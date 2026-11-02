// src/main.ts
// Open Crow — sohbet ve ajan arayüzü. Oturumlar IndexedDB'de, sağlayıcı bilgisi localStorage'da tutulur.

import './app.css';
import './detail.css';
import { initEffects } from './ui/effects';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ChatHistoryManager, type ChatMessage, type ChatSession, type ToolCall, type ToolStatus } from './core/ChatHistory';
import { fetchModels, streamChatCompletion, type ApiMessage, type ProviderConfig } from './agent/openai';
import { runAgentTurn, toApiMessage, type AgentEvents } from './agent/loop';
import { summarizeCall, type ApprovalMode, type ToolBackend } from './agent/tools';
import { CANONICAL_TOOL, allowRuleFor, formatRule, parseRule, rulesFromSettings, type PermissionRule } from './agent/permissions';
import { loadInstructions, renderInstructions, parseSkill, parseSlashCommand, matchCommands, type LoadedInstruction, type SkillDefinition } from './agent/instructions';
import { lastTurn, summarizeTurn, undoTurn } from './agent/checkpoints';
import { buildConversation, OUTPUT_STYLES, SUMMARY_REQUEST, type OutputStyle } from './agent/context';
import { allCommands, SHORTCUTS_HELP, type CommandDef } from './ui/commands';

const SETTINGS_KEY = 'kraga-ide-settings';
const MODEL_KEY = 'kraga:model';
const MODE_KEY = 'oc:mode';
const WORKSPACE_KEY = 'oc:lastWorkspace';
const STYLE_KEY = 'oc:style';
const INIT_PROMPT =
  'Bu proje için kök dizinde OPENCROW.md dosyası oluştur. Önce proje yapısını incele (README, paket dosyaları, ana kaynak klasörleri), sonra derleme ve test komutlarını, kod stilini ve önemli kuralları yaz. Kısa ve madde madde olsun. Dosyayı yazmadan önce içeriğini özetle.';

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
  commandPalette: $<HTMLDivElement>('commandPalette'),
  statusLine: $<HTMLDivElement>('statusLine'),
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

const MODE_ORDER: ApprovalMode[] = ['ask', 'edits', 'plan', 'auto'];
const MODE_LABEL: Record<ApprovalMode, string> = {
  ask: 'Her değişikliği sor',
  edits: 'Düzenlemeleri otomatik onayla',
  plan: 'Plan (yalnızca oku)',
  auto: 'Her şeyi otomatik onayla',
};

function approvalMode(): ApprovalMode {
  const saved = localStorage.getItem(MODE_KEY) as ApprovalMode | null;
  return saved && MODE_ORDER.includes(saved) ? saved : 'ask';
}

function setMode(mode: ApprovalMode): void {
  localStorage.setItem(MODE_KEY, mode);
  el.modeSelect.value = mode;
  updateStatusLine();
}

function cycleMode(): void {
  const next = MODE_ORDER[(MODE_ORDER.indexOf(approvalMode()) + 1) % MODE_ORDER.length];
  setMode(next);
  showNotice(`Onay modu: ${MODE_LABEL[next]}`);
}

// ---------- Bildirim şeridi ----------

function showNotice(text: string, kind: 'info' | 'error' = 'info', ms = 5000): void {
  // Hata mesajı en az 9 sn görünür kalır; kapatma (×, Escape) effects.ts içinde.
  const duration = kind === 'error' ? Math.max(ms, 9000) : ms;
  const tag = el.notice.querySelector<HTMLElement>('.notice-tag');
  const body = el.notice.querySelector<HTMLElement>('.notice-text');
  if (tag) tag.textContent = kind === 'error' ? 'Hata' : 'Bilgi';
  if (body) body.textContent = text;
  el.notice.dataset.kind = kind;
  el.notice.setAttribute('aria-live', kind === 'error' ? 'assertive' : 'polite');
  el.notice.hidden = false;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => {
    el.notice.hidden = true;
  }, duration);
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
  askApproval(call: ToolCall, args: Record<string, unknown>, onDecision: (approved: boolean) => void, onAlwaysAllow?: () => void): void;
  clearApproval(): void;
}

