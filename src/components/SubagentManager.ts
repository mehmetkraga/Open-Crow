// src/components/SubagentManager.ts
// Open Crow v2.7 — Subagent Orkestrasyon Yoneticisi
// Her subagent izole baglam, kendi mesaj gecmisi ve tool loop'u ile calisir.

import { sendAgentStream, ChatMessage } from '../core/proxyClient';
import { getRoleByName, type SubagentRoleDefinition } from './SubagentRoles';

export type SubagentStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

export interface SubagentSession {
  id: string;
  role: string;
  roleDefinition: SubagentRoleDefinition;
  task: string;
  status: SubagentStatus;
  messages: ChatMessage[];
  result: string;
  toolLog: SubagentToolLogEntry[];
  createdAt: number;
  completedAt?: number;
  elapsedMs: number;
  model: string;
  abortController: AbortController;
}

export interface SubagentToolLogEntry {
  tool: string;
  args: string;
  timestamp: number;
  status: 'running' | 'done' | 'error';
  result?: string;
}

/** Yazma / komut gibi riskli işlemler için ana panelin izin kapısı (true = izin verildi). */
export type SubagentPermissionHandler = (req: { type: 'file_write' | 'terminal'; title: string; detail: string }) => Promise<boolean>;

type SubagentEventType = 'spawn' | 'update' | 'tool' | 'complete' | 'error';
type SubagentEventCallback = (type: SubagentEventType, session: SubagentSession) => void;

export class SubagentManager {
  private sessions = new Map<string, SubagentSession>();
  private listeners: SubagentEventCallback[] = [];
  private projectPath: string | null = null;
  private defaultModel = 'gpt-5.4-mini';
  private permissionHandler: SubagentPermissionHandler | null = null;

  constructor() {
    const savedModel = localStorage.getItem('kraga:model');
    if (savedModel) this.defaultModel = savedModel;
  }

  public setProjectPath(path: string | null): void {
    this.projectPath = path;
  }

  public setPermissionHandler(handler: SubagentPermissionHandler | null): void {
    this.permissionHandler = handler;
  }

  public setDefaultModel(model: string): void {
    this.defaultModel = model;
  }

  public onEvent(cb: SubagentEventCallback): void {
    this.listeners.push(cb);
  }

  private emit(type: SubagentEventType, session: SubagentSession): void {
    for (const cb of this.listeners) {
      try { cb(type, session); } catch {}
    }
  }

  public getActiveSessions(): SubagentSession[] {
    return Array.from(this.sessions.values()).filter(s => s.status === 'running');
  }

  public getAllSessions(): SubagentSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getSession(id: string): SubagentSession | undefined {
    return this.sessions.get(id);
  }

