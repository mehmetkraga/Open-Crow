import { describe, it, expect, vi, afterEach } from 'vitest';
import { runAgentTurn, type AgentEvents } from '../src/agent/loop';
import { specsFor, parseTodos, formatTodos, requiresApproval, isReadOnlyTool, type ToolBackend } from '../src/agent/tools';
import { parseRule } from '../src/agent/permissions';
import type { ChatMessage, ToolCall } from '../src/core/ChatHistory';

const sse = (chunks: unknown[]) => chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';
const toolTurn = (id: string, name: string, args: unknown) =>
  sse([
    { choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name, arguments: JSON.stringify(args) } }] } }] },
    { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
  ]);
const textTurn = (text: string) => sse([{ choices: [{ delta: { content: text } }] }, { choices: [{ delta: {}, finish_reason: 'stop' }] }]);

function backend(files: Record<string, string> = {}): ToolBackend & { written: Record<string, string> } {
  const written: Record<string, string> = {};
  return {
    written,
    async readDirectory() {
      return [];
    },
    async readFile(p: string) {
      if (p in written) return written[p];
      if (p in files) return files[p];
      throw new Error(`yok: ${p}`);
    },
    async writeFile(p: string, c: string) {
      written[p] = c;
      return true;
    },
    async grep() {
      return { success: true, matches: [], truncated: false };
    },
    async glob() {
      return { success: true, files: [], truncated: false };
    },
    async runCommand(command: string) {
      return { stdout: `ran ${command}`, stderr: '', exitCode: 0 };
    },
    async fetchUrl() {
      return { success: true, text: 'sayfa' };
    },
    async search() {
      return { success: true, results: [{ title: 'Belge', url: 'https://d.example/x', snippet: 'özet' }] };
    },
  };
}