interface PreviewLine {
  sign: '+' | '-' | '';
  text: string;
}

function parseArgs(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

function previewLines(name: string, args: Record<string, unknown>): PreviewLine[] {
  if (name === 'edit_file') {
    return [
      ...String(args.old_string ?? '').split('\n').map((text): PreviewLine => ({ sign: '-', text })),
      ...String(args.new_string ?? '').split('\n').map((text): PreviewLine => ({ sign: '+', text })),
    ];
  }
  if (name === 'write_file') {
    return String(args.content ?? '').split('\n').map((text): PreviewLine => ({ sign: '', text }));
  }
  if (name === 'run_command') {
    return [{ sign: '', text: String(args.command ?? '') }];
  }
  return [];
}

function countLines(value: unknown): number {
  const text = String(value ?? '');
  return text === '' ? 0 : text.split('\n').length;
}

/** Onay kartındaki tek satırlık özet: ne kadar değişeceği. */
function approvalSummary(name: string, args: Record<string, unknown>): string {
  if (name === 'edit_file') {
    return `${countLines(args.old_string)} satır çıkarılacak, ${countLines(args.new_string)} satır eklenecek.`;
  }
  if (name === 'write_file') return `Dosya yazılacak: ${countLines(args.content)} satır.`;
  if (name === 'run_command') return 'Komut bu bilgisayarda çalıştırılacak.';
  return '';
}

function approvalPreview(name: string, args: Record<string, unknown>): HTMLPreElement {
  const pre = document.createElement('pre');
  pre.className = 'tool-preview';
  pre.tabIndex = 0;
  const lines = previewLines(name, args);
  for (const line of lines.slice(0, 60)) {
    const row = document.createElement('span');
    row.className = line.sign === '+' ? 'tool-line add' : line.sign === '-' ? 'tool-line del' : 'tool-line';
    // İşaret metinde de yer alır: renk kör ve ekran okuyucu kullanıcıları için de anlaşılır kalır
    row.textContent = line.sign ? `${line.sign} ${line.text}` : line.text;
    pre.appendChild(row);
  }
  if (lines.length > 60) {
    const more = document.createElement('span');
    more.className = 'tool-line tool-more';
    more.textContent = `… (${lines.length - 60} satır daha)`;
    pre.appendChild(more);
  }
  return pre;
}

function textLine(className: string, text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = text;
  p.title = text;
  return p;
}

function createToolCard(call: { id: string; name: string; arguments: string }): ToolCard {
  const args = parseArgs(call.arguments);
  const root = document.createElement('details');
  root.className = 'tool-card';
  root.dataset.status = 'running';

  const targetText = summarizeCall(call.name, args);
  const summary = document.createElement('summary');
  summary.className = 'tool-head';
  const label = document.createElement('span');
  label.className = 'tool-label';
  label.textContent = TOOL_LABELS[call.name] ?? call.name;
  const target = document.createElement('span');
  target.className = 'tool-target';
  target.textContent = targetText;
  target.title = targetText;
  const status = document.createElement('span');
  status.className = 'tool-status';
  status.textContent = STATUS_TEXT.running;
  summary.append(label, target, status);

  const approval = document.createElement('div');
  approval.className = 'tool-approval';
  approval.setAttribute('role', 'group');
  approval.tabIndex = -1;
  approval.hidden = true;

  const result = document.createElement('pre');
  result.className = 'tool-result';
  result.tabIndex = 0;
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
    clearApproval() {
      approval.hidden = true;
      approval.replaceChildren();
    },
    askApproval(c, a, onDecision, onAlwaysAllow) {
      approval.replaceChildren();
      approval.hidden = false;
      root.open = true;

      const isCommand = c.name === 'run_command';
      const question = isCommand ? 'Bu komutu çalıştırmama izin veriyor musun?' : 'Bu değişikliğe izin veriyor musun?';
      const questionEl = document.createElement('p');
      questionEl.className = 'approval-question';
      questionEl.textContent = question;

      const parts: HTMLElement[] = [questionEl, textLine('approval-where', `Klasör: ${workspace ?? '-'}`)];
      const file = isCommand ? '' : summarizeCall(c.name, a);
      if (file) parts.push(textLine('approval-where', `Dosya: ${file}`));
      const kind = approvalSummary(c.name, a);
      if (kind) parts.push(textLine('approval-kind', kind));

      const buttons = document.createElement('div');
      buttons.className = 'approval-actions';
      // Sıra tutarlı: Reddet solda (ikincil), İzin ver sağda (birincil)
      const deny = document.createElement('button');
      deny.type = 'button';
      deny.className = 'btn-ghost';
      deny.textContent = 'Reddet';
      const allow = document.createElement('button');
      allow.type = 'button';
      allow.className = 'btn-primary';
      allow.textContent = 'İzin ver';

      // Karar verilince kart başlığına odak döner; onDecision düğmeleri de temizler
      const decide = (approved: boolean) => {
        summary.focus();
        onDecision(approved);
      };
      deny.addEventListener('click', () => decide(false));
      allow.addEventListener('click', () => decide(true));
      const canRemember = onAlwaysAllow !== undefined && allowRuleFor(CANONICAL_TOOL[c.name] ?? c.name, a) !== null;
      if (canRemember) {
        const always = document.createElement('button');
        always.type = 'button';
        always.className = 'btn-ghost';
        always.textContent = 'Hep izin ver';
        always.title = 'Bu kalıp için kalıcı kural ekle; bir daha sorulmaz';
        always.addEventListener('click', () => {
          summary.focus();
          onAlwaysAllow?.();
        });
        buttons.append(deny, always, allow);
      } else {
        buttons.append(deny, allow);
      }

      parts.push(approvalPreview(c.name, a), buttons);
      approval.setAttribute('aria-label', question);
      approval.append(...parts);
      approval.focus();
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
    ? 'Bu klasörde dosya okuyabilir, düzenleyebilir ve komut çalıştırabilirim. Aşağıdan bir öneri seç ya da ne istediğini yaz.'
    : 'Dosyalarını okuyup düzenlemem için üst çubuktan bir çalışma klasörü seç.';
  el.emptyCopy.title = workspace ?? '';
}

function setWorkspace(path: string | null, persistGlobal = true): void {
  workspace = path;
  if (path) localStorage.setItem(WORKSPACE_KEY, path);
  updateWorkspaceUi();
  void refreshProjectContext().then(updateStatusLine);
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
  el.workspaceBtn.disabled = busy;
  syncSendButton();
}

/** Meşgulken durdur düğmesi her zaman etkin; boşta metin yoksa gönder devre dışı. */
function syncSendButton(): void {
  const busy = el.sendBtn.classList.contains('is-stop');
  el.sendBtn.disabled = !busy && el.input.value.trim() === '';
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
    checkpoint: msg.checkpoint,
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

  await refreshProjectContext();
  const conversation = buildConversation(session);
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
          card?.clearApproval();
          card?.setStatus(approved ? 'running' : 'denied');
          resolve(approved);
        };
        view.pendingApprovals.set(call.id, settle);
        const args = parseArgs(call.arguments);
        card?.askApproval(call, args, settle, () => {
          const rule = allowRuleFor(CANONICAL_TOOL[call.name] ?? call.name, args);
          if (rule) rememberAllow(rule);
          settle(true);
        });
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
        rules: activeRules(),
        systemExtra: buildSystemExtra(),
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

  // Sıraya alınmış mesajlar: durdurulduysa sıra temizlenir, aksi halde sırayla gönderilir
  if (controller.signal.aborted) {
    queued = [];
  }
  const next = queued.shift();

  updateStatusLine();
  await refreshSessionList();
  el.input.focus();
  if (next) void send(next);
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
    search: fail,
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
    search: (query, limit) => kragaAPI.web.search(query, limit),
  };
}

