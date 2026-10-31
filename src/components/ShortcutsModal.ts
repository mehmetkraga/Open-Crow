// src/components/ShortcutsModal.ts
// Open Crow v1.8.6 — Klavye Kısayolları ve Komut Rehberi Modalı

import { iconClose, iconSearch } from './icons';

export interface ShortcutItem {
  category: 'editor' | 'nav' | 'terminal' | 'ai';
  categoryLabel: string;
  name: string;
  keys: string[];
  description: string;
}

export const SHORTCUTS_DATA: ShortcutItem[] = [
  // Editör & Kodlama
  { category: 'editor', categoryLabel: 'Editör & Kodlama', name: 'Yeni Dosya', keys: ['Ctrl', 'N'], description: 'Yeni bir kod veya metin dosyası oluşturur.' },
  { category: 'editor', categoryLabel: 'Editör & Kodlama', name: 'Dosyayı Kaydet', keys: ['Ctrl', 'S'], description: 'Aktif sekmeyi diske kaydeder.' },
  { category: 'editor', categoryLabel: 'Editör & Kodlama', name: 'Tümünü Kaydet', keys: ['Ctrl', 'Alt', 'S'], description: 'Tüm değiştirilmiş açık sekmeleri kaydeder.' },
  { category: 'editor', categoryLabel: 'Editör & Kodlama', name: 'Sekmeyi Kapat', keys: ['Ctrl', 'W'], description: 'Aktif çalışma alanı sekmesini kapatır.' },
  { category: 'editor', categoryLabel: 'Editör & Kodlama', name: 'Metin Bul & Değiştir', keys: ['Ctrl', 'F'], description: 'Monaco editöründe arama ve değiştirme çubuğunu açar.' },
  { category: 'editor', categoryLabel: 'Editör & Kodlama', name: 'Belgeyi Biçimlendir', keys: ['Shift', 'Alt', 'F'], description: 'Kod dosyasını geçerli linter ve formatlayıcı ile hizalar.' },
  { category: 'editor', categoryLabel: 'Editör & Kodlama', name: 'Satır İçi AI Düzenle (Inline)', keys: ['Ctrl', 'K'], description: 'Seçili kod üzerinde anında yapay zeka düzenleme barını açar.' },
  { category: 'editor', categoryLabel: 'Editör & Kodlama', name: 'Kesme Noktası (Breakpoint)', keys: ['F9'], description: 'İmlecin bulunduğu satıra kırmızı debug kesme noktası koyar/kaldırır.' },
  { category: 'editor', categoryLabel: 'Editör & Kodlama', name: 'Geri Al (Undo)', keys: ['Ctrl', 'Z'], description: 'Son metin veya kod değişikliğini geri alır.' },
  { category: 'editor', categoryLabel: 'Editör & Kodlama', name: 'Yinele (Redo)', keys: ['Ctrl', 'Y'], description: 'Geri alınan değişikliği tekrar uygular.' },

  // Gezinme & Dosya
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Komut Paleti', keys: ['Ctrl', 'Shift', 'P'], description: 'Tüm IDE komutlarını aramak ve çalıştırmak için paleti açar.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Hızlı Dosya Aç', keys: ['Ctrl', 'P'], description: 'Projedeki dosyaları ada göre arayıp anında açar.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Klasör / Proje Aç', keys: ['Ctrl', 'O'], description: 'Yeni bir çalışma alanı veya proje klasörü seçer.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Dosya Gezgini', keys: ['Ctrl', 'Shift', 'E'], description: 'Sol kenar çubuğunda dosya ağacını gösterir.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Projede Arama', keys: ['Ctrl', 'Shift', 'F'], description: 'Tüm proje dosyalarında metin veya regex araması yapar.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Kaynak Kontrolü (Git)', keys: ['Ctrl', 'Shift', 'G'], description: 'Git değişikliklerini, diff ve commit panelini açar.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Eklentiler & MCP Hub', keys: ['Ctrl', 'Shift', 'X'], description: '68 MCP sunucusu ve eklenti pazarını görüntüler.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Sorunlar & Teşhis Paneli', keys: ['Ctrl', 'Shift', 'M'], description: 'Monaco linter ve sözdizimi hata listesini açar.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Zen Modu (Saf Odaklanma)', keys: ['F10'], description: 'Tüm panelleri gizleyerek sadece koda odaklanmayı sağlar.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Tam Ekran', keys: ['F11'], description: 'Uygulamayı tam ekran veya pencere moduna geçirir.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Ayarlar ve Tercihler', keys: ['Ctrl', ','], description: 'API, Model, MCP ve Görünüm ayarları modalini açar.' },
  { category: 'nav', categoryLabel: 'Gezinme & Görünüm', name: 'Open Crow Hakkında', keys: ['F1'], description: 'Sürüm, geliştirici ve sistem mimari bilgilerini gösterir.' },

  // Terminal & Görevler
  { category: 'terminal', categoryLabel: 'Terminal & Görevler', name: 'Terminali Aç / Kapat', keys: ['Ctrl', '`'], description: 'Entegre terminal panelini katlar veya açar.' },
  { category: 'terminal', categoryLabel: 'Terminal & Görevler', name: 'Yeni Terminal Oturumu', keys: ['Ctrl', 'Shift', '`'], description: 'Yeni bir PowerShell / bash terminal sekmesi başlatır.' },
  { category: 'terminal', categoryLabel: 'Terminal & Görevler', name: 'Script & Görev Paneli', keys: ['Ctrl', 'Shift', 'T'], description: 'package.json scriptleri ve NPM görevlerini yönetir.' },

  // Open Crow AI & Ajan
  { category: 'ai', categoryLabel: 'Open Crow AI & Ajan', name: 'Yeni Ajan Oturumu', keys: ['Ctrl', 'Shift', 'N'], description: 'Agent panelinde temiz bir sohbet oturumu başlatır.' },
  { category: 'ai', categoryLabel: 'Open Crow AI & Ajan', name: 'Sohbet Geçmişi', keys: ['Ctrl', 'H'], description: 'Yerleşik sohbet oturumları çekmecesini açar.' },
  { category: 'ai', categoryLabel: 'Open Crow AI & Ajan', name: 'Bağlamı Özetle (/compact)', keys: ['/compact'], description: 'Görüşmeyi zekice özetleyerek bağlam penceresini boşaltır.' },
  { category: 'ai', categoryLabel: 'Open Crow AI & Ajan', name: 'Plan Modu (/plan)', keys: ['/plan'], description: 'Ajanı mimari ve adım adım uygulama planı moduna geçirir.' },
  { category: 'ai', categoryLabel: 'Open Crow AI & Ajan', name: 'Eylem Modu (/act)', keys: ['/act'], description: 'Ajanı doğrudan kod üretme ve dosya yazma moduna geçirir.' },
  { category: 'ai', categoryLabel: 'Open Crow AI & Ajan', name: 'Modeller Konseyi (/council)', keys: ['/council'], description: 'Andrej Karpathy 3 aşamalı kör hakemlik konseyini toplar.' },
  { category: 'ai', categoryLabel: 'Open Crow AI & Ajan', name: 'MCP Sunucuları (/mcp)', keys: ['/mcp'], description: 'Bağlı MCP sunucularını ve etkin araçları listeler.' },
  { category: 'ai', categoryLabel: 'Open Crow AI & Ajan', name: 'Geliştirici Yetenekleri (/skills)', keys: ['/skills'], description: '100 Claude ve Antigravity yeteneğinin durumunu gösterir.' }
];

