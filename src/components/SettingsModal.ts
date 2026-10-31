// src/components/SettingsModal.ts
// Open Crow v2.5 — Tam Ekran, Arama Destekli, Modern Kart Mimarili Ayarlar Modalı

import {
  iconSettings, iconKey, iconZap, iconPalette, iconBarChart,
  iconInfo, iconPlug, iconPuzzle, iconNetwork, iconBrain,
  iconClose, iconEye, iconEyeOff, iconTrash, iconPlus, iconRefresh,
  iconSearch, iconShield, iconLock, iconSparkles, iconCheckCircle,
  iconBell, iconVolume2, iconType, iconFolder
} from './icons';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { TokenTracker } from '../core/TokenTracker';
import { SkillsHubManager } from './SkillsHub';
import { MCPSettingsPanel } from './MCPSettingsPanel';
import { SmartMemoryManager } from '../core/SmartMemory';
import {
  getAllModels, getModelsByCategory, formatContextLimit, getMultiplierClass,
  hasActiveProviderModels, registerPromoModels, registerCustomModel, type ModelInfo
} from '../core/ModelCatalog';
import { fetchAvailableModels } from '../core/proxyClient';
import { permissionManager, type PermissionMode } from '../core/PermissionManager';
import { notificationManager } from '../core/NotificationManager';

export type SettingsTabId = 'api' | 'kragaModels' | 'features' | 'permissions' | 'general' | 'usage' | 'mcp' | 'skills' | 'graphify' | 'memory' | 'about' | 'updates';

export class SettingsModalManager {
  private overlayEl: HTMLElement | null = null;
  private activeTab: SettingsTabId = 'api';
  private tokenTracker = TokenTracker.getInstance();
  private skillsHub: SkillsHubManager;
  private mcpPanel: MCPSettingsPanel;
  private smartMemory = new SmartMemoryManager();
  private searchQuery: string = '';

  // Settings state
  private settings = {
    mode: 'custom' as 'custom',
    baseUrl: '',
    apiKey: '',
    defaultModel: localStorage.getItem('kraga:model') || 'gpt-5.4-mini',
    maxContext: 200000,
    maxOutput: 8192,
    maxToolLoops: 35,
    streamResponse: true,
    autoCompact: true,
    webSearch: false,
    soundEffects: true,
    notifications: true,
    systemPrompt: 'Sen Open Crow AI, kıdemli bir yazılım mimarı ve kodlama asistanısın. Doğrudan, yüksek sinyalli ve temiz çözümler sun.',
    theme: 'original-dark',
    language: 'tr',
    chatFont: 'sans' as 'sans' | 'serif' | 'mono' | 'system',
    motion: 'system' as 'system' | 'reduced',
    notifyOnResponse: true,
    notificationSound: true,
    fontSize: 13,
    editorFontFamily: 'JetBrains Mono',
    fontLigatures: true,
    lineNumbers: 'on' as 'on' | 'off' | 'relative',
    tabSize: 2,
    wordWrap: true,
    minimap: true,
    defaultWorkspacePath: '',
    autoCheckUpdatesHourly: true,
  };

  private onThemeChangeCallback?: (theme: string) => void;
  public onDefaultWorkspaceChange?: (path: string) => void;
  public onAppearanceChange?: (appearance: {
    chatFont: 'sans' | 'serif' | 'mono' | 'system';
    motion: 'system' | 'reduced';
  }) => void;
  public onEditorSettingsChange?: (editorSettings: {
    fontSize: number;
    tabSize: number;
    wordWrap: boolean;
    minimap: boolean;
    editorFontFamily: string;
    fontLigatures: boolean;
    lineNumbers: 'on' | 'off' | 'relative';
  }) => void;

  constructor(skillsHub: SkillsHubManager, onThemeChange?: (theme: string) => void) {
    this.skillsHub = skillsHub;
    this.mcpPanel = new MCPSettingsPanel();
    this.onThemeChangeCallback = onThemeChange;

    this.loadSettings();
    this.applyChatFont(this.settings.chatFont);
    this.applyMotion(this.settings.motion);
    this.initDOM();

    // Arka plan otomatik güncelleme sinyal dinleyicisi
    try {
      (window as any).kragaAPI?.updater?.onAvailable((info: any) => {
        const navPill = document.getElementById('settingsUpdateNavPill');
        if (navPill) navPill.style.display = 'inline-block';
        notificationManager.showToast({
          title: '🚀 Yeni Open Crow Güncellemesi!',
          message: `${info.latestVersion} sürümü yayınlandı. Ayarlar üzerinden tek tıkla yükleyebilirsiniz.`,
          type: 'info',
          durationMs: 10000,
          action: {
            label: 'Güncelle',
            onClick: () => {
              this.open('updates');
            },
          },
        });
      });
    } catch {}
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('kraga-ide-settings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch {
      // defaults
    }
  }

  public saveSettings(): void {
    try {
      localStorage.setItem('kraga-ide-settings', JSON.stringify(this.settings));
      this.tokenTracker.notifySettingsChanged();
      window.dispatchEvent(new CustomEvent('kraga:settings-changed', { detail: this.settings }));
    } catch (e) {
      console.error('Ayarlar kaydedilemedi:', e);
    }
  }

  public getSettings() {
    return this.settings;
  }

  public getDefaultWorkspacePath(): string {
    return this.settings.defaultWorkspacePath || '';
  }

  public setDefaultWorkspacePath(path: string): void {
    this.settings.defaultWorkspacePath = path;
    this.saveSettings();
    this.onDefaultWorkspaceChange?.(path);
  }


  public getSmartMemory(): SmartMemoryManager {
    return this.smartMemory;
  }

  public getSkillsHub(): SkillsHubManager {
    return this.skillsHub;
  }

  public getMCPPanel(): MCPSettingsPanel {
    return this.mcpPanel;
  }