// ---------- Proje bağlamı: kurallar, talimatlar, beceriler, stil ----------

let rules: PermissionRule[] = [];
let sessionRules: PermissionRule[] = [];
let instructions: LoadedInstruction[] = [];
let skills: SkillDefinition[] = [];
let queued: string[] = [];

function pathSep(): string {
  return workspace && workspace.includes('\\') ? '\\' : '/';
}

/** Çalışma klasörü altında göreli bir yol kurar; ayırıcıyı klasörün kendi ayırıcısına uydurur. */
function workspacePath(...parts: string[]): string {
  const sep = pathSep();
  const relative = parts.join('/').split('/').filter(Boolean).join(sep);
  return `${workspace ?? ''}${sep}${relative}`;
}

function rulesKey(): string {
  return `oc:allow:${workspace ?? ''}`;
}

function loadSessionRules(): void {
  sessionRules = [];
  if (!workspace) return;
  try {
    const saved = JSON.parse(localStorage.getItem(rulesKey()) || '[]') as unknown;
    if (Array.isArray(saved)) {
      sessionRules = saved
        .filter((text): text is string => typeof text === 'string')
        .map((text) => parseRule(text, 'allow'))
        .filter((rule): rule is PermissionRule => rule !== null);
    }
  } catch {
    sessionRules = [];
  }
}

