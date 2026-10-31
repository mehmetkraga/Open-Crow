// src/components/LiveScriptWorkspace.ts
// Open Crow — Antigravity & Claude Tarzı Canlı Script ve Kod Çalışma Alanı (Live Artifact Workspace)
// - Ajan kod yazarken sol ana viewport'ta otomatik açılır
// - Monaco Editor entegrasyonu ile canlı streaming kod yazımı
// - Web Önizleme (Three.js, Canvas, HTML5 Demoları için yerleşik Live iframe Runner)
// - Farklı Kaydet, Editöre Aktar, Panoya Kopyala ve Kabul Et aksiyonları

import * as monaco from 'monaco-editor';
import { iconClose, iconPlay, iconCheck } from './icons';

export interface LiveScriptOptions {
  fileName: string;
  language: string;
  code: string;
  isStreaming?: boolean;
  onAccept?: (code: string) => void;
  onSave?: (path: string, code: string) => Promise<void>;
  onOpenInEditor?: (fileName: string, code: string, lang: string) => void;
}

export class LiveScriptWorkspaceManager {
  private container: HTMLElement;
  private currentOptions: LiveScriptOptions | null = null;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private model: monaco.editor.ITextModel | null = null;
  private activeView: 'code' | 'preview' = 'code';

  public onStateChange?: (isOpen: boolean) => void;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }

  public layout(): void {
    if (this.editor && this.activeView === 'code') {
      try {
        this.editor.layout();
      } catch {}
    }
  }

  private sanitizeFileName(fileName: string): string {
    let clean = (fileName || 'script.txt').trim();
    clean = clean.replace(/[/\\]+$/, '');
    const parts = clean.split(/[/\\]/);
    clean = parts[parts.length - 1] || 'script.txt';
    return clean.replace(/[^a-zA-Z0-9_\-\.]/g, '_') || 'script.txt';
  }

  public openScript(options: LiveScriptOptions): void {
    const safeName = this.sanitizeFileName(options.fileName);
    options.fileName = safeName;
    options.language = (options.language || 'plaintext').toLowerCase();

    // Eğer başlangıç kodu boşsa dostane bir canlı placeholder göster (pitch black ekranı önler)
    if (!options.code || options.code.trim().length === 0) {
      options.code = `// ⚡ Canlı kod akışı bekleniyor...\n// Ajan "${safeName}" dosyasını oluşturuyor, kodlar buraya anlık akacak.\n`;
    }

    this.currentOptions = options;
    this.activeView = 'code';
    this.container.style.display = 'flex';
    this.container.style.zIndex = '50';

    try {
      this.render();
    } catch (renderErr) {
      console.error('[LiveScriptWorkspace] render hatası:', renderErr);
    }

    try {
      this.initMonaco(options.code, options.language, options.fileName);
    } catch (err) {
      console.error('[LiveScriptWorkspace] initMonaco hatası:', err);
    }

    requestAnimationFrame(() => {
      this.layout();
      setTimeout(() => this.layout(), 60);
      setTimeout(() => this.layout(), 250);
    });

    this.onStateChange?.(true);
  }

  public setContent(code: string, isStreaming: boolean = true): void {
    if (!this.currentOptions) return;
    this.currentOptions.code = code;
    this.currentOptions.isStreaming = isStreaming;

    if (this.model) {
      if (this.model.getValue() !== code) {
        this.model.setValue(code);
        if (this.editor) {
          if (isStreaming) {
            const lineCount = this.model.getLineCount();
            this.editor.revealLine(lineCount);
          }
          this.editor.layout();
        }
      }
    } else {
      // Fallback pre container güncellemesi
      const pre = this.container.querySelector('#liveMonacoHost pre');
      if (pre) {
        pre.textContent = code;
      }
    }

    // Header ve durum rozetini güncelle
    const statusBadge = this.container.querySelector('#liveScriptStatus');
    if (statusBadge) {
      if (isStreaming) {
        statusBadge.className = 'live-script-badge live-script-badge--streaming';
        statusBadge.innerHTML = '<span class="live-dot-pulse"></span> Ajan Kod Yazıyor...';
      } else {
        statusBadge.className = 'live-script-badge live-script-badge--done';
        statusBadge.innerHTML = `${iconCheck(12)} Hazır • ${this.model?.getLineCount() || 0} satır`;
      }
    }

    // Alt bilgi barı
    const statsEl = this.container.querySelector('#liveScriptStats');
    if (statsEl && this.model) {
      statsEl.textContent = `${this.model.getLineCount()} satır • ${code.length} karakter • ${this.currentOptions.language.toUpperCase()}`;
    }

    // Eğer önizleme açıksa iframe'i güncelle
    if (this.activeView === 'preview') {
      this.updatePreviewIframe();
    }
  }

  public finishStreaming(code?: string): void {
    if (code !== undefined) {
      this.setContent(code, false);
    } else if (this.currentOptions) {
      this.setContent(this.currentOptions.code, false);
    }
  }

  public close(): void {
    this.container.style.display = 'none';
    this.container.style.zIndex = '';
    this.container.innerHTML = '';
    if (this.model) {
      try { this.model.dispose(); } catch {}
      this.model = null;
    }
    if (this.editor) {
      try { this.editor.dispose(); } catch {}
      this.editor = null;
    }
    this.currentOptions = null;
    this.onStateChange?.(false);
  }

  public isOpen(): boolean {
    return this.container.style.display !== 'none' && !!this.currentOptions;
  }

  public getFileName(): string {
    return this.currentOptions?.fileName || '';
  }

  public isStreaming(): boolean {
    return !!this.currentOptions?.isStreaming;
  }

  private render(): void {
    if (!this.currentOptions) return;
    const isWebFile = ['html', 'htm', 'js', 'javascript'].includes(this.currentOptions.language.toLowerCase()) ||
                      this.currentOptions.fileName.endsWith('.html');

    this.container.innerHTML = `
      <div class="live-script-panel">
        <!-- Header -->
        <div class="live-script-header">
          <div class="live-script-header__left">
            <div class="live-script-file-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <div class="live-script-tag">AJAN SCRIPT ÇALIŞMA ALANI</div>
              <h3 class="live-script-filename">${this.escapeHtml(this.currentOptions.fileName)}</h3>
            </div>
            <div id="liveScriptStatus" class="live-script-badge ${this.currentOptions.isStreaming ? 'live-script-badge--streaming' : 'live-script-badge--done'}">
              ${this.currentOptions.isStreaming
                ? '<span class="live-dot-pulse"></span> Ajan Kod Yazıyor...'
                : `${iconCheck(12)} Hazır`}
            </div>
          </div>

          <div class="live-script-header__actions">
            ${isWebFile ? `
              <div class="live-view-toggle">
                <button class="live-toggle-btn active" id="btnLiveViewCode">Kod</button>
                <button class="live-toggle-btn" id="btnLiveViewPreview">
                  ${iconPlay(12)} Canlı Önizleme
                </button>
              </div>
            ` : ''}

            <button class="live-action-btn live-action-btn--copy" id="btnLiveCopy" title="Kodu Kopyala">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Kopyala</span>
            </button>

            <button class="live-action-btn live-action-btn--editor" id="btnLiveOpenEditor" title="Sol Monaco Editör Sekmesi Olarak Aç">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              <span>Editörde Aç</span>
            </button>

            <button class="live-action-btn live-action-btn--save" id="btnLiveSave" title="Farklı Kaydet...">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span>Kaydet</span>
            </button>

            <button class="live-action-btn live-action-btn--accept" id="btnLiveAccept" title="Kabul Et ve Uygula">
              ${iconCheck(14)}
              <span>Kabul Et</span>
            </button>

            <button class="live-action-btn live-action-btn--close" id="btnLiveClose" title="Paneli Kapat">
              ${iconClose(14)}
            </button>
          </div>
        </div>

        <!-- Body: Code vs Preview -->
        <div class="live-script-body">
          <div id="liveMonacoHost" class="live-monaco-host"></div>
          <div id="livePreviewHost" class="live-preview-host" style="display: none;">
            <iframe id="livePreviewIframe" class="live-preview-iframe" sandbox="allow-scripts allow-modals"></iframe>
          </div>
        </div>

        <!-- Footer -->
        <div class="live-script-footer">
          <span id="liveScriptStats" class="live-script-stats">
            0 satır • 0 karakter • ${this.currentOptions.language.toUpperCase()}
          </span>
          <span class="live-script-footer-hint">
            Antigravity Live Artifact Workspace • Değişiklikler anında yansır
          </span>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private initMonaco(initialCode: string, language: string, fileName: string): void {
    const host = this.container.querySelector('#liveMonacoHost') as HTMLElement;
    if (!host) return;

    if (this.editor) {
      try { this.editor.dispose(); } catch {}
      this.editor = null;
    }
    if (this.model) {
      try { this.model.dispose(); } catch {}
      this.model = null;
    }

    try {
      const safeName = this.sanitizeFileName(fileName);
      const uri = monaco.Uri.parse(`inmemory://live_script_${Date.now()}_${safeName}`);
      this.model = monaco.editor.createModel(initialCode, language, uri);

      this.editor = monaco.editor.create(host, {
        model: this.model,
        theme: 'kraga-cyberpunk',
        fontSize: 13,
        fontFamily: "Consolas, 'Fira Code', monospace",
        lineNumbers: 'on',
        automaticLayout: true,
        minimap: { enabled: true, maxColumn: 80 },
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        readOnly: false,
      });
      this.editor.layout();
      requestAnimationFrame(() => this.editor?.layout());
      setTimeout(() => this.editor?.layout(), 50);
      setTimeout(() => this.editor?.layout(), 150);
      setTimeout(() => this.editor?.layout(), 350);

      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          if (this.editor && this.activeView === 'code') {
            try { this.editor.layout(); } catch {}
          }
        });
        ro.observe(host);
      }
    } catch (err) {
      console.error('[LiveScriptWorkspace] Monaco init hatası, fallback uygulanıyor:', err);
      host.innerHTML = `<div style="padding: 16px; color: #f1f5f9; font-family: Consolas, monospace; overflow: auto; height: 100%;"><pre style="margin:0;">${this.escapeHtml(initialCode || '// Kod bekleniyor...')}</pre></div>`;
    }
  }

  private bindEvents(): void {
    // Görünüm Değiştirici (Kod vs Canlı Önizleme)
    const btnCode = this.container.querySelector('#btnLiveViewCode');
    const btnPreview = this.container.querySelector('#btnLiveViewPreview');
    const monacoHost = this.container.querySelector('#liveMonacoHost') as HTMLElement;
    const previewHost = this.container.querySelector('#livePreviewHost') as HTMLElement;

    btnCode?.addEventListener('click', () => {
      this.activeView = 'code';
      btnCode.classList.add('active');
      btnPreview?.classList.remove('active');
      monacoHost.style.display = 'block';
      previewHost.style.display = 'none';
      this.editor?.layout();
    });

    btnPreview?.addEventListener('click', () => {
      this.activeView = 'preview';
      btnPreview.classList.add('active');
      btnCode?.classList.remove('active');
      monacoHost.style.display = 'none';
      previewHost.style.display = 'block';
      this.updatePreviewIframe();
    });

    // Kopyala
    this.container.querySelector('#btnLiveCopy')?.addEventListener('click', async () => {
      const code = this.model?.getValue() || this.currentOptions?.code || '';
      await navigator.clipboard.writeText(code);
      const btn = this.container.querySelector('#btnLiveCopy span');
      if (btn) {
        const oldText = btn.textContent;
        btn.textContent = 'Kopyalandı!';
        setTimeout(() => { btn.textContent = oldText; }, 1500);
      }
    });

    // Editörde Aç
    this.container.querySelector('#btnLiveOpenEditor')?.addEventListener('click', () => {
      if (!this.currentOptions) return;
      const code = this.model?.getValue() || this.currentOptions.code;
      if (this.currentOptions.onOpenInEditor) {
        this.currentOptions.onOpenInEditor(this.currentOptions.fileName, code, this.currentOptions.language);
      }
    });

    // Kaydet
    this.container.querySelector('#btnLiveSave')?.addEventListener('click', async () => {
      if (!this.currentOptions) return;
      const code = this.model?.getValue() || this.currentOptions.code;
      const targetPath = prompt('Dosyanın kaydedileceği dosya yolu:', this.currentOptions.fileName);
      if (targetPath) {
        if (this.currentOptions.onSave) {
          await this.currentOptions.onSave(targetPath, code);
        } else if (window.kragaAPI?.fs?.writeFile) {
          await window.kragaAPI.fs.writeFile(targetPath, code);
        }
        alert(`Dosya kaydedildi: ${targetPath}`);
      }
    });

    // Kabul Et
    this.container.querySelector('#btnLiveAccept')?.addEventListener('click', () => {
      if (!this.currentOptions) return;
      const code = this.model?.getValue() || this.currentOptions.code;
      this.currentOptions.onAccept?.(code);
      const btn = this.container.querySelector('#btnLiveAccept span');
      if (btn) {
        btn.textContent = 'Kabul Edildi';
        setTimeout(() => { this.close(); }, 800);
      }
    });

    // Kapat
    this.container.querySelector('#btnLiveClose')?.addEventListener('click', () => {
      this.close();
    });
  }

  private updatePreviewIframe(): void {
    const iframe = this.container.querySelector('#livePreviewIframe') as HTMLIFrameElement;
    if (!iframe || !this.currentOptions) return;

    let html = this.model?.getValue() || this.currentOptions.code || '';

    // Çalışma zamanı script hatalarını yakalayıp önizleme üzerinde gösteren zengin bildirim
    const errorTrapScript = `
<script>
(function() {
  function showScriptErr(msg, file, line, col) {
    var box = document.getElementById('__kraga_err_overlay__');
    if (!box) {
      box = document.createElement('div');
      box.id = '__kraga_err_overlay__';
      box.style.cssText = 'position:fixed;bottom:14px;left:14px;right:14px;background:rgba(18,18,24,0.96);backdrop-filter:blur(10px);color:#f87171;padding:12px 16px;border-radius:8px;font-family:Consolas,monospace;font-size:12px;border:1px solid #ef4444;box-shadow:0 8px 32px rgba(0,0,0,0.8);z-index:9999999;display:flex;align-items:flex-start;gap:12px;';
      document.body.appendChild(box);
    }
    var cleanFile = file ? file.split(/[\\\\/]/).pop() : '';
    box.innerHTML = '<span style="color:#ef4444;font-size:18px;line-height:1;">⚠️</span><div style="flex:1;"><div style="font-weight:bold;color:#fca5a5;margin-bottom:3px;">Script Çalışma Hatası (Runtime Error)</div><div style="color:#fecaca;word-break:break-all;">' + msg + '</div>' + (line ? '<div style="color:#94a3b8;font-size:11px;margin-top:4px;">Satır: ' + line + (col ? ', Sütun: ' + col : '') + (cleanFile ? ' (' + cleanFile + ')' : '') + '</div>' : '') + '</div>';
  }
  window.addEventListener('error', function(e) {
    showScriptErr(e.message || 'Bilinmeyen hata', e.filename, e.lineno, e.colno);
  });
  window.addEventListener('unhandledrejection', function(e) {
    var reason = e.reason ? (e.reason.message || e.reason) : 'Promise Reddedildi';
    showScriptErr('Unhandled Promise Rejection: ' + reason);
  });
})();
<\/script>
`;

    if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
      // Düz JS veya CSS ise HTML sarmalayıcı oluştur
      if (this.currentOptions.language === 'javascript' || this.currentOptions.fileName.endsWith('.js')) {
        html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;background:#111;color:#eee;font-family:sans-serif;padding:12px;}</style></head><body><script>${html}<\/script>${errorTrapScript}</body></html>`;
      } else if (this.currentOptions.language === 'css') {
        html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${html}</style></head><body><h1>Önizleme</h1><p>CSS Stili uygulandı.</p></body></html>`;
      }
    } else {
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${errorTrapScript}</body>`);
      } else {
        html += errorTrapScript;
      }
    }

    iframe.srcdoc = html;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
