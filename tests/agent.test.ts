import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveInWorkspace, relativeTo } from '../src/agent/workspace';
import { StreamAccumulator, parseSSELine, normalizeEndpointUrl, parseModelList } from '../src/agent/openai';
import { requiresApproval, executeTool, summarizeCall, type ToolBackend } from '../src/agent/tools';
import { runAgentTurn, type AgentEvents } from '../src/agent/loop';
import type { ChatMessage, ToolCall } from '../src/core/ChatHistory';

describe('resolveInWorkspace', () => {
  it('göreli yolu klasör altında çözer', () => {
    expect(resolveInWorkspace('F:\\proj', 'src/a.ts')).toBe('F:\\proj\\src\\a.ts');
    expect(resolveInWorkspace('/home/u/proj', './src//a.ts')).toBe('/home/u/proj/src/a.ts');
  });

  it('.. ile klasör dışına çıkmayı reddeder', () => {
    expect(() => resolveInWorkspace('F:\\proj', '../secret.txt')).toThrow('çalışma klasörünün dışında');
    expect(() => resolveInWorkspace('F:\\proj', 'src/../../x')).toThrow();
  });

  it('mutlak yol klasör içindeyse kabul eder, dışındaysa reddeder', () => {
    expect(resolveInWorkspace('F:\\proj', 'F:\\proj\\a.txt')).toBe('F:\\proj\\a.txt');
    expect(() => resolveInWorkspace('F:\\proj', 'C:\\Windows\\win.ini')).toThrow();
  });

  it('kardeş klasör adının önekiyle karışmaz', () => {
    expect(() => resolveInWorkspace('F:\\proj', '../proj2/a.txt')).toThrow();
    expect(() => resolveInWorkspace('F:\\proj', 'F:\\proj2\\a.txt')).toThrow();
  });

  it('relativeTo klasör yolunu kırpar', () => {
    expect(relativeTo('F:\\proj', 'F:\\proj\\src\\a.ts')).toBe('src/a.ts');
  });
});

