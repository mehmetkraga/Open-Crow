// src/components/WelcomeTab.ts
// Open Crow v2.0 — Cyberpunk Başlangıç & Hoş Geldiniz Ekranı (VS Code Insiders Üstü Deneyim)

import {
  iconFolder, iconFilePlus, iconGitBranch, iconBrain,
  iconNetwork, iconSparkles, iconPlug, iconDollarSign, iconTrash, iconTerminal, iconClose
} from './icons';
import { THEMES } from './ThemeManager';

export interface WelcomeActions {
  onNewFile: () => void;
  onOpenFolder: () => void;
  onCloneGit: () => void;
  onStartAgent: (promptHint?: string) => void;
  onScanGraphify: () => void;
  onOpenScripts?: () => void;
  onOpenRecent: (folderPath: string) => void;
  onClose?: () => void;
}

export class WelcomeTabManager {
  private container: HTMLElement;
  private actions: WelcomeActions;

  constructor(container: HTMLElement, actions: WelcomeActions) {
    this.container = container;
    this.actions = actions;

    window.addEventListener('kraga:theme-change', (e: any) => {
      const img = this.container.querySelector('#welcomeLogoImg') as HTMLImageElement;
      if (img && e.detail?.theme?.titleLogo) {
        img.src = e.detail.theme.titleLogo;
      }
    });
  }