/** "Hep izin ver" seçimini kalıcı kural olarak kaydeder. */
function rememberAllow(rule: PermissionRule): void {
  sessionRules.push(rule);
  try {
    const saved = JSON.parse(localStorage.getItem(rulesKey()) || '[]') as string[];
    localStorage.setItem(rulesKey(), JSON.stringify([...saved, formatRule(rule)]));
  } catch {
    // Kalıcılık başarısızsa kural bu oturum boyunca geçerli kalır
  }
  showNotice(`Kalıcı izin kuralı eklendi: ${formatRule(rule)}`);
  updateStatusLine();
}

function activeRules(): PermissionRule[] {
  return [...rules, ...sessionRules];
}

async function loadSkills(kragaAPI: Api): Promise<SkillDefinition[]> {
  if (!workspace) return [];
  const dir = workspacePath('.opencrow', 'skills');
  let entries: { name: string; isDirectory: boolean }[];
  try {
    entries = await kragaAPI.fs.readDirectory(dir);
  } catch {
    return [];
  }
  const found: SkillDefinition[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory) continue;
    try {
      const source = await kragaAPI.fs.readFile(`${dir}${pathSep()}${entry.name}${pathSep()}SKILL.md`);
      found.push(parseSkill(source, entry.name));
    } catch {
      // SKILL.md yoksa bu klasör beceri değildir
    }
  }
  return found;
}

/** Kural, talimat ve beceri dosyalarını çalışma klasöründen yeniden okur. Her turdan önce çağrılır. */
async function refreshProjectContext(): Promise<void> {
  loadSessionRules();
  const kragaAPI = api();
  if (!kragaAPI || !workspace) {
    rules = [];
    instructions = [];
    skills = [];
    return;
  }
  const readText = async (...parts: string[]): Promise<string | null> => {
    try {
      return await kragaAPI.fs.readFile(workspacePath(...parts));
    } catch {
      return null;
    }
  };
  instructions = await loadInstructions((file) => readText(file));
  const settingsText = await readText('.opencrow', 'settings.json');
  let settings: unknown = null;
  try {
    settings = settingsText ? JSON.parse(settingsText) : null;
  } catch {
    settings = null;
  }
  rules = rulesFromSettings(settings);
  skills = await loadSkills(kragaAPI);
}

function outputStyle(): OutputStyle {
  const saved = localStorage.getItem(STYLE_KEY);
  return saved === 'concise' || saved === 'explanatory' ? saved : 'normal';
}

