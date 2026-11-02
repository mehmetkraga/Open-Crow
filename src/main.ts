// src/main.ts
// Open Crow — sohbet ve ajan arayüzü. Oturumlar IndexedDB'de, sağlayıcı bilgisi localStorage'da tutulur.

import './app.css';
import './detail.css';
import { initEffects } from './ui/effects';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ChatHistoryManager, type ChatMessage, type ChatSession, type ToolCall, type ToolStatus } from './core/ChatHistory';
import { fetchModels, type ProviderConfig } from './agent/openai';
import { runAgentTurn, type AgentEvents } from './agent/loop';
import { summarizeCall, type ApprovalMode, type ToolBackend } from './agent/tools';

const SETTINGS_KEY = 'kraga-ide-settings';
const MODEL_KEY = 'kraga:model';
const MODE_KEY = 'oc:mode';
const WORKSPACE_KEY = 'oc:lastWorkspace';

const history = new ChatHistoryManager();

const $ = <T extends Element>(id: string) => document.getElementById(id) as unknown as T;

const el = {
  sessionList: $<HTMLDivElement>('sessionList'),
  chatTitle: $<HTMLHeadingElement>('chatTitle'),
  workspaceBtn: $<HTMLButtonElement>('workspaceBtn'),
  workspaceName: $<HTMLSpanElement>('workspaceName'),
  modeSelect: $<HTMLSelectElement>('modeSelect'),
  modelSelect: $<HTMLSelectElement>('modelSelect'),
  messages: $<HTMLDivElement>('messages'),
  emptyState: $<HTMLDivElement>('emptyState'),
  emptyTitle: $<HTMLHeadingElement>('emptyTitle'),
  emptyCopy: $<HTMLParagraphElement>('emptyCopy'),
  notice: $<HTMLDivElement>('notice'),
  composer: $<HTMLFormElement>('composer'),
  input: $<HTMLTextAreaElement>('input'),
  sendBtn: $<HTMLButtonElement>('sendBtn'),
  iconSend: $<SVGElement>('iconSend'),
  iconStop: $<SVGElement>('iconStop'),
  settingsOverlay: $<HTMLDivElement>('settingsOverlay'),
  settingsForm: $<HTMLFormElement>('settingsForm'),
  setBaseUrl: $<HTMLInputElement>('setBaseUrl'),
  setApiKey: $<HTMLInputElement>('setApiKey'),
  settingsStatus: $<HTMLDivElement>('settingsStatus'),
};

type Api = NonNullable<Window['kragaAPI']>;

const api = (): Api | undefined => (window as unknown as { kragaAPI?: Api }).kragaAPI;

let activeSession: ChatSession | null = null;
let workspace: string | null = localStorage.getItem(WORKSPACE_KEY);
let abortController: AbortController | null = null;
let noticeTimer: number | undefined;

// ---------- Sağlayıcı ayarları ----------

function readSettings(): ProviderConfig {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (parsed && parsed.mode === 'custom') {
      return { baseUrl: parsed.baseUrl || '', apiKey: parsed.apiKey || '' };
    }
  } catch {
    // Bozuk kayıt: boş ayar say
  }
  return { baseUrl: '', apiKey: '' };
}

function writeSettings(config: ProviderConfig): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ mode: 'custom', baseUrl: config.baseUrl, apiKey: config.apiKey }));
}

function hasProvider(): boolean {
  return Boolean(readSettings().baseUrl);
}

function approvalMode(): ApprovalMode {
  const saved = localStorage.getItem(MODE_KEY);
  return saved === 'edits' || saved === 'auto' ? saved : 'ask';
}

// ---------- Bildirim şeridi ----------

function showNotice(text: string, kind: 'info' | 'error' = 'info', ms = 5000): void {
  el.notice.textContent = text;
  el.notice.dataset.kind = kind;
  el.notice.hidden = false;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    el.notice.hidden = true;
  }, ms);
}

