// src/core/proxyClient.ts
// Open Crow AI Cloudflare Proxy & Özel API İstemcisi (Streaming SSE, Abort, Token Telemetrisi)

import { TokenTracker } from './TokenTracker';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onThinking?: (text: string) => void;
  onToolCallDelta?: (toolName: string, accumulatedArgs: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

export interface StreamOptions {
  model?: string;
  effort?: string;
  thinking?: boolean;
  signal?: AbortSignal;
  customBaseUrl?: string;
  customApiKey?: string;
  maxTokens?: number;
  _isRetry524?: boolean;
}

export const MODEL_UPSTREAM_MAP: Record<string, string> = {
  // Eco Modeller
  'gpt-5.4-mini': 'gpt-5.4-mini',
  'gpt-5.6-luna': 'gpt-5.6-luna',
  'gpt-4o-mini': 'gpt-4o-mini',
  'codex-auto-review': 'codex-auto-review',
  'haiku-4-5': 'haiku-4-5',
  'haiku-3-5': 'haiku-3-5',

  // Daily Modeller
  'sonnet-5': 'sonnet-5',
  'sonnet-4-6': 'sonnet-4-6',
  'claude-3-7-sonnet': 'claude-3-7-sonnet',
  'claude-3-5-sonnet': 'claude-3-5-sonnet',
  'gpt-4o': 'gpt-4o',
  'gpt-5.4': 'gpt-5.4',
  'gpt-5.6-terra': 'gpt-5.6-terra',

  // Pro Modeller
  'opus-5': 'opus-5',
  'opus-4-8': 'opus-4-8',
  'opus-4-7': 'opus-4-7',
  'claude-3-opus': 'claude-3-opus',
  'gpt-5.5': 'gpt-5.5',
  'gpt-5.6-sol': 'gpt-5.6-sol',

  // Flagship Modeller
  'claude-fable-5.1-1m': 'claude-fable-5.1[1m]',
  'claude-fable-5.1': 'claude-fable-5.1',
  'claude-fable-5-1m': 'claude-fable-5[1m]',
  'gpt-6-astra': 'gpt-6-astra',
};

export function resolveUpstreamModel(modelId: string, isDirectAnthropicByok = false): string {
  const cleanId = (modelId || '').trim();
  if (!cleanId) return 'gpt-5.4-mini';

  // 1. Katalog veya eşleme tablosunda tanımlı modelleri doğrudan kullan (opus-5, sonnet-5 vb.)
  if (MODEL_UPSTREAM_MAP[cleanId]) return MODEL_UPSTREAM_MAP[cleanId];

  // 2. Yalnızca doğrudan api.anthropic.com BYOK kullanıldığında standart Anthropic ID'lerine çevir
  if (isDirectAnthropicByok) {
    const lower = cleanId.toLowerCase();
    if (lower === 'claude-3-opus') return 'claude-3-opus-20240229';
    if (lower === 'claude-3-5-haiku' || lower === 'haiku-3-5') return 'claude-3-5-haiku-20241022';
    if (lower === 'claude-3-7-sonnet') return 'claude-3-7-sonnet-20250219';
    if (lower === 'claude-3-5-sonnet') return 'claude-3-5-sonnet-20241022';
  }

  return cleanId;
}

export function normalizeEndpointUrl(baseUrl: string, endpoint: string): string {
  let base = (baseUrl || '').trim();
  if (!base) return '';

  // Protokol yoksa varsayılan olarak https:// ekle (localhost ve 127.0.0.1 hariç)
  if (!/^https?:\/\//i.test(base)) {
    if (base.startsWith('localhost') || base.startsWith('127.0.0.1')) {
      base = 'http://' + base;
    } else {
      base = 'https://' + base;
    }
  }

  base = base.replace(/\/+$/, '');
  base = base.replace(/\/(chat\/completions|messages|models)$/i, '').replace(/\/+$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (!base.endsWith('/v1') && !cleanEndpoint.startsWith('/v1')) {
    return `${base}/v1${cleanEndpoint}`;
  }
  return `${base}${cleanEndpoint}`;
}

export function resolveProviderFallbackModels(baseUrl: string): { id: string; name: string }[] {
  const lower = (baseUrl || '').toLowerCase();
  if (lower.includes('claude') || lower.includes('codex') || lower.includes('anthropic')) {
    return [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'o3-mini', name: 'o3-mini' },
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    ];
  }

  if (lower.includes('deepseek')) {
    return [
      { id: 'deepseek-chat', name: 'DeepSeek Chat (V3)' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
    ];
  }

  if (lower.includes('openrouter')) {
    return [
      { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet (OpenRouter)' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (OpenRouter)' },
      { id: 'openai/gpt-4o', name: 'GPT-4o (OpenRouter)' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1 (OpenRouter)' },
    ];
  }

  return [
    { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  ];
}

/** Sağlayıcı hata gövdesini güvenle ayrıştırır: code sayı/null, message nesne/dizi olabilir (OpenRouter, OpenAI, DeepSeek...). Her zaman metin döner. */
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

const NO_PROVIDER_MESSAGE = 'Önce Ayarlar > Sağlayıcılar bölümünden API adresini ve anahtarını gir.';

function readProviderSettings(options: { customApiKey?: string; customBaseUrl?: string }): { apiKey?: string; baseUrl?: string } {
  let savedBaseUrl: string | undefined;
  let savedApiKey: string | undefined;
  try {
    const saved = localStorage.getItem('kraga-ide-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.mode === 'custom') {
        savedBaseUrl = parsed.baseUrl;
        savedApiKey = parsed.apiKey;
      }
    }
  } catch {}
  return {
    apiKey: options.customApiKey || savedApiKey,
    baseUrl: options.customBaseUrl || savedBaseUrl,
  };
}

function isAnthropicModel(modelId: string): boolean {
  const m = (modelId || '').toLowerCase();
  return m.includes('claude') || m.includes('haiku') || m.includes('sonnet') || m.includes('opus') || m.includes('fable');
}

export function isReasoningModel(modelId: string): boolean {
  const m = (modelId || '').toLowerCase();
  // SADECE OpenAI o-serisi modelleri OpenAI'nin reasoning_effort parametresini destekler.
  // Gemini, Claude, GPT-4o ve GPT-5 modellerine reasoning_effort parametresi KESİNLİKLE gönderilmemelidir.
  return /\b(o1|o3|o4)\b/i.test(m);
}

export const ANTHROPIC_BUDGET_MAP: Record<string, number> = {
  '1k': 1024,
  '2k': 2048,
  '4k': 4096,
  '8k': 8192,
  '16k': 16384,
  light: 1024,
  low: 2048,
  medium: 4096,
  high: 8192,
  max: 16384,
};

export function mapReasoningEffort(effort?: string): 'low' | 'medium' | 'high' {
  if (effort === 'light' || effort === 'low') return 'low';
  if (effort === 'high' || effort === 'max') return 'high';
  return 'medium';
}

export async function sendAgentStream(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options: StreamOptions = {}
): Promise<void> {
    const { apiKey: customApiKey, baseUrl: customBaseUrl } = readProviderSettings(options);
    if (!customBaseUrl) {
      callbacks.onError(new Error(NO_PROVIDER_MESSAGE));
      return;
    }

    const isDirectAnthropic = customBaseUrl.includes('anthropic.com');
    const rawModel = options.model || localStorage.getItem('kraga:model') || 'gpt-5.4-mini';
    const upstreamModel = resolveUpstreamModel(rawModel, isDirectAnthropic);
    const isAnthropic = isAnthropicModel(upstreamModel);
    const isReasoning = isReasoningModel(upstreamModel);
    const signal = options.signal;
    const tokenTracker = TokenTracker.getInstance();

    let estimatedInputTokens = 0;
    for (const msg of messages) {
      estimatedInputTokens += Math.ceil(msg.content.length / 3.5);
    }

    let outputText = '';

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-request-id': crypto.randomUUID(),
      };

      // Thinking ve effort parametrelerini dinamik ölçekle gönder
      const effort = options.effort || 'medium';
      const isThinkingRequested = options.thinking !== undefined ? options.thinking : true;

      const finalModel = upstreamModel;

      const rawPayload: Record<string, any> = {
        model: finalModel,
        messages,
        stream: true,
        max_tokens: options.maxTokens || 8192,
      };

      if (!isReasoning && !(options.thinking && isAnthropic && isDirectAnthropic)) {
        rawPayload.temperature = 0.2;
      }

      if (isDirectAnthropic) {
        if (isThinkingRequested) {
          const budget = ANTHROPIC_BUDGET_MAP[effort] || 4096;
          rawPayload['thinking'] = { type: 'enabled', budget_tokens: budget };
          rawPayload.max_tokens = Math.max(rawPayload.max_tokens || 4096, budget + 4096);
        } else {
          delete rawPayload.thinking;
        }
      } else {
        // OpenAI uyumlu sağlayıcılardan stream bitiminde kesin token ve cache kullanımını al
        rawPayload.stream_options = { include_usage: true };

        if (isReasoning) {
          rawPayload['reasoning_effort'] = mapReasoningEffort(effort);
        }
      }

    let requestBody: string;

    // Düz OpenAI uyumlu payload — zarf formatı tamamen kaldırıldı
    const buildRequestBody = (payload: any) => JSON.stringify(payload);

    // BYOK: Doğrudan kullanıcının sağlayıcısına OpenAI uyumlu format
    const url = normalizeEndpointUrl(customBaseUrl, '/chat/completions');
    if (customApiKey) {
      headers['Authorization'] = `Bearer ${customApiKey}`;
    }
    headers['Accept'] = 'text/event-stream, application/json';
    requestBody = buildRequestBody(rawPayload);

    let response = await fetch(url, {
      method: 'POST',
      headers,
      body: requestBody,
      signal,
    });

    // Kendini onarma (Self-healing retry): Eğer 400 dönerse parametreleri temizle ve 1 kez tekrar dene
    if (!response.ok && response.status === 400) {
      console.warn('[proxyClient] Upstream 400 hatası döndü. Kendini onaran geri dönüş (self-healing retry) başlatılıyor...');
      delete rawPayload.thinking;
      delete rawPayload.reasoning_effort;
      delete rawPayload.temperature;
      delete rawPayload.stream_options;
      rawPayload.max_tokens = 4096;

      headers['x-request-id'] = crypto.randomUUID();
      requestBody = buildRequestBody(rawPayload);

      const retryResponse = await fetch(url, {
        method: 'POST',
        headers,
        body: requestBody,
        signal,
      });

      if (retryResponse.ok) {
        response = retryResponse;
      }
    }

    if (!response.ok) {
      if ((response.status === 524 || response.status === 504) && !options._isRetry524) {
        console.warn('[ProxyClient] Cloudflare 524/504 timeout tespit edildi. Düşük gecikmeli hızlı modla (gemini-3.8-flash-low) otomatik kurtarma deneniyor...');
        return sendAgentStream(messages, callbacks, {
          ...options,
          effort: 'low',
          thinking: false,
          _isRetry524: true,
        });
      }

      const errText = await response.text();
      const { message: parsedMsg } = parseProviderError(errText);

      throw new Error(`AI Hatası (${response.status}): ${parsedMsg}`);
    }

    if (!response.body) {
      throw new Error('Yanıt gövdesi (stream) bulunamadı.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let actualInputTokens = 0;
    let actualOutputTokens = 0;
    let cacheWriteTokens = 0;
    let cacheReadTokens = 0;
    let totalReasoningLength = 0;
    const streamingToolCalls = new Map<number, { name: string; arguments: string; headerEmitted?: boolean }>();

    while (true) {
      // 120 saniyelik okuma timeout'u — sessiz socket ölümü paneli sonsuza kadar askıda bırakmasın
      const readResult = await Promise.race<ReadableStreamReadResult<Uint8Array>>([
        reader.read(),
        new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) =>
          setTimeout(() => reject(new Error('Stream read timeout (120s)')), 120_000)
        )
      ]);
      const { done, value } = readResult;
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') {
            finishStream();
            return;
          }
          try {
            const data = JSON.parse(jsonStr);

            // 1. Upstream SSE hata tespiti (Cloudflare Worker, KragaBridge veya AI Sağlayıcı)
            if (data.error) {
              const errDetails = typeof data.error === 'string'
                ? data.error
                : (data.error.message || data.message || JSON.stringify(data.error));
              throw new Error(`AI Hatası: ${errDetails}`);
            }

            let delta = '';
            let reasoning = '';

            // Token kullanımı takibi (OpenAI include_usage & Anthropic message_delta)
            if (data.usage) {
              actualInputTokens = data.usage.prompt_tokens || data.usage.input_tokens || actualInputTokens;
              actualOutputTokens = data.usage.completion_tokens || data.usage.output_tokens || actualOutputTokens;
              cacheReadTokens = data.usage.prompt_tokens_details?.cached_tokens || data.usage.cache_read_input_tokens || cacheReadTokens;
              cacheWriteTokens = data.usage.cache_creation_input_tokens || cacheWriteTokens;
            } else if (data.message?.usage) {
              actualInputTokens = data.message.usage.input_tokens || actualInputTokens;
              actualOutputTokens = data.message.usage.output_tokens || actualOutputTokens;
            }

            if (data.choices?.[0]?.delta?.reasoning_content) {
              reasoning = data.choices[0].delta.reasoning_content;
            } else if (data.choices?.[0]?.delta?.thinking) {
              reasoning = data.choices[0].delta.thinking;
            } else if (data.choices?.[0]?.delta?.thought) {
              reasoning = data.choices[0].delta.thought;
            } else if (data.choices?.[0]?.delta?.reasoning) {
              reasoning = data.choices[0].delta.reasoning;
            } else if (data.delta?.thinking) {
              reasoning = data.delta.thinking;
            } else if (data.type === 'content_block_delta' && data.delta?.thinking) {
              reasoning = data.delta.thinking;
            }

            if (reasoning) {
              totalReasoningLength += reasoning.length;
              if (callbacks.onThinking) {
                callbacks.onThinking(reasoning);
              }
            }

            // OpenAI native tool_calls akışı yakalama ve anlık gerçek zamanlı stream etme
            const deltaToolCalls = data.choices?.[0]?.delta?.tool_calls;
            if (Array.isArray(deltaToolCalls)) {
              for (const tc of deltaToolCalls) {
                const idx = tc.index ?? 0;
                let existing = streamingToolCalls.get(idx);
                if (!existing) {
                  existing = { name: '', arguments: '', headerEmitted: false };
                  streamingToolCalls.set(idx, existing);
                }
                if (tc.function?.name) existing.name += tc.function.name;

                let toolChunk = '';
                if (!existing.headerEmitted && (existing.name || tc.function?.arguments)) {
                  existing.headerEmitted = true;
                  const toolName = existing.name || 'write_file';
                  toolChunk += `\n\`\`\`tool_call\n{\n  "tool": "${toolName}",\n  "arguments": `;
                }

                if (tc.function?.arguments) {
                  existing.arguments += tc.function.arguments;
                  toolChunk += tc.function.arguments;
                }

                if (toolChunk) {
                  outputText += toolChunk;
                  callbacks.onChunk(toolChunk);
                }
                // Canlı script akışı için doğrudan tool call delta callback'i
                if (callbacks.onToolCallDelta && existing.name) {
                  callbacks.onToolCallDelta(existing.name, existing.arguments);
                }
              }
            }

            // Metin içeriği çıkarma (tüm OpenAI, Anthropic ve ara proxy zarfları)
            const rawDeltaContent = data.choices?.[0]?.delta?.content;
            if (typeof rawDeltaContent === 'string') {
              delta = rawDeltaContent;
            } else if (Array.isArray(rawDeltaContent)) {
              delta = rawDeltaContent.map((c: any) => (typeof c === 'string' ? c : (c.text || c.content || ''))).join('');
            } else if (typeof data.choices?.[0]?.message?.content === 'string') {
              delta = data.choices[0].message.content;
            } else if (typeof data.choices?.[0]?.text === 'string') {
              delta = data.choices[0].text;
            } else if (typeof data.delta?.text === 'string') {
              delta = data.delta.text;
            } else if (typeof data.delta?.content === 'string') {
              delta = data.delta.content;
            } else if (data.type === 'content_block_delta' && typeof data.delta?.text === 'string') {
              delta = data.delta.text;
            } else if (typeof data.content === 'string') {
              delta = data.content;
            } else if (typeof data.text === 'string') {
              delta = data.text;
            } else if (typeof data.response === 'string') {
              delta = data.response;
            }

            if (delta) {
              outputText += delta;
              callbacks.onChunk(delta);
            }
          } catch (e: any) {
            if (e instanceof Error && e.message.startsWith('AI Hatası:')) {
              throw e;
            }
            if (jsonStr && jsonStr !== '[DONE]') {
              // Ham JSON string'i outputText'e ekleme — boş yanıt korumasını bypass eder (v1.3.4 davranışı)
              callbacks.onChunk(jsonStr);
            }
          }
        }
      }
    }

    finishStream();

    function finishStream() {
      // Upstream OpenAI native tool_calls döndüyse ```tool_call bloklarını kapat veya fallback oluştur
      if (streamingToolCalls.size > 0) {
        for (const [_, tc] of streamingToolCalls) {
          if (tc.headerEmitted) {
            const closeBlock = `\n}\n\`\`\`\n`;
            outputText += closeBlock;
            callbacks.onChunk(closeBlock);
          } else {
            let parsedArgs: any = {};
            try {
              parsedArgs = JSON.parse(tc.arguments);
            } catch {
              parsedArgs = tc.arguments;
            }
            const toolCallBlock = `\n\`\`\`tool_call\n${JSON.stringify({ tool: tc.name || 'write_file', arguments: parsedArgs }, null, 2)}\n\`\`\`\n`;
            outputText += toolCallBlock;
            callbacks.onChunk(toolCallBlock);
          }
        }
      }

      const finalInput = actualInputTokens > 0 ? actualInputTokens : estimatedInputTokens;
      const finalOutput = actualOutputTokens > 0 ? actualOutputTokens : Math.ceil(outputText.length / 3.5);
      tokenTracker.addUsage(finalInput, finalOutput, rawModel, {
        cacheWriteTokens,
        cacheReadTokens,
      });

      if (outputText.trim().length === 0 && actualOutputTokens === 0 && totalReasoningLength === 0 && !signal?.aborted) {
        callbacks.onError(new Error('Modelden yanıt alınamadı (Boş yanıt döndü). Lütfen tekrar deneyin veya model ayarlarını kontrol edin.'));
        return;
      }

      callbacks.onDone();
    }
  } catch (error: any) {
    if (signal?.aborted) {
      callbacks.onDone();
      return;
    }
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export const DEFAULT_FALLBACK_MODELS: { id: string; name: string }[] = [
  { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B' }
];

// Kullanıcının kendi sağlayıcısından (OpenAI uyumlu /models) model listesini çeker
export async function fetchAvailableModels(options: { customApiKey?: string; customBaseUrl?: string } = {}): Promise<{ id: string; name: string }[]> {
  const { apiKey, baseUrl } = readProviderSettings(options);
  if (!baseUrl) {
    throw new Error(NO_PROVIDER_MESSAGE);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(normalizeEndpointUrl(baseUrl, '/models'), { method: 'GET', headers });
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Yetkilendirme Hatası (${res.status}): API anahtarı geçersiz veya eksik. Lütfen geçerli bir API anahtarı girin.`);
    }
    if (!res.ok) {
      console.warn(`[proxyClient] /models endpoint returned HTTP ${res.status}. Falling back to provider models.`);
      return resolveProviderFallbackModels(baseUrl);
    }
    const list = parseModelsList(await res.json());
    return list.length > 0 ? list : resolveProviderFallbackModels(baseUrl);
  } catch (err: any) {
    if (err.message && err.message.includes('Yetkilendirme Hatası')) {
      throw err;
    }
    console.warn('[proxyClient] Models fetch error, using provider fallbacks:', err);
    return resolveProviderFallbackModels(baseUrl);
  }
}

function parseModelsList(data: any): { id: string; name: string }[] {
  let rawList: any[] = [];
  if (Array.isArray(data)) rawList = data;
  else if (Array.isArray(data?.data)) rawList = data.data;
  else if (Array.isArray(data?.models)) rawList = data.models;
  else if (Array.isArray(data?.result)) rawList = data.result;
  else if (Array.isArray(data?.items)) rawList = data.items;
  else if (typeof data === 'object' && data !== null) {
    const values = Object.values(data);
    if (values.length > 0 && typeof values[0] === 'object') {
      rawList = values;
    }
  }

  return rawList
    .map((m: any) => {
      if (typeof m === 'string') return { id: m, name: m };
      let id = m.id || m.name || m.model || '';
      if (id.startsWith('models/')) id = id.replace(/^models\//, '');
      const name = m.display_name || m.displayName || m.name || id;
      return { id, name };
    })
    .filter((m) => Boolean(m.id));
}