/** Sistem istemine eklenecek metin: proje talimatları, beceri listesi ve yanıt stili. */
function buildSystemExtra(): string {
  const parts: string[] = [];
  const instructionText = renderInstructions(instructions);
  if (instructionText) parts.push(instructionText);
  if (skills.length > 0) {
    parts.push(`Beceriler (kullanıcı /ad ile çağırabilir):\n${skills.map((s) => `- ${s.name}: ${s.description}`).join('\n')}`);
  }
  const style = OUTPUT_STYLES[outputStyle()];
  if (style) parts.push(style);
  return parts.join('\n\n');
}

function updateStatusLine(): void {
  const model = el.modelSelect.value || 'model yok';
  const messageCount = activeSession?.messages.length ?? 0;
  const folder = workspace ? folderName(workspace) : 'klasör yok';
  el.statusLine.textContent = `${model} · ${MODE_LABEL[approvalMode()]} · ${folder} · ${messageCount} mesaj · ${activeRules().length} kural`;
}

// ---------- Komutlar ----------

function lastAssistantText(): string {
  const messages = activeSession?.messages ?? [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].content.trim()) return messages[i].content;
  }
  return '';
}

function transcriptMarkdown(): string {
  const parts: string[] = [];
  for (const msg of activeSession?.messages ?? []) {
    if (msg.role === 'user') parts.push(`## Sen\n\n${msg.content}`);
    else if (msg.role === 'assistant' && msg.content.trim()) parts.push(`## Open Crow\n\n${msg.content}`);
  }
  return parts.join('\n\n');
}

async function copyText(text: string, done: string): Promise<void> {
  if (!text.trim()) {
    showNotice('Kopyalanacak içerik yok.');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showNotice(done);
  } catch {
    showNotice('Panoya kopyalanamadı.', 'error');
  }
}

async function showChanges(): Promise<void> {
  if (!activeSession) {
    showNotice('Henüz bir sohbet yok.');
    return;
  }
  const session = (await history.getSession(activeSession.id)) ?? activeSession;
  const changes = summarizeTurn(session.messages, lastTurn(session.messages));
  if (changes.length === 0) {
    showNotice('Son turda dosya değişikliği yok.');
    return;
  }
  const list = changes.map((c) => `${c.path} (${c.kind === 'created' ? 'yeni' : 'değişti'})`).join(' · ');
  showNotice(`Son turda ${changes.length} dosya: ${list}`, 'info', 12000);
}

/** Son turdaki dosya değişikliklerini denetim noktalarından geri alır. */
async function undoLastTurn(): Promise<void> {
  const kragaAPI = api();
  if (!activeSession || abortController) return;
  if (!kragaAPI) {
    showNotice('Geri alma yalnızca masaüstü uygulamasında çalışır.', 'error');
    return;
  }
  const session = (await history.getSession(activeSession.id)) ?? activeSession;
  const turn = lastTurn(session.messages);
  const pending = summarizeTurn(session.messages, turn);
  if (pending.length === 0) {
    showNotice('Geri alınacak dosya değişikliği yok.');
    return;
  }
  if (!window.confirm(`Son turdaki ${pending.length} dosya değişikliği geri alınsın mı?`)) return;
  try {
    const restored = await undoTurn(session.messages, turn, {
      write: async (path, content) => {
        await kragaAPI.fs.writeFile(path, content);
      },
      remove: async (path) => {
        await kragaAPI.fs.deletePath(path);
      },
    });
    await history.addMessage(session.id, { role: 'system', content: `Son tur geri alındı: ${restored.map((r) => r.path).join(', ')}` });
    showNotice(`${restored.length} dosya geri alındı.`);
  } catch (err) {
    showNotice(`Geri alma başarısız: ${err instanceof Error ? err.message : String(err)}`, 'error', 9000);
  }
  activeSession = (await history.getSession(session.id)) ?? null;
  renderTranscript(activeSession ?? null);
  updateStatusLine();
}

