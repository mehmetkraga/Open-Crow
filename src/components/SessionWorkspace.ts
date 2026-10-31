// src/components/SessionWorkspace.ts
// Open Crow — Merkezi Sohbet Oturumları ve Geçmiş Çalışma Alanı (Session Workspace Panel)
// Hoş Geldiniz ekranı gibi ana merkez viewport'ta açılır.

import DOMPurify from 'dompurify';
import { ChatHistoryManager, ChatSession } from './ChatHistoryManager';

export interface SessionWorkspaceOptions {
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onClose: () => void;
  onDeleteSession?: (sessionId: string) => void;
}

export class SessionWorkspaceManager {
  private container: HTMLElement;
  private chatHistory: ChatHistoryManager;
  private currentOptions: SessionWorkspaceOptions | null = null;
  private searchQuery: string = '';

  public onStateChange?: (isOpen: boolean) => void;

  constructor(containerId: string, chatHistory: ChatHistoryManager) {
    this.container = document.getElementById(containerId)!;
    this.chatHistory = chatHistory;
  }

  public open(options?: SessionWorkspaceOptions): void {
    if (options) {
      this.currentOptions = options;
    }
    this.searchQuery = '';
    this.container.style.display = 'flex';
    this.render();
    this.onStateChange?.(true);
  }

  public close(): void {
    this.container.style.display = 'none';
    this.container.innerHTML = '';
    this.currentOptions?.onClose();
    this.onStateChange?.(false);
  }

  public refresh(): void {
    if (this.container.style.display !== 'none') {
      this.render();
    }
  }

