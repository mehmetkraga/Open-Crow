// src/components/PreviewModal.ts
// Open Crow — İnteraktif Canlı Önizleme Popup / Modal Penceresi (Live Game & Web Preview Modal)
// HTML Oyunları (yılan oyunu vb.), Web Siteleri ve Uygulamaları için bağımsız açılır pencere.
// Monaco Editör görünümünü bozmadan, tam odaklı oyun ve canlı test deneyimi sunar.

import DOMPurify from 'dompurify';

export interface PreviewModalOptions {
  filePath?: string;
  fileContent?: string;
  title?: string;
}

export class PreviewModal {
  private static instance: PreviewModal | null = null;

  private overlayEl: HTMLElement | null = null;
  private windowEl: HTMLElement | null = null;
  private iframeEl: HTMLIFrameElement | null = null;
  private currentDevice: 'desktop' | 'tablet' | 'mobile' = 'desktop';
  private isMaximized: boolean = false;
  private currentOptions: PreviewModalOptions | null = null;
  private currentBlobUrl: string | null = null;

  private constructor() {
    this.createDom();
    this.bindGlobalKeys();
  }

  public static getInstance(): PreviewModal {
    if (!PreviewModal.instance) {
      PreviewModal.instance = new PreviewModal();
    }
    return PreviewModal.instance;
  }

  private createDom(): void {
    const existing = document.getElementById('kragaPreviewModalOverlay');
    if (existing) existing.remove();

    this.overlayEl = document.createElement('div');
    this.overlayEl.id = 'kragaPreviewModalOverlay';
    this.overlayEl.className = 'kraga-preview-modal-overlay kraga-preview-modal-overlay--hidden';

    this.overlayEl.innerHTML = `
      <div class="kraga-preview-modal-window" id="kragaPreviewModalWindow">
        <!-- Modal Başlık Çubuğu -->
        <header class="kraga-preview-modal-header">
          <div class="kraga-preview-modal-header__left">
            <div class="kraga-preview-modal-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"/>
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/>
              </svg>
            </div>
            <div class="kraga-preview-modal-titles">
              <span class="kraga-preview-modal-title" id="previewModalTitle">Canlı Önizleme</span>
              <span class="kraga-preview-modal-badge" id="previewModalBadge">HTML OYUN / WEB</span>
            </div>
          </div>

          <!-- Cihaz Değiştirici Butonlar -->
          <div class="kraga-preview-device-pills">
            <button type="button" class="kraga-preview-pill active" data-device="desktop" title="Masaüstü (Tam Genişlik)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <span>Masaüstü</span>
            </button>
            <button type="button" class="kraga-preview-pill" data-device="tablet" title="Tablet (768px)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
              <span>Tablet</span>
            </button>
            <button type="button" class="kraga-preview-pill" data-device="mobile" title="Mobil (375px)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
              <span>Mobil</span>
            </button>
          </div>

          <!-- Eylem Butonları -->
          <div class="kraga-preview-modal-header__right">
            <button type="button" class="kraga-preview-action-btn" id="btnPreviewModalReload" title="Yeniden Başlat / Oyunu Sıfırla">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              <span class="kraga-preview-btn-label">Yeniden Başlat</span>
            </button>

            <button type="button" class="kraga-preview-action-btn" id="btnPreviewModalExternal" title="Varsayılan Dış Tarayıcıda Aç (Chrome/Edge)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              <span class="kraga-preview-btn-label">Tarayıcıda Aç</span>
            </button>

            <button type="button" class="kraga-preview-action-btn" id="btnPreviewModalMaximize" title="Pencereyi Büyüt / Küçült">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
            </button>

            <button type="button" class="kraga-preview-action-btn kraga-preview-action-btn--close" id="btnPreviewModalClose" title="Kapat (ESC)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Önizleme İçerik Alanı -->
        <main class="kraga-preview-modal-body">
          <div class="kraga-preview-modal-frame-holder kraga-preview-modal-frame-holder--desktop" id="kragaPreviewFrameHolder">
            <div class="kraga-preview-iframe-container" id="previewIframeContainer"></div>
          </div>
        </main>
      </div>
    `;

    document.body.appendChild(this.overlayEl);
    this.windowEl = this.overlayEl.querySelector('#kragaPreviewModalWindow');

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.overlayEl) return;

    // Kapat butonu
    this.overlayEl.querySelector('#btnPreviewModalClose')?.addEventListener('click', () => {
      this.close();
    });

