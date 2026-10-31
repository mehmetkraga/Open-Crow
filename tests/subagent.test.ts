import { describe, it, expect, vi, beforeEach } from 'vitest';

type Cb = { onChunk: (t: string) => void; onThinking: () => void; onDone: () => void; onError: (e: Error) => void };
let script: Array<(cb: Cb, signal?: AbortSignal) => void> = [];
let seenMessages: any[][] = [];

vi.mock('../src/core/proxyClient', () => ({
  sendAgentStream: (messages: any[], cb: Cb, opts: { signal?: AbortSignal }) => {
    seenMessages.push(JSON.parse(JSON.stringify(messages)));
    const step = script.shift();
    if (!step) { cb.onDone(); return; }
    step(cb, opts?.signal);
  },
}));

const toolCall = (tool: string, args: any) => '```tool_call\n' + JSON.stringify({ tool, arguments: args }) + '\n```';
const say = (text: string) => (cb: Cb) => { cb.onChunk(text); cb.onDone(); };

const fsFiles = new Map<string, string>();
const api = {
  fs: {
    readFile: vi.fn(async (p: string) => { if (!fsFiles.has(p)) throw new Error('ENOENT'); return fsFiles.get(p)!; }),
    writeFile: vi.fn(async (p: string, c: string) => { fsFiles.set(p, c); return true; }),
    readDirectory: vi.fn(async () => []),
  },
  terminal: { runCommand: vi.fn(async () => ({ stdout: 'ok', stderr: '', exitCode: 0 })) },
  mcp: { getConnectedServers: vi.fn(async () => ['memory']), callTool: vi.fn(async () => ({ content: [{ type: 'text', text: 'mcp-ok' }] })) },
  workspace: { grep: vi.fn(), glob: vi.fn() },
  web: { search: vi.fn(), fetch: vi.fn() },
  docs: { read: vi.fn(), create: vi.fn() },
};

beforeEach(() => {
  script = [];
  seenMessages = [];
  fsFiles.clear();
  vi.clearAllMocks();
  (globalThis as any).window = { kragaAPI: api };
  (globalThis as any).localStorage = { getItem: () => null, setItem: () => {} };
});

async function run(role: string, task: string, setup?: (m: any) => void) {
  const { SubagentManager } = await import('../src/components/SubagentManager');
  const m = new SubagentManager();
  m.setProjectPath('C:/proj');
  setup?.(m);
  const s = await m.spawnSubagent(role, task);
  await vi.waitFor(() => expect(s.status).not.toBe('running'), { timeout: 3000 });
  return { m, s };
}

