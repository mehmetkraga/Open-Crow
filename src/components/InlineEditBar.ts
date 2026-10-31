// src/components/InlineEditBar.ts
// Kraga IDE v2.5 — Monaco Editör Satır İçi AI Düzenleme Çubuğu (Ctrl+K)
// Cursor & Windsurf standartlarında yüzen prompt çubuğu, hızlı haplar ve canlı diff onay akışı

import * as monaco from 'monaco-editor';
import { sendAgentStream, ChatMessage } from '../core/proxyClient';
import { iconSparkles, iconCheck, iconClose, iconRefresh, iconZap } from './icons';

export class InlineEditBar {
  private static instance: InlineEditBar | null = null;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private overlayEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private statusEl: HTMLElement | null = null;
  private quickPillsEl: HTMLElement | null = null;
  private reviewBarEl: HTMLElement | null = null;

  private isVisible = false;
  private isGenerating = false;
  private currentAbortController: AbortController | null = null;

  // Düzenleme durumu
  private targetRange: monaco.Range | null = null;
  private originalText: string = '';
  private generatedCode: string = '';
  private lastPrompt: string = '';

  constructor() {
    this.createDOM();
  }

  public static getInstance(): InlineEditBar {
    if (!InlineEditBar.instance) {
      InlineEditBar.instance = new InlineEditBar();
    }
    return InlineEditBar.instance;
  }