// ---------- Markdown ----------

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(text: string): string {
  const raw = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

/** Kod bloğu: üstte dil etiketi + kopyala düğmesi şeridi, altında kaydırılabilir kod. */
function decorateCodeBlocks(container: HTMLElement): void {
  container.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode?.insertBefore(wrap, pre);

    const head = document.createElement('div');
    head.className = 'code-head';
    const label = document.createElement('span');
    label.className = 'code-lang';
    label.textContent = pre.querySelector('code')?.className.match(/language-([\w-]+)/)?.[1] ?? '';
    head.appendChild(label);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'code-copy';
    copy.textContent = 'Kopyala';
    let resetTimer = 0;
    copy.addEventListener('click', async () => {
      window.clearTimeout(resetTimer);
      copy.classList.remove('is-copied', 'is-failed');
      try {
        await navigator.clipboard.writeText(pre.innerText);
        copy.textContent = 'Kopyalandı';
        copy.classList.add('is-copied');
      } catch {
        copy.textContent = 'Kopyalanamadı';
        copy.classList.add('is-failed');
      }
      resetTimer = window.setTimeout(() => {
        copy.textContent = 'Kopyala';
        copy.classList.remove('is-copied', 'is-failed');
      }, 1500);
    });
    head.appendChild(copy);

    wrap.append(head, pre);
  });
}

// ---------- Mesaj görünümü ----------

function isNearBottom(): boolean {
  const { scrollTop, scrollHeight, clientHeight } = el.messages;
  return scrollHeight - scrollTop - clientHeight < 120;
}

function scrollToBottom(force = false): void {
  if (force || isNearBottom()) {
    el.messages.scrollTop = el.messages.scrollHeight;
  }
}

function setEmptyVisible(visible: boolean): void {
  el.emptyState.hidden = !visible;
}

function createMessageNode(role: 'user' | 'assistant'): { root: HTMLDivElement; body: HTMLDivElement } {
  const root = document.createElement('div');
  root.className = `msg msg-${role}`;
  const body = document.createElement('div');
  body.className = 'msg-body';
  root.appendChild(body);
  el.messages.appendChild(root);
  return { root, body };
}

function renderUserMessage(text: string): void {
  const { body } = createMessageNode('user');
  body.textContent = text;
}

function createTypingIndicator(): HTMLDivElement {
  const dots = document.createElement('div');
  dots.className = 'typing';
  dots.innerHTML = '<span></span><span></span><span></span>';
  return dots;
}

// ---------- Araç kartları ----------

const TOOL_LABELS: Record<string, string> = {
  list_dir: 'Klasör listesi',
  read_file: 'Dosya okuma',
  write_file: 'Dosya yazma',
  edit_file: 'Dosya düzenleme',
  grep: 'Metin arama',
  glob: 'Dosya arama',
  run_command: 'Komut',
  web_fetch: 'Web sayfası',
};

const STATUS_TEXT: Record<CardStatus, string> = {
  running: 'Çalışıyor',
  approval: 'Onay bekliyor',
  done: 'Tamamlandı',
  error: 'Hata',
  denied: 'Reddedildi',
  cancelled: 'Durduruldu',
};

type CardStatus = 'running' | 'approval' | ToolStatus;

