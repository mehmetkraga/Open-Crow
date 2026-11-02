// src/agent/checkpoints.ts
// Denetim noktaları: her dosya değişikliğinden önceki içerik, ilgili araç mesajında saklanır.
// Geri alma bu kayıtlardan yapılır; ayrı bir durum tutulmaz, sohbet geçmişi tek kaynaktır.

import type { ChatMessage } from '../core/ChatHistory';

export interface Checkpoint {
  path: string;
  /** Değişiklikten önceki içerik; dosya yoksa null (geri alma dosyayı siler) */
  before: string | null;
}

export interface TurnChange {
  path: string;
  kind: 'created' | 'modified';
}

/** Kullanıcı mesajlarını sayarak turun sıra numarasını verir (1 tabanlı). */
export function turnIndexOf(messages: ChatMessage[], messageIndex: number): number {
  let turn = 0;
  for (let i = 0; i <= messageIndex && i < messages.length; i++) {
    if (messages[i].role === 'user') turn++;
  }
  return turn;
}

/** Bir turdaki değişen dosyalar. Aynı dosyanın ilk "before" değeri esas alınır. */
export function changesInTurn(messages: ChatMessage[], turn: number): Map<string, Checkpoint> {
  const result = new Map<string, Checkpoint>();
  messages.forEach((message, index) => {
    if (message.role !== 'tool' || !message.checkpoint) return;
    if (turnIndexOf(messages, index) !== turn) return;
    if (!result.has(message.checkpoint.path)) result.set(message.checkpoint.path, message.checkpoint);
  });
  return result;
}

/** Son turda değişen dosyaların özeti (görüntüleme için). */
export function summarizeTurn(messages: ChatMessage[], turn: number): TurnChange[] {
  return [...changesInTurn(messages, turn).values()].map((checkpoint) => ({
    path: checkpoint.path,
    kind: checkpoint.before === null ? 'created' : 'modified',
  }));
}

/** Mesajlardaki en son turun numarası; hiç kullanıcı mesajı yoksa 0. */
export function lastTurn(messages: ChatMessage[]): number {
  return messages.filter((m) => m.role === 'user').length;
}

/**
 * Bir turu geri alır: her dosyayı değişiklik öncesi içeriğine döndürür, yeni oluşturulanları siler.
 * `write` ve `remove` dışarıdan verilir; böylece saf kalır ve test edilebilir.
 */
export async function undoTurn(
  messages: ChatMessage[],
  turn: number,
  io: { write: (path: string, content: string) => Promise<void>; remove: (path: string) => Promise<void> },
): Promise<TurnChange[]> {
  const restored: TurnChange[] = [];
  for (const checkpoint of changesInTurn(messages, turn).values()) {
    if (checkpoint.before === null) {
      await io.remove(checkpoint.path);
      restored.push({ path: checkpoint.path, kind: 'created' });
    } else {
      await io.write(checkpoint.path, checkpoint.before);
      restored.push({ path: checkpoint.path, kind: 'modified' });
    }
  }
  return restored;
}