describe('SSE ve akış birleştirme', () => {
  it('data satırlarını çözer, [DONE] ve veri olmayan satırları ayırt eder', () => {
    expect(parseSSELine('data: {"a":1}')).toEqual({ a: 1 });
    expect(parseSSELine('data: [DONE]')).toBeNull();
    expect(parseSSELine(': keep-alive')).toBeUndefined();
    expect(parseSSELine('data: {bozuk')).toBeUndefined();
  });

  it('metin ve araç çağrısı parçalarını tek yanıta birleştirir', () => {
    const acc = new StreamAccumulator();
    acc.push({ choices: [{ delta: { content: 'Bakıyorum' } }] });
    acc.push({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_a', function: { name: 'read_', arguments: '{"pa' } }] } }] });
    acc.push({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'file', arguments: 'th":"a.ts"}' } }] } }] });
    acc.push({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] });

    const result = acc.result();
    expect(result.content).toBe('Bakıyorum');
    expect(result.finishReason).toBe('tool_calls');
    expect(result.toolCalls).toEqual([{ id: 'call_a', name: 'read_file', arguments: '{"path":"a.ts"}' }]);
  });

  it('birden çok araç çağrısını index sırasıyla korur', () => {
    const acc = new StreamAccumulator();
    acc.push({ choices: [{ delta: { tool_calls: [{ index: 1, id: 'b', function: { name: 'grep', arguments: '{}' } }, { index: 0, id: 'a', function: { name: 'glob', arguments: '{}' } }] } }] });
    expect(acc.result().toolCalls.map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('uç nokta ve model listesi', () => {
  it('adresi /v1 altına normalize eder', () => {
    expect(normalizeEndpointUrl('https://api.example.com', '/chat/completions')).toBe('https://api.example.com/v1/chat/completions');
    expect(normalizeEndpointUrl('https://api.example.com/v1/', '/models')).toBe('https://api.example.com/v1/models');
    expect(normalizeEndpointUrl('localhost:11434', '/models')).toBe('http://localhost:11434/v1/models');
  });

  it('farklı model liste biçimlerini okur', () => {
    expect(parseModelList({ data: [{ id: 'gpt-x' }, { id: 'a-model' }] })).toEqual([
      { id: 'a-model', name: 'a-model' },
      { id: 'gpt-x', name: 'gpt-x' },
    ]);
    expect(parseModelList(['m1'])).toEqual([{ id: 'm1', name: 'm1' }]);
  });
});

describe('onay politikası', () => {
  it('okuma araçları hiçbir modda sorulmaz', () => {
    for (const mode of ['ask', 'edits', 'auto'] as const) {
      expect(requiresApproval('read_file', mode)).toBe(false);
      expect(requiresApproval('grep', mode)).toBe(false);
    }
  });

  it('ask modunda yazma ve komutlar sorulur', () => {
    expect(requiresApproval('edit_file', 'ask')).toBe(true);
    expect(requiresApproval('write_file', 'ask')).toBe(true);
    expect(requiresApproval('run_command', 'ask')).toBe(true);
  });

  it('edits modunda yalnızca komutlar sorulur, auto modunda hiçbiri', () => {
    expect(requiresApproval('edit_file', 'edits')).toBe(false);
    expect(requiresApproval('run_command', 'edits')).toBe(true);
    expect(requiresApproval('run_command', 'auto')).toBe(false);
  });

  it('kart özeti doğru alanı gösterir', () => {
    expect(summarizeCall('run_command', { command: 'npm test' })).toBe('npm test');
    expect(summarizeCall('edit_file', { path: 'a.ts' })).toBe('a.ts');
  });
});

function fakeBackend(files: Record<string, string>): ToolBackend & { written: Record<string, string> } {
  const written: Record<string, string> = {};
  return {
    written,
    async readDirectory() {
      return [{ name: 'src', path: 'F:\\proj\\src', isDirectory: true }, { name: 'a.ts', path: 'F:\\proj\\a.ts', isDirectory: false }];
    },
    async readFile(p: string) {
      if (p in written) return written[p];
      if (p in files) return files[p];
      throw new Error(`yok: ${p}`);
    },
    async writeFile(p: string, content: string) {
      written[p] = content;
      return true;
    },
    async grep() {
      return { success: true, matches: [{ file: 'F:\\proj\\a.ts', line: 2, text: 'const x = 1;' }], truncated: false };
    },
    async glob() {
      return { success: true, files: ['F:\\proj\\a.ts'], truncated: false };
    },
    async runCommand(command: string) {
      return { stdout: `ran ${command}`, stderr: '', exitCode: 0 };
    },
    async fetchUrl() {
      return { success: true, text: 'sayfa' };
    },
  };
}

describe('araç yürütücüsü', () => {
  const ctx = (backend: ToolBackend) => ({ root: 'F:\\proj', backend });

  it('edit_file tek eşleşmeyi değiştirir', async () => {
    const backend = fakeBackend({ 'F:\\proj\\a.ts': 'one\ntwo\nthree' });
    const out = await executeTool('edit_file', { path: 'a.ts', old_string: 'two', new_string: '2' }, ctx(backend));
    expect(out).toContain('1 değişiklik');
    expect(backend.written['F:\\proj\\a.ts']).toBe('one\n2\nthree');
  });

  it('edit_file birden çok eşleşmede durur, replace_all ile hepsini değiştirir', async () => {
    const backend = fakeBackend({ 'F:\\proj\\a.ts': 'x x x' });
    await expect(executeTool('edit_file', { path: 'a.ts', old_string: 'x', new_string: 'y' }, ctx(backend))).rejects.toThrow('3 kez');
    await executeTool('edit_file', { path: 'a.ts', old_string: 'x', new_string: 'y', replace_all: true }, ctx(backend));
    expect(backend.written['F:\\proj\\a.ts']).toBe('y y y');
  });

  it('edit_file bulunamayan metinde hata verir', async () => {
    const backend = fakeBackend({ 'F:\\proj\\a.ts': 'abc' });
    await expect(executeTool('edit_file', { path: 'a.ts', old_string: 'zzz', new_string: 'q' }, ctx(backend))).rejects.toThrow('bulunamadı');
  });

  it('read_file satır numaralarını ekler ve aralığı uygular', async () => {
    const backend = fakeBackend({ 'F:\\proj\\a.ts': 'l1\nl2\nl3\nl4' });
    const out = await executeTool('read_file', { path: 'a.ts', start_line: 2, end_line: 3 }, ctx(backend));
    expect(out).toContain('2\tl2');
    expect(out).toContain('3\tl3');
    expect(out).not.toContain('l4');
  });

  it('araçlar klasör dışına erişemez', async () => {
    const backend = fakeBackend({});
    await expect(executeTool('read_file', { path: '../../secret' }, ctx(backend))).rejects.toThrow('dışında');
  });

  it('bilinmeyen araç ve bozuk argüman hata verir', async () => {
    const backend = fakeBackend({});
    await expect(executeTool('rm_rf', {}, ctx(backend))).rejects.toThrow('Bilinmeyen araç');
  });
});

describe('ajan turu', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sse = (chunks: unknown[]) => chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';

  function stubProvider(responses: string[]) {
    let call = 0;
    const fetchMock = vi.fn(async () => new Response(responses[call++], { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  function makeEvents() {
    const assistants: ChatMessage[] = [];
    const results: ChatMessage[] = [];
    const starts: { name: string; needsApproval: boolean }[] = [];
    let text = '';
    const events: AgentEvents = {
      onText: (d) => (text += d),
      onAssistant: async (m) => void assistants.push(m),
      onToolStart: (c: ToolCall, needsApproval) => void starts.push({ name: c.name, needsApproval }),
      requestApproval: vi.fn(async () => false),
      onToolResult: async (m) => void results.push(m),
    };
    return { events, assistants, results, starts, text: () => text };
  }

  const userTurn: ChatMessage[] = [{ id: '1', role: 'user', content: 'a.ts oku', timestamp: 0 }];

  it('araç çağırır, sonucu alır, sonra metinle biter', async () => {
    stubProvider([
      sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'read_file', arguments: '{"path":"a.ts"}' } }] } }] }, { choices: [{ delta: {}, finish_reason: 'tool_calls' }] }]),
      sse([{ choices: [{ delta: { content: 'Bitti.' } }] }, { choices: [{ delta: {}, finish_reason: 'stop' }] }]),
    ]);
    const { events, assistants, results, starts } = makeEvents();

    await runAgentTurn(userTurn, events, {
      config: { baseUrl: 'https://p.example', apiKey: 'k' },
      model: 'm',
      workspace: 'F:\\proj',
      mode: 'ask',
      backend: fakeBackend({ 'F:\\proj\\a.ts': 'export {}' }),
      signal: new AbortController().signal,
    });

    expect(starts).toEqual([{ name: 'read_file', needsApproval: false }]);
    expect(results[0].toolStatus).toBe('done');
    expect(results[0].content).toContain('export {}');
    expect(assistants.map((a) => a.content)).toEqual(['', 'Bitti.']);
  });

  it('reddedilen yazma işlemi dosyaya dokunmaz ve reddedildiğini modele bildirir', async () => {
    const fetchMock = stubProvider([
      sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'w1', function: { name: 'write_file', arguments: '{"path":"new.ts","content":"x"}' } }] } }] }, { choices: [{ delta: {}, finish_reason: 'tool_calls' }] }]),
      sse([{ choices: [{ delta: { content: 'Tamam.' } }] }]),
    ]);
    const backend = fakeBackend({});
    const { events, results } = makeEvents();

    await runAgentTurn(userTurn, events, {
      config: { baseUrl: 'https://p.example', apiKey: 'k' },
      model: 'm',
      workspace: 'F:\\proj',
      mode: 'ask',
      backend,
      signal: new AbortController().signal,
    });

    expect(results[0].toolStatus).toBe('denied');
    expect(backend.written).toEqual({});
    const secondBody = JSON.parse(String((fetchMock.mock.calls[1] as unknown[])[1] && ((fetchMock.mock.calls[1] as unknown[])[1] as { body: string }).body));
    expect(secondBody.messages.at(-1).role).toBe('tool');
    expect(secondBody.messages.at(-1).content).toContain('reddetti');
  });

  it('çalışma klasörü yoksa araç listesi gönderilmez', async () => {
    const fetchMock = stubProvider([sse([{ choices: [{ delta: { content: 'Merhaba' } }] }])]);
    const { events } = makeEvents();
    await runAgentTurn(userTurn, events, {
      config: { baseUrl: 'https://p.example', apiKey: '' },
      model: 'm',
      mode: 'auto',
      backend: fakeBackend({}),
      signal: new AbortController().signal,
    });
    const body = JSON.parse((((fetchMock.mock.calls[0] as unknown[])[1]) as { body: string }).body);
    expect(body.tools).toBeUndefined();
  });

  it('araç çağrısı sonuçsuz kalmaz: durdurulursa iptal sonucu eklenir', async () => {
    const controller = new AbortController();
    stubProvider([
      sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'x1', function: { name: 'run_command', arguments: '{"command":"npm test"}' } }] } }] }, { choices: [{ delta: {}, finish_reason: 'tool_calls' }] }]),
    ]);
    const { events, results } = makeEvents();
    events.requestApproval = async () => {
      controller.abort();
      return false;
    };

    await runAgentTurn(userTurn, events, {
      config: { baseUrl: 'https://p.example', apiKey: 'k' },
      model: 'm',
      workspace: 'F:\\proj',
      mode: 'ask',
      backend: fakeBackend({}),
      signal: controller.signal,
    });

    expect(results.map((r) => r.toolCallId)).toEqual(['x1']);
    expect(results[0].toolStatus).toBe('denied');
  });
});