interface ToolCard {
  root: HTMLDetailsElement;
  setStatus(status: CardStatus): void;
  setResult(text: string): void;
  askApproval(call: ToolCall, args: Record<string, unknown>, onDecision: (approved: boolean) => void): void;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function approvalPreview(name: string, args: Record<string, unknown>): HTMLPreElement {
  const pre = document.createElement('pre');
  pre.className = 'tool-preview';
  const lines: string[] = [];
  if (name === 'edit_file') {
    const oldLines = String(args.old_string ?? '').split('\n').map((l) => `- ${l}`);
    const newLines = String(args.new_string ?? '').split('\n').map((l) => `+ ${l}`);
    lines.push(...oldLines, ...newLines);
  } else if (name === 'write_file') {
    lines.push(...String(args.content ?? '').split('\n'));
  } else if (name === 'run_command') {
    lines.push(String(args.command ?? ''));
  }
  const limited = lines.slice(0, 60);
  if (lines.length > 60) limited.push(`… (${lines.length - 60} satır daha)`);
  for (const line of limited) {
    const span = document.createElement('span');
    span.className = line.startsWith('+ ') ? 'add' : line.startsWith('- ') ? 'del' : '';
    span.textContent = `${line}\n`;
    pre.appendChild(span);
  }
  return pre;
}

function createToolCard(call: { id: string; name: string; arguments: string }): ToolCard {
  const args = parseArgs(call.arguments);
  const root = document.createElement('details');
  root.className = 'tool-card';
  root.dataset.status = 'running';

  const summary = document.createElement('summary');
  summary.className = 'tool-head';
  const label = document.createElement('span');
  label.className = 'tool-label';
  label.textContent = TOOL_LABELS[call.name] ?? call.name;
  const target = document.createElement('span');
  target.className = 'tool-target';
  target.textContent = summarizeCall(call.name, args);
  const status = document.createElement('span');
  status.className = 'tool-status';
  status.textContent = STATUS_TEXT.running;
  summary.append(label, target, status);

  const approval = document.createElement('div');
  approval.className = 'tool-approval';
  approval.hidden = true;

  const result = document.createElement('pre');
  result.className = 'tool-result';
  result.hidden = true;

  root.append(summary, approval, result);

  const setStatus = (value: CardStatus) => {
    root.dataset.status = value;
    status.textContent = STATUS_TEXT[value];
    if (value === 'approval') root.open = true;
  };

  return {
    root,
    setStatus,
    setResult(text: string) {
      result.textContent = text;
      result.hidden = !text;
    },
    askApproval(c, a, onDecision) {
      approval.replaceChildren();
      approval.hidden = false;
      root.open = true;

      const question = document.createElement('p');
      question.className = 'approval-question';
      question.textContent = c.name === 'run_command' ? 'Bu komutu çalıştırmama izin veriyor musun?' : 'Bu değişikliğe izin veriyor musun?';
      const where = document.createElement('p');
      where.className = 'approval-where';
      where.textContent = `Klasör: ${workspace ?? '-'}`;

      const buttons = document.createElement('div');
      buttons.className = 'approval-actions';
      const deny = document.createElement('button');
      deny.type = 'button';
      deny.className = 'btn-ghost';
      deny.textContent = 'Reddet';
      const allow = document.createElement('button');
      allow.type = 'button';
      allow.className = 'btn-primary';
      allow.textContent = 'İzin ver';

      const decide = (approved: boolean) => {
        approval.hidden = true;
        onDecision(approved);
      };
      deny.addEventListener('click', () => decide(false));
      allow.addEventListener('click', () => decide(true));
      buttons.append(deny, allow);

      approval.append(question, where, approvalPreview(c.name, a), buttons);
    },
  };
}

/** Kalıcı bir asistan mesajını (metin + araç kartları) ekrana basar. */
function renderAssistantNode(msg: ChatMessage, results: Map<string, ChatMessage>): void {
  const { root, body } = createMessageNode('assistant');
  if (msg.content) {
    body.innerHTML = renderMarkdown(msg.content);
    decorateCodeBlocks(body);
  }
  for (const call of msg.toolCalls ?? []) {
    const card = createToolCard(call);
    const stored = results.get(call.id);
    if (stored) {
      card.setStatus(stored.toolStatus ?? 'done');
      card.setResult(stored.content);
    } else {
      card.setStatus('cancelled');
    }
    root.appendChild(card.root);
  }
}

function renderTranscript(session: ChatSession | null): void {
  el.messages.querySelectorAll('.msg').forEach((node) => node.remove());
  if (!session || session.messages.length === 0) {
    setEmptyVisible(true);
    return;
  }
  setEmptyVisible(false);

  const results = new Map<string, ChatMessage>();
  for (const msg of session.messages) {
    if (msg.role === 'tool' && msg.toolCallId) results.set(msg.toolCallId, msg);
  }
  for (const msg of session.messages) {
    if (msg.role === 'user') renderUserMessage(msg.content);
    else if (msg.role === 'assistant') renderAssistantNode(msg, results);
  }
  scrollToBottom(true);
}

// ---------- Oturum listesi ----------

async function refreshSessionList(): Promise<void> {
  const sessions = (await history.getAllSessions()).sort((a, b) => b.updatedAt - a.updatedAt);
  el.sessionList.replaceChildren();

  if (sessions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'session-empty';
    empty.textContent = 'Henüz sohbet yok';
    const hint = document.createElement('span');
    hint.className = 'session-empty-hint';
    hint.textContent = 'Yeni sohbet başlattığında burada görünür.';
    empty.appendChild(hint);
    el.sessionList.appendChild(empty);
    return;
  }

  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const groups: { label: string; items: ChatSession[] }[] = [
    { label: 'Bugün', items: sessions.filter((s) => s.updatedAt >= startOfToday) },
    { label: 'Daha önce', items: sessions.filter((s) => s.updatedAt < startOfToday) },
  ];

  for (const group of groups) {
    if (group.items.length === 0) continue;
    const heading = document.createElement('div');
    heading.className = 'session-group-label';
    heading.textContent = group.label;
    el.sessionList.appendChild(heading);
    for (const session of group.items) {
      el.sessionList.appendChild(createSessionItem(session));
    }
  }
}

function createSessionItem(session: ChatSession): HTMLElement {
  const row = document.createElement('div');
  row.className = 'session-item';
  row.dataset.id = session.id;
  if (activeSession?.id === session.id) row.classList.add('is-active');

  const title = document.createElement('button');
  title.type = 'button';
  title.className = 'session-title';
  const label = session.title || 'Yeni sohbet';
  title.textContent = label;
  // Kesilen başlık tam metniyle ipucunda görünsün; çalışma klasörü ikinci satırda.
  title.title = session.workspace ? `${label}\n${session.workspace}` : label;
  title.addEventListener('click', () => void openSession(session.id));

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'session-delete';
  remove.title = 'Sohbeti sil';
  remove.setAttribute('aria-label', `${label} sohbetini sil`);
  remove.textContent = '×';
  remove.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (abortController) return;
    if (!window.confirm('Bu sohbet bu bilgisayardan silinsin mi?')) return;
    await history.deleteSession(session.id);
    if (activeSession?.id === session.id) {
      activeSession = null;
      el.chatTitle.textContent = 'Yeni sohbet';
      renderTranscript(null);
    }
    await refreshSessionList();
  });

  row.append(title, remove);
  return row;
}