  // Ana giris noktasi: yeni subagent baslat
  public async spawnSubagent(
    roleNameOrId: string,
    task: string,
    toolsOverride?: string[],
    modelOverride?: string
  ): Promise<SubagentSession> {
    // Rolu bul (yerlesik veya ozel)
    let roleDef = getRoleByName(roleNameOrId);
    if (!roleDef) {
      // Ozel rol olustur
      roleDef = {
        id: `custom-${Date.now()}`,
        role: roleNameOrId,
        description: task.slice(0, 80),
        tools: toolsOverride || ['read_file', 'list_dir'],
        maxDepth: 3,
        iconSvg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
        systemPromptTemplate: `Sen bir "${roleNameOrId}" subagent'sin. Gorevini tamamla ve sonucunu raporla.`
      };
    }

    const sessionId = `subagent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const model = modelOverride || this.defaultModel;
    const abortController = new AbortController();

    const session: SubagentSession = {
      id: sessionId,
      role: roleDef.role,
      roleDefinition: roleDef,
      task,
      status: 'running',
      messages: [],
      result: '',
      toolLog: [],
      createdAt: Date.now(),
      elapsedMs: 0,
      model,
      abortController,
    };

    this.sessions.set(sessionId, session);
    this.emit('spawn', session);

    // Async calistir — beklemeden don
    this.runSubagentLoop(session).catch(() => {
      session.status = 'error';
      session.completedAt = Date.now();
      session.elapsedMs = session.completedAt - session.createdAt;
      this.emit('error', session);
    });

    return session;
  }

  public killSubagent(id: string): void {
    const session = this.sessions.get(id);
    if (session && session.status === 'running') {
      session.abortController.abort();
      session.status = 'cancelled';
      session.completedAt = Date.now();
      session.elapsedMs = session.completedAt - session.createdAt;
      session.result = 'Kullanici tarafindan durduruldu.';
      this.emit('complete', session);
    }
  }

  // ─── Subagent Tool Calling Loop ─────────────────────────────────────────────

  private async runSubagentLoop(session: SubagentSession): Promise<void> {
    const systemPrompt: ChatMessage = {
      role: 'system',
      content: this.buildSubagentSystemPrompt(session),
    };

    // Ilk kullanici mesaji: gorev
    session.messages.push({ role: 'user', content: session.task });

    for (let depth = 0; depth < session.roleDefinition.maxDepth; depth++) {
      if (session.abortController.signal.aborted) break;

      const fullText = await this.streamSubagentTurn(session, systemPrompt);
      if (session.status !== 'running') return; // iptal edildi veya hata oluştu: durumu ezme
      if (!fullText.trim()) {
        session.status = 'error';
        session.result = 'Model boş yanıt döndürdü.';
        session.completedAt = Date.now();
        session.elapsedMs = session.completedAt - session.createdAt;
        this.emit('error', session);
        return;
      }

      // Tool call tespit et (%100 toleransli hem backtickli hem ham JSON)
      const extractedTool = this.extractToolCall(fullText);

      if (!extractedTool) {
        // Arac cagrisi yok — tamamlandi
        session.result = fullText.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        session.status = 'done';
        session.completedAt = Date.now();
        session.elapsedMs = session.completedAt - session.createdAt;
        this.emit('complete', session);
        return;
      }

      // Araci calistir
      try {
        const toolJson = extractedTool.toolJson;
        const toolName = toolJson.tool || toolJson.name || 'unknown';
        const toolArgs = toolJson.arguments || toolJson.args || {};

        const logEntry: SubagentToolLogEntry = {
          tool: toolName,
          args: JSON.stringify(toolArgs).slice(0, 200),
          timestamp: Date.now(),
          status: 'running',
        };
        session.toolLog.push(logEntry);
        this.emit('tool', session);

        const result = await this.executeSubagentTool(session, toolName, toolArgs);
        logEntry.status = 'done';
        logEntry.result = result.slice(0, 500);
        this.emit('update', session);

        // Arac sonucunu mesaja ekle
        session.messages.push({
          role: 'user',
          content: `[Arac Sonucu (${toolName})]:\n\`\`\`\n${result.length > 12000 ? result.slice(0, 12000) + '\n[... kesildi]' : result}\n\`\`\``,
        });
      } catch (err: any) {
        session.result = `Arac hatasi: ${err.message || String(err)}`;
        session.status = 'error';
        session.completedAt = Date.now();
        session.elapsedMs = session.completedAt - session.createdAt;
        this.emit('error', session);
        return;
      }
    }

    // maxDepth'e ulasildi
    if (session.status === 'running') {
      session.result = session.messages
        .filter(m => m.role === 'assistant')
        .map(m => m.content)
        .join('\n')
        .slice(-1000) || 'Maks adim sayisina ulasildi.';
      session.status = 'done';
      session.completedAt = Date.now();
      session.elapsedMs = session.completedAt - session.createdAt;
      this.emit('complete', session);
    }
  }

  private async streamSubagentTurn(session: SubagentSession, systemPrompt: ChatMessage): Promise<string> {
    return new Promise<string>((resolve) => {
      let fullText = '';

      sendAgentStream(
        [systemPrompt, ...session.messages],
        {
          onChunk: (text) => {
            fullText += text;
          },
          onThinking: () => {},
          onDone: () => {
            session.messages.push({ role: 'assistant', content: fullText });
            resolve(fullText);
          },
          onError: (err) => {
            if (session.status !== 'running') { resolve(''); return; } // iptal sonrası gelen abort hatasını yoksay
            session.status = 'error';
            session.result = `Stream hatasi: ${err.message}`;
            session.completedAt = Date.now();
            session.elapsedMs = session.completedAt - session.createdAt;
            this.emit('error', session);
            resolve('');
          },
        },
        {
          model: session.model,
          effort: 'medium',
          thinking: false,
          signal: session.abortController.signal,
        }
      );
    });
  }

  private async executeSubagentTool(
    session: SubagentSession,
    toolName: string,
    toolArgs: any
  ): Promise<string> {
    const allowedTools = session.roleDefinition.tools;
    if (!allowedTools.includes(toolName)) {
      return `Hata: "${toolName}" araci bu subagent'in erisim kapsaminda degil. Izin verilen araclar: ${allowedTools.join(', ')}`;
    }

    const resolvedPath = (relPath: string): string => {
      if (!relPath) return this.projectPath || '.';
      if (relPath.includes(':') || relPath.startsWith('/') || relPath.startsWith('\\')) return relPath;
      if (!this.projectPath) return relPath;
      const sep = this.projectPath.includes('\\') ? '\\' : '/';
      return `${this.projectPath}${sep}${relPath.replace(/^[\\/]+/, '')}`;
    };

    const askPermission = async (type: 'file_write' | 'terminal', title: string, detail: string): Promise<boolean> => {
      if (!this.permissionHandler) return false; // izin kapısı yoksa riskli işlem yapılmaz
      try { return await this.permissionHandler({ type, title: `[${session.role}] ${title}`, detail }); } catch { return false; }
    };
    const denied = (what: string) => `Kullanici bu islemi onaylamadi (${what}). Alternatif bir yol dene veya bunu raporunda belirt.`;

    try {
      if (toolName === 'read_file') {
        const text: string = await window.kragaAPI.fs.readFile(resolvedPath(toolArgs.filePath || toolArgs.path));
        return text.length > 60000 ? text.slice(0, 60000) + '\n[... dosya kesildi]' : text;
      } else if (toolName === 'edit_file') {
        const target = resolvedPath(toolArgs.filePath || toolArgs.path);
        const oldStr = toolArgs.oldString ?? toolArgs.old_string ?? '';
        const newStr = toolArgs.newString ?? toolArgs.new_string ?? '';
        const current: string = await window.kragaAPI.fs.readFile(target);
        if (!oldStr || !current.includes(oldStr)) return 'Hata: oldString dosyada bulunamadi.';
        const count = current.split(oldStr).length - 1;
        const all = toolArgs.replaceAll === true;
        if (count > 1 && !all) return `Hata: oldString ${count} kez geciyor; daha fazla baglam ekle veya replaceAll:true ver.`;
        if (!(await askPermission('file_write', 'Dosya Duzenleme Izni', target))) return denied(target);
        await window.kragaAPI.fs.writeFile(target, all ? current.split(oldStr).join(newStr) : current.replace(oldStr, () => newStr));
        return `Dosya guncellendi: ${target}`;
      } else if (toolName === 'grep_search') {
        if (!this.projectPath) return 'Hata: proje klasoru acik degil.';
        const r = await window.kragaAPI.workspace.grep(this.projectPath, toolArgs.pattern || toolArgs.query || '', { glob: toolArgs.glob, ignoreCase: toolArgs.ignoreCase !== false, literal: toolArgs.literal === true });
        if (!r.success) return 'Hata: ' + r.error;
        return r.matches.length ? r.matches.map((m: any) => `${m.file}:${m.line}: ${m.text}`).join('\n') : 'Eslesme yok.';
      } else if (toolName === 'find_files') {
        if (!this.projectPath) return 'Hata: proje klasoru acik degil.';
        const r = await window.kragaAPI.workspace.glob(this.projectPath, toolArgs.pattern || '*');
        if (!r.success) return 'Hata: ' + r.error;
        return r.files.length ? r.files.join('\n') : 'Eslesen dosya yok.';
      } else if (toolName === 'web_search') {
        const r = await window.kragaAPI.web.search(toolArgs.query || '');
        return r.success ? r.results.map((x: any, i: number) => `${i + 1}. ${x.title}\n   ${x.url}\n   ${x.snippet}`).join('\n\n') : 'Hata: ' + r.error;
      } else if (toolName === 'web_fetch') {
        const r = await window.kragaAPI.web.fetch(toolArgs.url || '');
        return r.success ? (r.text || '(bos)') : 'Hata: ' + r.error;
      } else if (toolName === 'read_document') {
        const r = await window.kragaAPI.docs.read(resolvedPath(toolArgs.filePath || toolArgs.path), { range: toolArgs.range, maxChars: toolArgs.maxChars });
        return r.success ? r.text : 'Hata: ' + r.error;
      } else if (toolName === 'create_document') {
        const target = resolvedPath(toolArgs.filePath || toolArgs.path);
        if (!(await askPermission('file_write', 'Belge Yazma Izni', target))) return denied(target);
        const r = await window.kragaAPI.docs.create(target, { title: toolArgs.title, markdown: toolArgs.markdown, blocks: toolArgs.blocks, slides: toolArgs.slides });
        return r.success ? `Belge olusturuldu: ${target}` : 'Hata: ' + r.error;
      } else if (toolName === 'write_file') {
        const target = resolvedPath(toolArgs.filePath || toolArgs.path);
        if (!(await askPermission('file_write', 'Dosya Yazma Izni', target))) return denied(target);
        await window.kragaAPI.fs.writeFile(target, toolArgs.content || '');
        return `Dosya kaydedildi: ${target} (${(toolArgs.content || '').length} karakter)`;
      } else if (toolName === 'list_dir') {
        const target = resolvedPath(toolArgs.dirPath || toolArgs.path || '.');
        const entries = await window.kragaAPI.fs.readDirectory(target);
        return JSON.stringify(entries.map((e: any) => ({ name: e.name, isDirectory: e.isDirectory })), null, 2);
      } else if (toolName === 'run_command') {
        const command = toolArgs.command || toolArgs.cmd;
        if (!command) return 'Hata: command bos.';
        if (!(await askPermission('terminal', 'Terminal Komut Izni', command))) return denied(command);
        const res = await window.kragaAPI.terminal.runCommand(command, this.projectPath || undefined);
        const out: string = res.stdout || res.stderr || `(Cikis kodu: ${res.exitCode})`;
        return out.length > 20000 ? out.slice(0, 8000) + '\n[... kesildi ...]\n' + out.slice(-8000) : out;
      } else if (toolName === 'mcp_call') {
        const server = toolArgs.server;
        const tool = toolArgs.tool || toolArgs.name;
        if (!server || !tool) return 'Hata: mcp_call icin server ve tool gerekli.';
        const connected: string[] = await window.kragaAPI.mcp.getConnectedServers().catch(() => []);
        if (!connected.includes(server)) return `Hata: MCP sunucusu bagli degil: "${server}". Bagli olanlar: ${connected.join(', ') || 'yok'}`;
        const res: any = await window.kragaAPI.mcp.callTool(server, tool, toolArgs.arguments || {});
        if (typeof res === 'string') return res;
        if (res && Array.isArray(res.content)) {
          const text = res.content.map((c: any) => (c.type === 'text' ? c.text : `[${c.type || 'veri'}]`)).join('\n');
          return res.isError ? 'MCP araci hata dondurdu: ' + text : text;
        }
        return JSON.stringify(res, null, 2);
      }
      return `Bilinmeyen arac: ${toolName}`;
    } catch (err: any) {
      return `Arac hatasi (${toolName}): ${err.message || String(err)}`;
    }
  }

  private extractToolCall(text: string): { toolJson: any; rawMatch: string } | null {
    const codeBlockMatch = text.match(/```(?:tool_call|json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (parsed.tool || parsed.name) {
          return { toolJson: parsed, rawMatch: codeBlockMatch[0] };
        }
      } catch {}
    }

    const rawIdx = text.search(/\{\s*"(?:tool|name)"\s*:/i);
    if (rawIdx !== -1) {
      let depth = 0;
      let end = -1;
      let inString = false;
      let escape = false;

      for (let i = rawIdx; i < text.length; i++) {
        const c = text[i];
        if (escape) { escape = false; continue; }
        if (c === '\\') { escape = true; continue; }
        if (c === '"') { inString = !inString; continue; }
        if (!inString) {
          if (c === '{') depth++;
          else if (c === '}') {
            depth--;
            if (depth === 0) { end = i + 1; break; }
          }
        }
      }

      if (end !== -1) {
        const candidate = text.slice(rawIdx, end);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed.tool || parsed.name) {
            return { toolJson: parsed, rawMatch: candidate };
          }
        } catch {}
      }
    }

    return null;
  }

  private buildSubagentSystemPrompt(session: SubagentSession): string {
    const toolsDesc = session.roleDefinition.tools.map(t => {
      switch (t) {
        case 'read_file': return '- read_file: { "filePath": "yol" } -> Dosya icerigini okur';
        case 'write_file': return '- write_file: { "filePath": "yol", "content": "..." } -> Dosya yazar';
        case 'list_dir': return '- list_dir: { "dirPath": "yol" } -> Dizin icerigini listeler';
        case 'run_command': return '- run_command: { "command": "..." } -> Terminal komutu calistirir';
        case 'edit_file': return '- edit_file: { "filePath": "yol", "oldString": "eski", "newString": "yeni", "replaceAll"?: false } -> Tam eslesen metni degistirir';
        case 'grep_search': return '- grep_search: { "pattern": "regex", "glob"?: "*.ts" } -> Projede metin arar';
        case 'find_files': return '- find_files: { "pattern": "**/*.ts" } -> Dosya adi/glob ile dosya bulur';
        case 'web_search': return '- web_search: { "query": "..." } -> Internette arar';
        case 'web_fetch': return '- web_fetch: { "url": "https://..." } -> Web sayfasini metin olarak getirir';
        case 'read_document': return '- read_document: { "filePath": "yol.pdf|.docx|.pptx", "range"?: "1-3" } -> Ofis belgesini okur';
        case 'create_document': return '- create_document: { "filePath": "yol.docx|.pdf|.pptx", "title"?: "...", "markdown"?: "...", "slides"?: [...] } -> Belge olusturur';
        case 'mcp_call': return '- mcp_call: { "server": "...", "tool": "...", "arguments": {...} } -> MCP araci';
        default: return `- ${t}`;
      }
    }).join('\n');

    return `${session.roleDefinition.systemPromptTemplate}

Proje dizini: ${this.projectPath || 'Belirtilmedi'}

Kullanabildigin araclar:
${toolsDesc}

Bir araci cagirmak icin:
\`\`\`tool_call
{
  "tool": "arac_adi",
  "arguments": { ... }
}
\`\`\`

ONEMLI: Gorevini tamamladiginda, sonuncunu net ve ozlu bir paragrafta ozetle. Arac cagirma — sadece ozet yaz.`;
  }
}
