import { describe, it, expect } from 'vitest';
import { latestTodos, changedFiles, contextUsage, estimateTokens, trailingTurnStart } from '../src/agent/insights';
import type { ChatMessage } from '../src/core/ChatHistory';

const base = { timestamp: 0, id: '' };

describe('içgörüler', () => {
  it('son todo_write listesini bulur, bozuk çağrıyı atlar', () => {
    const messages: ChatMessage[] = [
      { ...base, role: 'assistant', content: '', toolCalls: [{ id: 'a', name: 'todo_write', arguments: '{"todos":[{"content":"eski","status":"pending"}]}' }] },
      { ...base, role: 'assistant', content: '', toolCalls: [{ id: 'b', name: 'todo_write', arguments: '{bozuk' }] },
      { ...base, role: 'assistant', content: '', toolCalls: [{ id: 'c', name: 'todo_write', arguments: '{"todos":[{"content":"yeni","status":"completed"}]}' }] },
    ];
    expect(latestTodos(messages)).toEqual([{ content: 'yeni', status: 'completed' }]);
    expect(latestTodos([])).toEqual([]);
  });

  it('değişen dosyaları en son tura göre sıralar, yeni oluşturulanı korur', () => {
    const messages: ChatMessage[] = [
      { ...base, role: 'user', content: '1' },
      { ...base, role: 'tool', content: '', checkpoint: { path: 'a.ts', before: 'x' } },
      { ...base, role: 'user', content: '2' },
      { ...base, role: 'tool', content: '', checkpoint: { path: 'a.ts', before: 'y' } },
      { ...base, role: 'tool', content: '', checkpoint: { path: 'n.ts', before: null } },
    ];
    expect(changedFiles(messages)).toEqual([
      { path: 'a.ts', kind: 'modified', turn: 2 },
      { path: 'n.ts', kind: 'created', turn: 2 },
    ]);
  });

  it('bağlam tahmini karakter sayısından üretilir ve sınırda kesilir', () => {
    expect(estimateTokens(['abcdefg'])).toBe(2);
    const usage = contextUsage([{ ...base, role: 'user', content: 'x'.repeat(700) }], [], 100);
    expect(usage.ratio).toBe(1);
    expect(usage.used).toBe(200);
  });

  it('son kullanıcı mesajının konumunu verir', () => {
    expect(trailingTurnStart([{ ...base, role: 'user', content: 'a' }, { ...base, role: 'assistant', content: 'b' }])).toBe(0);
    expect(trailingTurnStart([])).toBe(-1);
  });
});