async function openSession(id: string): Promise<void> {
  if (abortController) return;
  const session = await history.getSession(id);
  if (!session) return;
  activeSession = session;
  if (session.workspace) setWorkspace(session.workspace, false);
  el.chatTitle.textContent = session.title || 'Yeni sohbet';
  renderTranscript(session);
  await refreshSessionList();
  el.input.focus();
}

function startNewChat(): void {
  if (abortController) return;
  activeSession = null;
  el.chatTitle.textContent = 'Yeni sohbet';
  renderTranscript(null);
  void refreshSessionList();
  el.input.focus();
}

// ---------- Çalışma klasörü ve mod ----------

function folderName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function updateWorkspaceUi(): void {
  el.workspaceName.textContent = workspace ? folderName(workspace) : 'Klasör seç';
  el.workspaceBtn.title = workspace ?? 'Çalışma klasörü seç';
  el.emptyTitle.textContent = workspace ? folderName(workspace) : 'Çalışma klasörü seçilmedi';
  el.emptyCopy.textContent = workspace
    ? `${workspace} içinde dosya okuyabilir, düzenleyebilir ve komut çalıştırabilirim.`
    : 'Dosyaları okuyup düzenlemem için önce üst çubuktan bir çalışma klasörü seç.';
}

function setWorkspace(path: string | null, persistGlobal = true): void {
  workspace = path;
  if (path) localStorage.setItem(WORKSPACE_KEY, path);
  updateWorkspaceUi();
  if (persistGlobal && activeSession && activeSession.workspace !== path) {
    activeSession.workspace = path ?? undefined;
    void history.updateSession(activeSession.id, { workspace: path ?? undefined });
  }
}

async function pickWorkspace(): Promise<void> {
  const kragaAPI = api();
  if (!kragaAPI) {
    showNotice('Klasör seçimi yalnızca masaüstü uygulamasında çalışır.', 'error');
    return;
  }
  if (abortController) return;
  const picked = await kragaAPI.fs.openFolder();
  if (picked) setWorkspace(picked);
}

// ---------- Model seçimi ----------

function setModelOptions(models: { id: string; name: string }[]): void {
  const saved = localStorage.getItem(MODEL_KEY) || '';
  el.modelSelect.replaceChildren();

  if (models.length === 0) {
    // Devre dışı seçenek tarayıcıda boş görünüyordu; etkin ve boş değerli tutulur
    el.modelSelect.add(new Option('Model yok', ''));
    el.modelSelect.value = '';
    localStorage.removeItem(MODEL_KEY);
    return;
  }

  for (const model of models) {
    el.modelSelect.add(new Option(model.name || model.id, model.id));
  }
  const pick = models.some((m) => m.id === saved) ? saved : models[0].id;
  el.modelSelect.value = pick;
  localStorage.setItem(MODEL_KEY, pick);
}