  private createDOM(): void {
    if (this.overlayEl) return;

    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'inline-edit-bar inline-edit-bar--hidden';
    this.overlayEl.innerHTML = `
      <div class="inline-edit-bar__container">
        <!-- Başlık ve Model Rozeti -->
        <div class="inline-edit-bar__header">
          <div class="inline-edit-bar__brand">
            ${iconSparkles(15, 'var(--accent-color, #00f0ff)')}
            <span>Kraga AI Inline Edit</span>
          </div>
          <div class="inline-edit-bar__badge" id="inlineEditModelBadge">GPT 5.4 Mini</div>
        </div>

        <!-- Girdi Alanı & Eylem Butonları -->
        <div class="inline-edit-bar__input-row">
          <input
            type="text"
            class="inline-edit-bar__input"
            id="inlineEditInput"
            placeholder="Ne yapmak istersiniz? (Örn: Async yap, tipleri ekle, refaktör et...)"
            autocomplete="off"
          />
          <button class="inline-edit-btn inline-edit-btn--primary" id="btnInlineEditSubmit" title="Çalıştır (Enter)">
            ${iconZap(14)}
            <span>Düzenle</span>
          </button>
          <button class="inline-edit-btn inline-edit-btn--cancel" id="btnInlineEditClose" title="Kapat (Esc)">
            ${iconClose(14)}
          </button>
        </div>

        <!-- Hızlı Eylem Hapları -->
        <div class="inline-edit-bar__pills" id="inlineEditPills">
          <button class="inline-edit-pill" data-prompt="TypeScript tip tanımlarını eksiksiz ve güçlü bir şekilde ekle.">
            + Tipler
          </button>
          <button class="inline-edit-pill" data-prompt="Kodu SOLID prensiplerine göre daha temiz, modern ve okunabilir refaktör et.">
            Refaktör
          </button>
          <button class="inline-edit-pill" data-prompt="Kapsamlı try-catch hata yakalama ve güvenlik denetimleri ekle.">
            Try-Catch
          </button>
          <button class="inline-edit-pill" data-prompt="Kodun ne yaptığını açıklayan net JSDoc dokümantasyon yorumları ekle.">
            JSDoc
          </button>
          <button class="inline-edit-pill" data-prompt="Performans darboğazlarını gider ve kodu optimize et.">
            Optimize Et
          </button>
        </div>

        <!-- Canlı İlerleme / Üretim Durumu -->
        <div class="inline-edit-bar__status inline-edit-bar__status--hidden" id="inlineEditStatus">
          <div class="inline-spinner" style="width: 14px; height: 14px;"></div>
          <span id="inlineEditStatusText">Kraga AI kodu düzenliyor...</span>
          <button class="inline-edit-btn-abort" id="btnInlineEditAbort">Durdur</button>
        </div>

        <!-- Diff Onay Barı (Üretim Tamamlandığında) -->
        <div class="inline-edit-bar__review inline-edit-bar__review--hidden" id="inlineEditReview">
          <span class="inline-edit-review__label">Değişiklikleri İnceleyin:</span>
          <button class="inline-edit-btn inline-edit-btn--accept" id="btnInlineEditAccept" title="Kabul Et (Ctrl+Enter)">
            ${iconCheck(14)}
            <span>Kabul Et (Ctrl+Enter)</span>
          </button>
          <button class="inline-edit-btn inline-edit-btn--reject" id="btnInlineEditReject" title="Geri Al & Reddet (Esc)">
            ${iconClose(14)}
            <span>Reddet (Esc)</span>
          </button>
          <button class="inline-edit-btn inline-edit-btn--retry" id="btnInlineEditRetry" title="Farklı Bir Prompt ile Yeniden Dene">
            ${iconRefresh(14)}
            <span>Tekrar Dene</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlayEl);

    this.inputEl = this.overlayEl.querySelector('#inlineEditInput');
    this.statusEl = this.overlayEl.querySelector('#inlineEditStatus');
    this.quickPillsEl = this.overlayEl.querySelector('#inlineEditPills');
    this.reviewBarEl = this.overlayEl.querySelector('#inlineEditReview');

    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.overlayEl) return;

    // Gönder butonu
    this.overlayEl.querySelector('#btnInlineEditSubmit')?.addEventListener('click', () => {
      this.handleSubmit();
    });

    // Kapat butonu
    this.overlayEl.querySelector('#btnInlineEditClose')?.addEventListener('click', () => {
      this.cancelAndClose();
    });

    // İptal / Durdur butonu
    this.overlayEl.querySelector('#btnInlineEditAbort')?.addEventListener('click', () => {
      this.abortGeneration();
    });

    // Kabul Et butonu
    this.overlayEl.querySelector('#btnInlineEditAccept')?.addEventListener('click', () => {
      this.acceptChanges();
    });

    // Reddet butonu
    this.overlayEl.querySelector('#btnInlineEditReject')?.addEventListener('click', () => {
      this.rejectChanges();
    });

    // Yeniden Dene butonu
    this.overlayEl.querySelector('#btnInlineEditRetry')?.addEventListener('click', () => {
      this.retry();
    });

    // Hızlı haplar
    this.overlayEl.querySelectorAll('.inline-edit-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const promptText = (e.currentTarget as HTMLElement).dataset.prompt;
        if (promptText && this.inputEl) {
          this.inputEl.value = promptText;
          this.handleSubmit();
        }
      });
    });

    // Klavye Kısayolları (Girdi Kutusunda)
    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelAndClose();
      }
    });

    // Global Kısayol Dinleyicisi (Review modundayken Ctrl+Enter veya Esc)
    window.addEventListener('keydown', (e) => {
      if (!this.isVisible) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (this.reviewBarEl && !this.reviewBarEl.classList.contains('inline-edit-bar__review--hidden')) {
          e.preventDefault();
          this.acceptChanges();
        }
      } else if (e.key === 'Escape') {
        if (this.reviewBarEl && !this.reviewBarEl.classList.contains('inline-edit-bar__review--hidden')) {
          e.preventDefault();
          this.rejectChanges();
        } else if (!this.isGenerating) {
          e.preventDefault();
          this.cancelAndClose();
        }
      }
    });
  }

  /**
   * Monaco editöründe Ctrl+K ile satır içi düzenleme çubuğunu açar
   */
  public show(editor: monaco.editor.IStandaloneCodeEditor, initialPrompt?: string): void {
    this.editor = editor;
    const model = editor.getModel();
    if (!model) return;

    let range: monaco.Range;
    const currentSel = editor.getSelection();
    if (currentSel && !currentSel.isEmpty()) {
      range = currentSel;
    } else {
      // Seçim yoksa imlecin bulunduğu satırı otomatik seç
      const pos = editor.getPosition() || new monaco.Position(1, 1);
      range = new monaco.Range(
        pos.lineNumber,
        1,
        pos.lineNumber,
        model.getLineMaxColumn(pos.lineNumber)
      );
      editor.setSelection(new monaco.Selection(
        range.startLineNumber,
        range.startColumn,
        range.endLineNumber,
        range.endColumn
      ));
    }

    this.targetRange = range;
    this.originalText = model.getValueInRange(range);
    this.generatedCode = '';

    // Aktif modeli rozette göster
    const currentModelId = localStorage.getItem('kraga:model') || 'gpt-5.4-mini';
    const badgeEl = this.overlayEl?.querySelector('#inlineEditModelBadge');
    if (badgeEl) badgeEl.textContent = currentModelId;

    // Arayüzü hazırla
    if (this.statusEl) this.statusEl.classList.add('inline-edit-bar__status--hidden');
    if (this.reviewBarEl) this.reviewBarEl.classList.add('inline-edit-bar__review--hidden');
    if (this.quickPillsEl) this.quickPillsEl.style.display = 'flex';

    if (this.inputEl) {
      this.inputEl.value = initialPrompt || '';
      this.inputEl.disabled = false;
    }

    // Konumlandırma: İmlecin / seçimin hemen üzerinde veya altında aç
    this.positionBar(editor, range);

    if (this.overlayEl) {
      this.overlayEl.classList.remove('inline-edit-bar--hidden');
      this.isVisible = true;
    }

    setTimeout(() => {
      this.inputEl?.focus();
      this.inputEl?.select();
    }, 50);

    if (initialPrompt) {
      this.handleSubmit();
    }
  }

  private positionBar(editor: monaco.editor.IStandaloneCodeEditor, range: monaco.Range): void {
    if (!this.overlayEl) return;

    try {
      const topPos = editor.getScrolledVisiblePosition({
        lineNumber: range.startLineNumber,
        column: range.startColumn,
      });

      const editorDom = editor.getDomNode();
      if (editorDom && topPos) {
        const editorRect = editorDom.getBoundingClientRect();
        let top = editorRect.top + topPos.top - 120;
        if (top < editorRect.top + 20) {
          // Çok üstteyse seçimin altına al
          top = editorRect.top + topPos.top + 40;
        }

        let left = editorRect.left + Math.max(topPos.left - 20, 60);
        const maxLeft = window.innerWidth - 560;
        if (left > maxLeft) left = maxLeft;

        this.overlayEl.style.top = `${Math.max(top, 60)}px`;
        this.overlayEl.style.left = `${Math.max(left, 80)}px`;
        return;
      }
    } catch {}

    // Fallback: Ortala
    this.overlayEl.style.top = '25%';
    this.overlayEl.style.left = '50%';
    this.overlayEl.style.transform = 'translate(-50%, -50%)';
  }

  public hide(): void {
    if (this.overlayEl) {
      this.overlayEl.classList.add('inline-edit-bar--hidden');
      this.isVisible = false;
    }
    this.editor?.focus();
  }

  private async handleSubmit(): Promise<void> {
    const prompt = this.inputEl?.value.trim();
    if (!prompt || !this.editor || !this.targetRange) return;

    this.lastPrompt = prompt;
    this.isGenerating = true;
    this.currentAbortController = new AbortController();

    if (this.inputEl) this.inputEl.disabled = true;
    if (this.quickPillsEl) this.quickPillsEl.style.display = 'none';
    if (this.reviewBarEl) this.reviewBarEl.classList.add('inline-edit-bar__review--hidden');
    if (this.statusEl) {
      this.statusEl.classList.remove('inline-edit-bar__status--hidden');
      const textEl = this.statusEl.querySelector('#inlineEditStatusText');
      if (textEl) textEl.textContent = 'Kraga AI kodu cerrahi olarak düzenliyor...';
    }

    const model = this.editor.getModel();
    const lang = model ? model.getLanguageId() : 'typescript';
    const activeModelId = localStorage.getItem('kraga:model') || 'gpt-5.4-mini';

    const systemPrompt = `Sen Kraga IDE'nin yüksek hızlı, cerrahi satır içi kod düzenleyicisisin (Inline AI Editor).
Kullanıcının talimatına göre verilen kaynak kod parçasını doğrudan değiştir.

KESİNLİKLE UYULMASI GEREKEN KURALLAR (Cursor & Claude Code Altın Standartları):
1. Yanıtında KESİNLİKLE markdown kod bloğu çitleri (\`\`\`ts, \`\`\` vb.) veya herhangi bir açıklama/selamlama metni KULLANMA.
2. SADECE doğrudan yerine geçecek ham kod metnini döndür.
3. Dil: ${lang}. Orijinal girintilemeyi (indentation) ve kod bütünlüğünü kusursuz koru.
4. KOD YORUMUNDA DÜŞÜNME/AÇIKLAMA YASAĞI (No Thinking in Comments): Kod içine asla diff anlatımı veya düşünce süreci yazma ("// burada hata giderildi", "// yeni buton" gibi anlatıcı yorumlar KESİNLİKLE YASAKTIR). Yalnızca kodun kendisini ve varsa teknik dokümantasyonunu üret.
5. KISALTMA YAPMA: Değiştirilmeyen kısımları asla "// ... kodun geri kalanı ..." veya "// TODO" diyerek atlama; seçilen bloğu eksiksiz ve çalışan haliyle üret.
6. CERRAHİ KAPSAM (Scope Restraint): Kullanıcı spesifik bir satırı veya değişkeni değiştirmek istediyse, sadece o mantığı düzelt; kodun çalışan diğer kısımlarını gereksiz yere yeniden tasarlama veya bozma.`;

    const userPrompt = `Kaynak Kod (Düzenlenecek Parça):
${this.originalText}

Kullanıcı Talimatı:
${prompt}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    let accumulatedCode = '';

    try {
      await sendAgentStream(
        messages,
        {
          onChunk: (chunk: string) => {
            accumulatedCode += chunk;
            // Canlı önizleme: Kod modelde güncellenir
            this.previewCode(accumulatedCode);
          },
          onDone: () => {
            this.isGenerating = false;
            this.generatedCode = this.cleanMarkdownFence(accumulatedCode);
            this.applyFinalCode(this.generatedCode);
            this.showReviewBar();
          },
          onError: (err: Error) => {
            this.isGenerating = false;
            if (this.statusEl) {
              const textEl = this.statusEl.querySelector('#inlineEditStatusText');
              if (textEl) textEl.textContent = `Hata: ${err.message || 'Üretim başarısız'}`;
            }
            if (this.inputEl) this.inputEl.disabled = false;
          },
        },
        {
          model: activeModelId,
          signal: this.currentAbortController.signal,
        }
      );
    } catch (err: any) {
      this.isGenerating = false;
      if (this.statusEl) {
        const textEl = this.statusEl.querySelector('#inlineEditStatusText');
        if (textEl) textEl.textContent = `Hata: ${err.message || 'İstek tamamlanamadı'}`;
      }
      if (this.inputEl) this.inputEl.disabled = false;
    }
  }

  private cleanMarkdownFence(raw: string): string {
    let clean = raw.trim();
    if (clean.startsWith('```')) {
      const firstLineEnd = clean.indexOf('\n');
      if (firstLineEnd !== -1) {
        clean = clean.slice(firstLineEnd + 1);
      }
    }
    if (clean.endsWith('```')) {
      clean = clean.slice(0, clean.length - 3).trimEnd();
    }
    return clean;
  }

