import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { promises as fs } from 'node:fs';

export interface MCPServerConfig {
  /** stdio sunucuları için komut (url verilmişse yok sayılır) */
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  /** Uzak (Streamable HTTP / SSE) sunucular için adres ve başlıklar */
  url?: string;
  headers?: Record<string, string>;
}

const CONNECT_TIMEOUT_MS = 90_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(label + ' ' + Math.round(ms / 1000) + ' sn içinde yanıt vermedi')), ms); }),
  ]);
}

export interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

export interface MCPToolDefinition {
  serverName: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

class MCPManager {
  private clients = new Map<string, { client: Client; transport: { close(): Promise<void> } }>();
  private lastErrors = new Map<string, string>();

  getLastError(name: string): string {
    return this.lastErrors.get(name) || '';
  }
  private tools: MCPToolDefinition[] = [];

  async loadConfig(configPath: string): Promise<boolean> {
    try {
      const content = await fs.readFile(configPath, 'utf8');
      const config: MCPConfig = JSON.parse(content);

      // Mevcut istemcileri kapat
      await this.disconnectAll();

      for (const [serverName, serverConfig] of Object.entries(config.mcpServers || {})) {
        await this.connectServer(serverName, serverConfig);
      }

      await this.refreshTools();
      return true;
    } catch (error) {
      console.error('MCP config yükleme hatası:', error);
      return false;
    }
  }

  async connectServer(name: string, config: MCPServerConfig): Promise<boolean> {
    this.lastErrors.delete(name);
    if (this.clients.has(name)) await this.disconnectServer(name);
    if (config.url) return this.connectRemote(name, config);
    let stderrTail = '';
    try {
      let command = (config.command || '').trim();
      if (!command) throw new Error('Komut boş');
      let args = [...(config.args || [])];

      // Eğer command içinde argümanlar varsa ve args boşsa, güvenli şekilde ayır
      if (args.length === 0 && command.includes(' ')) {
        const tokens = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        if (tokens.length > 0 && tokens[0]) {
          command = tokens[0].replace(/^"|"$/g, '');
          args = tokens.slice(1).map(t => t.replace(/^"|"$/g, ''));
        }
      }

      // Windows'ta npx, npm, yarn, pnpm, uvx vb. için .cmd uzantısı çözümü
      if (process.platform === 'win32') {
        const lower = command.toLowerCase();
        if (['npx', 'npm', 'pnpm', 'yarn', 'uvx'].includes(lower)) {
          command = `${command}.cmd`;
        }
      }

      const cleanEnv: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (typeof v === 'string') cleanEnv[k] = v;
      }
      if (config.env) {
        Object.assign(cleanEnv, config.env);
      }

      // Windows ortam değişkenleri uyumluluğu
      if (process.platform === 'win32') {
        const pathVal = cleanEnv['Path'] || cleanEnv['PATH'] || '';
        if (pathVal) {
          cleanEnv['PATH'] = pathVal;
          cleanEnv['Path'] = pathVal;
        }
        if (!cleanEnv['SystemRoot'] && process.env.SystemRoot) {
          cleanEnv['SystemRoot'] = process.env.SystemRoot;
        }
        if (!cleanEnv['COMSPEC'] && process.env.COMSPEC) {
          cleanEnv['COMSPEC'] = process.env.COMSPEC;
        }
        if (!cleanEnv['PATHEXT'] && process.env.PATHEXT) {
          cleanEnv['PATHEXT'] = process.env.PATHEXT;
        }
      }

      console.log(`[MCP] Başlatılıyor: ${name} -> komut: ${command}, argümanlar:`, args);

      const transport = new StdioClientTransport({
        command,
        args,
        env: cleanEnv,
        stderr: 'pipe',
      });
      transport.stderr?.on('data', (d: Buffer) => { stderrTail = (stderrTail + d.toString()).slice(-1500); });

      const client = new Client(
        { name: `kraga-ide-${name}`, version: '1.0.0' },
        { capabilities: {} }
      );

      try {
        await withTimeout(client.connect(transport), CONNECT_TIMEOUT_MS, 'Sunucu');
      } catch (err) {
        try { await transport.close(); } catch {}
        throw err;
      }
      this.clients.set(name, { client, transport });
      console.log(`[MCP] Sunucu başarıyla bağlandı: ${name}`);
      return true;
    } catch (error: any) {
      const reason = String(error?.message || error);
      const tailLines = stderrTail.trim().split(/\r?\n/).filter(Boolean);
      const important = tailLines.filter((l) => /404|not found|not recognized|cannot|enoent|denied|error:/i.test(l));
      const tail = (important.length ? important : tailLines).slice(0, 3).join(' | ').slice(0, 400);
      this.lastErrors.set(name, tail ? reason + ' — ' + tail : reason);
      console.error(`[MCP] ${name} sunucusuna bağlanılamadı:`, reason, tail);
      return false;
    }
  }