  public render(): void {
    const recentProjects = this.getRecentProjects();
    const showOnStartup = localStorage.getItem('kraga-show-welcome') !== 'false';

    const currentThemeId = localStorage.getItem('kraga_ide_theme') || 'kraga-cyberpunk';
    const currentTheme = THEMES.find((t) => t.id === currentThemeId) || THEMES[0];
    const initialLogo = currentTheme.titleLogo;

    this.container.innerHTML = `
      <div class="kraga-welcome-container">
        <!-- Hero Header -->
        <div class="welcome-hero">
          <button class="welcome-hero-close" id="btnWelcomeHeroClose" title="Hoş Geldiniz Sekmesini Kapat">
            ${iconClose(16)}
          </button>
          <div class="welcome-hero-branding">
            <img src="${initialLogo}" id="welcomeLogoImg" alt="Open Crow" class="welcome-neon-logo">
            <span class="welcome-version-badge">v1.9.0 • Belgeler, Arama & Çoklu Araç</span>
          </div>
          <p class="welcome-tagline">
            Yapay Zeka Destekli Otonom Geliştirme Ortamı. Yerleşik Act/Plan Ajanı, Canlı Token Maliyet Telemetrisi ve AST Bilgi Grafiği.
          </p>
        </div>

        <!-- 3-Kolonlu Ana Izgara -->
        <div class="welcome-grid">
          <!-- Kolon 1: Başlat -->
          <div class="welcome-card welcome-card--start">
            <h3 class="welcome-card__title">
              <span class="welcome-card__title-accent">Hızlı Başlangıç</span>
            </h3>
            <div class="welcome-actions-list">
              <button class="welcome-action-btn" id="btnWelcomeNewFile">
                ${iconFilePlus(18)}
                <div class="welcome-action-btn__text">
                  <span class="btn-main-label">Yeni Dosya Oluştur</span>
                  <span class="btn-sub-label">Boş bir düzenleyici aç</span>
                </div>
                <kbd>Ctrl+N</kbd>
              </button>

              <button class="welcome-action-btn" id="btnWelcomeOpenFolder">
                ${iconFolder(18)}
                <div class="welcome-action-btn__text">
                  <span class="btn-main-label">Proje Klasörü Aç</span>
                  <span class="btn-sub-label">Mevcut bir projeyi düzenle</span>
                </div>
                <kbd>Ctrl+O</kbd>
              </button>

              <button class="welcome-action-btn" id="btnWelcomeCloneGit">
                ${iconGitBranch(18)}
                <div class="welcome-action-btn__text">
                  <span class="btn-main-label">Git Reposu Klonla</span>
                  <span class="btn-sub-label">Uzak depodan projeyi çek</span>
                </div>
                <kbd>Ctrl+Shift+G</kbd>
              </button>

              <button class="welcome-action-btn welcome-action-btn--agent" id="btnWelcomeStartAgent">
                ${iconBrain(18)}
                <div class="welcome-action-btn__text">
                  <span class="btn-main-label">Open Crow Agent İle Başla</span>
                  <span class="btn-sub-label">Yapay zekaya yeni bir proje tarif et</span>
                </div>
                <kbd>Act / Plan</kbd>
              </button>

              <button class="welcome-action-btn" id="btnWelcomeScanGraphify">
                ${iconNetwork(18)}
                <div class="welcome-action-btn__text">
                  <span class="btn-main-label">Graphify AST Analizi</span>
                  <span class="btn-sub-label">Kod bağımlılık grafiğini çıkar</span>
                </div>
                <kbd>Graph</kbd>
              </button>

              <button class="welcome-action-btn" id="btnWelcomeOpenScripts">
                ${iconTerminal(18)}
                <div class="welcome-action-btn__text">
                  <span class="btn-main-label">Script & Görev Paneli</span>
                  <span class="btn-sub-label">package.json ve terminal görevleri</span>
                </div>
                <kbd>Tasks</kbd>
              </button>
            </div>
          </div>

          <!-- Kolon 2: Son Projeler -->
          <div class="welcome-card welcome-card--recent">
            <div class="welcome-card__header-flex">
              <h3 class="welcome-card__title">
                <span>Son Projeler</span>
              </h3>
              ${recentProjects.length > 0 ? `
                <button class="btn-text-sm" id="btnWelcomeClearRecent" title="Geçmişi Temizle">
                  ${iconTrash(12)} Temizle
                </button>
              ` : ''}
            </div>

            <div class="welcome-recent-list" id="welcomeRecentList">
              ${recentProjects.length > 0 ? recentProjects.map(path => {
                const folderName = path.split(/[\\/]/).filter(Boolean).pop() || path;
                return `
                  <div class="recent-item" data-path="${path}" title="${path}">
                    <div class="recent-item__icon">${iconFolder(16)}</div>
                    <div class="recent-item__info">
                      <span class="recent-item__name">${folderName}</span>
                      <span class="recent-item__path">${path}</span>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div class="welcome-empty-recent">
                  <p>Henüz son açılan proje geçmişi bulunmuyor.</p>
                  <button class="btn-primary-sm" id="btnWelcomeOpenFolderInline">Klasör Seç</button>
                </div>
              `}
            </div>
          </div>

          <!-- Kolon 3: Kraga Zekası (Walkthrough & Superpowers) -->
          <div class="welcome-card welcome-card--features">
            <h3 class="welcome-card__title">
              <span>Open Crow AI Gücü</span>
            </h3>
            <div class="welcome-features-list">
              <div class="feature-badge-box">
                <div class="feature-badge-icon">${iconBrain(16)}</div>
                <div class="feature-badge-content">
                  <h4>Otonom Kodlama Ajanı</h4>
                  <p>Act ve Plan modları, Diff önizleme ve doğrudan dosyalara tek tıkla kod yazımı.</p>
                </div>
              </div>

              <div class="feature-badge-box">
                <div class="feature-badge-icon">${iconSparkles(16)}</div>
                <div class="feature-badge-content">
                  <h4>Çoklu Model & Düşünce (Thinking)</h4>
                  <p>Claude Sonnet 5, Opus 5, Gemini Thinking, GPT-4o ve o3 modelleri arasında anlık geçiş.</p>
                </div>
              </div>

              <div class="feature-badge-box">
                <div class="feature-badge-icon">${iconPlug(16)}</div>
                <div class="feature-badge-content">
                  <h4>68+ Hazır MCP Sunucusu</h4>
                  <p>GitHub, SQLite, Postgres, Notion, Playwright, Stripe, Google Drive vb. araçlarla tam entegre.</p>
                </div>
              </div>

              <div class="feature-badge-box">
                <div class="feature-badge-icon">${iconDollarSign(16)}</div>
                <div class="feature-badge-content">
                  <h4>Canlı Maliyet & Token Sayacı</h4>
                  <p>Her oturumda kullanılan token ve harcanan dolar bütçesini anlık takip edin.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="welcome-footer">
          <label class="welcome-startup-checkbox">
            <input type="checkbox" id="chkShowWelcomeOnStartup" ${showOnStartup ? 'checked' : ''}>
            <span>Başlangıçta bu Hoş Geldiniz sekmesini aç</span>
          </label>
          <div class="welcome-shortcuts-bar">
            <span><kbd>Ctrl+Shift+P</kbd> Komut Paleti</span>
            <span><kbd>Ctrl+P</kbd> Hızlı Dosya</span>
            <span><kbd>Ctrl+\`</kbd> Terminal</span>
            <span><kbd>Ctrl+S</kbd> Kaydet</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    // Hero Kapatma butonu
    this.container.querySelector('#btnWelcomeHeroClose')?.addEventListener('click', () => {
      this.actions.onClose?.();
    });

    // Start butonları
    this.container.querySelector('#btnWelcomeNewFile')?.addEventListener('click', () => {
      this.actions.onNewFile();
    });

    this.container.querySelector('#btnWelcomeOpenFolder')?.addEventListener('click', () => {
      this.actions.onOpenFolder();
    });

    this.container.querySelector('#btnWelcomeOpenFolderInline')?.addEventListener('click', () => {
      this.actions.onOpenFolder();
    });

    this.container.querySelector('#btnWelcomeCloneGit')?.addEventListener('click', () => {
      this.actions.onCloneGit();
    });

    this.container.querySelector('#btnWelcomeStartAgent')?.addEventListener('click', () => {
      this.actions.onStartAgent();
    });

    this.container.querySelector('#btnWelcomeScanGraphify')?.addEventListener('click', () => {
      this.actions.onScanGraphify();
    });

    this.container.querySelector('#btnWelcomeOpenScripts')?.addEventListener('click', () => {
      this.actions.onOpenScripts?.();
    });

    // Son açılanlar tıklama
    const recentItems = this.container.querySelectorAll('.recent-item');
    recentItems.forEach((item) => {
      item.addEventListener('click', () => {
        const path = item.getAttribute('data-path');
        if (path) this.actions.onOpenRecent(path);
      });
    });

    // Geçmiş temizleme
    this.container.querySelector('#btnWelcomeClearRecent')?.addEventListener('click', () => {
      localStorage.removeItem('kraga-recent-projects');
      this.render();
    });

    // Başlangıçta göster checkbox
    const chk = this.container.querySelector('#chkShowWelcomeOnStartup') as HTMLInputElement;
    chk?.addEventListener('change', () => {
      localStorage.setItem('kraga-show-welcome', chk.checked ? 'true' : 'false');
    });
  }

  public addRecentProject(folderPath: string): void {
    let list = this.getRecentProjects();
    list = list.filter(p => p !== folderPath);
    list.unshift(folderPath);
    if (list.length > 8) list = list.slice(0, 8);
    localStorage.setItem('kraga-recent-projects', JSON.stringify(list));
  }

  public getRecentProjects(): string[] {
    try {
      const raw = localStorage.getItem('kraga-recent-projects');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