  private initDOM(): void {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'settings-modal-overlay settings-modal-overlay--fullscreen settings-modal-overlay--hidden';
    this.overlayEl.innerHTML = `
      <div class="settings-modal settings-modal--fullscreen">
        <!-- Üst Arama & Başlık Barı -->
        <div class="settings-topbar">
          <div class="settings-topbar__brand">
            <span class="settings-topbar__icon">${iconSettings(20, 'var(--accent-color, #00f0ff)')}</span>
            <span class="settings-topbar__title">Ayarlar</span>
          </div>

          <div class="settings-search-wrapper">
            <span class="settings-search-icon">${iconSearch(16)}</span>
            <input
              type="text"
              id="settingsSearchInput"
              class="settings-search-input"
              placeholder="Ayarlarda ara... (Modeller, Temalar, MCP, Parametreler)"
              autocomplete="off"
            />
            <button id="btnClearSettingsSearch" class="btn-clear-search" style="display: none;">${iconClose(14)}</button>
          </div>

          <div class="settings-topbar__actions">
            <button class="settings-modal__close-btn" id="btnSettingsClose" title="Ayarları Kapat (Esc)">
              <span class="settings-close-icon">${iconClose(16)}</span>
              <span class="settings-close-text">Ayarları Kapat</span>
              <kbd class="settings-close-kbd">Esc</kbd>
            </button>
          </div>
        </div>

        <!-- İki Sütunlu Gövde Düzeni -->
        <div class="settings-layout">
          <!-- Sol Kategori Menüsü -->
          <nav class="settings-nav">
            <div class="settings-nav__group-label">YAPILANDIRMA</div>
            <button class="settings-nav__item" data-tab="api">
              ${iconKey(16)} <span>API & Modeller</span>
            </button>
            <button class="settings-nav__item" data-tab="kragaModels">
              ${iconSparkles(16)} <span>Modeller</span>
            </button>
            <button class="settings-nav__item" data-tab="features">
              ${iconZap(16)} <span>Özellikler & AI</span>
            </button>
            <button class="settings-nav__item" data-tab="permissions">
              ${iconShield(16)} <span>İzinler & Güvenlik</span>
            </button>
            <button class="settings-nav__item" data-tab="general">
              ${iconPalette(16)} <span>Görünüm & Editör</span>
            </button>
            <button class="settings-nav__item" data-tab="usage">
              ${iconBarChart(16)} <span>Kullanım & Token</span>
            </button>

            <div class="settings-nav__group-label" style="margin-top: 16px;">GENİŞLETİLEBİLİRLİK</div>
            <button class="settings-nav__item" data-tab="mcp">
              ${iconPlug(16)} <span>MCP Sunucuları</span>
            </button>
            <button class="settings-nav__item" data-tab="skills">
              ${iconPuzzle(16)} <span>Yetenekler (Skills)</span>
            </button>
            <button class="settings-nav__item" data-tab="graphify">
              ${iconNetwork(16)} <span>Graphify Analiz</span>
            </button>
            <button class="settings-nav__item" data-tab="memory">
              ${iconBrain(16)} <span>Akıllı Hafıza</span>
            </button>

            <div class="settings-nav__group-label" style="margin-top: 16px;">SİSTEM</div>
            <button class="settings-nav__item" data-tab="updates">
              ${iconRefresh(16)} <span>Güncellemeler</span>
              <span class="settings-update-nav-pill" id="settingsUpdateNavPill" style="display: none;">Yeni</span>
            </button>
            <button class="settings-nav__item" data-tab="about">
              ${iconInfo(16)} <span>Hakkında</span>
            </button>

            <div class="settings-nav__spacer" style="flex: 1; min-height: 16px;"></div>
            <div class="settings-nav__footer">
              <button class="settings-nav__back-btn" id="btnSettingsNavBack" title="Editöre Dön (Esc)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                <span>Editöre Dön</span>
                <kbd class="settings-close-kbd">Esc</kbd>
              </button>
            </div>
          </nav>

          <!-- Sağ İçerik Alanı -->
          <div class="settings-content-area">
            <div class="settings-content-header">
              <h2 class="settings-content-title" id="settingsTabTitle">API & Modeller</h2>
              <span class="settings-tab-badge" id="settingsTabBadge">Aktif</span>
            </div>
            <div class="settings-content-body" id="settingsTabBody"></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);

    // Sekme geçiş listener'ları
    this.overlayEl.querySelectorAll('.settings-nav__item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLElement).dataset.tab as SettingsTabId;
        if (tab) this.switchTab(tab);
      });
    });

    // Arama filtre listener'ı
    const searchInput = this.overlayEl.querySelector('#settingsSearchInput') as HTMLInputElement;
    const btnClearSearch = this.overlayEl.querySelector('#btnClearSettingsSearch') as HTMLElement;

    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase().trim();
      btnClearSearch.style.display = this.searchQuery ? 'flex' : 'none';
      this.applySearchFilter();
    });

    btnClearSearch?.addEventListener('click', () => {
      searchInput.value = '';
      this.searchQuery = '';
      btnClearSearch.style.display = 'none';
      this.applySearchFilter();
    });

    // Kapatma listener'ları
    this.overlayEl.querySelector('#btnSettingsClose')?.addEventListener('click', () => this.close());
    this.overlayEl.querySelector('#btnSettingsNavBack')?.addEventListener('click', () => this.close());

    // Modal arkasına tıklayarak kapatma
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.close();
      }
    });

    // Yakalama fazında Escape tuşuyla anında kapatma
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlayEl && !this.overlayEl.classList.contains('settings-modal-overlay--hidden')) {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    }, true);
  }

  public open(tab?: SettingsTabId): void {
    if (!this.overlayEl) return;
    const targetTab = tab || 'api';
    this.switchTab(targetTab);
    this.overlayEl.classList.remove('settings-modal-overlay--hidden');
  }

  public close(): void {
    if (!this.overlayEl) return;
    this.overlayEl.classList.add('settings-modal-overlay--hidden');
    this.saveSettings();
  }

  public switchTab(tab: SettingsTabId): void {
    this.activeTab = tab;
    const items = this.overlayEl?.querySelectorAll('.settings-nav__item');
    items?.forEach(btn => {
      const isCurrent = (btn as HTMLElement).dataset.tab === tab;
      btn.classList.toggle('settings-nav__item--active', isCurrent);
      btn.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
    });

    this.renderCurrentTab();
  }

  private renderCurrentTab(): void {
    const titleEl = this.overlayEl?.querySelector('#settingsTabTitle');
    const badgeEl = this.overlayEl?.querySelector('#settingsTabBadge');
    const bodyEl = this.overlayEl?.querySelector('#settingsTabBody') as HTMLElement;
    if (!titleEl || !bodyEl) return;

    const meta: Record<SettingsTabId, { title: string; badge: string }> = {
      api: { title: 'API & Model Yapılandırması', badge: 'Sağlayıcı & BYOK' },
      kragaModels: { title: 'Open Crow AI Modelleri & Maliyet Çarpanları', badge: '5 Kategori' },
      features: { title: 'Özellikler & AI Davranışları', badge: 'Streaming & Otomasyon' },
      permissions: { title: 'Çalışma İzinleri & Güvenlik Politikası', badge: 'Cursor Modeli' },
      general: { title: 'Görünüm & Editör Tercihleri', badge: 'Tema & Font' },
      usage: { title: 'Token & Bakiye Gösterge Paneli', badge: 'Telemetri' },
      mcp: { title: 'Model Context Protocol (MCP) Connectors Hub', badge: 'Doğrulanmış Katalog' },
      skills: { title: 'Akıllı Yetenekler Hub (Skills)', badge: 'Genişletmeler' },
      graphify: { title: 'Graphify — Kod AST Analiz Motoru', badge: 'Bilgi Grafı' },
      memory: { title: 'Akıllı Hafıza (Smart Memory)', badge: 'Bağlam Kalıcılığı' },
      updates: { title: 'Uygulama Güncellemeleri & Sürümler', badge: 'Auto-Updater' },
      about: { title: 'Open Crow Hakkında', badge: 'v1.9.0' }
    };

    titleEl.textContent = meta[this.activeTab].title;
    if (badgeEl) badgeEl.textContent = meta[this.activeTab].badge;

    switch (this.activeTab) {
      case 'api':
        this.renderApiTab(bodyEl);
        break;
      case 'kragaModels':
        this.renderKragaModelsTab(bodyEl);
        break;
      case 'features':
        this.renderFeaturesTab(bodyEl);
        break;
      case 'permissions':
        this.renderPermissionsTab(bodyEl);
        break;
      case 'general':
        this.renderGeneralTab(bodyEl);
        break;
      case 'usage':
        this.renderUsageTab(bodyEl);
        break;
      case 'mcp':
        this.mcpPanel.render(bodyEl);
        break;
      case 'skills':
        this.skillsHub.render(bodyEl);
        break;
      case 'graphify':
        this.renderGraphifyTab(bodyEl);
        break;
      case 'memory':
        this.renderMemoryTab(bodyEl);
        break;
      case 'updates':
        this.renderUpdatesTab(bodyEl);
        break;
      case 'about':
        this.renderAboutTab(bodyEl);
        break;
    }

    if (this.searchQuery) {
      this.applySearchFilter();
    }
  }

  private applySearchFilter(): void {
    const bodyEl = this.overlayEl?.querySelector('#settingsTabBody');
    if (!bodyEl) return;

    const cards = bodyEl.querySelectorAll('.settings-card, .settings-section, .settings-toggle-row');
    if (!this.searchQuery) {
      cards.forEach(c => ((c as HTMLElement).style.display = ''));
      return;
    }

    cards.forEach(card => {
      const text = (card as HTMLElement).textContent?.toLowerCase() || '';
      const matches = text.includes(this.searchQuery);
      (card as HTMLElement).style.display = matches ? '' : 'none';
    });
  }

  // 1.5. KRAGA MODELLERİ & ÇARPANLAR TAB
  private renderKragaModelsTab(container: HTMLElement): void {
    const categories: {
      id: ModelInfo['category'];
      name: string;
      range: string;
      tierClass: string;
      desc: string;
      useCase: string;
    }[] = [
      {
        id: 'eco',
        name: 'Hızlı & Ucuz (Eco)',
        range: '< 1.0x (0.38x - 0.63x)',
        tierClass: 'model-mult-badge--eco',
        desc: 'Hızlı yanıtlar, basit dosya okuma, regex yazımı ve hızlı düzeltmeler için en düşük maliyetli modeller.',
        useCase: 'Günlük hızlı sorular, küçük kod refactorları, test üretimi ve anlık açıklama talepleri.'
      },
      {
        id: 'daily',
        name: 'Günlük Geliştirme (Daily)',
        range: '1.0x - 1.5x',
        tierClass: 'model-mult-badge--base',
        desc: 'Dengeli zeka, geniş bağlam penceresi ve güvenilir kod kalitesi sunan ana geliştirici modelleri.',
        useCase: 'Karmaşık fonksiyonlar, hata ayıklama, TypeScript dönüşümleri ve genel proje geliştirme.'
      },
      {
        id: 'pro',
        name: 'Profesyonel Mimari (Pro)',
        range: '2.5x',
        tierClass: 'model-mult-badge--pro',
        desc: 'Üstün akıl yürütme, derin mantık zincirleri ve genişletilmiş context analizi için profesyonel modeller.',
        useCase: 'Mimari tasarım, güvenlik analizi, çoklu dosya refactorı ve derinlemesine hata tespiti.'
      },
      {
        id: 'flagship',
        name: 'Amiral Gemisi & 1M Bağlam (Flagship)',
        range: '5.0x',
        tierClass: 'model-mult-badge--flagship',
        desc: '1 Milyon token bağlam penceresi ve sektör lideri muhakeme yeteneğine sahip en güçlü modeller.',
        useCase: 'Tüm projeyi tek seferde bağlama alma, büyük monorepo mimari analizleri ve en zorlu kodlama problemleri.'
      },
      {
        id: 'image',
        name: 'Görsel & Çok Modlu (Image)',
        range: '0.5x - 1.0x',
        tierClass: 'model-mult-badge--eco',
        desc: 'Ekran görüntüsü, UI mockup ve görsel analiz yeteneği olan çok modlu modeller.',
        useCase: 'Tasarım çizimlerinden frontend kodu üretme, görsel hata bildirimlerini analiz etme ve şema okuma.'
      }
    ];

    let html = `
      <div class="kraga-models-tab">
        <div class="settings-card" style="margin-bottom: 4px;">
          <div class="settings-card__header">
            <div class="settings-card__icon-wrap">${iconSparkles(18, 'var(--accent-color, #00f0ff)')}</div>
            <div>
              <h3 class="settings-card__title">Open Crow AI Model ve Çarpan Rehberi</h3>
              <p class="settings-card__desc">
                Her modelin harcadığı token miktarı web sitemizdeki gibi renkli maliyet çarpanı ile hesaplanır. Örneğin 1.0x standart tüketimken, 0.5x yarı yarıya tasarruf sağlar, 5.0x ise 1M bağlam penceresine sahip amiral gemisi işlemcisidir. Aşağıdan modellerin kullanım amaçlarını inceleyebilir ve tek tıkla varsayılan modelinizi seçebilirsiniz.
              </p>
            </div>
          </div>
        </div>
    `;

    for (const cat of categories) {
      const models = getModelsByCategory(cat.id);
      html += `
        <div class="kraga-category-section">
          <div class="kraga-category-header">
            <div class="kraga-category-title-wrap">
              <div class="kraga-category-title">
                <span>${cat.name}</span>
                <span class="model-mult-badge ${cat.tierClass}">${cat.range}</span>
              </div>
              <p class="kraga-category-desc">${cat.desc}</p>
              <p class="kraga-category-desc" style="color: var(--text-secondary); margin-top: 2px;">
                <strong>Önerilen Kullanım:</strong> ${cat.useCase}
              </p>
            </div>
          </div>

          <div class="kraga-model-grid">
            ${models.map(m => {
              const isDefault = this.settings.defaultModel === m.id;
              const multClass = getMultiplierClass(m.multiplier);
              return `
                <div class="kraga-model-card ${isDefault ? 'kraga-model-card--active' : ''}">
                  <div class="kraga-model-card__header">
                    <span class="kraga-model-card__name" title="${m.name}">${m.name}</span>
                    <span class="model-mult-badge ${multClass}">${m.multiplier}x</span>
                  </div>

                  <div class="kraga-model-card__badges">
                    <span class="kraga-model-card__spec">${formatContextLimit(m.contextLimit)} Bağlam</span>
                    <span class="kraga-model-card__spec">${formatContextLimit(m.maxOutput)} Çıkış</span>
                    ${m.supportsThinking ? '<span class="kraga-model-card__spec" style="color: var(--accent-purple, #b44dff);">Düşünme</span>' : ''}
                    ${m.supportsImages ? '<span class="kraga-model-card__spec" style="color: var(--accent-cyan, #00f0ff);">Görsel</span>' : ''}
                    ${m.badge ? `<span class="kraga-model-card__spec" style="color: var(--status-yellow, #f59e0b);">${m.badge}</span>` : ''}
                  </div>

                  <button
                    class="kraga-model-card__btn ${isDefault ? 'kraga-model-card__btn--selected' : ''}"
                    data-model-id="${m.id}"
                  >
                    ${isDefault ? `${iconCheckCircle(13)} Varsayılan Model` : 'Varsayılan Olarak Seç'}
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Buton dinleyicileri
    container.querySelectorAll('.kraga-model-card__btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modelId = (e.currentTarget as HTMLElement).dataset.modelId;
        if (modelId) {
          this.settings.defaultModel = modelId;
          localStorage.setItem('kraga:model', modelId);
          this.saveSettings();
          this.renderKragaModelsTab(container);

          // Popover ve Agent bar ile senkronize et
          window.dispatchEvent(new CustomEvent('kraga:default-model-changed', { detail: { modelId } }));
        }
      });
    });
  }

  // 1. API & PROMO TAB
  private renderApiTab(container: HTMLElement): void {
    const models = getAllModels();
    const hasProvider = hasActiveProviderModels();

    const buildModelOptions = (modelList: ModelInfo[], selectedId: string): string => {
      return modelList.map(m => `
        <option value="${m.id}" ${selectedId === m.id ? 'selected' : ''}>
          ${m.name} (${m.categoryLabel} - ${m.multiplier}x)
        </option>
      `).join('');
    };

    container.innerHTML = `
      <div class="settings-card" id="apiModeCustomSection">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconNetwork(18, '#7aa2f7')}</div>
          <div>
            <h3 class="settings-card__title">Özel Endpoint & API Anahtarı</h3>
            <p class="settings-card__desc">Özel model sağlayıcısının base URL'i ve gizli kimlik anahtarı.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="settings-form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="settings-field-label" style="margin-bottom: 0;">API Base URL</label>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="settings-btn settings-btn--sm" id="btnPresetOpenAI" style="padding: 2px 8px; font-size: 11px; background: rgba(255, 255, 255, 0.05); color: #a9b1d6; border: 1px solid rgba(255, 255, 255, 0.15); cursor: pointer; border-radius: 4px;">OpenAI</button>
              </div>
            </div>
            <input type="text" id="setBaseUrl" value="${this.settings.baseUrl}" class="settings-input" placeholder="https://api.openai.com/v1" />
          </div>
          <div class="settings-form-group" style="margin-top: 12px;">
            <label class="settings-field-label">API Anahtarı (API Key)</label>
            <div class="settings-form-row">
              <input type="password" id="setApiKey" value="${this.settings.apiKey}" class="settings-input" placeholder="sk-..." />
              <button class="settings-btn" id="btnToggleApiKey" title="Göster/Gizle">${iconEye(14)}</button>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconBrain(18, '#bb9af7')}</div>
          <div>
            <h3 class="settings-card__title">Varsayılan Model & Çıktı Parametreleri</h3>
            <p class="settings-card__desc">Agent sohbetlerinde varsayılan olarak başlatılacak model ve limitler.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="settings-grid-2">
            <div class="settings-form-group">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="settings-field-label" id="modelSelectLabel" style="margin-bottom: 0;">Varsayılan Model ${hasProvider ? `(${models.length} Aktif Model)` : ''}</label>
                <div style="display: flex; gap: 6px;">
                  <button type="button" class="settings-btn settings-btn--sm" id="btnAddCustomModelInSettings" style="padding: 2px 8px; font-size: 11px; background: rgba(187, 154, 247, 0.15); color: #bb9af7; border: 1px solid rgba(187, 154, 247, 0.3); cursor: pointer; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" title="Kataloğa Yeni Model ID Ekle">
                    <span>${iconPlus(12)}</span>
                    <span>+ Özel Model</span>
                  </button>
                  <button type="button" class="settings-btn settings-btn--sm" id="btnRefreshModelsInSettings" style="padding: 2px 8px; font-size: 11px; background: rgba(0, 240, 255, 0.12); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3); cursor: pointer; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;" title="Sağlayıcı veya Promo Kodundan Modelleri Yenile">
                    <span>${iconRefresh(12)}</span>
                    <span id="refreshModelsBtnText">Modelleri Yenile</span>
                  </button>
                </div>
              </div>
              <select id="setDefaultModel" class="settings-select">
                ${buildModelOptions(models, this.settings.defaultModel)}
              </select>
            </div>
            <div class="settings-form-group">
              <label class="settings-field-label">Maks. Çıktı Yanıt Limiti (Tokens)</label>
              <input type="number" id="setMaxOutput" value="${this.settings.maxOutput}" class="settings-input" step="1024" min="1024" max="128000" />
            </div>
          </div>
        </div>
      </div>
    `;

    const modelSelectEl = container.querySelector('#setDefaultModel') as HTMLSelectElement | null;
    const modelLabelEl = container.querySelector('#modelSelectLabel') as HTMLElement | null;

    const refreshModelsUI = async (showNotification = false) => {
      const btnText = container.querySelector('#refreshModelsBtnText');
      if (btnText) btnText.textContent = 'Alınıyor...';
      try {
        const isCustomMode = this.settings.mode === 'custom';
        const fetched = await fetchAvailableModels({
          customApiKey: isCustomMode ? this.settings.apiKey : undefined,
          customBaseUrl: isCustomMode ? this.settings.baseUrl : undefined
        });
        if (fetched && fetched.length > 0) {
          registerPromoModels(fetched);
          const updatedModels = getAllModels();
          if (modelSelectEl) {
            modelSelectEl.innerHTML = buildModelOptions(updatedModels, this.settings.defaultModel);
          }
          if (modelLabelEl) {
            modelLabelEl.textContent = `Varsayılan Model (${updatedModels.length} Aktif Model)`;
          }
          if (showNotification) {
            notificationManager.showToast({
              title: 'Modeller Güncellendi',
              message: `${updatedModels.length} model kullanıma hazır.`,
              type: 'success'
            });
          }
        } else {
          if (showNotification) {
            notificationManager.showToast({
              title: 'Model Bulunamadı',
              message: 'Sağlayıcıdan model listesi alınamadı.',
              type: 'warning'
            });
          }
        }
      } catch (err: any) {
        if (showNotification) {
          notificationManager.showToast({
            title: 'Model Yenileme Hatası',
            message: err?.message || 'Modeller alınamadı.',
            type: 'error'
          });
        }
      } finally {
        if (btnText) btnText.textContent = 'Modelleri Yenile';
      }
    };

    container.querySelector('#btnRefreshModelsInSettings')?.addEventListener('click', () => {
      refreshModelsUI(true);
    });

    container.querySelector('#btnAddCustomModelInSettings')?.addEventListener('click', () => {
      const backdrop = document.createElement('div');
      backdrop.className = 'kraga-switch-model-backdrop';
      backdrop.innerHTML = `
        <div class="kraga-switch-model-modal" role="dialog" aria-modal="true" style="max-width: 480px;">
          <div class="kraga-switch-model-title" style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--accent-color, #00f0ff);">${iconSparkles(18)}</span>
            <span>Özel Model Tanımla & Seç</span>
          </div>
          <div class="kraga-switch-model-desc" style="margin-bottom: 12px;">
            Kullandığınız API sağlayıcısının veya yerel modelin desteklediği kimliği (Model ID) girin veya aşağıdaki hızlı önerilere tıklayın.
          </div>

          <div style="margin-bottom: 14px;">
            <div style="font-size: 11px; color: var(--text-muted, #8b949e); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
              Hızlı Seçim Önerileri
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="customModelChipsInSettings">
              <button type="button" class="custom-model-chip" data-id="claude-3-7-sonnet">claude-3-7-sonnet</button>
              <button type="button" class="custom-model-chip" data-id="claude-3-5-sonnet">claude-3-5-sonnet</button>
              <button type="button" class="custom-model-chip" data-id="claude-opus-4-6-thinking">claude-opus-4-6-thinking</button>
              <button type="button" class="custom-model-chip" data-id="claude-sonnet-4-6">claude-sonnet-4-6</button>
              <button type="button" class="custom-model-chip" data-id="gpt-4o">gpt-4o</button>
              <button type="button" class="custom-model-chip" data-id="o3-mini">o3-mini</button>
              <button type="button" class="custom-model-chip" data-id="deepseek-chat">deepseek-chat</button>
              <button type="button" class="custom-model-chip" data-id="deepseek-reasoner">deepseek-reasoner</button>
              <button type="button" class="custom-model-chip" data-id="qwen-2.5-coder-32b">qwen-2.5-coder-32b</button>
            </div>
          </div>

          <div style="margin-bottom: 18px;">
            <label style="display: block; font-size: 12px; font-weight: 600; color: #c9d1d9; margin-bottom: 6px;">
              Model Kimliği (Model ID)
            </label>
            <input
              type="text"
              id="customModelInputInSettings"
              class="settings-input"
              placeholder="örn: claude-3-7-sonnet, deepseek-chat, mistral-large"
              style="width: 100%; box-sizing: border-box; padding: 9px 12px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; font-family: var(--font-mono, monospace); font-size: 13px; outline: none;"
            />
          </div>

          <div class="kraga-switch-model-actions">
            <button type="button" class="kraga-btn-switch-cancel" id="btnCancelCustomModelSettings">İptal</button>
            <button type="button" class="kraga-btn-switch-confirm" id="btnConfirmCustomModelSettings" style="background: var(--accent-color, #00f0ff); border-color: var(--accent-color, #00f0ff); color: #000;">
              Modeli Ekle & Seç
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);

      const input = backdrop.querySelector('#customModelInputInSettings') as HTMLInputElement;
      const btnCancel = backdrop.querySelector('#btnCancelCustomModelSettings') as HTMLButtonElement;
      const btnConfirm = backdrop.querySelector('#btnConfirmCustomModelSettings') as HTMLButtonElement;
      const chips = backdrop.querySelectorAll('.custom-model-chip');

      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          const id = (chip as HTMLElement).dataset.id;
          if (id && input) {
            input.value = id;
            input.focus();
          }
        });
      });

      const closeModal = () => backdrop.remove();
      btnCancel.addEventListener('click', closeModal);
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
      });

      const doSubmit = () => {
        const val = input?.value.trim();
        if (!val) {
          input?.focus();
          return;
        }
        closeModal();
        const added = registerCustomModel(val);
        this.settings.defaultModel = added.id;
        this.saveSettings();
        const updatedModels = getAllModels();
        if (modelSelectEl) {
          modelSelectEl.innerHTML = buildModelOptions(updatedModels, added.id);
        }
        if (modelLabelEl) {
          modelLabelEl.textContent = `Varsayılan Model (${updatedModels.length} Aktif Model)`;
        }
        notificationManager.showToast({
          title: 'Özel Model Eklendi',
          message: `${added.name} (${added.id}) varsayılan model olarak seçildi.`,
          type: 'success'
        });
      };

      btnConfirm.addEventListener('click', doSubmit);
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          doSubmit();
        }
      });
      setTimeout(() => input?.focus(), 50);
    });

    // Sayfa açıldığında henüz sağlayıcı modelleri çekilmemişse arka planda otomatik çek
    if (!hasProvider) {
      setTimeout(() => refreshModelsUI(false), 200);
    }

    // Listener'lar
    const keyInput = container.querySelector('#setApiKey') as HTMLInputElement;
    const toggleBtn = container.querySelector('#btnToggleApiKey');
    toggleBtn?.addEventListener('click', () => {
      if (keyInput) {
        const isPass = keyInput.type === 'password';
        keyInput.type = isPass ? 'text' : 'password';
        toggleBtn.innerHTML = isPass ? iconEyeOff(14) : iconEye(14);
      }
    });

    const baseUrlInput = container.querySelector('#setBaseUrl') as HTMLInputElement | null;
    container.querySelector('#btnPresetOpenAI')?.addEventListener('click', () => {
      this.settings.baseUrl = 'https://api.openai.com/v1';
      if (baseUrlInput) baseUrlInput.value = 'https://api.openai.com/v1';
      this.saveSettings();
      notificationManager.showToast({ title: 'Base URL Ayarlandı', message: 'OpenAI (https://api.openai.com/v1) aktif.', type: 'info' });
      refreshModelsUI(false);
    });

    baseUrlInput?.addEventListener('input', (e) => {
      this.settings.baseUrl = (e.target as HTMLInputElement).value.trim();
      this.saveSettings();
    });

    baseUrlInput?.addEventListener('change', (e) => {
      this.settings.baseUrl = (e.target as HTMLInputElement).value.trim();
      this.saveSettings();
      refreshModelsUI(false);
    });

    const apiKeyInput = container.querySelector('#setApiKey') as HTMLInputElement | null;
    apiKeyInput?.addEventListener('input', (e) => {
      this.settings.apiKey = (e.target as HTMLInputElement).value.trim();
      this.saveSettings();
    });

    apiKeyInput?.addEventListener('change', (e) => {
      this.settings.apiKey = (e.target as HTMLInputElement).value.trim();
      this.saveSettings();
      refreshModelsUI(false);
    });

    container.querySelector('#setDefaultModel')?.addEventListener('change', (e) => {
      this.settings.defaultModel = (e.target as HTMLSelectElement).value;
      this.saveSettings();
    });

    container.querySelector('#setMaxOutput')?.addEventListener('change', (e) => {
      this.settings.maxOutput = parseInt((e.target as HTMLInputElement).value) || 8192;
      this.saveSettings();
    });
  }

  // 2. FEATURES TAB
  private renderFeaturesTab(container: HTMLElement): void {
    container.innerHTML = `
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconZap(18, 'var(--accent-color, #00f0ff)')}</div>
          <div>
            <h3 class="settings-card__title">Akıllı Yanıt Davranışları</h3>
            <p class="settings-card__desc">Yapay zeka modellerinin cevap oluşturma ve çıktı akış mekanizması.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Akışlı Yanıtlar (Streaming SSE)</span>
              <p class="settings-toggle-desc">Yapay zeka yanıtlarını kelime kelime ekrana anında basar.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="featStream" ${this.settings.streamResponse ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Otomatik Bağlam Sıkıştırma (Auto Compact)</span>
              <p class="settings-toggle-desc">Sohbet penceresi %80 dolduğunda eski mesajları otomatik özetler.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="featCompact" ${this.settings.autoCompact ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Ses Efektleri & Mikro-Etkileşimler</span>
              <p class="settings-toggle-desc">Mesaj gönderimi ve görev tamamlandığında hafif sentetik chimes çalar.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="featSounds" ${this.settings.soundEffects ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Arka Plan Bildirimleri</span>
              <p class="settings-toggle-desc">IDE simge durumundayken uzun işlemler bittiğinde Windows bildirimi gönderir.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="featNotifs" ${this.settings.notifications ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Maksimum Otonom Araç Döngüsü (Max Tool Steps)</span>
              <p class="settings-toggle-desc">Ajanın tek kullanıcı mesajında arka arkaya çalıştırabileceği otonom araç adımı tavanı.</p>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <select id="featMaxToolLoops" class="settings-select" style="min-width: 130px;">
                <option value="15" ${this.settings.maxToolLoops === 15 ? 'selected' : ''}>15 Adım</option>
                <option value="25" ${this.settings.maxToolLoops === 25 ? 'selected' : ''}>25 Adım</option>
                <option value="35" ${(!this.settings.maxToolLoops || this.settings.maxToolLoops === 35) ? 'selected' : ''}>35 Adım (Standart)</option>
                <option value="50" ${this.settings.maxToolLoops === 50 ? 'selected' : ''}>50 Adım (Tam Otonom)</option>
                <option value="100" ${this.settings.maxToolLoops === 100 ? 'selected' : ''}>100 Adım (Maksimum)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconBrain(18, '#9d7cd8')}</div>
          <div>
            <h3 class="settings-card__title">Temel Sistem Promptu (Base Persona)</h3>
            <p class="settings-card__desc">Bu talimat tüm AI isteklerinin en başına sistem talimatı olarak enjekte edilir.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <textarea id="setSystemPrompt" rows="4" class="settings-textarea">${this.settings.systemPrompt}</textarea>
        </div>
      </div>
    `;

    container.querySelector('#featStream')?.addEventListener('change', (e) => {
      this.settings.streamResponse = (e.target as HTMLInputElement).checked;
      this.saveSettings();
    });
    container.querySelector('#featCompact')?.addEventListener('change', (e) => {
      this.settings.autoCompact = (e.target as HTMLInputElement).checked;
      this.saveSettings();
    });
    container.querySelector('#featSounds')?.addEventListener('change', (e) => {
      this.settings.soundEffects = (e.target as HTMLInputElement).checked;
      this.saveSettings();
    });
    container.querySelector('#featNotifs')?.addEventListener('change', (e) => {
      this.settings.notifications = (e.target as HTMLInputElement).checked;
      this.saveSettings();
    });
    container.querySelector('#featMaxToolLoops')?.addEventListener('change', (e) => {
      this.settings.maxToolLoops = parseInt((e.target as HTMLSelectElement).value, 10) || 35;
      this.saveSettings();
    });
    container.querySelector('#setSystemPrompt')?.addEventListener('input', (e) => {
      this.settings.systemPrompt = (e.target as HTMLTextAreaElement).value;
      this.saveSettings();
    });
  }

  // 2.5. PERMISSIONS & SECURITY TAB (Cursor-style Granular Permissions)
  private renderPermissionsTab(container: HTMLElement): void {
    const perm = permissionManager.getSettings();

    container.innerHTML = `
      <div class="settings-banner" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(0, 240, 255, 0.08)); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 14px 18px; margin-bottom: 20px;">
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <div style="color: #10b981; flex-shrink: 0; margin-top: 2px;">${iconShield(20, '#10b981')}</div>
          <div>
            <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: var(--text-primary);">Cursor Tarzı Güvenlik ve Çalışma İzinleri</h4>
            <p style="margin: 0; font-size: 12px; line-height: 1.5; color: var(--text-secondary);">
              Open Crow yerleşik bir masaüstü geliştirme ortamıdır. Ajanın terminalde komut koşturması, dosyaları değiştirmesi veya harici MCP araçlarını tetiklemesi üzerindeki denetim politikanızı buradan yapılandırabilirsiniz.
            </p>
          </div>
        </div>
      </div>

      <!-- 1. Ana Çalışma Modu (3 Kart) -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconShield(18, '#00f0ff')}</div>
          <div>
            <h3 class="settings-card__title">Ana Onay Politikası (Policy Mode)</h3>
            <p class="settings-card__desc">Ajanın işlem yaparken sizden ne zaman izin isteyeceğini belirleyin.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="settings-radio-cards" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
            <label class="settings-radio-card ${perm.mode === 'ask_all' ? 'settings-radio-card--active' : ''}">
              <input type="radio" name="permMode" value="ask_all" ${perm.mode === 'ask_all' ? 'checked' : ''}>
              <div class="settings-radio-card__content">
                <span class="settings-radio-card__title">${iconLock(15)} Her Zaman Sor</span>
                <p class="settings-radio-card__desc">Paranoid Denetim: Her terminal komutu ve dosya yazma işleminde sohbette onay kartı açılır.</p>
              </div>
            </label>
            <label class="settings-radio-card ${perm.mode === 'ask_critical' ? 'settings-radio-card--active' : ''}">
              <input type="radio" name="permMode" value="ask_critical" ${perm.mode === 'ask_critical' ? 'checked' : ''}>
              <div class="settings-radio-card__content">
                <span class="settings-radio-card__title">${iconShield(15, '#10b981')} Yalnızca Kritik (Önerilen)</span>
                <p class="settings-radio-card__desc">Dengeli Güvenlik: Normal komut ve düzenlemeler otomatik yapılır; tehlikeli eylemlerde sorulur.</p>
              </div>
            </label>
            <label class="settings-radio-card ${perm.mode === 'auto' ? 'settings-radio-card--active' : ''}">
              <input type="radio" name="permMode" value="auto" ${perm.mode === 'auto' ? 'checked' : ''}>
              <div class="settings-radio-card__content">
                <span class="settings-radio-card__title">${iconZap(15, '#f59e0b')} Tam Otonom (Asla Sorma)</span>
                <p class="settings-radio-card__desc">YOLO Modu: Ajan tüm komutları doğrudan çalıştırır, kodları yazar, asla izin penceresiyle bölmez.</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- 2. Granüler İzin Anahtarları -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconZap(18, '#ff9e3b')}</div>
          <div>
            <h3 class="settings-card__title">Granüler İzin Anahtarları</h3>
            <p class="settings-card__desc">Farklı eylem türleri için otomatik çalışma izinlerini tek tek yönetin.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Terminal Komutlarını Otomatik Çalıştır</span>
              <p class="settings-toggle-desc">Ajanın önerdiği terminal komutlarını onay beklemeden yerel terminalde koşturur.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="permAllowTerminal" ${perm.allowTerminalAutoRun ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Dosya Oluşturma & İçerik Yazma (Auto Write)</span>
              <p class="settings-toggle-desc">Kod değişikliklerini ve yeni dosyaları onay beklemeden doğrudan diske yazar.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="permAllowFileWrite" ${perm.allowFileWrite ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Dosya Silme İşlemlerinde Her Zaman Onay İste</span>
              <p class="settings-toggle-desc">Projede herhangi bir dosya veya dizin silinirken mutlaka kullanıcıdan onay ister.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="permConfirmDelete" ${perm.confirmFileDelete ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">MCP Araç Çağrılarını Otomatik Yürüt</span>
              <p class="settings-toggle-desc">Blender, Unreal Engine, Unity, GitHub vb. MCP sunucularındaki araçları doğrudan çalıştırır.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="permAllowMCP" ${perm.allowMCPAutoRun ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row" style="background: rgba(239, 68, 68, 0.05); padding: 12px 14px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.25);">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title" style="color: #ef4444; font-weight: 600;">Yıkıcı Sistem Komutları Kalkanı (Dangerous Command Blocker)</span>
              <p class="settings-toggle-desc" style="color: var(--text-secondary);">rm -rf, del /s /q, format, diskpart, drop database gibi geri dönüşümsüz yıkıcı komutları algılar ve kesin olarak durdurur.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="permBlockDangerous" ${perm.blockDangerousCommands ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- 3. Oturum İzinleri Belleği -->
      <div class="settings-card" style="margin-bottom: 24px;">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconRefresh(18, '#a78bfa')}</div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h3 class="settings-card__title" style="margin: 0;">Aktif Oturum İzinleri</h3>
              <span class="session-perm-badge ${permissionManager.getSessionBypasses().length > 0 ? 'session-perm-badge--active' : 'session-perm-badge--empty'}">
                ${permissionManager.getSessionBypasses().length > 0 ? `${permissionManager.getSessionBypasses().length} Muafiyet Aktif` : 'Aktif Muafiyet Yok'}
              </span>
            </div>
            <p class="settings-card__desc">Sohbet penceresinde 'Bu Oturumda Hep İzin Ver' butonuyla tanımlanmış geçici muafiyetler.</p>
          </div>
        </div>
        <div class="settings-card__body">
          ${permissionManager.getSessionBypasses().length === 0 ? `
            <div class="session-perm-empty">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Şu an bu oturumda tanımlanmış bir geçici muafiyet bulunmuyor. Tüm güvenlik kalkanları devrede.</span>
            </div>
          ` : `
            <div style="margin-bottom: 14px;">
              <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Bu Oturumda Tanımlanmış Muafiyetler:</span>
              <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                ${permissionManager.getSessionBypasses().map(b => `
                  <span class="session-perm-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-green, #10b981)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>${b === 'terminal' ? 'Terminal Komutları' : b === 'file_write' ? 'Dosya Yazma' : b === 'file_delete' ? 'Dosya Silme' : 'MCP Araçları'}</span>
                  </span>
                `).join('')}
              </div>
            </div>
          `}
          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 14px; border-top: 1px solid var(--border-color); margin-top: 12px;">
            <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">
              Geçici oturum izinleri bellekte tutulur ve IDE yeniden başlatıldığında otomatik sıfırlanır.
            </p>
            <button class="settings-action-btn settings-action-btn--reset" id="btnResetSessionPerms" ${permissionManager.getSessionBypasses().length === 0 ? 'disabled' : ''}>
              ${iconRefresh(13)}
              <span>Oturum İzinlerini Sıfırla</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Radio seçim listener'ları
    container.querySelectorAll('input[name="permMode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const val = (e.target as HTMLInputElement).value as PermissionMode;
        permissionManager.setMode(val);
        this.renderPermissionsTab(container);
      });
    });

    // Granüler switch listener'ları
    container.querySelector('#permAllowTerminal')?.addEventListener('change', (e) => {
      permissionManager.updateSettings({ allowTerminalAutoRun: (e.target as HTMLInputElement).checked });
    });
    container.querySelector('#permAllowFileWrite')?.addEventListener('change', (e) => {
      permissionManager.updateSettings({ allowFileWrite: (e.target as HTMLInputElement).checked });
    });
    container.querySelector('#permConfirmDelete')?.addEventListener('change', (e) => {
      permissionManager.updateSettings({ confirmFileDelete: (e.target as HTMLInputElement).checked });
    });
    container.querySelector('#permAllowMCP')?.addEventListener('change', (e) => {
      permissionManager.updateSettings({ allowMCPAutoRun: (e.target as HTMLInputElement).checked });
    });
    container.querySelector('#permBlockDangerous')?.addEventListener('change', (e) => {
      permissionManager.updateSettings({ blockDangerousCommands: (e.target as HTMLInputElement).checked });
    });
    container.querySelector('#btnResetSessionPerms')?.addEventListener('click', () => {
      permissionManager.clearSessionBypasses();
      this.renderPermissionsTab(container);
    });
  }

  // 3. GENERAL TAB (Görünüm, Tipografi, Hareket, Bildirimler ve Editör)
  private renderGeneralTab(container: HTMLElement): void {
    const themes = [
      { id: 'original-dark', name: 'Orijinal (Siyah, Varsayılan)' },
      { id: 'kraga-cyberpunk', name: 'Klasik (Neon)' },
      { id: 'midnight-blue', name: 'Mavi' },
      { id: 'emerald-dark', name: 'Yeşil' },
      { id: 'sunset-warm', name: 'Turuncu' },
      { id: 'dracula', name: 'Mor' },
      { id: 'synthwave', name: 'Pembe' },
      { id: 'minimal-light', name: 'Açık' }
    ];

    const editorFonts = [
      { id: "'JetBrains Mono', Consolas, monospace", name: 'JetBrains Mono (Önerilen)' },
      { id: "'Fira Code', Consolas, monospace", name: 'Fira Code' },
      { id: "Consolas, 'Courier New', monospace", name: 'Consolas' },
      { id: "'Cascadia Code', Consolas, monospace", name: 'Cascadia Code' },
      { id: "'Source Code Pro', Consolas, monospace", name: 'Source Code Pro' }
    ];

    container.innerHTML = `
      <!-- 0. Varsayılan Proje & Çalışma Alanı (Default Workspace Directory) -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconFolder(18, '#00f0ff')}</div>
          <div>
            <h3 class="settings-card__title">Varsayılan Proje & Çalışma Alanı (Default Workspace)</h3>
            <p class="settings-card__desc">Ajanın ve editörün hiçbir klasör açılmadığında otomatik bağlanacağı ve dosyaları yazacağı varsayılan bilgisayar konumu.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div style="display: flex; gap: 8px; align-items: center;">
            <input type="text" id="setDefaultWorkspaceInput" class="settings-input" 
                   style="flex: 1; font-family: var(--font-mono); font-size: 12px;" 
                   placeholder="Varsayılan klasör seçilmedi (Örn: C:/Projelerim)" 
                   value="${this.settings.defaultWorkspacePath || ''}" />
            <button type="button" class="settings-action-btn" id="btnBrowseDefaultWorkspace" style="display: flex; align-items: center; gap: 6px; white-space: nowrap;">
              ${iconFolder(14)}
              <span>Gözat / Klasör Seç...</span>
            </button>
            <button type="button" class="settings-action-btn settings-action-btn--reset" id="btnClearDefaultWorkspace" title="Varsayılanı Temizle" ${!this.settings.defaultWorkspacePath ? 'disabled' : ''}>
              ${iconTrash(14)}
            </button>
          </div>
          <span class="settings-field-hint" style="margin-top: 6px; display: block;">
            Bu dizin ayarlandığında, ajan "neredeyim?" döngüsüne girmeden tüm yeni dosya ve planları doğrudan bu klasörün içinde oluşturur.
          </span>
        </div>
      </div>

      <!-- 1. Tema & Renk Şeması -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconPalette(18, '#f7768e')}</div>
          <div>
            <h3 class="settings-card__title">Görsel Tema & Arayüz Dili</h3>
            <p class="settings-card__desc">IDE renk şeması, tema estetiği ve yerelleştirme tercihleri.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="settings-grid-2">
            <div class="settings-form-group">
              <label class="settings-field-label">Tema (Theme)</label>
              <select id="setThemeSelect" class="settings-select">
                ${themes.map(t => `<option value="${t.id}" ${(localStorage.getItem('kraga_ide_theme') || this.settings.theme) === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
              </select>
            </div>
            <div class="settings-form-group">
              <label class="settings-field-label">Arayüz Dili (Interface Language)</label>
              <select id="setLangSelect" class="settings-select">
                <option value="tr" ${this.settings.language === 'tr' ? 'selected' : ''}>Türkçe (Varsayılan)</option>
                <option value="en" ${this.settings.language === 'en' ? 'selected' : ''}>English</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Sohbet Tipografisi & Hareket (Image 3 Referansı) -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconType(18, '#38bdf8')}</div>
          <div>
            <h3 class="settings-card__title">Sohbet Tipografisi & Hareket (Chat Font & Motion)</h3>
            <p class="settings-card__desc">Ajan sohbet balonları, font ailesi ve arayüz akıcılık tercihleri.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="settings-grid-2" style="align-items: start; margin-bottom: 14px;">
            <div class="settings-form-group">
              <label class="settings-field-label">Chat font (Sohbet Yazı Tipi)</label>
              <select id="setChatFontSelect" class="settings-select">
                <option value="serif" ${this.settings.chatFont === 'serif' ? 'selected' : ''}>Anthropic Serif (Charter / Georgia, Serif)</option>
                <option value="sans" ${this.settings.chatFont === 'sans' ? 'selected' : ''}>Modern Sans (Inter / Segoe UI, Varsayılan)</option>
                <option value="mono" ${this.settings.chatFont === 'mono' ? 'selected' : ''}>JetBrains Mono / Kod Fontu</option>
                <option value="system" ${this.settings.chatFont === 'system' ? 'selected' : ''}>Sistem Varsayılanı (System UI)</option>
              </select>
              <span class="settings-field-hint">Sohbet mesajlarında ve ajan çıktılarında kullanılacak font ailesi.</span>
            </div>

            <div class="settings-form-group">
              <label class="settings-field-label">Motion (Hareket & Animasyonlar)</label>
              <div class="segmented-pills">
                <button type="button" class="segmented-pill-btn ${this.settings.motion === 'system' ? 'segmented-pill-btn--active' : ''}" id="btnMotionSystem">
                  System
                </button>
                <button type="button" class="segmented-pill-btn ${this.settings.motion === 'reduced' ? 'segmented-pill-btn--active' : ''}" id="btnMotionReduced">
                  Reduced
                </button>
              </div>
              <span class="settings-field-hint">Reduce animation in streaming responses and other interface elements. (Akış yanıtlarında ve arayüzde animasyonları azalt.)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Bildirimler (Notifications - Image 3 Referansı) -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconBell(18, '#fbbf24')}</div>
          <div>
            <h3 class="settings-card__title">Bildirimler (Notifications)</h3>
            <p class="settings-card__desc">Ajan çalışma bildirimleri, yanıt tamamlama uyarıları ve ses efektleri.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Response completions (Yanıt Tamamlanma Bildirimi)</span>
              <p class="settings-toggle-desc">Get notified when Open Crow has finished a response. Useful for long-running tasks. (Open Crow yanıt vermeyi bitirdiğinde bildirim al. Uzun süren görevler için kullanışlıdır.)</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="featNotifyOnResponse" ${this.settings.notifyOnResponse ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row" style="margin-top: 10px;">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Notification sound (Yanıt Tamamlanma Sesi)</span>
              <p class="settings-toggle-desc">Yanıt tamamlandığında yumuşak fütüristik ses tonu (Web Audio chime) çalar.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="featNotificationSound" ${this.settings.notificationSound ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 12px; color: var(--text-secondary);">Sistem sesini ve masaüstü bildirimini canlı test edin:</span>
            <button type="button" class="settings-action-btn" id="btnTestNotification">
              ${iconVolume2(14)}
              <span>Bildirim ve Sesi Test Et</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 4. Editör Tercihleri (Monaco) -->
      <div class="settings-card" style="margin-bottom: 24px;">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconKey(18, '#73daca')}</div>
          <div>
            <h3 class="settings-card__title">Kod Editörü Tercihleri (Monaco)</h3>
            <p class="settings-card__desc">Monaco kod editörünün yazı boyutu, font ailesi, girinti ve görsel yardımcıları.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="settings-grid-2">
            <div class="settings-form-group">
              <label class="settings-field-label" id="lblFontSize">Yazı Tipi Boyutu (Font Size: ${this.settings.fontSize}px)</label>
              <input type="range" id="setFontSize" min="11" max="22" value="${this.settings.fontSize}" class="settings-range" />
            </div>
            <div class="settings-form-group">
              <label class="settings-field-label">Kod Yazı Tipi Ailesi (Editor Font Family)</label>
              <select id="setEditorFontFamily" class="settings-select">
                ${editorFonts.map(f => `<option value="${f.id}" ${this.settings.editorFontFamily === f.id ? 'selected' : ''}>${f.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="settings-grid-2" style="margin-top: 14px;">
            <div class="settings-form-group">
              <label class="settings-field-label">Girinti Boşluğu (Tab Size)</label>
              <select id="setTabSize" class="settings-select">
                <option value="2" ${this.settings.tabSize === 2 ? 'selected' : ''}>2 Boşluk</option>
                <option value="4" ${this.settings.tabSize === 4 ? 'selected' : ''}>4 Boşluk</option>
              </select>
            </div>
            <div class="settings-form-group">
              <label class="settings-field-label">Satır Numaraları (Line Numbers)</label>
              <select id="setLineNumbers" class="settings-select">
                <option value="on" ${this.settings.lineNumbers === 'on' ? 'selected' : ''}>Açık (Standart)</option>
                <option value="off" ${this.settings.lineNumbers === 'off' ? 'selected' : ''}>Kapalı</option>
                <option value="relative" ${this.settings.lineNumbers === 'relative' ? 'selected' : ''}>Göreli (Relative)</option>
              </select>
            </div>
          </div>

          <div class="settings-toggle-row" style="margin-top: 14px;">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Font Ligatures (Ok & Operatör Birleşimleri)</span>
              <p class="settings-toggle-desc">=>, !==, === gibi programlama operatörlerini birleşik estetik sembollere dönüştürür.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="featLigatures" ${this.settings.fontLigatures ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Sözcük Kaydırma (Word Wrap)</span>
              <p class="settings-toggle-desc">Uzun satırları yatay kaydırma çubuğu olmadan alt satıra kırar.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="featWordWrap" ${this.settings.wordWrap ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>

          <div class="settings-toggle-row">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Minimap (Kod Haritası)</span>
              <p class="settings-toggle-desc">Editörün sağ tarafında genel kod yapısı önizleme çubuğu.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="featMinimap" ${this.settings.minimap ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
    `;

    // ─── Event Listener'lar ─────────────────────────────────────────

    // Varsayılan Proje & Çalışma Alanı
    container.querySelector('#btnBrowseDefaultWorkspace')?.addEventListener('click', async () => {
      try {
        const folder = await window.kragaAPI.fs.openFolder();
        if (folder) {
          this.setDefaultWorkspacePath(folder);
          const input = container.querySelector('#setDefaultWorkspaceInput') as HTMLInputElement;
          if (input) input.value = folder;
          const btnClear = container.querySelector('#btnClearDefaultWorkspace') as HTMLButtonElement;
          if (btnClear) btnClear.disabled = false;
        }
      } catch (err) {
        console.error('Varsayılan klasör seçilemedi:', err);
      }
    });

    container.querySelector('#setDefaultWorkspaceInput')?.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value.trim();
      this.setDefaultWorkspacePath(val);
      const btnClear = container.querySelector('#btnClearDefaultWorkspace') as HTMLButtonElement;
      if (btnClear) btnClear.disabled = !val;
    });

    container.querySelector('#btnClearDefaultWorkspace')?.addEventListener('click', () => {
      this.setDefaultWorkspacePath('');
      const input = container.querySelector('#setDefaultWorkspaceInput') as HTMLInputElement;
      if (input) input.value = '';
      const btnClear = container.querySelector('#btnClearDefaultWorkspace') as HTMLButtonElement;
      if (btnClear) btnClear.disabled = true;
    });

    // Tema
    container.querySelector('#setThemeSelect')?.addEventListener('change', (e) => {
      const newTheme = (e.target as HTMLSelectElement).value;
      this.settings.theme = newTheme;
      this.saveSettings();
      if (this.onThemeChangeCallback) this.onThemeChangeCallback(newTheme);
    });

    // Dil
    container.querySelector('#setLangSelect')?.addEventListener('change', (e) => {
      this.settings.language = (e.target as HTMLSelectElement).value;
      this.saveSettings();
    });

    // Chat Font
    container.querySelector('#setChatFontSelect')?.addEventListener('change', (e) => {
      const font = (e.target as HTMLSelectElement).value as 'sans' | 'serif' | 'mono' | 'system';
      this.settings.chatFont = font;
      this.saveSettings();
      this.applyChatFont(font);
      this.onAppearanceChange?.({ chatFont: font, motion: this.settings.motion });
    });

    // Motion: System vs Reduced
    const btnMotionSystem = container.querySelector('#btnMotionSystem') as HTMLButtonElement;
    const btnMotionReduced = container.querySelector('#btnMotionReduced') as HTMLButtonElement;

    btnMotionSystem?.addEventListener('click', () => {
      this.settings.motion = 'system';
      this.saveSettings();
      this.applyMotion('system');
      btnMotionSystem.classList.add('segmented-pill-btn--active');
      btnMotionReduced?.classList.remove('segmented-pill-btn--active');
      this.onAppearanceChange?.({ chatFont: this.settings.chatFont, motion: 'system' });
    });

    btnMotionReduced?.addEventListener('click', () => {
      this.settings.motion = 'reduced';
      this.saveSettings();
      this.applyMotion('reduced');
      btnMotionReduced.classList.add('segmented-pill-btn--active');
      btnMotionSystem?.classList.remove('segmented-pill-btn--active');
      this.onAppearanceChange?.({ chatFont: this.settings.chatFont, motion: 'reduced' });
    });

    // Bildirimler
    container.querySelector('#featNotifyOnResponse')?.addEventListener('change', (e) => {
      this.settings.notifyOnResponse = (e.target as HTMLInputElement).checked;
      this.saveSettings();
    });

    container.querySelector('#featNotificationSound')?.addEventListener('change', (e) => {
      this.settings.notificationSound = (e.target as HTMLInputElement).checked;
      this.saveSettings();
    });

    container.querySelector('#btnTestNotification')?.addEventListener('click', async () => {
      await notificationManager.testNotification();
    });

    // Editör Font Boyutu
    const fontRange = container.querySelector('#setFontSize') as HTMLInputElement;
    const fontLbl = container.querySelector('#lblFontSize');
    fontRange?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.settings.fontSize = val;
      if (fontLbl) fontLbl.textContent = `Yazı Tipi Boyutu (Font Size: ${val}px)`;
      this.saveSettings();
      this.notifyEditorChange();
    });

    // Editör Font Ailesi
    container.querySelector('#setEditorFontFamily')?.addEventListener('change', (e) => {
      this.settings.editorFontFamily = (e.target as HTMLSelectElement).value;
      this.saveSettings();
      this.notifyEditorChange();
    });

    // Tab Size
    container.querySelector('#setTabSize')?.addEventListener('change', (e) => {
      this.settings.tabSize = parseInt((e.target as HTMLSelectElement).value);
      this.saveSettings();
      this.notifyEditorChange();
    });

    // Line Numbers
    container.querySelector('#setLineNumbers')?.addEventListener('change', (e) => {
      this.settings.lineNumbers = (e.target as HTMLSelectElement).value as 'on' | 'off' | 'relative';
      this.saveSettings();
      this.notifyEditorChange();
    });

    // Ligatures
    container.querySelector('#featLigatures')?.addEventListener('change', (e) => {
      this.settings.fontLigatures = (e.target as HTMLInputElement).checked;
      this.saveSettings();
      this.notifyEditorChange();
    });

    // Word Wrap
    container.querySelector('#featWordWrap')?.addEventListener('change', (e) => {
      this.settings.wordWrap = (e.target as HTMLInputElement).checked;
      this.saveSettings();
      this.notifyEditorChange();
    });

    // Minimap
    container.querySelector('#featMinimap')?.addEventListener('change', (e) => {
      this.settings.minimap = (e.target as HTMLInputElement).checked;
      this.saveSettings();
      this.notifyEditorChange();
    });
  }

  private notifyEditorChange(): void {
    this.onEditorSettingsChange?.({
      fontSize: this.settings.fontSize,
      tabSize: this.settings.tabSize,
      wordWrap: this.settings.wordWrap,
      minimap: this.settings.minimap,
      editorFontFamily: this.settings.editorFontFamily,
      fontLigatures: this.settings.fontLigatures,
      lineNumbers: this.settings.lineNumbers
    });
  }

  public applyChatFont(font: 'sans' | 'serif' | 'mono' | 'system'): void {
    let family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    if (font === 'serif') {
      family = '"Charter", "Bitstream Charter", "Sitka Text", "Cambria", Georgia, "Times New Roman", serif';
    } else if (font === 'mono') {
      family = '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace';
    } else if (font === 'system') {
      family = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    }
    document.documentElement.style.setProperty('--font-chat', family);
  }

  public applyMotion(motion: 'system' | 'reduced'): void {
    if (motion === 'reduced') {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
  }

  // 4. USAGE TAB
  private renderUsageTab(container: HTMLElement): void {
    const state = this.tokenTracker.getState();
    const usedPct = this.tokenTracker.getUsagePercentage();
    const isEst = this.tokenTracker.isEstimated();

    container.innerHTML = `
      <div class="usage-stats-grid">
        <div class="usage-stat-card">
          <span class="usage-stat-card__label">Harcanan Bakiye</span>
          <span class="usage-stat-card__val">$${state.totalCostUsed.toFixed(2)}</span>
          <span class="usage-stat-card__sub">${this.tokenTracker.getFormattedTokens()} Token ${isEst ? '(Harici / Tahmini)' : '(KragaBridge Gerçek)'}</span>
        </div>
        <div class="usage-stat-card">
          <span class="usage-stat-card__label">Kalan Bakiye</span>
          <span class="usage-stat-card__val">${this.tokenTracker.getFormattedBalance()}</span>
          <span class="usage-stat-card__sub">${state.tokenLimit > 0 ? (state.tokenLimit - state.totalTokensUsed).toLocaleString() + ' Token' : 'Sınırsız / BYOK'}</span>
        </div>
        <div class="usage-stat-card">
          <span class="usage-stat-card__label">Toplam İstek</span>
          <span class="usage-stat-card__val">${state.requestCount}</span>
          <span class="usage-stat-card__sub">Son Model: ${state.lastModel}</span>
        </div>
      </div>

      <div class="settings-card" style="margin-top: 16px;">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconBarChart(18, 'var(--accent-color, #00f0ff)')}</div>
          <div>
            <h3 class="settings-card__title">Token & Bağlam Tüketim Oranı</h3>
            <p class="settings-card__desc">Bu oturumda ve promo limitiniz çerçevesinde harcanan kapasite.</p>
          </div>
        </div>
        <div class="settings-card__body" style="display: flex; justify-content: center; padding: 24px 0;">
          <div class="doughnut-chart-wrap">
            <svg width="200" height="200" viewBox="0 0 100 100" class="doughnut-svg">
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border-color, #232738)" stroke-width="12" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="12"
                stroke-dasharray="251.2"
                stroke-dashoffset="${251.2 - (251.2 * Math.min(usedPct, 100) / 100)}"
                stroke-linecap="round"
                transform="rotate(-90 50 50)" />
              <text x="50" y="48" text-anchor="middle" font-size="12" font-weight="bold" fill="var(--text-color, #fff)">%${usedPct.toFixed(0)}</text>
              <text x="50" y="62" text-anchor="middle" font-size="6" fill="var(--text-muted, #8b949e)">Tüketildi</text>
            </svg>
          </div>
        </div>
      </div>
    `;
  }

  // 7. GRAPHIFY TAB
  private renderGraphifyTab(container: HTMLElement): void {
    container.innerHTML = `
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconNetwork(18, 'var(--accent-color, #00f0ff)')}</div>
          <div>
            <h3 class="settings-card__title">Graphify AST Kod ve Bağımlılık Motoru</h3>
            <p class="settings-card__desc">Kod tabanınızın soyut sözdizim ağacını tarayarak merkez (God Node) dosyaları ve mimari ilişkileri çıkarır.</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="mcp-stats-cards">
            <div class="mcp-stat-card">
              <span class="mcp-stat-card__val">AST Regex</span>
              <span class="mcp-stat-card__label">Ayrıştırma Motoru</span>
            </div>
            <div class="mcp-stat-card">
              <span class="mcp-stat-card__val">TS, JS, PY, JSON</span>
              <span class="mcp-stat-card__label">Desteklenen Diller</span>
            </div>
            <div class="mcp-stat-card">
              <span class="mcp-stat-card__val">PageRank</span>
              <span class="mcp-stat-card__label">Düğüm Önem Derecesi</span>
            </div>
          </div>

          <div style="margin-top: 20px;">
            <button class="settings-btn settings-btn--accent" id="btnRunGraphifyModal">
              ${iconRefresh(14)} Tüm Projeyi Şimdi Tara & Analiz Et
            </button>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#btnRunGraphifyModal')?.addEventListener('click', () => {
      this.close();
      const btn = document.getElementById('btnGraphifyScan');
      if (btn) btn.click();
    });
  }

  // 8. MEMORY TAB
  private renderMemoryTab(container: HTMLElement): void {
    const items = this.smartMemory.getItems();
    const count = this.smartMemory.getCount();
    const max = this.smartMemory.getMax();

    container.innerHTML = `
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">${iconBrain(18, 'var(--accent-color, #00f0ff)')}</div>
          <div>
            <h3 class="settings-card__title">Akıllı Hafıza (Smart Memory)</h3>
            <p class="settings-card__desc">Kullanıcı tercihleri, kodlama kuralları ve mimari alışkanlıklar (${count}/${max}).</p>
          </div>
        </div>
        <div class="settings-card__body">
          <div class="settings-form-row">
            <input type="text" id="newMemoryInput" maxlength="150" placeholder="Yeni kural ekle (örn: Her zaman async/await kullan, callback yasak)" class="settings-input">
            <button class="settings-btn settings-btn--accent" id="btnAddMemory">${iconPlus(14)} Ekle</button>
          </div>

          <div class="memory-items-list" id="memoryList" style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">
            ${items.length === 0 ? '<p style="color: var(--text-muted, #8b949e); font-size: 13px;">Kayıtlı hafıza kuralı bulunmuyor. Yukarıdaki alandan ekleyebilirsiniz.</p>' : ''}
            ${items.map(item => `
              <div class="memory-card" style="display: flex; justify-content: space-between; align-items: center; background: var(--bg-secondary, #151824); padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color, #232738);">
                <span style="font-size: 13px;">${item.content}</span>
                <button class="memory-delete-btn" data-id="${item.id}" style="background: transparent; border: none; cursor: pointer;">
                  ${iconTrash(14, '#ff5555')}
                </button>
              </div>
            `).join('')}
          </div>

          ${items.length > 0 ? `
            <div style="margin-top: 16px;">
              <button class="settings-btn settings-btn--danger" id="btnClearAllMemory">
                ${iconTrash(14)} Tüm Hafızayı Temizle
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    container.querySelector('#btnAddMemory')?.addEventListener('click', () => {
      const input = container.querySelector('#newMemoryInput') as HTMLInputElement;
      const val = input?.value.trim();
      if (val) {
        this.smartMemory.addItem(val);
        this.renderMemoryTab(container);
      }
    });

    container.querySelectorAll('.memory-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id) {
          this.smartMemory.removeItem(id);
          this.renderMemoryTab(container);
        }
      });
    });

    container.querySelector('#btnClearAllMemory')?.addEventListener('click', () => {
      if (confirm('Tüm hafızayı silmek istediğinize emin misiniz?')) {
        this.smartMemory.clearAll();
        this.renderMemoryTab(container);
      }
    });
  }

  // 10. UPDATES TAB (IN-APP AUTO-UPDATER)
  private async renderUpdatesTab(container: HTMLElement): Promise<void> {
    let currentVer = '1.9.0';
    try {
      if ((window as any).kragaAPI?.updater?.getVersion) {
        currentVer = await (window as any).kragaAPI.updater.getVersion();
      }
    } catch {}

    container.innerHTML = `
      <!-- Sürüm Durum Kartı -->
      <div class="settings-card">
        <div class="settings-card__header">
          <div class="settings-card__icon-wrap">
            ${iconRefresh(18, '#ffffff')}
          </div>
          <div style="flex: 1;">
            <h3 class="settings-card__title">Open Crow Sürüm ve Güncellemeler</h3>
            <p class="settings-card__desc">Yerleşik otomatik güncelleme motoru ile yeni sürümleri doğrudan IDE içinden kurun.</p>
          </div>
          <span class="settings-badge" style="background: rgba(255, 255, 255, 0.08); color: #ffffff; border: 1px solid rgba(255, 255, 255, 0.2); font-weight: 600; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-family: var(--font-mono, monospace);">v${currentVer}</span>
        </div>

        <div class="settings-card__body">
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: rgba(255, 255, 255, 0.03); border-radius: 8px; border: 1px solid var(--border-color); gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 14px; font-weight: 600; color: var(--text-primary);">Mevcut Yüklü Sürüm:</span>
                <span style="font-family: var(--font-mono, monospace); font-weight: 700; color: #ffffff; background: rgba(255, 255, 255, 0.08); padding: 2px 8px; border-radius: 4px; font-size: 12px;">v${currentVer}</span>
              </div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Kanal: Resmi GitHub Sürümleri (KRAGA-AI-IDE-RELEASES) • 64-bit (x64)</div>
            </div>
            <button class="settings-btn" id="btnCheckUpdatesManual" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.22); color: #ffffff; padding: 8px 16px; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px;">
              ${iconRefresh(14)}
              <span id="btnCheckUpdatesText">Güncellemeleri Denetle</span>
            </button>
          </div>

          <!-- Saatlik Otomatik Kontrol Switch -->
          <div class="settings-toggle-row" style="margin-top: 14px; border-top: 1px solid var(--border-color); padding-top: 14px;">
            <div class="settings-toggle-info">
              <span class="settings-toggle-title">Saat Başı Otomatik Kontrol</span>
              <p class="settings-toggle-desc">Arka planda her saat yeni bir sürüm olup olmadığını kontrol eder ve hazır olduğunda masaüstü bildirimi gönderir.</p>
            </div>
            <label class="skill-toggle-switch">
              <input type="checkbox" id="autoCheckUpdatesToggle" ${this.settings.autoCheckUpdatesHourly ? 'checked' : ''} />
              <span class="skill-toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Güncelleme Sonuç Alanı (Dinamik) -->
      <div id="updateStatusContainer" style="margin-top: 16px;">
        <div class="settings-card" style="text-align: center; padding: 28px 20px; color: var(--text-muted); border: 1px dashed var(--border-color);">
          <div class="inline-spinner" style="margin: 0 auto 12px auto;"></div>
          <div style="font-size: 13px;">GitHub Releases üzerinden güncellemeler denetleniyor...</div>
        </div>
      </div>
    `;

    // Saatlik kontrol toggle
    const toggle = container.querySelector('#autoCheckUpdatesToggle') as HTMLInputElement;
    toggle?.addEventListener('change', () => {
      this.settings.autoCheckUpdatesHourly = toggle.checked;
      this.saveSettings();
    });

    // Manuel kontrol butonu
    const btnCheck = container.querySelector('#btnCheckUpdatesManual') as HTMLButtonElement;
    const btnText = container.querySelector('#btnCheckUpdatesText') as HTMLElement;
    const statusContainer = container.querySelector('#updateStatusContainer') as HTMLElement;

    const isNewer = (latest: string, current: string): boolean => {
      const cleanL = latest.replace(/^v/i, '').trim();
      const cleanC = current.replace(/^v/i, '').trim();
      const partsL = cleanL.split('.').map(n => parseInt(n, 10) || 0);
      const partsC = cleanC.split('.').map(n => parseInt(n, 10) || 0);
      const len = Math.max(partsL.length, partsC.length);
      for (let i = 0; i < len; i++) {
        const vL = partsL[i] || 0;
        const vC = partsC[i] || 0;
        if (vL > vC) return true;
        if (vL < vC) return false;
      }
      return false;
    };

    const performUpdateCheck = async () => {
      if (btnCheck.disabled) return;
      btnCheck.disabled = true;
      if (btnText) btnText.textContent = 'Kontrol Ediliyor...';

      statusContainer.innerHTML = `
        <div class="settings-card" style="text-align: center; padding: 32px 20px;">
          <div class="inline-spinner" style="margin: 0 auto 12px auto;"></div>
          <div style="font-size: 13px; color: var(--text-primary);">GitHub Releases sorgulanıyor...</div>
        </div>
      `;

      try {
        let info: any = null;
        const updater = (window as any).kragaAPI?.updater;

        if (updater?.check) {
          try {
            info = await updater.check();
          } catch (e) {
            console.warn('[SettingsModal] Electron updater.check başarısız oldu, doğrudan GitHub API fallback çalışıyor:', e);
          }
        }

        // Doğrudan GitHub API Fallback (IPC yoksa veya hata verdiyse)
        if (!info || typeof info.hasUpdate === 'undefined') {
          const res = await fetch('https://api.github.com/repos/mehmetkraga/KRAGA-AI-IDE-RELEASES/releases/latest', {
            headers: { Accept: 'application/vnd.github.v3+json' },
          });
          if (!res.ok) {
            throw new Error(`GitHub API yanıt vermedi (${res.status})`);
          }
          const release = await res.json();
          const latestTag = release.tag_name || release.name || '';
          const latestVer = latestTag.replace(/^v/i, '').trim();
          const hasUpdate = isNewer(latestVer, currentVer);

          let downloadUrl: string | null = null;
          let assetName: string | null = null;
          let assetSize = 0;

          if (Array.isArray(release.assets)) {
            const exeAsset = release.assets.find((a: any) =>
              typeof a.name === 'string' && a.name.endsWith('.exe') && !a.name.includes('.blockmap')
            );
            if (exeAsset) {
              downloadUrl = exeAsset.browser_download_url;
              assetName = exeAsset.name;
              assetSize = exeAsset.size || 0;
            }
          }

          info = {
            hasUpdate,
            currentVersion: currentVer,
            latestVersion: latestVer,
            releaseName: release.name || latestTag,
            releaseNotes: release.body || '',
            publishedAt: release.published_at || '',
            downloadUrl,
            assetName,
            assetSize,
            htmlUrl: release.html_url || 'https://github.com/mehmetkraga/KRAGA-AI-IDE-RELEASES/releases/latest',
          };
        }

        btnCheck.disabled = false;
        if (btnText) btnText.textContent = 'Tekrar Denetle';

        const nowStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        if (!info.hasUpdate) {
          // Güncel
          statusContainer.innerHTML = `
            <div class="settings-card" style="border: 1px solid rgba(16, 185, 129, 0.35); background: rgba(16, 185, 129, 0.04); border-radius: 8px; padding: 18px 20px;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 14px;">
                <div style="display: flex; align-items: center; gap: 14px;">
                  <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(16, 185, 129, 0.12); display: flex; align-items: center; justify-content: center; color: #10b981; flex-shrink: 0;">
                    ${iconCheckCircle(20, '#10b981')}
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
                      <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: #ffffff;">Tebrikler, Open Crow En Güncel Sürümde!</h4>
                      <span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 11px; padding: 1px 7px; border-radius: 4px; font-weight: 600; font-family: var(--font-mono, monospace);">v${info.currentVersion || currentVer}</span>
                    </div>
                    <p style="margin: 0; font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
                      Mevcut yüklü v${info.currentVersion || currentVer} sürümü resmi son kararlı sürümdür. Yeni bir güncelleme yayınlandığında Open Crow sizi bilgilendirecektir.
                    </p>
                  </div>
                </div>
                <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; font-family: var(--font-mono, monospace);">
                  Son kontrol: Bugün ${nowStr}
                </div>
              </div>
            </div>

            <!-- Son Yayınlanan Sürüm Özeti -->
            ${info.latestVersion ? `
              <div class="settings-card" style="margin-top: 12px; border: 1px solid var(--border-color); background: rgba(255, 255, 255, 0.02); border-radius: 8px; padding: 16px 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <span style="font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Son Yayınlanan Sürüm: v${info.latestVersion}</span>
                  <a href="${info.htmlUrl || 'https://github.com/mehmetkraga/KRAGA-AI-IDE-RELEASES/releases/latest'}" target="_blank" style="font-size: 12px; color: var(--accent-cyan, #00f0ff); text-decoration: none; display: flex; align-items: center; gap: 4px;">
                    GitHub'da İncele ↗
                  </a>
                </div>
                <div style="font-size: 12px; line-height: 1.5; color: var(--text-secondary); max-height: 120px; overflow-y: auto;">
                  ${info.releaseNotes ? DOMPurify.sanitize(marked.parse(info.releaseNotes) as string) : '<p>Sürüm notları mevcut.</p>'}
                </div>
              </div>
            ` : ''}
          `;
        } else {
          // Yeni sürüm var!
          const notesHtml = info.releaseNotes
            ? DOMPurify.sanitize(marked.parse(info.releaseNotes) as string)
            : '<p>Sürüm notu belirtilmedi.</p>';

          const sizeMb = info.assetSize ? (info.assetSize / (1024 * 1024)).toFixed(1) + ' MB' : 'Kurulum Paketi';

          statusContainer.innerHTML = `
            <div class="settings-card" style="border: 1px solid rgba(255, 255, 255, 0.25); background: rgba(255, 255, 255, 0.03); border-radius: 8px; padding: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; gap: 16px;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="background: #ffffff; color: #000000; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px;">YENİ SÜRÜM MEVCUT</span>
                    <span style="font-family: var(--font-mono, monospace); font-weight: 700; color: #ffffff; font-size: 13px;">v${info.latestVersion}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">• ${sizeMb}</span>
                  </div>
                  <h3 style="margin: 4px 0 2px 0; font-size: 15px; font-weight: 600; color: var(--text-primary);">${info.releaseName || 'Open Crow v' + info.latestVersion}</h3>
                  <div style="font-size: 12px; color: var(--text-muted);">In-App Otomatik Kurulum veya Doğrudan İndirme</div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <button class="settings-btn" id="btnStartDownloadUpdate" style="background: #ffffff; color: #000000; border: none; font-weight: 700; padding: 9px 18px; border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">
                    ⚡ Hemen İndir ve Güncelle
                  </button>
                  ${info.downloadUrl ? `
                    <a href="${info.downloadUrl}" target="_blank" class="settings-btn" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); color: #ffffff; text-decoration: none; padding: 9px 14px; border-radius: 6px; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                      Direct .EXE ↗
                    </a>
                  ` : ''}
                </div>
              </div>

              <!-- İlerleme Çubuğu -->
              <div id="updateDownloadProgressWrap" style="display: none; margin: 16px 0 12px 0; padding: 14px; background: rgba(255, 255, 255, 0.04); border-radius: 8px; border: 1px solid var(--border-color);">
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-primary); margin-bottom: 8px;">
                  <span id="updateProgressStatusText">Kurulum paketi indiriliyor...</span>
                  <span id="updateProgressPercent" style="font-weight: 700; color: #ffffff; font-family: var(--font-mono, monospace);">0%</span>
                </div>
                <div style="width: 100%; height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; overflow: hidden;">
                  <div id="updateProgressBarFill" style="width: 0%; height: 100%; background: #ffffff; transition: width 0.2s ease;"></div>
                </div>
                <div id="updateProgressBytes" style="font-size: 11px; color: var(--text-muted); margin-top: 6px; text-align: right; font-family: var(--font-mono, monospace);">0 MB / ${sizeMb}</div>
              </div>

              <!-- Değişiklik Notları -->
              <div style="margin-top: 14px; border-top: 1px solid var(--border-color); padding-top: 12px;">
                <h4 style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Sürüm Değişiklik Notları</h4>
                <div class="update-release-notes" style="font-size: 12px; line-height: 1.6; color: var(--text-secondary); max-height: 180px; overflow-y: auto; padding: 12px; background: rgba(0, 0, 0, 0.3); border-radius: 6px; border: 1px solid var(--border-color);">
                  ${notesHtml}
                </div>
              </div>
            </div>
          `;

          // İndirme ve Kurulum Aksiyonları
          const btnDownload = statusContainer.querySelector('#btnStartDownloadUpdate') as HTMLButtonElement;
          const progressWrap = statusContainer.querySelector('#updateDownloadProgressWrap') as HTMLElement;
          const progressFill = statusContainer.querySelector('#updateProgressBarFill') as HTMLElement;
          const progressPercent = statusContainer.querySelector('#updateProgressPercent') as HTMLElement;
          const progressStatus = statusContainer.querySelector('#updateProgressStatusText') as HTMLElement;
          const progressBytes = statusContainer.querySelector('#updateProgressBytes') as HTMLElement;

          btnDownload?.addEventListener('click', async () => {
            if (!updater?.download) {
              if (info.downloadUrl) {
                window.open(info.downloadUrl, '_blank');
              } else {
                window.open(info.htmlUrl || 'https://github.com/mehmetkraga/KRAGA-AI-IDE-RELEASES/releases/latest', '_blank');
              }
              return;
            }

            btnDownload.disabled = true;
            btnDownload.style.opacity = '0.7';
            btnDownload.textContent = '⏳ İndiriliyor...';
            progressWrap.style.display = 'block';

            // Canlı progress dinle
            const unbindProgress = updater.onProgress((p: { percent: number; downloaded: number; total: number }) => {
              if (progressFill) progressFill.style.width = `${p.percent}%`;
              if (progressPercent) progressPercent.textContent = `${p.percent}%`;
              if (progressBytes && p.total > 0) {
                const curMb = (p.downloaded / (1024 * 1024)).toFixed(1);
                const totMb = (p.total / (1024 * 1024)).toFixed(1);
                progressBytes.textContent = `${curMb} MB / ${totMb} MB`;
              }
            });

            try {
              const res = await updater.download();
              unbindProgress();

              if (res.success) {
                if (progressFill) progressFill.style.width = '100%';
                if (progressPercent) progressPercent.textContent = '100%';
                if (progressStatus) progressStatus.textContent = 'İndirme tamamlandı! Kuruluma hazır.';

                btnDownload.disabled = false;
                btnDownload.style.opacity = '1';
                btnDownload.style.background = '#2ea043';
                btnDownload.style.borderColor = '#2ea043';
                btnDownload.style.color = '#ffffff';
                btnDownload.textContent = '⚡ Şimdi Yeniden Başlat ve Güncelle';

                btnDownload.onclick = () => {
                  btnDownload.disabled = true;
                  btnDownload.style.opacity = '0.7';
                  btnDownload.textContent = '⏳ Güncelleniyor ve Yeniden Başlatılıyor...';
                  if (progressStatus) progressStatus.textContent = 'IDE güncelleniyor, lütfen bekleyin... Otomatik olarak yeniden açılacaktır.';
                  updater.install();
                };
              } else {
                throw new Error(res.error || 'İndirme başarısız oldu.');
              }
            } catch (err: any) {
              unbindProgress();
              btnDownload.disabled = false;
              btnDownload.style.opacity = '1';
              btnDownload.textContent = '❌ Tekrar Dene';
              if (progressStatus) progressStatus.textContent = `Hata: ${err.message || 'İndirilemedi'}`;
            }
          });
        }
      } catch (err: any) {
        btnCheck.disabled = false;
        if (btnText) btnText.textContent = 'Tekrar Denetle';
        statusContainer.innerHTML = `
          <div class="settings-card" style="border: 1px solid rgba(248, 81, 73, 0.35); background: rgba(248, 81, 73, 0.05); border-radius: 8px; padding: 16px 20px;">
            <div style="font-size: 14px; font-weight: 600; color: #f85149;">Güncelleme kontrolü başarısız oldu</div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${err.message || 'Ağ bağlantınızı kontrol edin.'}</div>
          </div>
        `;
      }
    };

    btnCheck?.addEventListener('click', performUpdateCheck);

    // Sekme açıldığında kullanıcıyı bekletmeden otomatik sorgu yap
    setTimeout(() => {
      performUpdateCheck();
    }, 50);
  }

  // 9. ABOUT TAB
  private async renderAboutTab(container: HTMLElement): Promise<void> {
    let appVer = '1.9.0';
    try {
      if ((window as any).kragaAPI?.updater?.getVersion) {
        appVer = await (window as any).kragaAPI.updater.getVersion();
      }
    } catch {}

    container.innerHTML = `
      <div class="settings-card" style="text-align: center; padding: 36px 24px;">
        <div style="position: relative; display: inline-block; margin-bottom: 16px;">
          <img src="./assets/images/logo-bird.png" width="96" height="96" alt="Open Crow Logo" style="filter: drop-shadow(0 0 20px rgba(0, 240, 255, 0.45));" />
        </div>
        <h2 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
          Open Crow <span style="color: var(--accent-color, #00f0ff);">v${appVer}</span>
        </h2>
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
          <span class="settings-badge" style="background: rgba(0, 240, 255, 0.12); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.3);">Resmi Sürüm</span>
          <span class="settings-badge" style="background: rgba(255, 255, 255, 0.06); color: #e6edf3; border: 1px solid rgba(255, 255, 255, 0.12);">Windows x64</span>
          <span class="settings-badge" style="background: rgba(52, 211, 153, 0.12); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);">Kod İmzalı</span>
          <span class="settings-badge" style="background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);">KragaOS Çekirdeği</span>
        </div>
        <p style="color: var(--text-secondary, #c9d1d9); margin: 0 auto 24px auto; max-width: 580px; font-size: 13.5px; line-height: 1.65;">
          Yapay Zekâ ve Otonom Ajan Destekli Yeni Nesil Masaüstü Kodlama Stüdyosu. <strong>Doğrulanmış MCP sunucu kataloğu</strong>, <strong>100 Seçkin Claude & Antigravity Yeteneği</strong>, <strong>Modeller Konseyi</strong> (Karpathy 3-Aşamalı Hakemlik), <strong>Graphify AST</strong> Analitiği ve <strong>Monaco Editor</strong> çalışma alanı.
        </p>

        <!-- Sistem ve Mimari Detay Kartı -->
        <div style="text-align: left; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1)); border-radius: 8px; padding: 16px 20px; max-width: 620px; margin: 0 auto 24px auto; font-size: 12.5px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px;">
            <div><span style="color: var(--text-muted, #8b949e);">Sürüm:</span> <strong style="color: #ffffff;">${appVer} (Son Kararlı Derleme)</strong></div>
            <div><span style="color: var(--text-muted, #8b949e);">Geliştirici:</span> <strong style="color: #ffffff;">mehmetkraga</strong></div>
            <div><span style="color: var(--text-muted, #8b949e);">Dağıtım:</span> <span style="color: var(--text-primary, #f0f6fc);">Windows NSIS x64 Standalone</span></div>
            <div><span style="color: var(--text-muted, #8b949e);">Mimari:</span> <span style="color: var(--text-primary, #f0f6fc);">Electron • Node.js • TypeScript</span></div>
            <div><span style="color: var(--text-muted, #8b949e);">Editör Motoru:</span> <span style="color: var(--text-primary, #f0f6fc);">Monaco Editor (VS Code Çekirdeği)</span></div>
            <div><span style="color: var(--text-muted, #8b949e);">Terminal:</span> <span style="color: var(--text-primary, #f0f6fc);">xterm.js GPU İvmelendirmeli</span></div>
          </div>
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11px; color: var(--text-muted, #8b949e); text-align: center;">
            Telif Hakkı © 2026 mehmetkraga. Tüm hakları saklıdır.
          </div>
        </div>

        <!-- Hızlı Bağlantı Butonları -->
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button class="settings-btn settings-btn--accent" id="btnAboutOpenWeb" style="cursor: pointer;">
            🌐 Resmi Web Portalı
          </button>
          <button class="settings-btn" id="btnAboutOpenReleases" style="cursor: pointer;">
            📦 GitHub Sürümleri
          </button>
          <button class="settings-btn" id="btnAboutOpenRepo" style="cursor: pointer;">
            💻 Kaynak Kod Deposu
          </button>
          <button class="settings-btn" id="btnAboutOpenIssues" style="cursor: pointer;">
            🐛 Hata / Öneri Bildir
          </button>
          <button class="settings-btn" id="btnAboutCheckUpdates" style="cursor: pointer;">
            🔄 Güncellemeleri Denetle
          </button>
        </div>
      </div>
    `;

    const openExt = (url: string) => {
      if ((window as any).kragaAPI?.app?.openExternal) {
        (window as any).kragaAPI.app.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    };

    container.querySelector('#btnAboutOpenReleases')?.addEventListener('click', () => openExt('https://github.com/mehmetkraga/KRAGA-AI-IDE-RELEASES'));
    container.querySelector('#btnAboutOpenRepo')?.addEventListener('click', () => openExt('https://github.com/mehmetkraga/KRAGA-AI-IDE'));
    container.querySelector('#btnAboutOpenIssues')?.addEventListener('click', () => openExt('https://github.com/mehmetkraga/KRAGA-AI-IDE/issues'));
    container.querySelector('#btnAboutCheckUpdates')?.addEventListener('click', () => this.switchTab('updates'));
  }
}
