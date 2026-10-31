// src/components/OutputPanel.ts
// Kraga IDE — Visual Studio 2022 Çok Kanallı Çıktı Konsolu (Multi-Channel Output Window)
// Yapay Zeka, Derleme, MCP Sunucuları, Git ve Genel IDE loglarını ayrı kanallarda tutar.

export type OutputChannel = 'ai' | 'build' | 'mcp' | 'git' | 'general';
export type OutputLogLevel = 'info' | 'warn' | 'error' | 'success';

export interface OutputLogEntry {
  timestamp: Date;
  level: OutputLogLevel;
  message: string;
}

export class OutputPanelManager {
  private container: HTMLElement;
  private currentChannel: OutputChannel = 'ai';
  private autoScroll: boolean = true;
  private wordWrap: boolean = true;
  private filterQuery: string = '';

  private channelLogs: Map<OutputChannel, OutputLogEntry[]> = new Map([
    ['ai', []],
    ['build', []],
    ['mcp', []],
    ['git', []],
    ['general', []],
  ]);

  private selectChannelEl!: HTMLSelectElement;
  private logViewEl!: HTMLElement;
  private filterInputEl!: HTMLInputElement;
  private btnAutoScrollEl!: HTMLButtonElement;
  private btnWordWrapEl!: HTMLButtonElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initDOM();
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <div class="vs-output-panel">
        <!-- Visual Studio 2022 Output Toolbar -->
        <div class="vs-output-toolbar">
          <div class="vs-output-channel-group">
            <label class="vs-output-label" for="vsOutputChannelSelect">Çıktıyı göster:</label>
            <select class="vs-output-channel-select" id="vsOutputChannelSelect">
              <option value="ai">Kraga AI Ajanı</option>
              <option value="build">Derleme (Build)</option>
              <option value="mcp">MCP Sunucuları</option>
              <option value="git">Kaynak Denetimi (Git)</option>
              <option value="general">Genel (General)</option>
            </select>
          </div>

          <div class="vs-output-search-group">
            <input 
              type="text" 
              class="vs-output-filter-input" 
              id="vsOutputFilterInput" 
              placeholder="Çıktıda ara veya filtrele..."
            />
          </div>

          <div class="vs-output-actions">
            <button class="vs-output-btn" id="btnOutputClear" title="Çıktıyı Temizle">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Temizle</span>
            </button>
            <button class="vs-output-btn active" id="btnOutputAutoScroll" title="Otomatik Kaydırma">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              <span>Otomatik Kaydır</span>
            </button>
            <button class="vs-output-btn active" id="btnOutputWordWrap" title="Sözcük Kaydırma">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>
              <span>Sözcük Kaydır</span>
            </button>
            <button class="vs-output-btn" id="btnOutputCopy" title="Tüm Çıktıyı Kopyala">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Kopyala</span>
            </button>
          </div>
        </div>

