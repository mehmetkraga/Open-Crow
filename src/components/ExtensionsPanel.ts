// src/components/ExtensionsPanel.ts
// Kraga IDE v2.5 — Eklentiler (Extensions Marketplace) Paneli

import { iconSearch, iconStar, iconDownload } from './icons';
import { logoGitHub, logoDocker } from './brandLogos';

export interface ExtensionDef {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description: string;
  downloads: string;
  rating: number;
  featured?: boolean;
  category: 'languages' | 'linters' | 'formatters' | 'tools' | 'ai';
  iconSvg?: (size?: number) => string;
}

export const EXTENSIONS_CATALOG: ExtensionDef[] = [
  {
    id: 'ms-python',
    name: 'Python',
    publisher: 'Microsoft',
    version: 'v2025.2.0',
    description: 'Python dili, Pylance, akıllı IntelliSense, hata ayıklama ve formatlama desteği.',
    downloads: '124M',
    rating: 4.8,
    featured: true,
    category: 'languages'
  },
  {
    id: 'dbaeumer.vscode-eslint',
    name: 'ESLint',
    publisher: 'Microsoft',
    version: 'v3.0.10',
    description: 'JavaScript ve TypeScript kod standartları denetimi ve otomatik düzeltme.',
    downloads: '48M',
    rating: 4.7,
    featured: true,
    category: 'linters'
  },
  {
    id: 'esbenp.prettier-vscode',
    name: 'Prettier - Code Formatter',
    publisher: 'Prettier',
    version: 'v10.4.0',
    description: 'Evrensel ve popüler kod biçimlendirici (JS, TS, CSS, HTML, JSON, Markdown).',
    downloads: '54M',
    rating: 4.9,
    featured: true,
    category: 'formatters'
  },
  {
    id: 'bradlc.vscode-tailwindcss',
    name: 'Tailwind CSS IntelliSense',
    publisher: 'Tailwind Labs',
    version: 'v0.12.7',
    description: 'Gelişmiş Tailwind sınıf tamamlama, renk önizleme ve linter desteği.',
    downloads: '31M',
    rating: 4.8,
    featured: true,
    category: 'tools'
  },
  {
    id: 'ms-azuretools.vscode-docker',
    name: 'Docker',
    publisher: 'Microsoft',
    version: 'v1.29.0',
    description: 'Dockerfile, Compose yönetimi, container oluşturma ve imaj denetimi.',
    downloads: '37M',
    rating: 4.6,
    iconSvg: logoDocker,
    category: 'tools'
  },
  {
    id: 'eamodio.gitlens',
    name: 'GitLens — Git Supercharged',
    publisher: 'GitKraken',
    version: 'v16.1.0',
    description: 'Kod satır geçmişi, blame annotasyonları, commit grafikleri ve görselleştirme.',
    downloads: '42M',
    rating: 4.9,
    featured: true,
    category: 'tools'
  },
  {
    id: 'prisma.prisma',
    name: 'Prisma',
    publisher: 'Prisma',
    version: 'v5.18.0',
    description: 'Prisma şema dosyaları için tam sözdizimi renklendirme, tamamlama ve linting.',
    downloads: '14M',
    rating: 4.8,
    category: 'languages'
  },
  {
    id: 'rust-lang.rust-analyzer',
    name: 'rust-analyzer',
    publisher: 'The Rust Programming Language',
    version: 'v0.4.2000',
    description: 'Rust programlama dili için modüler dil sunucusu ve yüksek performanslı analiz.',
    downloads: '11M',
    rating: 4.9,
    category: 'languages'
  },
  {
    id: 'formulahendry.auto-rename-tag',
    name: 'Auto Rename Tag',
    publisher: 'Jun Han',
    version: 'v0.1.10',
    description: 'Eşleşen HTML ve XML etiketlerini otomatik olarak eşzamanlı yeniden adlandırır.',
    downloads: '26M',
    rating: 4.7,
    category: 'tools'
  },
  {
    id: 'github.copilot',
    name: 'GitHub Copilot',
    publisher: 'GitHub',
    version: 'v1.200.0',
    description: 'Yapay zekâ destekli gerçek zamanlı kod tamamlama ve iş ortağı önerileri.',
    downloads: '36M',
    rating: 4.6,
    iconSvg: logoGitHub,
    category: 'ai'
  }
];

export interface InstalledExtensionState {
  id: string;
  enabled: boolean;
  installedAt: number;
}

export class ExtensionsPanelManager {
  private container: HTMLElement;
  private installedExtensions: Map<string, InstalledExtensionState> = new Map();
  private currentFilter: 'all' | 'installed' | 'featured' = 'all';
  private searchQuery: string = '';

  constructor(container: HTMLElement) {
    this.container = container;
    this.loadState();
    this.initDOM();
  }

  private loadState(): void {
    try {
      const saved = localStorage.getItem('kraga-installed-extensions');
      if (saved) {
        const arr = JSON.parse(saved) as InstalledExtensionState[];
        arr.forEach(ext => this.installedExtensions.set(ext.id, ext));
      } else {
        // Varsayılan olarak 2 popüler eklentiyi kurulu getir
        this.installedExtensions.set('dbaeumer.vscode-eslint', { id: 'dbaeumer.vscode-eslint', enabled: true, installedAt: Date.now() });
        this.installedExtensions.set('esbenp.prettier-vscode', { id: 'esbenp.prettier-vscode', enabled: true, installedAt: Date.now() });
        this.saveState();
      }
    } catch {
      // ignore
    }
  }