/** Konuşmayı modele özetletir; sonraki istekler özet + son mesajlarla gider. */
async function compactSession(): Promise<void> {
  if (!activeSession || abortController) return;
  if (!hasProvider()) {
    showNotice('Önce sağlayıcı ayarlarını tamamla.', 'error');
    return;
  }
  const model = el.modelSelect.value || localStorage.getItem(MODEL_KEY) || '';
  if (!model) {
    showNotice('Bir model seç.', 'error');
    return;
  }
  const session = (await history.getSession(activeSession.id)) ?? activeSession;
  if (session.messages.length < 4) {
    showNotice('Özetlenecek kadar mesaj yok.');
    return;
  }
  const controller = new AbortController();
  abortController = controller;
  setBusy(true);
  showNotice('Konuşma özetleniyor…', 'info', 60000);
  try {
    const messages: ApiMessage[] = [
      { role: 'system', content: 'Sen bir konuşma özetleyicisisin.' },
      ...buildConversation(session).map(toApiMessage),
      { role: 'user', content: SUMMARY_REQUEST },
    ];
    const result = await streamChatCompletion(readSettings(), { model, messages }, { signal: controller.signal });
    const summary = result.content.trim();
    if (!summary) throw new Error('Özet boş döndü.');
    await history.updateSession(session.id, { summary, summaryUpTo: session.messages.length });
    activeSession = (await history.getSession(session.id)) ?? null;
    showNotice(`Konuşma özetlendi (${session.messages.length} mesaj). Sonraki istekler özetle devam eder.`, 'info', 7000);
  } catch (err) {
    if (!controller.signal.aborted) {
      showNotice(err instanceof Error ? err.message : 'Özetleme başarısız.', 'error', 9000);
    }
  } finally {
    abortController = null;
    setBusy(false);
    updateStatusLine();
  }
}

function skillPrompt(skill: SkillDefinition, args: string): string {
  return `Beceri "${skill.name}" çağrıldı. Aşağıdaki yönergeleri uygula.\n\n${skill.body}${args ? `\n\nİstek: ${args}` : ''}`;
}

/** Slash komutunu çalıştırır. Bilinmeyen komut bildirim olarak gösterilir. */
async function runCommand(name: string, args: string): Promise<void> {
  const skill = skills.find((s) => s.name === name);
  if (skill) {
    await send(skillPrompt(skill, args));
    return;
  }
  switch (name) {
    case 'yeni':
    case 'temizle':
      startNewChat();
      return;
    case 'model': {
      if (!args) {
        el.modelSelect.focus();
        return;
      }
      const match = [...el.modelSelect.options].find(
        (o) => !o.disabled && (o.value === args || o.text.toLowerCase().includes(args.toLowerCase())),
      );
      if (!match) {
        showNotice(`Model bulunamadı: ${args}`, 'error');
        return;
      }
      el.modelSelect.value = match.value;
      localStorage.setItem(MODEL_KEY, match.value);
      updateStatusLine();
      showNotice(`Model: ${match.text}`);
      return;
    }
    case 'mod': {
      if (!args) {
        cycleMode();
        return;
      }
      if (!MODE_ORDER.includes(args as ApprovalMode)) {
        showNotice('Geçerli modlar: plan, ask, edits, auto', 'error');
        return;
      }
      setMode(args as ApprovalMode);
      showNotice(`Onay modu: ${MODE_LABEL[args as ApprovalMode]}`);
      return;
    }
    case 'stil': {
      if (!args) {
        showNotice(`Yanıt stili: ${outputStyle()} (normal, concise, explanatory)`);
        return;
      }
      if (!(args in OUTPUT_STYLES)) {
        showNotice('Geçerli stiller: normal, concise, explanatory', 'error');
        return;
      }
      localStorage.setItem(STYLE_KEY, args);
      showNotice(`Yanıt stili: ${args}`);
      return;
    }
    case 'klasor':
      await pickWorkspace();
      return;
    case 'init':
      await send(INIT_PROMPT);
      return;
    case 'bellek': {
      const files = instructions.map((i) => i.file).join(', ') || 'yok';
      showNotice(`Talimatlar: ${files} · İzin kuralları: ${rules.length} proje, ${sessionRules.length} kayıtlı`, 'info', 9000);
      return;
    }
    case 'beceriler': {
      const list = skills.map((s) => s.name).join(', ') || 'yok (.opencrow/skills/<ad>/SKILL.md)';
      showNotice(`Beceriler: ${list}`, 'info', 9000);
      return;
    }
    case 'ozet':
      await compactSession();
      return;
    case 'degisiklikler':
      await showChanges();
      return;
    case 'geri-al':
      await undoLastTurn();
      return;
    case 'kopyala':
      await copyText(lastAssistantText(), 'Son yanıt panoya kopyalandı.');
      return;
    case 'aktar':
      await copyText(transcriptMarkdown(), 'Sohbet panoya kopyalandı.');
      return;
    case 'yardim':
      showNotice(SHORTCUTS_HELP, 'info', 12000);
      return;
    default:
      showNotice(`Bilinmeyen komut: /${name}. Komutları görmek için / yaz.`, 'error');
  }
}

