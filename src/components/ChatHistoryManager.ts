import { ChatMessage } from '../core/proxyClient';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
  model?: string;
  messageCount?: number;
  preview?: string;
  folderId?: string;
}

export interface ChatFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface GroupedSessions {
  pinned: ChatSession[];
  today: ChatSession[];
  yesterday: ChatSession[];
  pastWeek: ChatSession[];
  older: ChatSession[];
}

export class ChatHistoryManager {
  private storageKey = 'kraga-chat-sessions-v1';
  private activeSessionKey = 'kraga-active-session';

  private getSessions(): Record<string, ChatSession> {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      console.error('ChatHistoryManager getSessions error:', e);
      return {};
    }
  }

  private saveSessions(sessions: Record<string, ChatSession>): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(sessions));
    } catch (e: any) {
      console.warn('ChatHistoryManager: Quota exceeded, applying LRU eviction...', e);
      // Sabitlenmemis en eski oturumlari tespit et
      const unpinnedKeys = Object.keys(sessions)
        .filter(id => !sessions[id].isPinned)
        .sort((a, b) => (sessions[a].updatedAt || sessions[a].createdAt) - (sessions[b].updatedAt || sessions[b].createdAt));

      // Yer acilana kadar en eski oturumlari tek tek silip dene
      while (unpinnedKeys.length > 0) {
        const oldestId = unpinnedKeys.shift()!;
        delete sessions[oldestId];
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(sessions));
          console.info(`[ChatHistoryManager] LRU: ${oldestId} silinerek depolama kurtarildi.`);
          return;
        } catch {
          // Yetersizse sonraki eski oturumu silmeye devam et
        }
      }

      // Son savunma hatti: Mesajlari son 15 mesajla sinirla
      try {
        for (const s of Object.values(sessions)) {
          if (s.messages && s.messages.length > 15) {
            s.messages = s.messages.slice(-15);
          }
        }
        localStorage.setItem(this.storageKey, JSON.stringify(sessions));
      } catch (finalErr) {
        console.error('ChatHistoryManager: Kritik depolama hatasi:', finalErr);
      }
    }
  }

  public saveSession(id: string, title: string, messages: ChatMessage[], model?: string): void {
    if (!id) return;
    const sessions = this.getSessions();
    const existing = sessions[id];

    const preview = this.generatePreview(messages);
    
    sessions[id] = {
      id,
      title: title || existing?.title || 'Yeni Sohbet',
      messages,
      createdAt: existing ? existing.createdAt : Date.now(),
      updatedAt: Date.now(),
      isPinned: existing ? !!existing.isPinned : false,
      model: model || existing?.model || 'GPT 5.4 Mini',
      messageCount: messages.length,
      preview,
      folderId: existing ? existing.folderId : undefined
    };
    
    this.saveSessions(sessions);
  }

  public loadSession(id: string): ChatSession | null {
    const sessions = this.getSessions();
    return sessions[id] || null;
  }

  public getSessionMessages(id: string): ChatMessage[] {
    const s = this.loadSession(id);
    return s && s.messages ? [...s.messages] : [];
  }

  public appendMessageToSession(id: string, message: ChatMessage, model?: string): void {
    if (!id) return;
    const sessions = this.getSessions();
    const existing = sessions[id];
    const msgs = existing && existing.messages ? [...existing.messages, message] : [message];
    const title = existing?.title || this.generateTitle(msgs);
    this.saveSession(id, title, msgs, model || existing?.model);
  }

  public listSessions(): ChatSession[] {
    const sessions = this.getSessions();
    return Object.values(sessions)
      .map(s => ({
        ...s,
        messageCount: s.messageCount ?? (s.messages ? s.messages.length : 0),
        preview: s.preview ?? (s.messages ? this.generatePreview(s.messages) : ''),
        messages: [] // Performans için mesaj gövdesini listede taşıma
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  public togglePin(id: string): boolean {
    const sessions = this.getSessions();
    if (sessions[id]) {
      sessions[id].isPinned = !sessions[id].isPinned;
      sessions[id].updatedAt = Date.now();
      this.saveSessions(sessions);
      return !!sessions[id].isPinned;
    }
    return false;
  }

  public deleteSession(id: string): void {
    const sessions = this.getSessions();
    delete sessions[id];
    this.saveSessions(sessions);
  }

  public clearAllSessions(): void {
    this.saveSessions({});
    localStorage.removeItem(this.activeSessionKey);
  }

  public renameSession(id: string, title: string): void {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const sessions = this.getSessions();
    if (sessions[id]) {
      sessions[id].title = cleanTitle;
      sessions[id].updatedAt = Date.now();
      this.saveSessions(sessions);
    }
  }

  public getActiveSessionId(): string | null {
    return localStorage.getItem(this.activeSessionKey);
  }

  public setActiveSessionId(id: string): void {
    localStorage.setItem(this.activeSessionKey, id);
  }

  public getGroupedSessions(filter?: string): GroupedSessions {
    let list = this.listSessions();

    if (filter && filter.trim()) {
      const q = filter.trim().toLowerCase();
      list = list.filter(s => 
        s.title.toLowerCase().includes(q) || 
        (s.preview && s.preview.toLowerCase().includes(q)) ||
        (s.model && s.model.toLowerCase().includes(q))
      );
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const pastWeekStart = todayStart - (6 * 86400000);

    const pinned: ChatSession[] = [];
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const pastWeek: ChatSession[] = [];
    const older: ChatSession[] = [];

    for (const session of list) {
      if (session.isPinned) {
        pinned.push(session);
        continue;
      }

      const time = session.updatedAt || session.createdAt;
      if (time >= todayStart) {
        today.push(session);
      } else if (time >= yesterdayStart) {
        yesterday.push(session);
      } else if (time >= pastWeekStart) {
        pastWeek.push(session);
      } else {
        older.push(session);
      }
    }

    return { pinned, today, yesterday, pastWeek, older };
  }

  public exportSession(id: string): string {
    const session = this.loadSession(id);
    return session ? JSON.stringify(session, null, 2) : '';
  }

  public exportAllSessionsJson(): string {
    return JSON.stringify(this.getSessions(), null, 2);
  }

  public exportSessionMarkdown(id: string): string {
    const session = this.loadSession(id);
    if (!session) return '';

    const dateStr = new Date(session.createdAt).toLocaleString('tr-TR');
    let md = `# ${session.title}\n\n`;
    md += `*Oluşturulma:* ${dateStr} | *Model:* ${session.model || 'Bilinmiyor'} | *Mesaj Sayısı:* ${session.messages.length}\n\n---\n\n`;

    for (const msg of session.messages) {
      const sender = msg.role === 'user' ? 'Kullanıcı' : msg.role === 'assistant' ? 'Open Crow Agent' : 'Sistem';
      md += `### ${sender}\n\n${msg.content}\n\n---\n\n`;
    }

    return md;
  }

  public generateTitle(messages: ChatMessage[]): string {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (!firstUserMsg || !firstUserMsg.content) return 'Yeni Sohbet';
    
    // Temizle ve tek satıra indir
    const content = firstUserMsg.content
      .replace(/^#+\s*/, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (content.length <= 42) return content || 'Yeni Sohbet';
    return content.substring(0, 42) + '...';
  }

  public generatePreview(messages: ChatMessage[]): string {
    if (!messages || messages.length === 0) return '';
    // Son mesajı bul
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || !lastMsg.content) return '';

    const content = lastMsg.content
      .replace(/<think>[\s\S]*?<\/think>/g, '') // think bloklarını gizle
      .replace(/```[\s\S]*?```/g, '[Kod Bloğu]')
      .replace(/\n+/g, ' ')
      .trim();

    if (content.length <= 65) return content;
    return content.substring(0, 65) + '...';
  }
}
