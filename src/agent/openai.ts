// src/agent/openai.ts
// OpenAI uyumlu sağlayıcılar için akışlı (SSE) chat istemcisi, araç çağrısı birleştirme ve model listesi.

import type { ToolCall } from '../core/ChatHistory';

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface StreamResult {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
}

/** Sağlayıcı hata gövdesinden okunabilir mesaj ve kod çıkarır. */
export function parseProviderError(errText: string): { message: string; code: string } {
  let message = errText;
  let code = '';
  try {
    const errJson = JSON.parse(errText);
    const rawMsg = errJson?.error?.message ?? (typeof errJson?.error === 'string' ? errJson.error : undefined) ?? errJson?.message ?? errText;
    message = typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg);
    code = String(errJson?.error?.code ?? errJson?.code ?? '');
  } catch {
    // JSON değil: ham metin
  }
  return { message, code };
}

/** Kullanıcının girdiği adresi /v1/<endpoint> biçimine getirir. */
export function normalizeEndpointUrl(baseUrl: string, endpoint: string): string {
  let base = (baseUrl || '').trim();
  if (!base) return '';
  if (!/^https?:\/\//i.test(base)) {
    base = base.startsWith('localhost') || base.startsWith('127.0.0.1') ? `http://${base}` : `https://${base}`;
  }
  base = base.replace(/\/+$/, '').replace(/\/(chat\/completions|messages|models)$/i, '').replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base.endsWith('/v1') ? `${base}${cleanEndpoint}` : `${base}/v1${cleanEndpoint}`;
}

/**
 * SSE akışındaki parça (delta) dizisini tek bir yanıta birleştirir.
 * Araç çağrıları `index` alanına göre parça parça gelir; ad ve argüman metinleri eklenerek kurulur.
 */
export class StreamAccumulator {
  content = '';
  finishReason: string | null = null;
  private calls = new Map<number, { id: string; name: string; arguments: string }>();

  push(chunk: unknown): void {
    const choice = (chunk as { choices?: { delta?: Record<string, unknown>; finish_reason?: string | null }[] })?.choices?.[0];
    if (!choice) return;
    const delta = choice.delta ?? {};
    if (typeof delta.content === 'string') this.content += delta.content;

    const toolDeltas = (delta.tool_calls as { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] | undefined) ?? [];
    for (const tc of toolDeltas) {
      const index = tc.index ?? 0;
      let entry = this.calls.get(index);
      if (!entry) {
        entry = { id: '', name: '', arguments: '' };
        this.calls.set(index, entry);
      }
      if (tc.id) entry.id = tc.id;
      if (tc.function?.name) entry.name += tc.function.name;
      if (tc.function?.arguments) entry.arguments += tc.function.arguments;
    }

    if (choice.finish_reason) this.finishReason = choice.finish_reason;
  }

  result(): StreamResult {
    const toolCalls = [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, entry], i) => ({
        id: entry.id || `call_${i}_${Date.now()}`,
        name: entry.name,
        arguments: entry.arguments || '{}',
      }))
      .filter((call) => call.name.length > 0);
    return { content: this.content, toolCalls, finishReason: this.finishReason };
  }
}

/** Tek bir SSE satırını çözer. `[DONE]` için null, veri olmayan satırlar için undefined döner. */
export function parseSSELine(line: string): unknown | null | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return undefined;
  const payload = trimmed.slice(5).trim();
  if (payload === '[DONE]') return null;
  try {
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}

function authHeaders(config: ProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  return headers;
}

export async function streamChatCompletion(
  config: ProviderConfig,
  body: { model: string; messages: ApiMessage[]; tools?: { type: 'function'; function: ToolSpec }[] },
  options: { signal?: AbortSignal; onText?: (delta: string) => void } = {},
): Promise<StreamResult> {
  const url = normalizeEndpointUrl(config.baseUrl, '/chat/completions');
  if (!url) throw new Error('API adresi tanımlı değil. Ayarlar bölümünden ekle.');

  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ ...body, stream: true }),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const { message } = parseProviderError(text);
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Yetkilendirme hatası (${response.status}): API anahtarını kontrol et. ${message}`);
    }
    throw new Error(`Sağlayıcı hatası (${response.status}): ${message || response.statusText}`);
  }
  if (!response.body) throw new Error('Sağlayıcı akış döndürmedi.');

  const accumulator = new StreamAccumulator();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const consume = (line: string): boolean => {
    const chunk = parseSSELine(line);
    if (chunk === null) return true;
    if (chunk === undefined) return false;
    const before = accumulator.content.length;
    accumulator.push(chunk);
    const delta = accumulator.content.slice(before);
    if (delta && options.onText) options.onText(delta);
    return false;
  };

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (consume(line)) return accumulator.result();
    }
  }
  if (buffer) consume(buffer);
  return accumulator.result();
}

/** Sağlayıcının model listesini çeker. OpenAI, OpenRouter ve benzeri `{data:[...]}` biçimlerini destekler. */
export async function fetchModels(config: ProviderConfig): Promise<{ id: string; name: string }[]> {
  const url = normalizeEndpointUrl(config.baseUrl, '/models');
  if (!url) throw new Error('API adresi tanımlı değil.');
  const response = await fetch(url, { headers: authHeaders(config) });
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Yetkilendirme hatası (${response.status}): API anahtarı geçersiz veya eksik.`);
  }
  if (!response.ok) {
    const { message } = parseProviderError(await response.text().catch(() => ''));
    throw new Error(`Model listesi alınamadı (${response.status}): ${message || response.statusText}`);
  }
  return parseModelList(await response.json());
}

export function parseModelList(data: unknown): { id: string; name: string }[] {
  const root = data as Record<string, unknown> | unknown[] | null;
  let raw: unknown[] = [];
  if (Array.isArray(root)) raw = root;
  else if (root && Array.isArray((root as { data?: unknown[] }).data)) raw = (root as { data: unknown[] }).data;
  else if (root && Array.isArray((root as { models?: unknown[] }).models)) raw = (root as { models: unknown[] }).models;

  return raw
    .map((item) => {
      if (typeof item === 'string') return { id: item, name: item };
      const m = item as { id?: string; name?: string; model?: string; display_name?: string };
      const id = (m.id || m.model || m.name || '').replace(/^models\//, '');
      return { id, name: m.display_name || m.name || id };
    })
    .filter((m) => m.id.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}
