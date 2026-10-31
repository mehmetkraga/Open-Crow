// src/components/PreviewWorkspace.ts
// Open Crow — Dahili Çoklu Format Canlı Önizleme Çalışma Alanı (Live Preview Workspace Panel)
// - HTML & Canvas Web Oyunları (örn. yilan_oyunu.html), Web Siteleri
// - PDF Belgeleri (Dahili PDF görüntüleyici)
// - Zengin Markdown & Mermaid önizleme
// - Görseller (PNG, JPG, SVG, GIF, WebP)
// - Responsive Cihaz Modları: Masaüstü (100%), Tablet (768px), Mobil (375px)
// - Adres çubuğu, Yenile, Dış Tarayıcıda Aç, Konsol Logları ve Tam Ekran

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { loadMermaid } from '../core/mermaidLoader';

export interface PreviewOptions {
  filePath?: string;
  fileContent?: string;
  title?: string;
  fileType?: 'html' | 'pdf' | 'markdown' | 'image' | 'generic';
  onClose?: () => void;
}

export class PreviewWorkspaceManager {
  private container: HTMLElement;
  private currentOptions: PreviewOptions | null = null;
  private currentDevice: 'desktop' | 'tablet' | 'mobile' = 'desktop';
  private iframeEl: HTMLIFrameElement | null = null;
  private blobUrl: string | null = null;

