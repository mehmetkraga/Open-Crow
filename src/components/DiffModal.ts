// src/components/DiffModal.ts
// Open Crow — Visual Studio 2022 Yan Yana Görsel Kod Karşılaştırma Modalı (Side-by-Side Diff Modal)
// Monaco Diff Editor (createDiffEditor) kullanarak orijinal ve yeni kodu yan yana,
// satır satır kırmızı/yeşil diff renklendirmesiyle sunar ve tek tıkla dosyaya uygular.

import * as monaco from 'monaco-editor';
import { iconCheck, iconClose } from './icons';

export interface DiffModalOptions {
  filePath: string;
  fileName: string;
  originalCode: string;
  modifiedCode: string;
  language?: string;
  onApply?: (newCode: string) => Promise<void> | void;
}

export class DiffModalManager {
  private overlayEl: HTMLElement | null = null;
  private diffEditor: monaco.editor.IStandaloneDiffEditor | null = null;
  private originalModel: monaco.editor.ITextModel | null = null;
  private modifiedModel: monaco.editor.ITextModel | null = null;
  private currentOptions: DiffModalOptions | null = null;

  public open(options: DiffModalOptions): void {
    this.close();
    this.currentOptions = options;

    const lang = options.language || this.detectLanguage(options.filePath);

    // Modal DOM Ağacı
    const overlay = document.createElement('div');
    overlay.className = 'diff-modal-overlay';
    overlay.id = 'diffModalOverlay';

    overlay.innerHTML = `
      <div class="diff-modal-window">
        <!-- Visual Studio 2022 Diff Başlığı -->
        <div class="diff-modal-header">
          <div class="diff-modal-title-group">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="12" y1="3" x2="12" y2="21"/>
            </svg>
            <div class="diff-modal-title">
              <span class="diff-modal-badge">VS 2022 DIFF</span>
              <span class="diff-modal-filename">${this.escapeHtml(options.fileName)}</span>
              <span class="diff-modal-filepath">${this.escapeHtml(options.filePath)}</span>
            </div>
          </div>

          <div class="diff-modal-actions">
            <button class="diff-action-btn diff-action-btn--apply" id="btnDiffApply">
              ${iconCheck(14)}
              <span>Değişiklikleri Uygula</span>
            </button>
            <button class="diff-action-btn diff-action-btn--cancel" id="btnDiffCancel" title="İptal (Esc)">
              ${iconClose(14)}
              <span>Kapat</span>
            </button>
          </div>
        </div>

        <!-- Diff Etiket Şeridi (Orijinal vs. Yeni) -->
        <div class="diff-labels-bar">
          <div class="diff-label diff-label--original">
            <span class="diff-indicator-dot dot-red"></span>
            <span>Mevcut Disk / Orijinal Kod (Salt Okunur)</span>
          </div>
          <div class="diff-label diff-label--modified">
            <span class="diff-indicator-dot dot-green"></span>
            <span>Önerilen / Yeni Değişiklikler (Düzenlenebilir)</span>
          </div>
        </div>

        <!-- Monaco Diff Editor Konteyneri -->
        <div class="diff-editor-host" id="diffEditorHost"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    this.overlayEl = overlay;

    const host = overlay.querySelector('#diffEditorHost') as HTMLElement;
    if (host) {
      // Monaco Diff Editor oluştur
      this.originalModel = monaco.editor.createModel(options.originalCode, lang);
      this.modifiedModel = monaco.editor.createModel(options.modifiedCode, lang);

      this.diffEditor = monaco.editor.createDiffEditor(host, {
        theme: 'kraga-cyberpunk',
        readOnly: false,
        originalEditable: false,
        automaticLayout: true,
        renderSideBySide: true,
        renderIndicators: true,
        smoothScrolling: true,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        fontFamily: 'var(--font-mono, Consolas, monospace)',
        fontSize: 13,
      });

      this.diffEditor.setModel({
        original: this.originalModel,
        modified: this.modifiedModel,
      });
    }

    // Buton Dinleyicileri
    overlay.querySelector('#btnDiffCancel')?.addEventListener('click', () => this.close());

    const btnApply = overlay.querySelector('#btnDiffApply') as HTMLButtonElement;
    btnApply?.addEventListener('click', async () => {
      if (!this.modifiedModel || !this.currentOptions) return;
      const finalCode = this.modifiedModel.getValue();
      btnApply.disabled = true;
      btnApply.innerHTML = 'Uygulanıyor...';
      try {
        await this.currentOptions.onApply?.(finalCode);
      } finally {
        this.close();
      }
    });

    // Esc ile kapatma
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        window.removeEventListener('keydown', keyHandler);
        this.close();
      }
    };
    window.addEventListener('keydown', keyHandler);
  }

  public close(): void {
    if (this.diffEditor) {
      try { this.diffEditor.dispose(); } catch {}
      this.diffEditor = null;
    }
    if (this.originalModel) {
      try { this.originalModel.dispose(); } catch {}
      this.originalModel = null;
    }
    if (this.modifiedModel) {
      try { this.modifiedModel.dispose(); } catch {}
      this.modifiedModel = null;
    }
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
    }
    this.overlayEl = null;
    this.currentOptions = null;
  }

  private detectLanguage(filePath: string): string {
    const ext = (filePath.split('.').pop() || '').toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': case 'mjs': case 'cjs': return 'javascript';
      case 'html': case 'htm': return 'html';
      case 'css': case 'scss': case 'sass': case 'less': return 'css';
      case 'json': return 'json';
      case 'py': return 'python';
      case 'md': return 'markdown';
      case 'c': case 'h': return 'c';
      case 'cpp': case 'cc': case 'cxx': case 'hpp': return 'cpp';
      case 'cs': return 'csharp';
      case 'sql': return 'sql';
      default: return 'plaintext';
    }
  }

  private escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