describe('SubagentManager', () => {
  it('araç çağırır, sonucu modele geri verir ve bitirir', async () => {
    fsFiles.set('C:/proj/a.txt', 'merhaba');
    script = [say(toolCall('read_file', { filePath: 'a.txt' })), say('Özet: dosya "merhaba" içeriyor.')];
    const { s } = await run('Planlayici', 'a.txt oku');
    expect(s.status).toBe('done');
    expect(s.result).toContain('merhaba');
    expect(s.toolLog).toHaveLength(1);
    expect(s.toolLog[0].status).toBe('done');
    // geçmişte aynı asistan mesajı iki kez yer almamalı
    const assistants = s.messages.filter((m) => m.role === 'assistant');
    expect(assistants).toHaveLength(2);
  });

  it('izin kapısı yokken yazma işlemi reddedilir ve dosya yazılmaz', async () => {
    script = [say(toolCall('write_file', { filePath: 'x.txt', content: 'gizli' })), say('Yazamadım.')];
    const { s } = await run('Kod Yazici', 'x yaz');
    expect(api.fs.writeFile).not.toHaveBeenCalled();
    expect(JSON.stringify(seenMessages[1])).toContain('onaylamadi');
    expect(s.status).toBe('done');
  });

  it('kullanıcı reddederse komut çalışmaz', async () => {
    script = [say(toolCall('run_command', { command: 'rm -rf /' })), say('Tamam.')];
    await run('Test Kosturucu', 'çalıştır', (m) => m.setPermissionHandler(async () => false));
    expect(api.terminal.runCommand).not.toHaveBeenCalled();
  });

  it('kullanıcı onaylarsa yazma gerçekleşir ve izin başlığı rolü içerir', async () => {
    const handler = vi.fn(async () => true);
    script = [say(toolCall('write_file', { filePath: 'ok.txt', content: 'veri' })), say('Bitti.')];
    await run('Kod Yazici', 'yaz', (m) => m.setPermissionHandler(handler));
    expect(fsFiles.get('C:/proj/ok.txt')).toBe('veri');
    expect(handler.mock.calls[0][0].title).toContain('Kod Yazici');
  });

  it('rolün kapsamında olmayan aracı reddeder', async () => {
    script = [say(toolCall('run_command', { command: 'dir' })), say('Yapamadım.')];
    await run('Kod Inceleyici', 'incele'); // read-only rol
    expect(api.terminal.runCommand).not.toHaveBeenCalled();
    expect(JSON.stringify(seenMessages[1])).toContain('erisim kapsaminda degil');
  });

  it('edit_file benzersizlik denetimi yapar', async () => {
    fsFiles.set('C:/proj/f.ts', 'a a');
    script = [say(toolCall('edit_file', { filePath: 'f.ts', oldString: 'a', newString: 'b' })), say('Bitti.')];
    await run('Kod Yazici', 'düzenle', (m) => m.setPermissionHandler(async () => true));
    expect(fsFiles.get('C:/proj/f.ts')).toBe('a a');
    expect(JSON.stringify(seenMessages[1])).toContain('2 kez');
  });

  it('mcp_call bağlı olmayan sunucuda açık hata verir, bağlıda metni döndürür', async () => {
    script = [say(toolCall('mcp_call', { server: 'yok', tool: 't', arguments: {} })), say(toolCall('mcp_call', { server: 'memory', tool: 'read_graph', arguments: {} })), say('Bitti.')];
    // Planlayici rolünde mcp_call yok: önce kapsam hatası döner
    const { s } = await run('Planlayici', 'x');
    expect(s.status).toBe('done');
    expect(JSON.stringify(seenMessages[1])).toContain('erisim kapsaminda degil');
    expect(api.mcp.callTool).not.toHaveBeenCalled();
  });

  it('özel rol mcp_call kullanabilir: bağlı değilse hata, bağlıysa gerçek metin', async () => {
    const { SubagentManager } = await import('../src/components/SubagentManager');
    const m = new SubagentManager();
    script = [say(toolCall('mcp_call', { server: 'yok', tool: 't', arguments: {} })), say(toolCall('mcp_call', { server: 'memory', tool: 'read_graph', arguments: { a: 1 } })), say('Bitti.')];
    const s = await m.spawnSubagent('Ozel Rol', 'mcp dene', ['mcp_call']);
    await vi.waitFor(() => expect(s.status).not.toBe('running'), { timeout: 3000 });
    expect(JSON.stringify(seenMessages[1])).toContain('MCP sunucusu bagli degil');
    expect(JSON.stringify(seenMessages[2])).toContain('mcp-ok');
    expect(api.mcp.callTool).toHaveBeenCalledWith('memory', 'read_graph', { a: 1 });
  });

  it('iptal edilen alt ajan "cancelled" kalır (hata durumuna dönmez)', async () => {
    let release: (() => void) | undefined;
    script = [(cb, signal) => {
      signal?.addEventListener('abort', () => cb.onError(new Error('aborted')));
      release = () => cb.onDone();
    }];
    const { SubagentManager } = await import('../src/components/SubagentManager');
    const m = new SubagentManager();
    const s = await m.spawnSubagent('Planlayici', 'uzun iş');
    m.killSubagent(s.id);
    await new Promise((r) => setTimeout(r, 30));
    expect(s.status).toBe('cancelled');
    release?.();
  });

  it('boş model yanıtı hata olarak raporlanır', async () => {
    script = [(cb) => cb.onDone()];
    const { s } = await run('Planlayici', 'x');
    expect(s.status).toBe('error');
    expect(s.result).toContain('boş');
  });

  it('akış hatasını raporlar', async () => {
    script = [(cb) => cb.onError(new Error('HTTP 500'))];
    const { s } = await run('Planlayici', 'x');
    expect(s.status).toBe('error');
    expect(s.result).toContain('HTTP 500');
  });
});
