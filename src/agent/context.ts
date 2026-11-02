// src/agent/context.ts
// Modele gönderilecek konuşma penceresi: uzun sohbetlerde eski kısım özetle değiştirilir.

import type { ChatMessage, ChatSession } from '../core/ChatHistory';

export type OutputStyle = 'normal' | 'concise' | 'explanatory';

export const OUTPUT_STYLES: Record<OutputStyle, string | null> = {
  normal: null,
  concise: 'Yanıtların çok kısa olsun: gereksiz açıklama ve tekrar yok, doğrudan sonuca git.',
  explanatory: 'Yaptığın her adımın gerekçesini kısaca açıkla; kararlarını ve alternatiflerini belirt.',
};

export const SUMMARY_REQUEST =
  'Şimdiye kadar yapılanları, verilen kararları, değiştirilen dosyaları ve açık kalan işleri, sonraki adımda bağlamı kaybetmeden devam edebilecek kadar ayrıntılı ama kısa bir özet olarak yaz. Yalnızca özeti yaz.';

/**
 * Oturumun modele gönderilecek mesajları. Özet varsa, özetten sonra gelen mesajlar korunur.
 * Özet bir sistem mesajı olarak başa eklenir.
 */
export function buildConversation(session: Pick<ChatSession, 'messages' | 'summary' | 'summaryUpTo'>): ChatMessage[] {
  if (!session.summary || session.summaryUpTo === undefined) return session.messages;
  const tail = session.messages.slice(session.summaryUpTo);
  const summary: ChatMessage = {
    id: '',
    role: 'system',
    content: `Önceki konuşmanın özeti (bu bölüm artık ayrıntılı olarak gönderilmiyor):\n${session.summary}`,
    timestamp: 0,
  };
  return [summary, ...tail];
}