  public onStateChange?: (isOpen: boolean) => void;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }

  public openPreview(options: PreviewOptions): void {
    if (!this.container) {
      this.container = document.getElementById('previewWorkspaceView')!;
    }
    this.cleanupBlob();
    this.currentOptions = options;
    this.container.style.setProperty('display', 'flex', 'important');
    this.render();
    this.onStateChange?.(true);
  }

  public show(): void {
    if (!this.container) {
      this.container = document.getElementById('previewWorkspaceView')!;
    }
    if (this.container) {
      this.container.style.setProperty('display', 'flex', 'important');
    }
    this.onStateChange?.(true);
  }

  public hide(): void {
    if (this.container) {
      this.container.style.setProperty('display', 'none', 'important');
    }
  }

  public close(): void {
    this.hide();
    this.cleanupBlob();
    const closeCb = this.currentOptions?.onClose;
    this.currentOptions = null;
    closeCb?.();
    this.onStateChange?.(false);
  }

  private cleanupBlob(): void {
    if (this.blobUrl) {
      try {
        URL.revokeObjectURL(this.blobUrl);
      } catch {}
      this.blobUrl = null;
    }
  }

  public refresh(): void {
    if (this.iframeEl && this.blobUrl) {
      this.iframeEl.src = this.blobUrl;
    } else if (this.currentOptions) {
      this.render();
    }
  }

  private detectFileType(filePath?: string, customType?: string): 'html' | 'pdf' | 'markdown' | 'image' | 'generic' {
    if (customType) return customType as any;
    if (!filePath) return 'html';

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['md', 'markdown'].includes(ext)) return 'markdown';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'image';
    return 'generic';
  }

  private render(): void {
    if (!this.currentOptions) return;
    const { filePath, fileContent, title } = this.currentOptions;
    const type = this.detectFileType(filePath, this.currentOptions.fileType);
    const displayTitle = title || (filePath ? filePath.split(/[/\\]/).pop() || 'Canlı Önizleme' : 'Canlı Önizleme');
    const displayUrl = filePath || 'about:blank';

    this.container.innerHTML = `
      <div class="preview-workspace-container">
        <!-- Üst Önizleme Araç Çubuğu -->
        <header class="preview-toolbar">
          <div class="preview-toolbar__left">
            <button class="preview-tool-btn" id="btnPreviewReload" title="Yeniden Yükle">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
            <div class="preview-device-switch">
              <button class="preview-device-btn ${this.currentDevice === 'desktop' ? 'active' : ''}" data-device="desktop" title="Masaüstü Görünümü (100%)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </button>
              <button class="preview-device-btn ${this.currentDevice === 'tablet' ? 'active' : ''}" data-device="tablet" title="Tablet Görünümü (768px)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </button>
              <button class="preview-device-btn ${this.currentDevice === 'mobile' ? 'active' : ''}" data-device="mobile" title="Mobil Görünüm (375px)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="preview-toolbar__center">
            <span class="preview-title-badge" style="font-size: 11px; color: var(--text-secondary); margin-right: 6px; font-weight: 600;">${DOMPurify.sanitize(displayTitle || 'Canlı Önizleme')}</span>
            <div class="preview-address-bar" title="${DOMPurify.sanitize(displayUrl)}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span>${DOMPurify.sanitize(displayUrl)}</span>
            </div>
          </div>

          <div class="preview-toolbar__right">
            ${filePath ? `
              <button class="preview-tool-btn" id="btnPreviewExternal" title="Varsayılan Dış Tarayıcıda Aç">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>
            ` : ''}
            <button class="preview-tool-btn" id="btnPreviewClose" title="Önizlemeyi Kapat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Önizleme Alanı -->
        <main class="preview-viewport-area">
          <div class="preview-frame-wrapper preview-frame-wrapper--${this.currentDevice}" id="previewFrameWrapper">
            <!-- İçerik türüne göre render edilecek alan -->
            <div id="previewContentHost" style="width: 100%; height: 100%;"></div>
          </div>
        </main>
      </div>
    `;

    this.bindEvents(filePath);
    this.renderContent(type, fileContent, filePath);
  }

  private async renderContent(type: 'html' | 'pdf' | 'markdown' | 'image' | 'generic', content?: string, filePath?: string): Promise<void> {
    const host = this.container.querySelector('#previewContentHost') as HTMLElement;
    if (!host) return;
    host.innerHTML = '';

    if (type === 'html') {
      let htmlContent = content;
      if (!htmlContent && filePath) {
        try {
          htmlContent = await window.kragaAPI.fs.readFile(filePath);
        } catch (e) {
          console.warn('Dosya okunamadı:', e);
        }
      }

      if (htmlContent) {
        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
        this.blobUrl = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.className = 'preview-iframe';
        iframe.setAttribute('sandbox', 'allow-scripts allow-modals allow-forms allow-popups');
        iframe.src = this.blobUrl;
        this.iframeEl = iframe;
        host.appendChild(iframe);
      } else {
        host.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Önizlenecek HTML içeriği bulunamadı.</div>`;
      }
    } else if (type === 'pdf') {
      if (filePath) {
        const fileUrl = filePath.startsWith('file://') ? filePath : `file:///${filePath.replace(/\\/g, '/')}`;
        host.innerHTML = `
          <iframe src="${fileUrl}" class="preview-iframe" title="PDF Önizleme"></iframe>
        `;
      } else {
        host.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">PDF dosya yolu belirtilmedi.</div>`;
      }
    } else if (type === 'markdown') {
      let mdText = content || '';
      if (!mdText && filePath) {
        try {
          mdText = await window.kragaAPI.fs.readFile(filePath);
        } catch {}
      }

      let parsedHtml = '';
      try {
        parsedHtml = marked.parse(mdText) as string;
      } catch {
        parsedHtml = `<pre>${DOMPurify.sanitize(mdText)}</pre>`;
      }

      const mdContainer = document.createElement('div');
      mdContainer.className = 'markdown-body';
      mdContainer.style.cssText = 'padding: 32px; overflow-y: auto; height: 100%; box-sizing: border-box; background: #0c0e14; color: #e6edf3;';
      mdContainer.innerHTML = DOMPurify.sanitize(parsedHtml);
      host.appendChild(mdContainer);

      // Mermaid render
      const pres = mdContainer.querySelectorAll('pre code.language-mermaid');
      for (let i = 0; i < pres.length; i++) {
        const code = pres[i];
        const pre = code.closest('pre');
        if (!pre) continue;
        try {
          const { svg } = await (await loadMermaid()).render(`preview-mermaid-${Date.now()}-${i}`, code.textContent || '');
          const div = document.createElement('div');
          div.innerHTML = svg;
          pre.replaceWith(div);
        } catch {}
      }
    } else if (type === 'image') {
      const src = filePath ? `fsimg:///${filePath.replace(/\\/g, '/')}` : '';
      host.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #090a0f;">
          <img src="${src}" alt="Görsel" style="max-width: 95%; max-height: 95%; object-fit: contain; box-shadow: 0 4px 20px rgba(0,0,0,0.5);" />
        </div>
      `;
    } else {
      host.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-muted);">Bu dosya formatı için canlı önizleme desteklenmiyor.</div>`;
    }
  }

  private bindEvents(filePath?: string): void {
    // Yenile
    this.container.querySelector('#btnPreviewReload')?.addEventListener('click', () => {
      this.refresh();
    });

    // Kapat
    this.container.querySelector('#btnPreviewClose')?.addEventListener('click', () => {
      this.close();
    });

    // Dış Tarayıcı
    this.container.querySelector('#btnPreviewExternal')?.addEventListener('click', () => {
      if (filePath) {
        window.kragaAPI.fs.openPath(filePath);
      }
    });

    // Cihaz Değiştirici
    const deviceBtns = this.container.querySelectorAll('.preview-device-btn');
    const wrapper = this.container.querySelector('#previewFrameWrapper');
    deviceBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        deviceBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const device = btn.getAttribute('data-device') as 'desktop' | 'tablet' | 'mobile';
        this.currentDevice = device;
        if (wrapper) {
          wrapper.className = `preview-frame-wrapper preview-frame-wrapper--${device}`;
        }
      });
    });
  }
}
