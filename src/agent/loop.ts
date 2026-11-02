// src/agent/loop.ts
// Ajan döngüsü: model yanıtlar, araç çağırırsa kurallar ve onay uygulanır, araç çalışır, sonuç modele geri verilir.

import type { ChatMessage, ToolCall, ToolStatus } from '../core/ChatHistory';
import { streamChatCompletion, type ApiMessage, type ProviderConfig } from './openai';
import { CANONICAL_TOOL, evaluateRules, type PermissionRule } from './permissions';
import { executeTool, getToolKind, requiresApproval, specsFor, type ApprovalMode, type ToolBackend } from './tools';
import { truncate } from './workspace';

export const MAX_STEPS = 30;
export const MAX_SUBAGENT_STEPS = 12;

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
  /** İzin kuralları (deny > ask > allow) */
  rules?: PermissionRule[];
  /** Sistem istemine eklenecek ek metin: proje talimatları, beceriler, çıktı stili */
  systemExtra?: string;
  /** Bu tur bir alt ajan mı: alt ajan kendi alt ajanını başlatamaz ve yalnızca okuma yapar */
  subagent?: boolean;
}

function systemPrompt(options: AgentOptions): string {
  const base = [
    'Sen Open Crow\'sun: kullanıcının bilgisayarındaki projelerde çalışan bir kodlama asistanısın.',
    'Yanıtların kısa, net ve somut olsun. Kod bloklarını dil etiketiyle ver. Varsayılan dil Türkçedir; kullanıcı başka dilde yazarsa o dilde yanıt ver.',
  ];
  if (!options.workspace) {
    base.push('Şu an bir çalışma klasörü seçili değil; dosya ve komut araçları kullanılamıyor. Gerekirse kullanıcıdan bir klasör seçmesini iste.');
  } else {
    base.push(
      `Çalışma klasörün: ${options.workspace}`,
      'Dosyalar hakkında konuşmadan önce ilgili dosyaları araçlarla oku; tahmin yürütme.',
      'Değişiklik yapmadan önce mevcut dosyayı oku. Mevcut dosyalarda edit_file ile küçük ve odaklı düzenlemeler yap; write_file yalnızca yeni dosyalar veya tamamen yeniden yazım için kullan.',
      'Çok adımlı işlerde todo_write ile yapılacaklar listesi tut ve adımları tamamladıkça güncelle.',
      'Geniş ve ayrıntılı taramaları task aracıyla alt ajana devredebilirsin; sonuçta yalnızca özet gelir.',
      'Yolları çalışma klasörüne göre göreli yaz. Yıkıcı ya da belirsiz bir işlem varsa önce kullanıcıya sor.',
      'Araç sonucu bir hataysa nedenini anla ve düzelt; kullanıcı bir işlemi reddettiyse aynı işlemi tekrar deneme.',
      'İş bittiğinde ne yaptığını ve varsa kalan riskleri kısaca özetle.',
    );
  }
  if (options.mode === 'plan' && !options.subagent) {
    base.push('Plan modundasın: dosya yazamaz ve komut çalıştıramazsın. Yalnızca incele ve adım adım bir plan sun; uygulamayı kullanıcı onaylayınca yap.');
  }
  if (options.subagent) {
    base.push('Alt ajan olarak çalışıyorsun: yalnızca okuma ve arama yap, sonunda ana ajana kısa bir özet ver.');
  }
  if (options.systemExtra) base.push(options.systemExtra);
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
  checkpoint?: { path: string; before: string | null };
}

/** Kurallar ve mod birlikte karar verir: önce kural, yoksa mod. */
function decide(call: ToolCall, args: Record<string, unknown>, options: AgentOptions): 'deny' | 'ask' | 'allow' {
  const canonical = CANONICAL_TOOL[call.name] ?? call.name;
  const ruled = evaluateRules(options.rules ?? [], canonical, args);
  if (ruled) return ruled;
  return requiresApproval(call.name, options.mode) ? 'ask' : 'allow';
}

