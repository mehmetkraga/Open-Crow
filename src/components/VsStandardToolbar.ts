// src/components/VsStandardToolbar.ts
// Kraga IDE — Visual Studio 2022 Standart Düzenleme ve Hata Ayıklama Araç Çubuğu (Standard Toolbar)

export interface VsToolbarEvents {
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  onNewFile?: () => void;
  onOpenFile?: () => void;
  onSave?: () => void;
  onSaveAll?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onStartDebug?: (config: string, target: string, platform?: string) => void;
  onCommentSelection?: () => void;
  onUncommentSelection?: () => void;
  onFormatDocument?: () => void;
  onFind?: () => void;
  onReplace?: () => void;
  onToggleBreakpoint?: () => void;
  onSplitEditor?: () => void;
  onLivePreview?: () => void;
  onPeekDefinition?: () => void;
  onQuickFix?: () => void;
}

export class VsStandardToolbar {
  private container: HTMLElement;
  private events: VsToolbarEvents = {};
  private currentConfig: string = 'Debug';
  private currentPlatform: string = 'Any CPU';
  private currentProjectName: string = 'Başlat';
  private configDropdownEl: HTMLSelectElement | null = null;
  private platformDropdownEl: HTMLSelectElement | null = null;
  private runBtnEl: HTMLButtonElement | null = null;

  constructor(containerId: string, events: VsToolbarEvents = {}) {
    this.container = document.getElementById(containerId)!;
    this.events = events;
    this.render();
  }

  public setProjectName(name?: string): void {
    if (!name || name === 'Klasör Açılmadı' || name.trim() === '') {
      this.currentProjectName = 'Başlat';
    } else {
      this.currentProjectName = name.trim();
    }
    if (this.runBtnEl) {
      const label = this.runBtnEl.querySelector('.vs-run-label');
      if (label) label.textContent = this.currentProjectName;
      this.runBtnEl.title = `Çalıştır (${this.currentProjectName})`;
    }
  }

  public setEvents(events: Partial<VsToolbarEvents>): void {
    this.events = { ...this.events, ...events };
  }