// ---------- Komut paleti ----------

let paletteItems: CommandDef[] = [];
let paletteIndex = 0;

/** Girdi yalnızca "/ad" biçimindeyse (boşluk yoksa) komut adını döndürür; değilse null. */
function paletteQuery(): string | null {
  const value = el.input.value;
  if (!value.startsWith('/') || /\s/.test(value)) return null;
  return value.slice(1);
}

function hidePalette(): void {
  el.commandPalette.hidden = true;
  paletteItems = [];
  paletteIndex = 0;
}

function renderPalette(): void {
  el.commandPalette.replaceChildren(
    ...paletteItems.map((item, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'palette-item';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(index === paletteIndex));
      row.classList.toggle('is-active', index === paletteIndex);
      const name = document.createElement('span');
      name.className = 'palette-name';
      name.textContent = `/${item.name}${item.argHint ? ` ${item.argHint}` : ''}`;
      const desc = document.createElement('span');
      desc.className = 'palette-desc';
      desc.textContent = item.description;
      row.append(name, desc);
      row.addEventListener('mousedown', (event) => {
        event.preventDefault();
        choosePalette(index);
      });
      return row;
    }),
  );
  el.commandPalette.querySelector<HTMLElement>('.is-active')?.scrollIntoView({ block: 'nearest' });
}

function refreshPalette(): void {
  const query = paletteQuery();
  if (query === null) {
    hidePalette();
    return;
  }
  paletteItems = matchCommands(query, allCommands(skills)).slice(0, 10);
  if (paletteItems.length === 0) {
    hidePalette();
    return;
  }
  paletteIndex = Math.min(paletteIndex, paletteItems.length - 1);
  el.commandPalette.hidden = false;
  renderPalette();
}

/** Seçilen komutu çalıştırır; argüman bekleyen komut metne eklenir. */
function choosePalette(index: number): void {
  const item = paletteItems[index];
  if (!item) return;
  if (item.argHint) {
    el.input.value = `/${item.name} `;
    autoResize();
    hidePalette();
    el.input.focus();
    return;
  }
  el.input.value = '';
  autoResize();
  hidePalette();
  void runCommand(item.name, '');
}

// ---------- Girdi alanı ----------

function autoResize(): void {
  el.input.style.height = 'auto';
  el.input.style.height = `${Math.min(el.input.scrollHeight, 220)}px`;
  syncSendButton();
}

el.input.addEventListener('input', () => {
  autoResize();
  paletteIndex = 0;
  refreshPalette();
});

