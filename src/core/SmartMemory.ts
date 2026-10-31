export interface MemoryItem {
  id: string;
  content: string;
  createdAt: number;
}

export interface MemoryState {
  enabled: boolean;
  items: MemoryItem[];
  maxItems: number;
}

export class SmartMemoryManager {
  private static readonly STORAGE_KEY = 'kraga-smart-memory';
  private state: MemoryState;
  private listeners: Set<(state: MemoryState) => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): MemoryState {
    try {
      const stored = localStorage.getItem(SmartMemoryManager.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
          items: Array.isArray(parsed.items) ? parsed.items : [],
          maxItems: 20
        };
      }
    } catch (e) {
      console.error('Failed to load smart memory state', e);
    }
    
    return {
      enabled: true,
      items: [],
      maxItems: 20
    };
  }

  private saveState(): void {
    try {
      localStorage.setItem(SmartMemoryManager.STORAGE_KEY, JSON.stringify(this.state));
      this.notifyListeners();
    } catch (e) {
      console.error('Failed to save smart memory state', e);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.state));
  }

  public addItem(content: string): MemoryItem | null {
    if (!this.state.enabled || this.state.items.length >= this.state.maxItems) {
      return null;
    }

    const item: MemoryItem = {
      id: crypto.randomUUID(),
      content: content.slice(0, 150),
      createdAt: Date.now()
    };

    this.state.items.push(item);
    this.saveState();

    return item;
  }

  public removeItem(id: string): void {
    const initialLength = this.state.items.length;
    this.state.items = this.state.items.filter(item => item.id !== id);
    
    if (this.state.items.length !== initialLength) {
      this.saveState();
    }
  }

  public clearAll(): void {
    this.state.items = [];
    this.saveState();
  }

  public getItems(): MemoryItem[] {
    return [...this.state.items];
  }

  public getCount(): number {
    return this.state.items.length;
  }

  public getMax(): number {
    return this.state.maxItems;
  }

  public setEnabled(enabled: boolean): void {
    if (this.state.enabled !== enabled) {
      this.state.enabled = enabled;
      this.saveState();
    }
  }

  public isEnabled(): boolean {
    return this.state.enabled;
  }

  public getSystemPromptInjection(): string {
    if (!this.state.enabled || this.state.items.length === 0) {
      return '';
    }

    const itemsText = this.state.items.map(item => `- ${item.content}`).join('\n');
    return `## Kullanıcı Hafızası\n${itemsText}`;
  }

  public on(event: 'change', callback: (state: MemoryState) => void): void {
    if (event === 'change') {
      this.listeners.add(callback);
    }
  }

  public off(event: 'change', callback: Function): void {
    if (event === 'change') {
      this.listeners.forEach(listener => {
        if (listener === callback) {
          this.listeners.delete(listener);
        }
      });
    }
  }
}