  private render(): void {
    if (!this.container) return;

    this.container.classList.add('vs-toolbar-container', 'vs-standard-toolbar');
    this.container.innerHTML = `
      <div class="vs-toolbar-inner">
        <!-- 1. Gezinme Butonları (Geri / İleri) -->
        <div class="vs-toolbar-group">
          <button type="button" class="vs-tool-btn" id="vsBtnNavBack" title="Geriye Git (Alt+Sol)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnNavForward" title="İleri Git (Alt+Sağ)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>

        <div class="vs-toolbar-sep"></div>

        <!-- 2. Dosya Yönetimi (Yeni, Aç, Kaydet, Tümünü Kaydet) -->
        <div class="vs-toolbar-group">
          <button type="button" class="vs-tool-btn" id="vsBtnNewFile" title="Yeni Dosya (Ctrl+N)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnOpenFile" title="Dosya Aç (Ctrl+O)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnSave" title="Kaydet (Ctrl+S)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnSaveAll" title="Tümünü Kaydet (Ctrl+Shift+S)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 18H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9l4 4v10a2 2 0 0 1-2 2z"/><path d="M20 22H8a2 2 0 0 1-2-2v-2h12V8h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2z"/></svg>
          </button>
        </div>

        <div class="vs-toolbar-sep"></div>

        <!-- 3. Düzenleme (Geri Al / Yinele) -->
        <div class="vs-toolbar-group">
          <button type="button" class="vs-tool-btn" id="vsBtnUndo" title="Geri Al (Ctrl+Z)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnRedo" title="Yinele (Ctrl+Y)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
          </button>
        </div>

        <div class="vs-toolbar-sep"></div>

        <!-- 4. Visual Studio Başlat & Konfigürasyon Bloğu (Yeşil Play ve Hedefler) -->
        <div class="vs-toolbar-group vs-toolbar-group--run">
          <button type="button" class="vs-run-btn" id="vsBtnStartRun" title="Hata Ayıklamayı Başlat / Çalıştır (F5)">
            <span class="vs-run-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#38d430" stroke="#38d430" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </span>
            <span class="vs-run-label">${this.currentProjectName}</span>
          </button>

          <select class="vs-select-config" id="vsSelectConfig" title="Çözüm Yapılandırması">
            <option value="Debug" selected>Debug</option>
            <option value="Release">Release</option>
          </select>

          <select class="vs-select-platform" id="vsSelectPlatform" title="Çözüm Platformu">
            <option value="Any CPU" selected>Any CPU</option>
            <option value="x64">x64</option>
            <option value="x86">x86</option>
            <option value="ARM64">ARM64</option>
          </select>
        </div>

        <div class="vs-toolbar-sep"></div>

        <!-- 5. Kodlama ve Biçimlendirme Araçları -->
        <div class="vs-toolbar-group">
          <button type="button" class="vs-tool-btn" id="vsBtnComment" title="Seçimi Yorum Satırı Yap (Ctrl+K, Ctrl+C)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="4" x2="6" y2="20"/><line x1="22" y1="4" x2="10" y2="20"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnUncomment" title="Yorum İşaretini Kaldır (Ctrl+K, Ctrl+U)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="4" x2="6" y2="20"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnFormat" title="Belgeyi Biçimlendir (Shift+Alt+F)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnPeekDef" title="Tanıma Gözat (Alt+F12)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnQuickFix" title="Hızlı İşlemler & Refaktör (Ctrl+.)">
            <span style="font-size: 11px;">💡</span>
          </button>
        </div>

        <div class="vs-toolbar-sep"></div>

        <!-- 6. Arama ve Kesme Noktaları -->
        <div class="vs-toolbar-group">
          <button type="button" class="vs-tool-btn" id="vsBtnFind" title="Dosyada Bul (Ctrl+F)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnReplace" title="Değiştir (Ctrl+H)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m14 4 4 4-4 4"/><path d="M4 8h14"/><path d="m10 20-4-4 4-4"/><path d="M20 16H6"/></svg>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnBreakpoint" title="Kesme Noktasını Değiştir (F9)">
            <span class="vs-bp-icon">●</span>
          </button>
          <button type="button" class="vs-tool-btn" id="vsBtnSplitEditor" title="Editörü Böl (Yatay/Dikey)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
          </button>
        </div>

        <div class="vs-toolbar-sep"></div>

        <!-- 7. Canlı Önizleme / Oyunu Başlat (HTML Popup) -->
        <div class="vs-toolbar-group">
          <button type="button" class="vs-tool-btn vs-tool-btn--preview" id="vsBtnLivePreview" title="Canlı Önizleme / Oyunu Aç (HTML Popup Penceresi)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2.2">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10 8 16 12 10 16 10 8" fill="var(--accent-color, #00f0ff)"/>
            </svg>
            <span style="font-size: 11px; font-weight: 600; color: var(--accent-color, #00f0ff); margin-left: 3px;">Önizle</span>
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.container.querySelector('#vsBtnNavBack')?.addEventListener('click', () => this.events.onNavigateBack?.());
    this.container.querySelector('#vsBtnNavForward')?.addEventListener('click', () => this.events.onNavigateForward?.());
    this.container.querySelector('#vsBtnNewFile')?.addEventListener('click', () => this.events.onNewFile?.());
    this.container.querySelector('#vsBtnOpenFile')?.addEventListener('click', () => this.events.onOpenFile?.());
    this.container.querySelector('#vsBtnSave')?.addEventListener('click', () => this.events.onSave?.());
    this.container.querySelector('#vsBtnSaveAll')?.addEventListener('click', () => this.events.onSaveAll?.());
    this.container.querySelector('#vsBtnUndo')?.addEventListener('click', () => this.events.onUndo?.());
    this.container.querySelector('#vsBtnRedo')?.addEventListener('click', () => this.events.onRedo?.());
    this.container.querySelector('#vsBtnLivePreview')?.addEventListener('click', () => this.events.onLivePreview?.());

    this.runBtnEl = this.container.querySelector('#vsBtnStartRun');
    this.runBtnEl?.addEventListener('click', () => {
      this.events.onStartDebug?.(this.currentConfig, this.currentProjectName, this.currentPlatform);
    });

    this.configDropdownEl = this.container.querySelector('#vsSelectConfig');
    this.configDropdownEl?.addEventListener('change', (e) => {
      this.currentConfig = (e.target as HTMLSelectElement).value;
    });

    this.platformDropdownEl = this.container.querySelector('#vsSelectPlatform');
    this.platformDropdownEl?.addEventListener('change', (e) => {
      this.currentPlatform = (e.target as HTMLSelectElement).value;
    });

    this.container.querySelector('#vsBtnComment')?.addEventListener('click', () => this.events.onCommentSelection?.());
    this.container.querySelector('#vsBtnUncomment')?.addEventListener('click', () => this.events.onUncommentSelection?.());
    this.container.querySelector('#vsBtnFormat')?.addEventListener('click', () => this.events.onFormatDocument?.());
    this.container.querySelector('#vsBtnFind')?.addEventListener('click', () => this.events.onFind?.());
    this.container.querySelector('#vsBtnReplace')?.addEventListener('click', () => this.events.onReplace?.());
    this.container.querySelector('#vsBtnBreakpoint')?.addEventListener('click', () => this.events.onToggleBreakpoint?.());
    this.container.querySelector('#vsBtnSplitEditor')?.addEventListener('click', () => this.events.onSplitEditor?.());
    this.container.querySelector('#vsBtnPeekDef')?.addEventListener('click', () => this.events.onPeekDefinition?.());
    this.container.querySelector('#vsBtnQuickFix')?.addEventListener('click', () => this.events.onQuickFix?.());
  }
}