function providerReplies(replies: string[]) {
  let i = 0;
  const fetchMock = vi.fn(async () => new Response(replies[Math.min(i++, replies.length - 1)], { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function events(approve = false) {
  const assistants: ChatMessage[] = [];
  const results: ChatMessage[] = [];
  const starts: { name: string; needsApproval: boolean }[] = [];
  const approvals: string[] = [];
  const e: AgentEvents = {
    onText: () => {},
    onAssistant: async (m) => void assistants.push(m),
    onToolStart: (c: ToolCall, needsApproval) => void starts.push({ name: c.name, needsApproval }),
    requestApproval: async (c) => {
      approvals.push(c.name);
      return approve;
    },
    onToolResult: async (m) => void results.push(m),
  };
  return { e, assistants, results, starts, approvals };
}

const user: ChatMessage[] = [{ id: '1', role: 'user', content: 'yap', timestamp: 0 }];
const base = (b: ToolBackend, extra: Partial<Parameters<typeof runAgentTurn>[2]> = {}) => ({
  config: { baseUrl: 'https://p.example', apiKey: 'k' },
  model: 'm',
  workspace: 'F:\\proj',
  mode: 'ask' as const,
  backend: b,
  signal: new AbortController().signal,
  ...extra,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('plan modu ve araç kümeleri', () => {
  it('plan ve salt okunur kümede yazma ve komut yok, görev aracı var', () => {
    const names = specsFor({ readOnly: true }).map((s) => s.function.name);
    expect(names).toContain('read_file');
    expect(names).toContain('web_search');
    expect(names).toContain('task');
    expect(names).not.toContain('write_file');
    expect(names).not.toContain('run_command');
  });

  it('alt ajan kendi alt ajanını başlatamaz', () => {
    const names = specsFor({ readOnly: true, subagent: true }).map((s) => s.function.name);
    expect(names).not.toContain('task');
  });

  it('okuma araçlarının onayı yoktur, yazma ve komutlar ask modunda sorulur', () => {
    expect(isReadOnlyTool('todo_write')).toBe(true);
    expect(requiresApproval('todo_write', 'ask')).toBe(false);
    expect(requiresApproval('web_search', 'ask')).toBe(false);
    expect(requiresApproval('edit_file', 'plan')).toBe(false);
  });

  it('plan modunda model yazma aracı çağırırsa dosya değişmez', async () => {
    providerReplies([toolTurn('c1', 'write_file', { path: 'a.ts', content: 'x' }), textTurn('Plan hazır.')]);
    const b = backend();
    const { e, results } = events();
    await runAgentTurn(user, e, base(b, { mode: 'plan' }));
    expect(b.written).toEqual({});
    expect(results[0].toolStatus).toBe('denied');
    expect(results[0].content).toContain('Plan modunda');
  });
});

describe('izin kuralları döngüde', () => {
  it('deny kuralı çağrıyı onaysız engeller', async () => {
    providerReplies([toolTurn('c1', 'run_command', { command: 'rm -rf x' }), textTurn('Tamam.')]);
    const { e, results, approvals } = events(true);
    await runAgentTurn(user, e, base(backend(), { rules: [parseRule('Bash(rm *)', 'deny')!] }));
    expect(results[0].toolStatus).toBe('denied');
    expect(approvals).toEqual([]);
  });

  it('allow kuralı ask modunda onayı atlar', async () => {
    providerReplies([toolTurn('c1', 'run_command', { command: 'npm test' }), textTurn('Geçti.')]);
    const b = backend();
    const { e, results, approvals } = events(false);
    await runAgentTurn(user, e, base(b, { rules: [parseRule('Bash(npm test)', 'allow')!] }));
    expect(approvals).toEqual([]);
    expect(results[0].toolStatus).toBe('done');
  });

  it('ask kuralı auto modunda bile onay ister', async () => {
    providerReplies([toolTurn('c1', 'run_command', { command: 'git push' }), textTurn('Tamam.')]);
    const { e, approvals } = events(false);
    await runAgentTurn(user, e, base(backend(), { mode: 'auto', rules: [parseRule('Bash(git *)', 'ask')!] }));
    expect(approvals).toEqual(['run_command']);
  });
});

describe('denetim noktaları ve görev aracı', () => {
  it('dosya değişikliğinin önceki içeriği sonuç mesajına yazılır', async () => {
    providerReplies([
      toolTurn('c1', 'edit_file', { path: 'a.ts', old_string: 'eski', new_string: 'yeni' }),
      textTurn('Bitti.'),
    ]);
    const b = backend({ 'F:\\proj\\a.ts': 'eski metin' });
    const { e, results } = events(true);
    await runAgentTurn(user, e, base(b, { mode: 'auto' }));
    expect(results[0].checkpoint).toEqual({ path: 'F:\\proj\\a.ts', before: 'eski metin' });
  });

  it('task aracı alt ajanı çalıştırır ve yalnızca özet döndürür', async () => {
    const replies = [
      toolTurn('t1', 'task', { description: 'tara', prompt: 'src tarat' }),
      textTurn('Alt ajan özeti: 3 dosya var.'),
      textTurn('Ana cevap.'),
    ];
    const fetchMock = providerReplies(replies);
    const { e, results } = events();
    await runAgentTurn(user, e, base(backend(), { mode: 'auto' }));
    expect(results[0].toolStatus).toBe('done');
    expect(results[0].content).toBe('Alt ajan özeti: 3 dosya var.');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('yapılacaklar listesi', () => {
  it('geçerli listeyi ayrıştırır, geçersiz durumu pending yapar', () => {
    const todos = parseTodos([{ content: 'Testleri yaz', status: 'in_progress' }, { content: 'Dokümante et', status: 'bilinmiyor' }]);
    expect(todos).toEqual([
      { content: 'Testleri yaz', status: 'in_progress' },
      { content: 'Dokümante et', status: 'pending' },
    ]);
    expect(formatTodos(todos)).toBe('[~] Testleri yaz\n[ ] Dokümante et');
  });

  it('boş içerik ve liste dışı girdi hata verir', () => {
    expect(() => parseTodos([{ content: '  ', status: 'pending' }])).toThrow('boş olamaz');
    expect(() => parseTodos('x')).toThrow('liste');
  });
});