async function runSubagent(args: Record<string, unknown>, options: AgentOptions): Promise<string> {
  const prompt = typeof args.prompt === 'string' ? args.prompt : '';
  if (!prompt.trim()) throw new Error('"prompt" boş olamaz.');
  let answer = '';
  const history: ChatMessage[] = [{ id: '', role: 'user', content: prompt, timestamp: Date.now() }];
  await runAgentTurnInternal(
    history,
    {
      onText: () => {},
      onAssistant: async (message) => {
        if (message.content) answer = message.content;
      },
      onToolStart: () => {},
      requestApproval: async () => false,
      onToolResult: async () => {},
    },
    { ...options, subagent: true, mode: 'auto', rules: [] },
    MAX_SUBAGENT_STEPS,
  );
  return answer.trim() || 'Alt ajan sonuç üretmedi.';
}

async function runOneCall(call: ToolCall, options: AgentOptions, events: AgentEvents): Promise<ToolOutcome> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(call.arguments || '{}') as Record<string, unknown>;
  } catch {
    events.onToolStart(call, false);
    return { content: 'Hata: araç argümanları geçerli JSON değil.', status: 'error' };
  }

  const kind = getToolKind(call.name);
  const verdict = decide(call, args, options);
  const needsApproval = verdict === 'ask';
  events.onToolStart(call, needsApproval);

  if (verdict === 'deny') {
    return { content: 'Bu işlem izin kurallarınızla engellendi. Farklı bir yol dene veya kullanıcıya sor.', status: 'denied' };
  }

  const readOnlyTurn = options.mode === 'plan' || options.subagent === true;
  if (readOnlyTurn && (kind === 'write' || kind === 'exec')) {
    return {
      content: options.subagent
        ? 'Alt ajanlar dosya yazamaz ve komut çalıştıramaz. Sonuçları özet olarak ana ajana bırak.'
        : 'Plan modunda dosya yazma ve komut çalıştırma kapalı. Planı sun; kullanıcı onaylayınca uygulanır.',
      status: 'denied',
    };
  }

  if (needsApproval) {
    const approved = await events.requestApproval(call);
    if (!approved) {
      return { content: 'Kullanıcı bu işlemi reddetti. Aynı işlemi tekrar deneme; farklı bir yol öner veya kullanıcıya sor.', status: 'denied' };
    }
  }

  if (options.signal.aborted) {
    return { content: 'Çalışma kullanıcı tarafından durduruldu.', status: 'cancelled' };
  }

  if (kind === 'delegate') {
    try {
      const answer = await runSubagent(args, options);
      return { content: truncate(answer), status: 'done' };
    } catch (err) {
      return { content: `Hata: ${err instanceof Error ? err.message : String(err)}`, status: 'error' };
    }
  }

  let checkpoint: ToolOutcome['checkpoint'];
  try {
    const output = await executeTool(call.name, args, {
      root: options.workspace ?? '',
      backend: options.backend,
      onCheckpoint: (path, before) => {
        if (!checkpoint) checkpoint = { path, before };
      },
    });
    return { content: truncate(output), status: 'done', checkpoint };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: `Hata: ${message}`, status: 'error', checkpoint };
  }
}

/** Bir kullanıcı turunu çalıştırır. Model araç çağırmayı bırakana kadar döngü sürer. */
export async function runAgentTurn(history: ChatMessage[], events: AgentEvents, options: AgentOptions): Promise<void> {
  return runAgentTurnInternal(history, events, options, options.subagent ? MAX_SUBAGENT_STEPS : MAX_STEPS);
}

async function runAgentTurnInternal(history: ChatMessage[], events: AgentEvents, options: AgentOptions, maxSteps: number): Promise<void> {
  const readOnly = options.mode === 'plan' || options.subagent === true;
  const tools = options.workspace ? specsFor({ readOnly, subagent: options.subagent }) : undefined;
  const conversation: ApiMessage[] = [{ role: 'system', content: systemPrompt(options) }, ...history.map(toApiMessage)];

  for (let step = 0; step < maxSteps; step++) {
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
        checkpoint: outcome.checkpoint,
      };
      await events.onToolResult(message);
      conversation.push(toApiMessage(message));
    }
  }

  throw new Error(`Adım sınırına ulaşıldı (${maxSteps}). Devam etmek için yeni bir mesaj gönder.`);
}