async function loadModels(): Promise<void> {
  if (!hasProvider()) {
    setModelOptions([]);
    return;
  }
  try {
    const models = await fetchModels(readSettings());
    setModelOptions(models);
    el.settingsStatus.dataset.kind = 'ok';
    el.settingsStatus.textContent = `${models.length} model bulundu.`;
  } catch (err) {
    setModelOptions([]);
    el.settingsStatus.dataset.kind = 'error';
    el.settingsStatus.textContent = err instanceof Error ? err.message : 'Modeller alınamadı.';
  }
}

// ---------- Gönderim ve ajan turu ----------

function setBusy(busy: boolean): void {
  el.sendBtn.classList.toggle('is-stop', busy);
  el.sendBtn.title = busy ? 'Durdur' : 'Gönder';
  el.sendBtn.setAttribute('aria-label', busy ? 'Durdur' : 'Gönder');
  el.iconSend.toggleAttribute('hidden', busy);
  el.iconStop.toggleAttribute('hidden', !busy);
  el.input.disabled = busy;
  el.workspaceBtn.disabled = busy;
}

interface TurnView {
  /** Açık asistan düğümü (akış sürüyorsa) */
  current: { root: HTMLDivElement; body: HTMLDivElement; streamText: HTMLDivElement | null } | null;
  /** Son kapanan asistan düğümü; araç kartları buraya eklenir */
  lastRoot: HTMLDivElement | null;
  cards: Map<string, ToolCard>;
  pendingApprovals: Map<string, (approved: boolean) => void>;
}

function ensureCurrent(view: TurnView) {
  if (!view.current) {
    const { root, body } = createMessageNode('assistant');
    body.appendChild(createTypingIndicator());
    view.current = { root, body, streamText: null };
  }
  return view.current;
}

function storedFields(msg: ChatMessage) {
  return {
    role: msg.role,
    content: msg.content,
    model: msg.model,
    toolCalls: msg.toolCalls,
    toolCallId: msg.toolCallId,
    toolName: msg.toolName,
    toolStatus: msg.toolStatus,
  };
}

function cardFor(view: TurnView, id: string, name: string): ToolCard {
  let card = view.cards.get(id);
  if (!card) {
    card = createToolCard({ id, name, arguments: '{}' });
    view.cards.set(id, card);
    (view.lastRoot ?? ensureCurrent(view).root).appendChild(card.root);
  }
  return card;
}