el.input.addEventListener('keydown', (event) => {
  const paletteOpen = !el.commandPalette.hidden && paletteItems.length > 0;
  if (paletteOpen) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      paletteIndex = (paletteIndex + step + paletteItems.length) % paletteItems.length;
      renderPalette();
      return;
    }
    if ((event.key === 'Tab' && !event.shiftKey) || (event.key === 'Enter' && !event.shiftKey && !event.isComposing)) {
      event.preventDefault();
      choosePalette(paletteIndex);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      hidePalette();
      return;
    }
  }
  if (event.key === 'Tab' && event.shiftKey) {
    event.preventDefault();
    cycleMode();
    return;
  }
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    el.composer.requestSubmit();
  }
});

el.composer.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = el.input.value.trim();
  if (abortController) {
    // Meşgulken metin varsa sıraya al; düğmeyle gönderim yanıtı durdurur
    if (text && (event as SubmitEvent).submitter !== el.sendBtn) {
      queued.push(text);
      el.input.value = '';
      autoResize();
      showNotice(`Sıraya eklendi (${queued.length}). Yanıt bitince gönderilecek.`);
      return;
    }
    abortController.abort();
    return;
  }
  const command = text.startsWith('/') ? parseSlashCommand(text) : null;
  if (command) {
    el.input.value = '';
    autoResize();
    hidePalette();
    void runCommand(command.name, command.args);
    return;
  }
  void send(el.input.value);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && abortController && el.settingsOverlay.hidden && el.commandPalette.hidden) {
    abortController.abort();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n' && !abortController) {
    event.preventDefault();
    startNewChat();
  }
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
  updateStatusLine();
});

el.modeSelect.value = approvalMode();
el.modeSelect.addEventListener('change', () => {
  setMode(el.modeSelect.value as ApprovalMode);
});

el.workspaceBtn.addEventListener('click', () => void pickWorkspace());
$<HTMLButtonElement>('btnNewChat').addEventListener('click', startNewChat);

// ---------- Ayarlar penceresi ----------

const btnOpenSettings = $<HTMLButtonElement>('btnOpenSettings');
let settingsReturnFocus: HTMLElement | null = null;
let backdropPressed = false;

const MODAL_FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function openSettings(): void {
  const settings = readSettings();
  el.setBaseUrl.value = settings.baseUrl;
  el.setApiKey.value = settings.apiKey;
  el.settingsStatus.textContent = '';
  el.settingsStatus.dataset.kind = '';
  settingsReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  el.settingsOverlay.hidden = false;
  window.setTimeout(() => el.setBaseUrl.focus(), 0);
}

function closeSettings(): void {
  if (el.settingsOverlay.hidden) return;
  el.settingsOverlay.hidden = true;
  const back = settingsReturnFocus ?? btnOpenSettings;
  settingsReturnFocus = null;
  back.focus();
}

/** Sekme tuşu modal dışına çıkmaz: ilk ve son odaklanabilir öğe arasında döner. */
function trapTab(event: KeyboardEvent): void {
  const items = Array.from(el.settingsOverlay.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE));
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = active instanceof HTMLElement && el.settingsOverlay.contains(active);

  if (!inside) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  } else if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

$<HTMLButtonElement>('btnCloseSettings').addEventListener('click', closeSettings);
btnOpenSettings.addEventListener('click', openSettings);

// Arka plan tıklaması yalnızca basış da arka planda başladıysa kapatır;
// metin seçerken alandan dışarı sürüklemek pencereyi kapatmaz.
el.settingsOverlay.addEventListener('pointerdown', (event) => {
  backdropPressed = event.target === el.settingsOverlay;
});
el.settingsOverlay.addEventListener('click', (event) => {
  if (backdropPressed && event.target === el.settingsOverlay) closeSettings();
  backdropPressed = false;
});
window.addEventListener('keydown', (event) => {
  if (el.settingsOverlay.hidden) return;
  if (event.key === 'Escape') {
    closeSettings();
  } else if (event.key === 'Tab') {
    trapTab(event);
  }
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
  await refreshProjectContext();
  updateStatusLine();
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