    // Dış alana tıklayınca kapatma
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.close();
      }
    });

    // Yeniden başlat (Restart)
    this.overlayEl.querySelector('#btnPreviewModalReload')?.addEventListener('click', () => {
      this.reload();
    });

    // Dış tarayıcıda aç
    this.overlayEl.querySelector('#btnPreviewModalExternal')?.addEventListener('click', () => {
      this.openExternal();
    });

    // Tam Ekran / Büyüt
    this.overlayEl.querySelector('#btnPreviewModalMaximize')?.addEventListener('click', () => {
      this.toggleMaximize();
    });

    // Cihaz Değiştiriciler
    this.overlayEl.querySelectorAll('.kraga-preview-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const device = (btn as HTMLElement).dataset.device as 'desktop' | 'tablet' | 'mobile';
        if (device) this.setDevice(device);
      });
    });
  }

  private bindGlobalKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  public isOpen(): boolean {
    return !!(this.overlayEl && !this.overlayEl.classList.contains('kraga-preview-modal-overlay--hidden'));
  }

  public async open(options: PreviewModalOptions): Promise<void> {
    this.cleanupBlob();
    this.currentOptions = options;

    if (!this.overlayEl) {
      this.createDom();
    }

    const titleEl = this.overlayEl?.querySelector('#previewModalTitle') as HTMLElement;
    const badgeEl = this.overlayEl?.querySelector('#previewModalBadge') as HTMLElement;

    const fileName = options.filePath?.split(/[\\/]/).pop() || options.title || 'Canlı Önizleme';
    if (titleEl) {
      titleEl.textContent = DOMPurify.sanitize(fileName);
    }
    if (badgeEl) {
      const ext = fileName.split('.').pop()?.toUpperCase() || 'HTML';
      badgeEl.textContent = `${ext} ÖNİZLEME`;
    }

    this.overlayEl?.classList.remove('kraga-preview-modal-overlay--hidden');

    await this.loadIframeContent();
  }

  private async loadIframeContent(): Promise<void> {
    const container = this.overlayEl?.querySelector('#previewIframeContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="kraga-preview-loading">
        <span class="kraga-preview-spinner"></span>
        <span>Önizleme yükleniyor...</span>
      </div>
    `;

    let htmlContent = this.currentOptions?.fileContent;
    const filePath = this.currentOptions?.filePath;

    if (!htmlContent && filePath) {
      try {
        htmlContent = await (window as any).kragaAPI?.fs?.readFile(filePath);
      } catch (err) {
        console.warn('PreviewModal dosya okuma hatası:', err);
      }
    }

    if (!htmlContent) {
      container.innerHTML = `
        <div class="kraga-preview-empty">
          <p>Önizlenecek HTML içeriği bulunamadı.</p>
        </div>
      `;
      return;
    }

    // Blob URL oluştur
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    this.currentBlobUrl = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.className = 'kraga-preview-iframe';
    iframe.setAttribute('sandbox', 'allow-scripts allow-modals allow-forms allow-popups');
    iframe.src = this.currentBlobUrl;

    // Klavye odağını doğrudan oyuna ver (Yılan oyunu, yön tuşları, WASD anında çalışsın)
    iframe.addEventListener('load', () => {
      try {
        iframe.contentWindow?.focus();
        iframe.focus();
      } catch {}
    });

    container.innerHTML = '';
    container.appendChild(iframe);
    this.iframeEl = iframe;
  }

  public reload(): void {
    if (this.iframeEl && this.currentBlobUrl) {
      this.iframeEl.src = this.currentBlobUrl;
      setTimeout(() => {
        try {
          this.iframeEl?.contentWindow?.focus();
          this.iframeEl?.focus();
        } catch {}
      }, 100);
    } else {
      this.loadIframeContent();
    }
  }

  public openExternal(): void {
    const path = this.currentOptions?.filePath;
    if (path) {
      const url = `file:///${path.replace(/\\/g, '/')}`;
      if ((window as any).kragaAPI?.app?.openExternal) {
        (window as any).kragaAPI.app.openExternal(url);
      } else {
        window.open(url, '_blank');
      }
    } else if (this.currentBlobUrl) {
      window.open(this.currentBlobUrl, '_blank');
    }
  }

  public toggleMaximize(): void {
    this.isMaximized = !this.isMaximized;
    if (this.windowEl) {
      if (this.isMaximized) {
        this.windowEl.classList.add('kraga-preview-modal-window--maximized');
      } else {
        this.windowEl.classList.remove('kraga-preview-modal-window--maximized');
      }
    }
  }

  public setDevice(device: 'desktop' | 'tablet' | 'mobile'): void {
    this.currentDevice = device;
    const holder = this.overlayEl?.querySelector('#kragaPreviewFrameHolder');
    if (holder) {
      holder.className = `kraga-preview-modal-frame-holder kraga-preview-modal-frame-holder--${device}`;
    }

    this.overlayEl?.querySelectorAll('.kraga-preview-pill').forEach((btn) => {
      if ((btn as HTMLElement).dataset.device === device) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    setTimeout(() => {
      try {
        this.iframeEl?.contentWindow?.focus();
        this.iframeEl?.focus();
      } catch {}
    }, 50);
  }

  public getCurrentDevice(): 'desktop' | 'tablet' | 'mobile' {
    return this.currentDevice;
  }

  public close(): void {
    this.overlayEl?.classList.add('kraga-preview-modal-overlay--hidden');
    this.cleanupBlob();
    const container = this.overlayEl?.querySelector('#previewIframeContainer');
    if (container) container.innerHTML = '';
    this.iframeEl = null;
    this.currentOptions = null;
  }

  private cleanupBlob(): void {
    if (this.currentBlobUrl) {
      try {
        URL.revokeObjectURL(this.currentBlobUrl);
      } catch {}
      this.currentBlobUrl = null;
    }
  }
}

export const previewModal = PreviewModal.getInstance();