async function send(rawText: string): Promise<void> {
  const text = rawText.trim();
  if (!text || abortController) return;

  if (!hasProvider()) {
    showNotice('Önce Ayarlar bölümünden API adresini ve anahtarını gir.', 'error', 6000);
    openSettings();
    return;
  }
  const model = el.modelSelect.value || localStorage.getItem(MODEL_KEY) || '';
  if (!model) {
    showNotice('Bir model seç. Model listesi boşsa ayarlardan bağlantıyı kontrol et.', 'error', 6000);
    return;
  }

  el.input.value = '';
  autoResize();

  if (!activeSession) {
    activeSession = await history.createSession();
    if (workspace) {
      activeSession.workspace = workspace;
      await history.updateSession(activeSession.id, { workspace });
    }
  }
  const isFirstMessage = (await history.getSession(activeSession.id))?.messages.length === 0;
  if (isFirstMessage) {
    await history.autoTitle(activeSession.id, text);
  }
  await history.addMessage(activeSession.id, { role: 'user', content: text });
  const session = (await history.getSession(activeSession.id))!;
  activeSession = session;
  if (workspace && session.workspace !== workspace) {
    // Mevcut bir oturumun klasörü değiştiyse yeniden açıldığında doğru klasör gelsin
    session.workspace = workspace;
    await history.updateSession(session.id, { workspace });
  }
  el.chatTitle.textContent = session.title || 'Yeni sohbet';
  setEmptyVisible(false);
  renderUserMessage(text);
  scrollToBottom(true);

  const conversation = session.messages;
  const kragaAPI = api();
  const controller = new AbortController();
  abortController = controller;
  setBusy(true);

  const view: TurnView = { current: null, lastRoot: null, cards: new Map(), pendingApprovals: new Map() };

  const events: AgentEvents = {
    onText(delta) {
      const node = ensureCurrent(view);
      if (!node.streamText) {
        node.body.replaceChildren();
        node.streamText = document.createElement('div');
        node.streamText.className = 'stream-text is-streaming';
        node.body.appendChild(node.streamText);
      }
      node.streamText.textContent += delta;
      scrollToBottom();
    },

    async onAssistant(msg) {
      const node = ensureCurrent(view);
      // İmleç, kayıt beklenirken de yanıp durmasın: yanıt tamamlandı
      node.streamText?.classList.remove('is-streaming');
      const stored = await history.addMessage(session.id, storedFields(msg));
      view.current = null;
      if (!stored.content && !stored.toolCalls?.length) {
        // Boş adım: görünmeyen bir kutu bırakma
        node.root.remove();
        return;
      }
      node.body.replaceChildren();
      if (stored.content) {
        node.body.innerHTML = renderMarkdown(stored.content);
        decorateCodeBlocks(node.body);
      }
      view.lastRoot = node.root;
      scrollToBottom();
    },

    onToolStart(call, needsApproval) {
      const card = cardFor(view, call.id, call.name);
      card.setStatus(needsApproval ? 'approval' : 'running');
      scrollToBottom();
    },

    requestApproval(call) {
      const card = view.cards.get(call.id);
      return new Promise<boolean>((resolve) => {
        const settle = (approved: boolean) => {
          view.pendingApprovals.delete(call.id);
          card?.setStatus(approved ? 'running' : 'denied');
          resolve(approved);
        };
        view.pendingApprovals.set(call.id, settle);
        card?.askApproval(call, parseArgs(call.arguments), settle);
        scrollToBottom();
      });
    },

    async onToolResult(msg) {
      const stored = await history.addMessage(session.id, storedFields(msg));
      const card = cardFor(view, stored.toolCallId ?? '', stored.toolName ?? '');
      card.setStatus(stored.toolStatus ?? 'done');
      card.setResult(stored.content);
      scrollToBottom();
    },
  };

  let failure: string | null = null;
  try {
    await runAgentTurn(
      conversation,
      events,
      {
        config: readSettings(),
        model,
        workspace: workspace ?? undefined,
        mode: approvalMode(),
        backend: kragaAPI ? makeBackend(kragaAPI) : offlineBackend(),
        signal: controller.signal,
      },
    );
  } catch (err) {
    if (!controller.signal.aborted) {
      failure = err instanceof Error ? err.message : String(err);
    }
  } finally {
    for (const settle of view.pendingApprovals.values()) settle(false);
    view.pendingApprovals.clear();
    abortController = null;
    setBusy(false);

    // Yarım kalan yanıt: ekranda görünen metin kalıcı olsun ki yenilemede kaybolmasın
    if (view.current) {
      const partial = view.current.streamText?.textContent ?? '';
      const node = view.current;
      view.current = null;
      if (partial.trim()) {
        const stored = await history.addMessage(session.id, { role: 'assistant', content: partial, model });
        node.body.innerHTML = renderMarkdown(stored.content);
        decorateCodeBlocks(node.body);
        node.root.classList.toggle('is-stopped', controller.signal.aborted);
      } else {
        node.root.remove();
      }
    }
  }

  if (controller.signal.aborted) {
    showNotice('Çalışma durduruldu.', 'info');
  } else if (failure) {
    showNotice(failure, 'error', 9000);
  }

  await refreshSessionList();
  el.input.focus();
}

function offlineBackend(): ToolBackend {
  const fail = async (): Promise<never> => {
    throw new Error('Araçlar yalnızca masaüstü uygulamasında çalışır.');
  };
  return {
    readDirectory: fail,
    readFile: fail,
    writeFile: fail,
    grep: fail,
    glob: fail,
    runCommand: fail,
    fetchUrl: fail,
  };
}