  private render(): void {
    const allSessions = this.chatHistory.listSessions();
    const totalCount = allSessions.length;
    const totalMessages = allSessions.reduce((acc, s) => acc + (s.messageCount || s.messages?.length || 0), 0);

    let filtered = allSessions;
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = allSessions.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.preview && s.preview.toLowerCase().includes(q)) ||
          (s.model && s.model.toLowerCase().includes(q))
      );
    }

    const pinned = filtered.filter((s) => s.isPinned);
    const unpinned = filtered.filter((s) => !s.isPinned);

    // Tarih gruplaması
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 6 * 86400000;

    const todaySessions = unpinned.filter((s) => s.updatedAt >= todayStart);
    const yesterdaySessions = unpinned.filter((s) => s.updatedAt >= yesterdayStart && s.updatedAt < todayStart);
    const thisWeekSessions = unpinned.filter((s) => s.updatedAt >= weekStart && s.updatedAt < yesterdayStart);
    const olderSessions = unpinned.filter((s) => s.updatedAt < weekStart);

    this.container.innerHTML = `
      <div class="session-workspace-container">
        <!-- Hero Header (Tıpkı Hoş Geldiniz Ekranı Gibi) -->
        <header class="session-workspace-hero">
          <div class="session-workspace-hero__left">
            <div class="session-hero-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="11" r="1"/>
                <circle cx="8" cy="11" r="1"/>
                <circle cx="16" cy="11" r="1"/>
              </svg>
            </div>
            <div class="session-hero-titles">
              <div class="session-hero-tag">OPEN CROW • SOHBET OTURUMLARI & GEÇMİŞ</div>
              <h1 class="session-hero-title">Sohbet Oturumları & Hafıza</h1>
              <div class="session-hero-meta">
                <span class="session-stat-pill">${totalCount} Oturum</span>
                <span class="session-meta-sep">•</span>
                <span class="session-stat-pill">${totalMessages} Mesaj</span>
                <span class="session-meta-sep">•</span>
                <span class="session-meta-text">Tüm geçmiş yerel hafızada güvenle saklanır</span>
              </div>
            </div>
          </div>

          <div class="session-workspace-hero__actions">
            <button class="session-ws-btn session-ws-btn--new" id="btnSessionWsNew">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>Yeni Sohbet</span>
            </button>
            <button class="session-ws-btn session-ws-btn--export" id="btnSessionWsExport" title="Tüm oturumları JSON formatında yedekle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Dışa Aktar</span>
            </button>
            <button class="session-ws-btn session-ws-btn--clear" id="btnSessionWsClear" title="Tüm geçmişi temizle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span>Temizle</span>
            </button>
            <button class="session-ws-btn session-ws-btn--close" id="btnSessionWsClose" title="Paneli Kapat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Arama Çubuğu -->
        <div class="session-search-bar">
          <div class="session-search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              id="sessionWsSearchInput"
              class="session-search-input"
              placeholder="Sohbet başlığı, önizleme metni veya modele göre filtrele..."
              value="${DOMPurify.sanitize(this.searchQuery)}"
            />
            ${this.searchQuery ? '<button id="btnSessionClearSearch" class="session-search-clear">✕</button>' : ''}
          </div>
        </div>

        <!-- Oturum Kartları Izgarası (Grid) -->
        <div class="session-workspace-body">
          ${totalCount === 0 ? `
            <div class="session-empty-state">
              <div class="session-empty-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #8b949e)" stroke-width="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3>Henüz kayıtlı bir sohbet yok</h3>
              <p>Open Crow Agent ile başlattığınız tüm konuşmalar otomatik olarak buraya kaydedilir.</p>
              <button class="session-ws-btn session-ws-btn--new" id="btnSessionWsNewEmpty">
                Yeni Sohbet Başlat
              </button>
            </div>
          ` : `
            ${pinned.length > 0 ? this.renderSessionGroup('📌 Sabitlenen Sohbetler', pinned) : ''}
            ${todaySessions.length > 0 ? this.renderSessionGroup('📅 Bugün', todaySessions) : ''}
            ${yesterdaySessions.length > 0 ? this.renderSessionGroup('⏳ Dün', yesterdaySessions) : ''}
            ${thisWeekSessions.length > 0 ? this.renderSessionGroup('🗓️ Bu Hafta', thisWeekSessions) : ''}
            ${olderSessions.length > 0 ? this.renderSessionGroup('🗄️ Daha Eski', olderSessions) : ''}
            ${filtered.length === 0 ? `
              <div class="session-no-results">
                <p>"${DOMPurify.sanitize(this.searchQuery)}" ile eşleşen sohbet bulunamadı.</p>
              </div>
            ` : ''}
          `}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderSessionGroup(title: string, sessions: ChatSession[]): string {
    return `
      <div class="session-group">
        <h3 class="session-group-title">${title} <span class="session-group-count">(${sessions.length})</span></h3>
        <div class="session-cards-grid">
          ${sessions.map((s) => this.renderSessionCard(s)).join('')}
        </div>
      </div>
    `;
  }

  private renderSessionCard(s: ChatSession): string {
    const date = new Date(s.updatedAt);
    const dateStr = `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    const msgCount = s.messageCount || s.messages?.length || 0;
    const modelName = s.model ? s.model.replace('claude-', '').replace('gpt-', 'GPT-') : 'Open Crow Agent';

    return `
      <div class="session-card ${s.isPinned ? 'session-card--pinned' : ''}" data-id="${s.id}">
        <div class="session-card__header">
          <span class="session-card__model-badge">${DOMPurify.sanitize(modelName)}</span>
          <div class="session-card__header-right">
            <span class="session-card__date">${dateStr}</span>
            <button class="session-card-icon-btn session-card-btn--pin" data-id="${s.id}" title="${s.isPinned ? 'Sabitlemeyi Kaldır' : 'Başa Sabitle'}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="${s.isPinned ? 'var(--accent-color, #00f0ff)' : 'none'}" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="17" x2="12" y2="22"/>
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="session-card__body">
          <h4 class="session-card__title" id="card-title-${s.id}">${DOMPurify.sanitize(s.title || 'İsimsiz Sohbet')}</h4>
          <p class="session-card__preview">${DOMPurify.sanitize(s.preview || 'Bu sohbette henüz mesaj yok.')}</p>
        </div>

        <div class="session-card__footer">
          <span class="session-card__msg-count">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            ${msgCount} mesaj
          </span>
          <div class="session-card__actions">
            <button class="session-card-btn session-card-btn--open" data-id="${s.id}">
              <span>Aç</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <button class="session-card-icon-btn session-card-btn--rename" data-id="${s.id}" title="Yeniden Adlandır">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
              </svg>
            </button>
            <button class="session-card-icon-btn session-card-btn--copy" data-id="${s.id}" title="Markdown Olarak Kopyala">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
            </button>
            <button class="session-card-icon-btn session-card-btn--delete" data-id="${s.id}" title="Sil">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // Top bar actions
    const btnNew = this.container.querySelector('#btnSessionWsNew');
    const btnNewEmpty = this.container.querySelector('#btnSessionWsNewEmpty');
    const handleNew = () => {
      this.close();
      this.currentOptions?.onNewSession();
    };
    btnNew?.addEventListener('click', handleNew);
    btnNewEmpty?.addEventListener('click', handleNew);

    const btnClose = this.container.querySelector('#btnSessionWsClose');
    btnClose?.addEventListener('click', () => {
      this.close();
    });

    const btnExport = this.container.querySelector('#btnSessionWsExport');
    btnExport?.addEventListener('click', () => {
      const json = this.chatHistory.exportAllSessionsJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kraga-sessions-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const btnClear = this.container.querySelector('#btnSessionWsClear');
    btnClear?.addEventListener('click', () => {
      if (confirm('Tüm sohbet geçmişini silmek istediğinize emin misiniz?')) {
        this.chatHistory.clearAllSessions();
        this.render();
        window.dispatchEvent(new CustomEvent('kraga:clear-all-sessions'));
      }
    });

    // Search input
    const searchInput = this.container.querySelector('#sessionWsSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value;
      this.render();
      const newSearchInput = this.container.querySelector('#sessionWsSearchInput') as HTMLInputElement;
      if (newSearchInput) {
        newSearchInput.focus();
        newSearchInput.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
      }
    });

    const btnClearSearch = this.container.querySelector('#btnSessionClearSearch');
    btnClearSearch?.addEventListener('click', () => {
      this.searchQuery = '';
      this.render();
    });

    // Card click & open
    this.container.querySelectorAll('.session-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (
          (e.target as HTMLElement).closest('.session-card-icon-btn') ||
          (e.target as HTMLElement).closest('.session-card-title-input') ||
          (e.target as HTMLElement).closest('.session-card-btn--open')
        ) {
          return;
        }
        const id = (card as HTMLElement).dataset.id;
        if (id) {
          this.close();
          this.currentOptions?.onSelectSession(id);
        }
      });
    });

    // Open button
    this.container.querySelectorAll('.session-card-btn--open').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (id) {
          this.close();
          this.currentOptions?.onSelectSession(id);
        }
      });
    });

    // Pin toggle
    this.container.querySelectorAll('.session-card-btn--pin').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (id) {
          this.chatHistory.togglePin(id);
          this.render();
        }
      });
    });

    // Copy Markdown
    this.container.querySelectorAll('.session-card-btn--copy').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (!id) return;
        const md = this.chatHistory.exportSessionMarkdown(id);
        if (md) {
          await navigator.clipboard.writeText(md);
          alert('Sohbet Markdown formatında panoya kopyalandı!');
        }
      });
    });

    // Rename
    this.container.querySelectorAll('.session-card-btn--rename').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (!id) return;
        const titleEl = document.getElementById(`card-title-${id}`);
        if (!titleEl) return;

        const currentTitle = titleEl.textContent || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'session-card-title-input';
        input.value = currentTitle;

        titleEl.replaceWith(input);
        input.focus();
        input.select();

        const save = () => {
          const newTitle = input.value.trim();
          if (newTitle && newTitle !== currentTitle) {
            this.chatHistory.renameSession(id, newTitle);
          }
          this.render();
        };

        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            ke.preventDefault();
            save();
          } else if (ke.key === 'Escape') {
            this.render();
          }
        });
        input.addEventListener('blur', () => save());
      });
    });

    // Delete
    this.container.querySelectorAll('.session-card-btn--delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (id && confirm('Bu sohbeti silmek istediğinize emin misiniz?')) {
          this.chatHistory.deleteSession(id);
          this.currentOptions?.onDeleteSession?.(id);
          this.render();
        }
      });
    });
  }
}