  private saveState(): void {
    try {
      const arr = Array.from(this.installedExtensions.values());
      localStorage.setItem('kraga-installed-extensions', JSON.stringify(arr));
    } catch (e) {
      console.error('Eklenti durumu kaydedilemedi:', e);
    }
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <div class="extensions-panel">
        <div class="extensions-search-bar">
          <div class="extensions-search-input-wrapper">
            <span class="extensions-search-icon">${iconSearch(14)}</span>
            <input
              type="text"
              id="extSearchInput"
              class="extensions-search-input"
              placeholder="Eklentilerde ara... (Marketplace)"
              autocomplete="off"
            />
          </div>
        </div>

        <div class="extensions-filter-tabs">
          <button class="ext-filter-btn ext-filter-btn--active" data-filter="all">Tümü</button>
          <button class="ext-filter-btn" data-filter="installed">Kurulu (${this.installedExtensions.size})</button>
          <button class="ext-filter-btn" data-filter="featured">Önerilen</button>
        </div>

        <div class="extensions-list" id="extensionsListContainer"></div>
      </div>
    `;

    this.bindEvents();
    this.renderList();
  }

  private bindEvents(): void {
    const searchInput = this.container.querySelector('#extSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase().trim();
      this.renderList();
    });

    const filterBtns = this.container.querySelectorAll('.ext-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => b.classList.remove('ext-filter-btn--active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('ext-filter-btn--active');
        this.currentFilter = (target.dataset.filter as any) || 'all';
        this.renderList();
      });
    });
  }

  private renderList(): void {
    const listEl = this.container.querySelector('#extensionsListContainer');
    if (!listEl) return;

    let items = EXTENSIONS_CATALOG.filter(ext => {
      // Arama filtresi
      if (this.searchQuery) {
        const matchesName = ext.name.toLowerCase().includes(this.searchQuery);
        const matchesDesc = ext.description.toLowerCase().includes(this.searchQuery);
        const matchesPub = ext.publisher.toLowerCase().includes(this.searchQuery);
        if (!matchesName && !matchesDesc && !matchesPub) return false;
      }

      // Sekme filtresi
      if (this.currentFilter === 'installed') {
        return this.installedExtensions.has(ext.id);
      }
      if (this.currentFilter === 'featured') {
        return !!ext.featured;
      }
      return true;
    });

    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="ext-empty-state">
          <p>Eşleşen eklenti bulunamadı.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';

    for (const ext of items) {
      const isInstalled = this.installedExtensions.has(ext.id);
      const state = this.installedExtensions.get(ext.id);
      const isEnabled = state?.enabled ?? false;

      const card = document.createElement('div');
      card.className = `extension-card ${isInstalled ? 'extension-card--installed' : ''}`;

      const iconContent = ext.iconSvg ? ext.iconSvg(24) : `
        <div class="ext-default-icon">${ext.name.substring(0, 2).toUpperCase()}</div>
      `;

      card.innerHTML = `
        <div class="extension-card__icon">${iconContent}</div>
        <div class="extension-card__body">
          <div class="extension-card__header">
            <span class="extension-card__title">${ext.name}</span>
            <span class="extension-card__version">${ext.version}</span>
          </div>
          <div class="extension-card__publisher">${ext.publisher}</div>
          <p class="extension-card__desc">${ext.description}</p>
          <div class="extension-card__footer">
            <span class="ext-stat">${iconDownload(12)} ${ext.downloads}</span>
            <span class="ext-stat">${iconStar(12, '#e0af68')} ${ext.rating}</span>
            <div class="ext-actions-group">
              ${isInstalled ? `
                <button class="ext-action-btn btn-toggle-enable" title="${isEnabled ? 'Devre Dışı Bırak' : 'Etkinleştir'}">
                  ${isEnabled ? 'Etkin' : 'Devre Dışı'}
                </button>
                <button class="ext-action-btn ext-action-btn--danger btn-uninstall" title="Kaldır">
                  Kaldır
                </button>
              ` : `
                <button class="ext-action-btn ext-action-btn--primary btn-install" title="Bu Eklentiyi Kur">
                  Kur
                </button>
              `}
            </div>
          </div>
        </div>
      `;

      // Aksiyon dinleyicileri
      const btnInstall = card.querySelector('.btn-install');
      btnInstall?.addEventListener('click', () => {
        this.installedExtensions.set(ext.id, {
          id: ext.id,
          enabled: true,
          installedAt: Date.now()
        });
        this.saveState();
        this.updateFilterCounts();
        this.renderList();
        this.showToast(`"${ext.name}" eklentisi başarıyla kuruldu.`);
      });

      const btnUninstall = card.querySelector('.btn-uninstall');
      btnUninstall?.addEventListener('click', () => {
        if (confirm(`"${ext.name}" eklentisini kaldırmak istiyor musunuz?`)) {
          this.installedExtensions.delete(ext.id);
          this.saveState();
          this.updateFilterCounts();
          this.renderList();
          this.showToast(`"${ext.name}" eklentisi kaldırıldı.`);
        }
      });

      const btnToggle = card.querySelector('.btn-toggle-enable');
      btnToggle?.addEventListener('click', () => {
        if (state) {
          state.enabled = !state.enabled;
          this.saveState();
          this.renderList();
          this.showToast(`"${ext.name}" ${state.enabled ? 'etkinleştirildi' : 'devre dışı bırakıldı'}.`);
        }
      });

      listEl.appendChild(card);
    }
  }

  private updateFilterCounts(): void {
    const installedBtn = this.container.querySelector('[data-filter="installed"]');
    if (installedBtn) {
      installedBtn.textContent = `Kurulu (${this.installedExtensions.size})`;
    }
  }

  private showToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'git-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('git-toast--fade');
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }
}