function makeBackend(kragaAPI: Api): ToolBackend {
  return {
    readDirectory: (dirPath) => kragaAPI.fs.readDirectory(dirPath),
    readFile: (filePath) => kragaAPI.fs.readFile(filePath),
    writeFile: (filePath, content) => kragaAPI.fs.writeFile(filePath, content),
    grep: (root, pattern, opts) => kragaAPI.workspace.grep(root, pattern, opts),
    glob: (root, pattern, limit) => kragaAPI.workspace.glob(root, pattern, limit),
    runCommand: (command, cwd) => kragaAPI.terminal.runCommand(command, cwd),
    fetchUrl: (url, maxChars) => kragaAPI.web.fetch(url, maxChars),
  };
}

// ---------- Girdi alanı ----------

function autoResize(): void {
  el.input.style.height = 'auto';
  el.input.style.height = `${Math.min(el.input.scrollHeight, 220)}px`;
}

el.input.addEventListener('input', autoResize);
el.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    el.composer.requestSubmit();
  }
});

el.composer.addEventListener('submit', (event) => {
  event.preventDefault();
  if (abortController) {
    abortController.abort();
    return;
  }
  void send(el.input.value);
});

document.querySelectorAll<HTMLButtonElement>('.suggestion').forEach((button) => {
  button.addEventListener('click', () => {
    el.input.value = button.dataset.prompt || '';
    autoResize();
    el.input.focus();
  });
});

el.modelSelect.addEventListener('change', () => {
  localStorage.setItem(MODEL_KEY, el.modelSelect.value);
});

el.modeSelect.value = approvalMode();
el.modeSelect.addEventListener('change', () => {
  localStorage.setItem(MODE_KEY, el.modeSelect.value);
});

el.workspaceBtn.addEventListener('click', () => void pickWorkspace());
$<HTMLButtonElement>('btnNewChat').addEventListener('click', startNewChat);

// ---------- Ayarlar penceresi ----------

function openSettings(): void {
  const settings = readSettings();
  el.setBaseUrl.value = settings.baseUrl;
  el.setApiKey.value = settings.apiKey;
  el.settingsStatus.textContent = '';
  el.settingsOverlay.hidden = false;
  window.setTimeout(() => el.setBaseUrl.focus(), 0);
}

function closeSettings(): void {
  el.settingsOverlay.hidden = true;
}

$<HTMLButtonElement>('btnOpenSettings').addEventListener('click', openSettings);
$<HTMLButtonElement>('btnCloseSettings').addEventListener('click', closeSettings);
el.settingsOverlay.addEventListener('click', (event) => {
  if (event.target === el.settingsOverlay) closeSettings();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !el.settingsOverlay.hidden) closeSettings();
});

el.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  let baseUrl = el.setBaseUrl.value.trim();
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    el.settingsStatus.dataset.kind = 'error';
    el.settingsStatus.textContent = 'API adresi http:// veya https:// ile başlamalı.';
    return;
  }
  baseUrl = baseUrl.replace(/\/+$/, '');
  writeSettings({ baseUrl, apiKey: el.setApiKey.value.trim() });
  el.settingsStatus.dataset.kind = '';
  el.settingsStatus.textContent = 'Kaydedildi. Modeller alınıyor…';
  await loadModels();
});

$<HTMLButtonElement>('btnClearSettings').addEventListener('click', () => {
  if (!window.confirm('Kayıtlı API adresi ve anahtar silinsin mi?')) return;
  localStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(MODEL_KEY);
  el.setBaseUrl.value = '';
  el.setApiKey.value = '';
  el.settingsStatus.dataset.kind = '';
  el.settingsStatus.textContent = 'Bilgiler silindi.';
  setModelOptions([]);
});

// ---------- Pencere kontrolleri ----------

$<HTMLButtonElement>('btnMinimize').addEventListener('click', () => api()?.app.minimize());
$<HTMLButtonElement>('btnMaximize').addEventListener('click', () => api()?.app.maximize());
$<HTMLButtonElement>('btnClose').addEventListener('click', () => api()?.app.close());

// ---------- Başlangıç ----------

async function init(): Promise<void> {
  updateWorkspaceUi();
  await refreshSessionList();
  renderTranscript(null);
  await loadModels();
  if (!hasProvider()) {
    showNotice('Hoş geldin. Başlamak için Ayarlar bölümünden API adresini ve anahtarını gir.', 'info', 9000);
  }
  el.input.focus();
}

initEffects();
void init();
