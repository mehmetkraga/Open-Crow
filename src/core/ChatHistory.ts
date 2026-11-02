export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type ToolStatus = 'done' | 'error' | 'denied' | 'cancelled';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  model?: string;
  tokensUsed?: number;
  isStarred?: boolean;
  /** assistant: istenen araç çağrıları */
  toolCalls?: ToolCall[];
  /** tool: karşılık geldiği çağrı */
  toolCallId?: string;
  toolName?: string;
  toolStatus?: ToolStatus;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  isPinned: boolean;
  model: string;
  /** Oturumun çalışma klasörü; araçlar yalnızca bu klasörün içinde çalışır */
  workspace?: string;
}

const DB_NAME = 'kraga-ide-chats';
const STORE_NAME = 'sessions';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error("Failed to open database: " + request.error?.message));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('isPinned', 'isPinned', { unique: false });
      }
    };
  });
}

export class ChatHistoryManager {
  public async createSession(title?: string): Promise<ChatSession> {
    const db = await openDB();
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: title || 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPinned: false,
      model: 'default'
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(session);

      request.onsuccess = () => resolve(session);
      request.onerror = () => reject(new Error("Failed to create session: " + request.error?.message));
    });
  }

  public async getSession(id: string): Promise<ChatSession | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Failed to get session: " + request.error?.message));
    });
  }

  public async updateSession(id: string, updates: Partial<ChatSession>): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const session = getRequest.result as ChatSession | undefined;
        if (!session) {
          reject(new Error("Session not found"));
          return;
        }

        const updatedSession = { ...session, ...updates, updatedAt: Date.now() };
        const putRequest = store.put(updatedSession);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error("Failed to update session: " + putRequest.error?.message));
      };
      getRequest.onerror = () => reject(new Error("Failed to get session for update: " + getRequest.error?.message));
    });
  }

  public async deleteSession(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to delete session: " + request.error?.message));
    });
  }

  public async deleteAllSessions(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to delete all sessions: " + request.error?.message));
    });
  }

  public async addMessage(sessionId: string, msg: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const newMessage: ChatMessage = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      session.messages.push(newMessage);
      session.updatedAt = Date.now();
      
      const request = store.put(session);
      
      request.onsuccess = () => resolve(newMessage);
      request.onerror = () => reject(new Error("Failed to add message: " + request.error?.message));
    });
  }

  public async getMessages(sessionId: string): Promise<ChatMessage[]> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    return session.messages;
  }

  public async toggleStarMessage(sessionId: string, messageId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const message = session.messages.find(m => m.id === messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    message.isStarred = !message.isStarred;
    
    await this.updateSession(sessionId, { messages: session.messages });
  }

  public async getAllSessions(): Promise<ChatSession[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('updatedAt');
      const request = index.openCursor(null, 'prev');
      const sessions: ChatSession[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          sessions.push(cursor.value as ChatSession);
          cursor.continue();
        } else {
          resolve(sessions);
        }
      };
      request.onerror = () => reject(new Error("Failed to get sessions: " + request.error?.message));
    });
  }

  public async searchSessions(query: string): Promise<ChatSession[]> {
    const allSessions = await this.getAllSessions();
    const lowerQuery = query.toLowerCase();
    return allSessions.filter(session => session.title.toLowerCase().includes(lowerQuery));
  }

  public async getStarredMessages(): Promise<{session: ChatSession, message: ChatMessage}[]> {
    const allSessions = await this.getAllSessions();
    const starred: {session: ChatSession, message: ChatMessage}[] = [];
    
    for (const session of allSessions) {
      for (const message of session.messages) {
        if (message.isStarred) {
          starred.push({ session, message });
        }
      }
    }
    
    return starred;
  }

  public async getSessionsByDate(): Promise<{today: ChatSession[], yesterday: ChatSession[], older: ChatSession[]}> {
    const allSessions = await this.getAllSessions();
    const result: {today: ChatSession[], yesterday: ChatSession[], older: ChatSession[]} = {
      today: [],
      yesterday: [],
      older: []
    };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;

    for (const session of allSessions) {
      if (session.updatedAt >= todayStart) {
        result.today.push(session);
      } else if (session.updatedAt >= yesterdayStart) {
        result.yesterday.push(session);
      } else {
        result.older.push(session);
      }
    }

    return result;
  }

  public async exportSession(id: string): Promise<string> {
    const session = await this.getSession(id);
    if (!session) {
      throw new Error("Session not found");
    }
    return JSON.stringify(session);
  }

  public async importSession(json: string): Promise<ChatSession> {
    const sessionData = JSON.parse(json) as ChatSession;
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(sessionData);

      request.onsuccess = () => resolve(sessionData);
      request.onerror = () => reject(new Error("Failed to import session: " + request.error?.message));
    });
  }

  public async togglePin(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    await this.updateSession(sessionId, { isPinned: !session.isPinned });
  }

  public async autoTitle(sessionId: string, firstMessage: string): Promise<void> {
    const title = firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage;
    await this.updateSession(sessionId, { title });
  }
}