  private previewCode(code: string): void {
    if (!this.editor || !this.targetRange) return;
    const model = this.editor.getModel();
    if (!model) return;

    const cleaned = this.cleanMarkdownFence(code);
    editorExecuteEdits(this.editor, [
      {
        range: this.targetRange,
        text: cleaned,
        forceMoveMarkers: true,
      },
    ]);

    // Yeni range'i güncelle
    const lines = cleaned.split('\n');
    const endLine = this.targetRange.startLineNumber + lines.length - 1;
    const endCol = lines.length === 1
      ? this.targetRange.startColumn + cleaned.length
      : lines[lines.length - 1].length + 1;

    this.targetRange = new monaco.Range(
      this.targetRange.startLineNumber,
      this.targetRange.startColumn,
      endLine,
      endCol
    );
  }

  private applyFinalCode(code: string): void {
    this.previewCode(code);
  }

  private showReviewBar(): void {
    if (this.statusEl) this.statusEl.classList.add('inline-edit-bar__status--hidden');
    if (this.reviewBarEl) this.reviewBarEl.classList.remove('inline-edit-bar__review--hidden');
  }

  private acceptChanges(): void {
    this.hide();
  }

  private rejectChanges(): void {
    if (this.editor && this.targetRange) {
      editorExecuteEdits(this.editor, [
        {
          range: this.targetRange,
          text: this.originalText,
          forceMoveMarkers: true,
        },
      ]);
    }
    this.hide();
  }

  private retry(): void {
    if (this.editor && this.targetRange) {
      editorExecuteEdits(this.editor, [
        {
          range: this.targetRange,
          text: this.originalText,
          forceMoveMarkers: true,
        },
      ]);
    }
    if (this.reviewBarEl) this.reviewBarEl.classList.add('inline-edit-bar__review--hidden');
    if (this.inputEl) {
      this.inputEl.value = this.lastPrompt;
      this.inputEl.disabled = false;
      this.inputEl.focus();
      this.inputEl.select();
    }
    if (this.quickPillsEl) this.quickPillsEl.style.display = 'flex';
  }

  private abortGeneration(): void {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }
    this.isGenerating = false;
    this.rejectChanges();
  }

  private cancelAndClose(): void {
    if (this.isGenerating) {
      this.abortGeneration();
    } else {
      this.hide();
    }
  }
}

/**
 * Monaco Editöründe güvenli edit operasyonu (Undo geçmişini korur)
 */
function editorExecuteEdits(
  editor: monaco.editor.IStandaloneCodeEditor,
  edits: monaco.editor.IIdentifiedSingleEditOperation[]
): void {
  editor.executeEdits('inline-edit', edits);
  editor.pushUndoStop();
}
