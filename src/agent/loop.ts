// src/agent/loop.ts
// Ajan döngüsü: model yanıtlar, araç çağırırsa onay alınır, araç çalışır, sonuç modele geri verilir.

import type { ChatMessage, ToolCall, ToolStatus } from '../core/ChatHistory';
import { streamChatCompletion, type ApiMessage, type ProviderConfig } from './openai';
import { TOOL_SPECS, executeTool, requiresApproval, type ApprovalMode, type ToolBackend } from './tools';
import { truncate } from './workspace';

export const MAX_STEPS = 30;

export interface AgentEvents {
  /** Modelin o anki yanıt metninden yeni gelen parça */
  onText(delta: string): void;
  /** Model bir adımı bitirdi; mesaj kalıcı olarak kaydedilmeli */
  onAssistant(message: ChatMessage): Promise<void>;
  /** Bir araç çağrısı başladı; onay gerekiyorsa `needsApproval` true */
  onToolStart(call: ToolCall, needsApproval: boolean): void;
  /** Kullanıcıdan onay ister; izin verirse true döner */
  requestApproval(call: ToolCall): Promise<boolean>;
  /** Araç sonucu hazır; mesaj kalıcı olarak kaydedilmeli */
  onToolResult(message: ChatMessage): Promise<void>;
}

export interface AgentOptions {
  config: ProviderConfig;
  model: string;
  /** Çalışma klasörü; yoksa araçlar kapalı olarak sohbet edilir */
  workspace?: string;
  mode: ApprovalMode;
  backend: ToolBackend;
  signal: AbortSignal;
}

function systemPrompt(workspace?: string): string {
  const base = [
    'Sen Open Crow\'sun: kullanıcının bilgisayarındaki projelerde çalışan bir kodlama asistanısın.',
    'Yanıtların kısa, net ve somut olsun. Kod bloklarını dil etiketiyle ver. Varsayılan dil Türkçedir; kullanıcı başka dilde yazarsa o dilde yanıt ver.',
  ];
  if (!workspace) {
    base.push('Şu an bir çalışma klasörü seçili değil; dosya ve komut araçları kullanılamıyor. Gerekirse kullanıcıdan bir klasör seçmesini iste.');
  } else {
    base.push(
      `Çalışma klasörün: ${workspace}`,
      'Dosyalar hakkında konuşmadan önce ilgili dosyaları araçlarla oku; tahmin yürütme.',
      'Değişiklik yapmadan önce mevcut dosyayı oku. Mevcut dosyalarda edit_file ile küçük ve odaklı düzenlemeler yap; write_file yalnızca yeni dosyalar veya tamamen yeniden yazım için kullan.',
      'Yolları çalışma klasörüne göre göreli yaz. Yıkıcı ya da belirsiz bir işlem varsa önce kullanıcıya sor.',
      'Araç sonucu bir hataysa nedenini anla ve düzelt; kullanıcı bir işlemi reddettiyse aynı işlemi tekrar deneme.',
      'İş bittiğinde ne yaptığını ve varsa kalan riskleri kısaca özetle.',
    );
  }
  return base.join('\n');
}

/** Kalıcı mesajı OpenAI biçimine çevirir. */
export function toApiMessage(message: ChatMessage): ApiMessage {
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.toolCallId ?? '', content: message.content };
  }
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function' as const,
        function: { name: call.name, arguments: call.arguments },
      })),
    };
  }
  return { role: message.role === 'system' ? 'system' : message.role === 'user' ? 'user' : 'assistant', content: message.content };
}

/**
 * Yarım kalan araç çağrılarına sonuç ekler. Sağlayıcılar her çağrı için bir sonuç bekler;
 * aksi halde sonraki istek reddedilir.
 */
export function cancelledResults(calls: ToolCall[], reason: string): ChatMessage[] {
  return calls.map((call) => ({
    id: '',
    role: 'tool' as const,
    content: reason,
    timestamp: Date.now(),
    toolCallId: call.id,
    toolName: call.name,
    toolStatus: 'cancelled' as ToolStatus,
  }));
}

interface ToolOutcome {
  content: string;
  status: ToolStatus;
}

async function runOneCall(call: ToolCall, options: AgentOptions, events: AgentEvents): Promise<ToolOutcome> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(call.arguments || '{}') as Record<string, unknown>;
  } catch {
    events.onToolStart(call, false);
    return { content: 'Hata: araç argümanları geçerli JSON değil.', status: 'error' };
  }

  const needsApproval = requiresApproval(call.name, options.mode);
  events.onToolStart(call, needsApproval);

  if (needsApproval) {
    const approved = await events.requestApproval(call);
    if (!approved) {
      return { content: 'Kullanıcı bu işlemi reddetti. Aynı işlemi tekrar deneme; farklı bir yol öner veya kullanıcıya sor.', status: 'denied' };
    }
  }

  if (options.signal.aborted) {
    return { content: 'Çalışma kullanıcı tarafından durduruldu.', status: 'cancelled' };
  }

  try {
    const output = await executeTool(call.name, args, { root: options.workspace ?? '', backend: options.backend });
    return { content: truncate(output), status: 'done' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: `Hata: ${message}`, status: 'error' };
  }
}

/**
 * Bir kullanıcı turunu çalıştırır. Model araç çağırmayı bırakana kadar (en fazla MAX_STEPS adım) döngü sürer.
 * Durdurulduğunda hiçbir araç çağrısı sonuçsuz kalmaz.
 */
export async function runAgentTurn(history: ChatMessage[], events: AgentEvents, options: AgentOptions): Promise<void> {
  const tools = options.workspace ? TOOL_SPECS : undefined;
  const conversation: ApiMessage[] = [{ role: 'system', content: systemPrompt(options.workspace) }, ...history.map(toApiMessage)];

  for (let step = 0; step < MAX_STEPS; step++) {
    if (options.signal.aborted) return;

    const result = await streamChatCompletion(
      options.config,
      { model: options.model, messages: conversation, tools },
      { signal: options.signal, onText: events.onText },
    );

    const assistant: ChatMessage = {
      id: '',
      role: 'assistant',
      content: result.content,
      timestamp: Date.now(),
      model: options.model,
      toolCalls: result.toolCalls.length ? result.toolCalls : undefined,
    };
    await events.onAssistant(assistant);
    conversation.push(toApiMessage(assistant));

    if (result.toolCalls.length === 0) return;

    for (let i = 0; i < result.toolCalls.length; i++) {
      const call = result.toolCalls[i];
      if (options.signal.aborted) {
        for (const message of cancelledResults(result.toolCalls.slice(i), 'Çalışma kullanıcı tarafından durduruldu.')) {
          await events.onToolResult(message);
        }
        return;
      }

      const outcome = await runOneCall(call, options, events);
      const message: ChatMessage = {
        id: '',
        role: 'tool',
        content: outcome.content,
        timestamp: Date.now(),
        toolCallId: call.id,
        toolName: call.name,
        toolStatus: outcome.status,
      };
      await events.onToolResult(message);
      conversation.push(toApiMessage(message));
    }
  }

  throw new Error(`Adım sınırına ulaşıldı (${MAX_STEPS}). Devam etmek için yeni bir mesaj gönder.`);
}
