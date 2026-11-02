// src/agent/insights.ts
// Yan panel için sohbetten türetilen veriler: son yapılacaklar listesi, değişen dosyalar, bağlam kullanımı.

import type { ChatMessage, ToolCall } from '../core/ChatHistory';
import { parseTodos, type TodoItem } from './tools';
import { changesInTurn, lastTurn } from './checkpoints';

/** Kullanıcı mesajlarını gönderilmeden önce kaldırılacak sondaki asistan/araç çıktısını bulur. */
export function trailingTurnStart(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return i;
  }
  return -1;
}

/** Konuşmadaki son todo_write çağrısının listesi. Bozuk argüman atlanır. */
export function latestTodos(messages: ChatMessage[]): TodoItem[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const calls: ToolCall[] = messages[i].toolCalls ?? [];
    for (let j = calls.length - 1; j >= 0; j--) {
      if (calls[j].name !== 'todo_write') continue;
      try {
        return parseTodos((JSON.parse(calls[j].arguments || '{}') as { todos?: unknown }).todos);
      } catch {
        // Bozuk çağrıyı atla, bir öncekine bak
      }
    }
  }
  return [];
}

export interface ChangedFile {
  path: string;
  kind: 'created' | 'modified';
  turn: number;
}

/** Oturumda değişen tüm dosyalar; her dosya için en son değiştiren tur. */
export function changedFiles(messages: ChatMessage[]): ChangedFile[] {
  const last = lastTurn(messages);
  const seen = new Map<string, ChangedFile>();
  for (let turn = 1; turn <= last; turn++) {
    for (const checkpoint of changesInTurn(messages, turn).values()) {
      const previous = seen.get(checkpoint.path);
      seen.set(checkpoint.path, {
        path: checkpoint.path,
        kind: previous?.kind === 'created' ? 'created' : checkpoint.before === null ? 'created' : 'modified',
        turn,
      });
    }
  }
  return [...seen.values()].sort((a, b) => b.turn - a.turn);
}

/** Kabaca bağlam tahmini: karakter sayısı / 3.5 (Türkçe ve kod için yaklaşık). */
export function estimateTokens(texts: string[]): number {
  return texts.reduce((sum, text) => sum + Math.ceil(text.length / 3.5), 0);
}

export interface ContextUsage {
  used: number;
  limit: number;
  ratio: number;
}

export function contextUsage(messages: ChatMessage[], extraTexts: string[], limit: number): ContextUsage {
  const texts = [...messages.map((m) => m.content), ...messages.flatMap((m) => (m.toolCalls ?? []).map((c) => c.arguments)), ...extraTexts];
  const used = estimateTokens(texts);
  return { used, limit, ratio: Math.min(1, used / limit) };
}