export class ShortcutsModalManager {
  private overlayEl: HTMLElement | null = null;
  private activeCategory: string = 'all';
  private searchQuery: string = '';

  constructor() {
    this.createDOM();
  }

  private createDOM(): void {
    const existing = document.getElementById('shortcutsModalOverlay');
    if (existing) {
      this.overlayEl = existing;
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'shortcutsModalOverlay';
    overlay.className = 'modal-overlay shortcuts-modal-overlay';
    overlay.style.display = 'none';

    overlay.innerHTML = `
      <div class="shortcuts-modal-window">
        <div class="shortcuts-modal-header">
          <div class="shortcuts-modal-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8"/>
            </svg>
            <div>
              <h3>Klavye Kısayolları ve Komut Rehberi</h3>
              <p>Open Crow v1.9.0 — Üretkenliği artıran tüm kısayol ve komutlar</p>
            </div>
          </div>
          <button id="btnCloseShortcutsModal" class="btn-modal-close" title="Kapat (Esc)">
            ${iconClose(18)}
          </button>
        </div>

        <div class="shortcuts-filter-bar">
          <div class="shortcuts-search-box">
            ${iconSearch(16, 'var(--text-muted)')}
            <input type="text" id="shortcutsSearchInput" placeholder="Kısayol, eylem veya tuş ara (örn: kaydet, bul, terminal, plan)..." />
          </div>
          <div class="shortcuts-category-pills">
            <button class="shortcuts-pill active" data-cat="all">Tümü (${SHORTCUTS_DATA.length})</button>
            <button class="shortcuts-pill" data-cat="editor">Editör & Kodlama</button>
            <button class="shortcuts-pill" data-cat="nav">Gezinme</button>
            <button class="shortcuts-pill" data-cat="terminal">Terminal</button>
            <button class="shortcuts-pill" data-cat="ai">Open Crow AI</button>
          </div>
        </div>

        <div class="shortcuts-modal-body" id="shortcutsListBody">
          <!-- Kısayollar Dinamik Render -->
        </div>

        <div class="shortcuts-modal-footer">
          <span>İpucu: Komut Paletini açmak için dilediğiniz zaman <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> tuşlarına basabilirsiniz.</span>
          <button class="settings-btn" id="btnShortcutsCloseBottom">Tamam</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlayEl = overlay;
    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.overlayEl) return;

    // Kapat butonları
    this.overlayEl.querySelector('#btnCloseShortcutsModal')?.addEventListener('click', () => this.close());
    this.overlayEl.querySelector('#btnShortcutsCloseBottom')?.addEventListener('click', () => this.close());

    // Dış tıkla kapat
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.close();
      }
    });

    // Escape ile kapat
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    // Arama
    const searchInput = this.overlayEl.querySelector('#shortcutsSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase().trim();
      this.renderList();
    });

    // Kategori hapları
    const pills = this.overlayEl.querySelectorAll('.shortcuts-pill');
    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        pills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeCategory = pill.getAttribute('data-cat') || 'all';
        this.renderList();
      });
    });
  }

  public open(): void {
    if (!this.overlayEl) this.createDOM();
    if (!this.overlayEl) return;
    this.overlayEl.style.display = 'flex';
    this.searchQuery = '';
    const searchInput = this.overlayEl.querySelector('#shortcutsSearchInput') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
      setTimeout(() => searchInput.focus(), 80);
    }
    this.renderList();
  }

  public close(): void {
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
  }

  public isOpen(): boolean {
    return this.overlayEl?.style.display === 'flex';
  }

  private renderList(): void {
    if (!this.overlayEl) return;
    const body = this.overlayEl.querySelector('#shortcutsListBody');
    if (!body) return;

    let items = SHORTCUTS_DATA;

    if (this.activeCategory !== 'all') {
      items = items.filter((item) => item.category === this.activeCategory);
    }

    if (this.searchQuery) {
      items = items.filter((item) => {
        return (
          item.name.toLowerCase().includes(this.searchQuery) ||
          item.description.toLowerCase().includes(this.searchQuery) ||
          item.keys.some((k) => k.toLowerCase().includes(this.searchQuery)) ||
          item.categoryLabel.toLowerCase().includes(this.searchQuery)
        );
      });
    }

    if (items.length === 0) {
      body.innerHTML = `
        <div class="shortcuts-empty-state">
          <p>"${this.searchQuery}" ile eşleşen bir kısayol bulunamadı.</p>
        </div>
      `;
      return;
    }

    // Kategoriye göre grupla
    const groups: { [key: string]: ShortcutItem[] } = {};
    for (const item of items) {
      if (!groups[item.categoryLabel]) {
        groups[item.categoryLabel] = [];
      }
      groups[item.categoryLabel].push(item);
    }

    let html = '';
    for (const [catTitle, catItems] of Object.entries(groups)) {
      html += `
        <div class="shortcuts-group">
          <div class="shortcuts-group-title">${catTitle}</div>
          <div class="shortcuts-table">
            ${catItems
              .map(
                (item) => `
              <div class="shortcuts-row">
                <div class="shortcuts-info">
                  <span class="shortcuts-name">${item.name}</span>
                  <span class="shortcuts-desc">${item.description}</span>
                </div>
                <div class="shortcuts-keys">
                  ${item.keys
                    .map(
                      (k, i) => `
                    <kbd class="shortcut-key">${k}</kbd>
                    ${i < item.keys.length - 1 ? '<span class="key-plus">+</span>' : ''}
                  `
                    )
                    .join('')}
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    body.innerHTML = html;
  }
}

export const shortcutsModal = new ShortcutsModalManager();