        <!-- Output Log Lines Container -->
        <div class="vs-output-body vs-output-body--wrap" id="vsOutputBody"></div>
      </div>
    `;

    this.selectChannelEl = this.container.querySelector('#vsOutputChannelSelect') as HTMLSelectElement;
    this.logViewEl = this.container.querySelector('#vsOutputBody') as HTMLElement;
    this.filterInputEl = this.container.querySelector('#vsOutputFilterInput') as HTMLInputElement;
    this.btnAutoScrollEl = this.container.querySelector('#btnOutputAutoScroll') as HTMLButtonElement;
    this.btnWordWrapEl = this.container.querySelector('#btnOutputWordWrap') as HTMLButtonElement;

    // Dinleyiciler
    this.selectChannelEl.addEventListener('change', () => {
      this.currentChannel = this.selectChannelEl.value as OutputChannel;
      this.render();
    });

    this.filterInputEl.addEventListener('input', () => {
      this.filterQuery = this.filterInputEl.value.toLowerCase().trim();
      this.render();
    });

    this.container.querySelector('#btnOutputClear')?.addEventListener('click', () => {
      this.clear();
    });

    this.btnAutoScrollEl.addEventListener('click', () => {
      this.autoScroll = !this.autoScroll;
      this.btnAutoScrollEl.classList.toggle('active', this.autoScroll);
    });

    this.btnWordWrapEl.addEventListener('click', () => {
      this.wordWrap = !this.wordWrap;
      this.btnWordWrapEl.classList.toggle('active', this.wordWrap);
      this.logViewEl.classList.toggle('vs-output-body--wrap', this.wordWrap);
    });

    this.container.querySelector('#btnOutputCopy')?.addEventListener('click', () => {
      const logs = this.channelLogs.get(this.currentChannel) || [];
      const text = logs.map(l => `[${this.formatTime(l.timestamp)}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
      navigator.clipboard.writeText(text);
    });

    // Başlangıç karşılama logları
    this.append('ai', 'Kraga AI Ajanı hazır ve komutları dinliyor.', 'info');
    this.append('build', 'Derleme çıktısı izleyicisi aktif.', 'info');
    this.append('mcp', 'MCP Model Context Protocol servisleri bağlandı.', 'info');
    this.append('git', 'Git sürüm kontrol kanalı bağlandı.', 'info');
    this.append('general', 'Kraga IDE çalışma alanı başlatıldı.', 'info');
  }

  public append(channel: OutputChannel, message: string, level: OutputLogLevel = 'info'): void {
    const list = this.channelLogs.get(channel);
    if (!list) return;

    const entry: OutputLogEntry = {
      timestamp: new Date(),
      level,
      message,
    };

    list.push(entry);
    if (list.length > 2000) {
      list.shift();
    }

    if (this.currentChannel === channel) {
      this.appendLogDOM(entry);
    }
  }

  public clear(channel?: OutputChannel): void {
    const target = channel || this.currentChannel;
    this.channelLogs.set(target, []);
    if (this.currentChannel === target) {
      this.logViewEl.innerHTML = '';
    }
  }

  public setChannel(channel: OutputChannel): void {
    if (this.currentChannel === channel) return;
    this.currentChannel = channel;
    this.selectChannelEl.value = channel;
    this.render();
  }

  public scrollToBottom(): void {
    if (this.logViewEl) {
      this.logViewEl.scrollTop = this.logViewEl.scrollHeight;
    }
  }

  private render(): void {
    this.logViewEl.innerHTML = '';
    const logs = this.channelLogs.get(this.currentChannel) || [];

    const filtered = this.filterQuery
      ? logs.filter(l => l.message.toLowerCase().includes(this.filterQuery))
      : logs;

    if (filtered.length === 0) {
      this.logViewEl.innerHTML = `<div class="vs-output-empty">Bu kanal için henüz çıktı yok.</div>`;
      return;
    }

    const fragment = document.createDocumentFragment();
    for (const entry of filtered) {
      const line = this.createLineElement(entry);
      fragment.appendChild(line);
    }
    this.logViewEl.appendChild(fragment);

    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  private appendLogDOM(entry: OutputLogEntry): void {
    if (this.filterQuery && !entry.message.toLowerCase().includes(this.filterQuery)) {
      return;
    }
    // Eğer daha önce empty mesajı varsa temizle
    const emptyNotice = this.logViewEl.querySelector('.vs-output-empty');
    if (emptyNotice) {
      emptyNotice.remove();
    }

    const line = this.createLineElement(entry);
    this.logViewEl.appendChild(line);

    if (this.autoScroll) {
      this.scrollToBottom();
    }
  }

  private createLineElement(entry: OutputLogEntry): HTMLElement {
    const line = document.createElement('div');
    line.className = `vs-output-line vs-output-line--${entry.level}`;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'vs-output-timestamp';
    timeSpan.textContent = `[${this.formatTime(entry.timestamp)}]`;

    const levelBadge = document.createElement('span');
    levelBadge.className = `vs-output-badge vs-output-badge--${entry.level}`;
    levelBadge.textContent = entry.level.toUpperCase();

    const msgSpan = document.createElement('span');
    msgSpan.className = 'vs-output-text';
    msgSpan.textContent = entry.message;

    line.appendChild(timeSpan);
    line.appendChild(levelBadge);
    line.appendChild(msgSpan);

    return line;
  }

  private formatTime(d: Date): string {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
}
