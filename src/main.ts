// src/main.ts
// Open Crow — sohbet arayüzü. Oturumlar IndexedDB'de, sağlayıcı bilgisi localStorage'da tutulur.

import './app.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { sendAgentStream, fetchAvailableModels } from './core/proxyClient';
import { ChatHistoryManager, type ChatSession } from './core/ChatHistory';

const SETTINGS_KEY = 'kraga-ide-settings';
const MODEL_KEY = 'kraga:model';

const history = new ChatHistoryManager();

const $ = <T extends Element>(id: string) => document.getElementById(id) as unknown as T;

const el = {
  sessionList: $<HTMLDivElement>('sessionList'),
  chatTitle: $<HTMLHeadingElement>('chatTitle'),
  modelSelect: $<HTMLSelectElement>('modelSelect'),
  messages: $<HTMLDivElement>('messages'),
  emptyState: $<HTMLDivElement>('emptyState'),
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

let activeSession: ChatSession | null = null;
let abortController: AbortController | null = null;
let noticeTimer: number | undefined;

// ---------- Sağlayıcı ayarları ----------

interface ProviderSettings {
  mode: 'custom';
  baseUrl: string;
  apiKey: string;
}

function readSettings(): ProviderSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (parsed && parsed.mode === 'custom') {
      return { mode: 'custom', baseUrl: parsed.baseUrl || '', apiKey: parsed.apiKey || '' };
    }
  } catch {
    // Bozuk kayıt: boş ayar say
  }
  return { mode: 'custom', baseUrl: '', apiKey: '' };
}

function writeSettings(settings: ProviderSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function hasProvider(): boolean {
  return Boolean(readSettings().baseUrl);
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

function decorateCodeBlocks(container: HTMLElement): void {
  container.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
    if (pre.parentElement?.classList.contains('code-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-wrap';
    pre.parentNode?.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'code-copy';
    copy.textContent = 'Kopyala';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pre.innerText);
        copy.textContent = 'Kopyalandı';
      } catch {
        copy.textContent = 'Kopyalanamadı';
      }
      window.setTimeout(() => (copy.textContent = 'Kopyala'), 1500);
    });
    wrap.appendChild(copy);
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

function renderAssistantStatic(text: string): void {
  const { body } = createMessageNode('assistant');
  body.innerHTML = renderMarkdown(text);
  decorateCodeBlocks(body);
}

function renderTranscript(session: ChatSession | null): void {
  el.messages.querySelectorAll('.msg').forEach((node) => node.remove());
  if (!session || session.messages.length === 0) {
    setEmptyVisible(true);
    return;
  }
  setEmptyVisible(false);
  for (const msg of session.messages) {
    if (msg.role === 'user') renderUserMessage(msg.content);
    else if (msg.role === 'assistant') renderAssistantStatic(msg.content);
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
  title.textContent = session.title || 'Yeni sohbet';
  title.addEventListener('click', () => void openSession(session.id));

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'session-delete';
  remove.title = 'Sohbeti sil';
  remove.setAttribute('aria-label', 'Sohbeti sil');
  remove.textContent = '×';
  remove.addEventListener('click', async (event) => {
    event.stopPropagation();
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

// ---------- Model seçimi ----------

function setModelOptions(models: { id: string; name: string }[]): void {
  const saved = localStorage.getItem(MODEL_KEY) || '';
  el.modelSelect.replaceChildren();

  if (models.length === 0) {
    const none = new Option('Model yok', '');
    none.disabled = true;
    el.modelSelect.add(none);
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
    const models = await fetchAvailableModels();
    setModelOptions(models);
    el.settingsStatus.dataset.kind = 'ok';
    el.settingsStatus.textContent = `${models.length} model bulundu.`;
  } catch (err) {
    setModelOptions([]);
    el.settingsStatus.dataset.kind = 'error';
    el.settingsStatus.textContent = err instanceof Error ? err.message : 'Modeller alınamadı.';
  }
}

// ---------- Gönderim ----------

function setBusy(busy: boolean): void {
  el.sendBtn.classList.toggle('is-stop', busy);
  el.sendBtn.title = busy ? 'Durdur' : 'Gönder';
  el.sendBtn.setAttribute('aria-label', busy ? 'Durdur' : 'Gönder');
  el.iconSend.toggleAttribute('hidden', busy);
  el.iconStop.toggleAttribute('hidden', !busy);
  el.input.disabled = busy;
}

function createTypingIndicator(): HTMLDivElement {
  const dots = document.createElement('div');
  dots.className = 'typing';
  dots.innerHTML = '<span></span><span></span><span></span>';
  return dots;
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
  }
  // Kayıtlı kopyayı her gönderimde tazele: mesaj listesi IndexedDB'de tutulur
  const isFirstMessage = (await history.getSession(activeSession.id))?.messages.length === 0;
  if (isFirstMessage) {
    await history.autoTitle(activeSession.id, text);
  }
  await history.addMessage(activeSession.id, { role: 'user', content: text });
  const session = (await history.getSession(activeSession.id))!;
  activeSession = session;
  el.chatTitle.textContent = session.title || 'Yeni sohbet';

  renderUserMessage(text);
  setEmptyVisible(false);

  const { root, body } = createMessageNode('assistant');
  body.appendChild(createTypingIndicator());
  scrollToBottom(true);

  const conversation = session.messages.map((m) => ({ role: m.role, content: m.content }));

  let full = '';
  let streamText: HTMLDivElement | null = null;
  const controller = new AbortController();
  abortController = controller;
  setBusy(true);

  const showText = (text: string) => {
    if (!streamText) {
      body.replaceChildren();
      streamText = document.createElement('div');
      streamText.className = 'stream-text';
      body.appendChild(streamText);
    }
    streamText.textContent = text;
  };

  let failure = null as Error | null;
  try {
    await sendAgentStream(
      conversation,
      {
        onChunk: (chunk) => {
          full += chunk;
          showText(full);
          scrollToBottom();
        },
        onDone: () => {},
        onError: (err) => {
          failure = err;
        },
      },
      { model, signal: controller.signal },
    );
  } catch (err) {
    failure = err instanceof Error ? err : new Error(String(err));
  } finally {
    abortController = null;
    setBusy(false);
  }

  const stopped = controller.signal.aborted;
  if (full.trim()) {
    body.innerHTML = renderMarkdown(full);
    decorateCodeBlocks(body);
    await history.addMessage(session.id, { role: 'assistant', content: full, model });
  } else if (stopped) {
    root.remove();
  } else {
    root.remove();
    const message = failure ? failure.message : 'Yanıt alınamadı.';
    showNotice(message, 'error', 9000);
  }

  if (stopped && full.trim()) {
    root.classList.add('is-stopped');
  }

  await refreshSessionList();
  el.input.focus();
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
  writeSettings({ mode: 'custom', baseUrl, apiKey: el.setApiKey.value.trim() });
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

$<HTMLButtonElement>('btnMinimize').addEventListener('click', () => window.kragaAPI?.app.minimize());
$<HTMLButtonElement>('btnMaximize').addEventListener('click', () => window.kragaAPI?.app.maximize());
$<HTMLButtonElement>('btnClose').addEventListener('click', () => window.kragaAPI?.app.close());

// ---------- Başlangıç ----------

async function init(): Promise<void> {
  await refreshSessionList();
  renderTranscript(null);
  await loadModels();
  if (!hasProvider()) {
    showNotice('Hoş geldin. Başlamak için Ayarlar bölümünden API adresini ve anahtarını gir.', 'info', 9000);
  }
  el.input.focus();
}

void init();