  private async connectRemote(name: string, config: MCPServerConfig): Promise<boolean> {
    const url = new URL(config.url!);
    if (!/^https?:$/.test(url.protocol)) {
      this.lastErrors.set(name, 'Yalnızca http(s) adresleri desteklenir');
      return false;
    }
    const requestInit = { headers: config.headers || {} };
    const attempts: Array<() => { transport: any }> = [
      () => ({ transport: new StreamableHTTPClientTransport(url, { requestInit }) }),
      () => ({ transport: new SSEClientTransport(url, { requestInit }) }),
    ];
    let lastErr = '';
    for (const make of attempts) {
      const { transport } = make();
      const client = new Client({ name: `kraga-ide-${name}`, version: '1.0.0' }, { capabilities: {} });
      try {
        await withTimeout(client.connect(transport), 30_000, 'Uzak sunucu');
        this.clients.set(name, { client, transport });
        console.log(`[MCP] Uzak sunucu bağlandı: ${name}`);
        return true;
      } catch (err: any) {
        lastErr = String(err?.message || err);
        try { await transport.close(); } catch {}
        if (/401|403|unauthorized|forbidden/i.test(lastErr)) break;
      }
    }
    this.lastErrors.set(name, /401|403|unauthorized|forbidden/i.test(lastErr) ? 'Kimlik doğrulama reddedildi (anahtarı kontrol edin)' : lastErr);
    return false;
  }

  async refreshTools(): Promise<MCPToolDefinition[]> {
    const allTools: MCPToolDefinition[] = [];

    for (const [serverName, { client }] of this.clients.entries()) {
      try {
        const result = await client.listTools();
        for (const tool of result.tools) {
          allTools.push({
            serverName,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema as Record<string, unknown>,
          });
        }
      } catch (err) {
        console.warn(`[MCP] ${serverName} araç listesi alınamadı:`, err);
      }
    }

    this.tools = allTools;
    return allTools;
  }

  getTools(): MCPToolDefinition[] {
    return this.tools;
  }

  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const entry = this.clients.get(serverName);
    if (!entry) {
      throw new Error(`MCP sunucusu bulunamadı: ${serverName}`);
    }
    const result = await entry.client.callTool({ name: toolName, arguments: args }, undefined, { timeout: 120_000 });
    return result;
  }

  async disconnectServer(name: string): Promise<void> {
    const entry = this.clients.get(name);
    if (entry) {
      try {
        await entry.transport.close();
      } catch {}
      this.clients.delete(name);
      // Araclari guncelle
      this.tools = this.tools.filter(t => t.serverName !== name);
    }
  }

  getConnectedServerNames(): string[] {
    return Array.from(this.clients.keys());
  }

  async disconnectAll(): Promise<void> {
    for (const [, { transport }] of this.clients.entries()) {
      try {
        await transport.close();
      } catch {}
    }
    this.clients.clear();
    this.tools = [];
  }
}

export const mcpManager = new MCPManager();
