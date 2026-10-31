// src/components/SpreadsheetWorkspace.ts
// Kraga IDE — Yerleşik İnteraktif Excel / Spreadsheet Çalışma Alanı (.xlsx, .xls, .csv, .tsv)
// ChatGPT Canvas ve Claude Artifacts tarzı canlı elektronik tablo çalışma alanı.
// Çoklu çalışma sayfası seçimi, [✨ Düzenleme İste] otonom AI yönlendirme popover'ı,
// canlı formül çubuğu (fx), yakınlaştırma (%50-%200), dışa aktarma ve parıldayan hücre animasyonları.

import * as XLSX from 'xlsx';
import {
  colIndexToLetter,
  coordToA1,
  a1ToCoord,
} from '../core/spreadsheetAgentTools';

export interface SpreadsheetCellCoord {
  r: number; // 0-indexed row
  c: number; // 0-indexed col
}

export class SpreadsheetWorkspace {
  private static instance: SpreadsheetWorkspace | null = null;
  private containerEl: HTMLElement | null = null;

  private currentFilePath: string = '';
  private currentFileName: string = '';
  private workbook: XLSX.WorkBook | null = null;
  private activeSheetName: string = '';
  private sheetData: any[][] = []; // 2D array of strings / numbers
  private maxRows: number = 0;
  private maxCols: number = 0;

  private selectedCell: SpreadsheetCellCoord = { r: 0, c: 0 };
  private selectionStart: SpreadsheetCellCoord | null = null;
  private selectionEnd: SpreadsheetCellCoord | null = null;
  private isSelectingRange: boolean = false;

  private isEditing: boolean = false;
  private isDirty: boolean = false;
  private zoomLevel: number = 100;
  private isAiPopoverOpen: boolean = false;
  private isSheetDropdownOpen: boolean = false;
  private isExportMenuOpen: boolean = false;
  private isFullscreen: boolean = false;

  private searchQuery: string = '';
  private searchMatches: SpreadsheetCellCoord[] = [];
  private activeSearchMatchIndex: number = -1;

  public onDirtyChange?: (isDirty: boolean, filePath: string) => void;
  public onSaveComplete?: (filePath: string) => void;

  private constructor() {}

  public static getInstance(): SpreadsheetWorkspace {
    if (!SpreadsheetWorkspace.instance) {
      SpreadsheetWorkspace.instance = new SpreadsheetWorkspace();
    }
    return SpreadsheetWorkspace.instance;
  }

  public init(container: HTMLElement): void {
    this.containerEl = container;
  }

  public getCurrentFilePath(): string {
    return this.currentFilePath;
  }

  public getActiveSheetName(): string {
    return this.activeSheetName;
  }

  public getSelectedCellOrRange(): string {
    if (this.selectionStart && this.selectionEnd && (this.selectionStart.r !== this.selectionEnd.r || this.selectionStart.c !== this.selectionEnd.c)) {
      const minR = Math.min(this.selectionStart.r, this.selectionEnd.r);
      const maxR = Math.max(this.selectionStart.r, this.selectionEnd.r);
      const minC = Math.min(this.selectionStart.c, this.selectionEnd.c);
      const maxC = Math.max(this.selectionStart.c, this.selectionEnd.c);
      return `${coordToA1(minR, minC)}:${coordToA1(maxR, maxC)}`;
    }
    return coordToA1(this.selectedCell.r, this.selectedCell.c);
  }

  public getIsDirty(): boolean {
    return this.isDirty;
  }

  public async open(filePath: string): Promise<void> {
    this.currentFilePath = filePath;
    this.currentFileName = filePath.split(/[\\/]/).pop() || 'Tablo';
    this.isDirty = false;
    this.searchQuery = '';
    this.searchMatches = [];
    this.activeSearchMatchIndex = -1;
    this.selectedCell = { r: 0, c: 0 };
    this.selectionStart = null;
    this.selectionEnd = null;
    this.isAiPopoverOpen = false;

    if (!this.containerEl) {
      this.containerEl = document.getElementById('spreadsheetWorkspaceView');
    }

    if (!this.containerEl) {
      console.error('[SpreadsheetWorkspace] spreadsheetWorkspaceView containerı bulunamadı!');
      return;
    }

    this.renderLoading('Dosya yükleniyor ve ayrıştırılıyor...');

    try {
      let base64 = '';

      if (window.kragaAPI?.fs?.readBinaryFile) {
        base64 = await window.kragaAPI.fs.readBinaryFile(filePath);
      } else {
        const text = await window.kragaAPI.fs.readFile(filePath);
        base64 = btoa(unescape(encodeURIComponent(text)));
      }

      this.workbook = XLSX.read(base64, {
        type: 'base64',
        cellDates: true,
        cellStyles: true,
        cellFormula: true,
      });

      if (!this.workbook.SheetNames || this.workbook.SheetNames.length === 0) {
        throw new Error('Excel dosyasında okunabilir çalışma sayfası (sheet) bulunamadı.');
      }

      this.activeSheetName = this.workbook.SheetNames[0];
      this.loadCurrentSheetData();
      this.render();
    } catch (err: any) {
      console.error('[SpreadsheetWorkspace] Dosya açılamadı:', err);
      this.renderError(err.message || 'Excel dosyası açılırken beklenmeyen bir hata oluştu.');
    }
  }

  public async reloadFromDisk(highlightCells?: string[]): Promise<void> {
    if (!this.currentFilePath) return;
    try {
      let base64 = '';
      if (window.kragaAPI?.fs?.readBinaryFile) {
        base64 = await window.kragaAPI.fs.readBinaryFile(this.currentFilePath);
      } else {
        const text = await window.kragaAPI.fs.readFile(this.currentFilePath);
        base64 = btoa(unescape(encodeURIComponent(text)));
      }

      this.workbook = XLSX.read(base64, {
        type: 'base64',
        cellDates: true,
        cellStyles: true,
        cellFormula: true,
      });

      if (!this.workbook.SheetNames.includes(this.activeSheetName)) {
        this.activeSheetName = this.workbook.SheetNames[0] || 'Sayfa1';
      }

      this.loadCurrentSheetData();
      this.render();

      if (highlightCells && highlightCells.length > 0) {
        this.pulseHighlightCells(highlightCells);
      }

      this.showToast(`✨ Kraga AI: Tablo canlı olarak güncellendi (${highlightCells?.length || 0} hücre)`);
    } catch (err: any) {
      console.error('[SpreadsheetWorkspace] reloadFromDisk hatası:', err);
    }
  }

  private loadCurrentSheetData(): void {
    if (!this.workbook || !this.activeSheetName) return;
    const worksheet = this.workbook.Sheets[this.activeSheetName];
    if (!worksheet) {
      this.sheetData = [];
      this.maxRows = 10;
      this.maxCols = 6;
      return;
    }

    const rawData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as any[][];

    this.sheetData = rawData || [];

    let calculatedMaxCols = 8;
    for (const row of this.sheetData) {
      if (Array.isArray(row) && row.length > calculatedMaxCols) {
        calculatedMaxCols = row.length;
      }
    }

    this.maxCols = Math.max(calculatedMaxCols + 2, 10);
    this.maxRows = Math.max(this.sheetData.length + 10, 25);

    for (let r = 0; r < this.maxRows; r++) {
      if (!this.sheetData[r]) {
        this.sheetData[r] = [];
      }
      while (this.sheetData[r].length < this.maxCols) {
        this.sheetData[r].push('');
      }
    }
  }

  private renderLoading(msg: string): void {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = `
      <div class="kraga-sheet-empty-state">
        <div class="kraga-sheet-spinner"></div>
        <div class="kraga-sheet-empty-title">${this.escapeHtml(this.currentFileName)}</div>
        <div class="kraga-sheet-empty-desc">${this.escapeHtml(msg)}</div>
      </div>
    `;
  }

  private renderError(errMsg: string): void {
    if (!this.containerEl) return;
    this.containerEl.innerHTML = `
      <div class="kraga-sheet-empty-state">
        <div class="kraga-sheet-error-icon">⚠️</div>
        <div class="kraga-sheet-empty-title">Excel Dosyası Açılamadı</div>
        <div class="kraga-sheet-empty-desc">${this.escapeHtml(errMsg)}</div>
        <div class="kraga-sheet-error-actions">
          <button type="button" class="kraga-sheet-btn kraga-sheet-btn--primary" id="btnOpenSystemExcelFallback">
            📊 Bilgisayardaki Excel ile Aç
          </button>
        </div>
      </div>
    `;

    document.getElementById('btnOpenSystemExcelFallback')?.addEventListener('click', () => {
      this.openInSystemExcel();
    });
  }

  public render(): void {
    if (!this.containerEl) return;

    const sheetNames = this.workbook?.SheetNames || [this.activeSheetName || 'Sayfa1'];
    const activeVal = this.getCellValue(this.selectedCell.r, this.selectedCell.c);
    const coordLabel = this.getSelectedCellOrRange();

    this.containerEl.innerHTML = `
      <div class="kraga-sheet-shell ${this.isFullscreen ? 'kraga-sheet-shell--fullscreen' : ''}">
        <!-- 1. Üst Başlık ve Canvas Araç Çubuğu (ChatGPT Desktop 1:1) -->
        <header class="kraga-sheet-toolbar">
          <div class="kraga-sheet-toolbar__left">
            <!-- Çalışma Sayfası Açılır Menüsü (Dropdown) -->
            <div class="kraga-sheet-dropdown-wrap" id="sheetDropdownWrap">
              <button type="button" class="kraga-sheet-dropdown-btn" id="sheetDropdownBtn" title="Çalışma Sayfası Değiştir">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>
                </svg>
                <span class="kraga-sheet-dropdown-label" id="sheetActiveDropdownLabel">${this.escapeHtml(this.activeSheetName || 'Sayfa')}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              <div class="kraga-sheet-dropdown-menu" id="sheetDropdownMenu" style="${this.isSheetDropdownOpen ? 'display: block;' : 'display: none;'}">
                <div class="kraga-sheet-dropdown-header">Çalışma Sayfaları</div>
                ${sheetNames
                  .map(
                    (name) => `
                  <div class="kraga-sheet-dropdown-item ${name === this.activeSheetName ? 'kraga-sheet-dropdown-item--active' : ''}" data-sheet="${this.escapeHtml(name)}">
                    <span>${this.escapeHtml(name)}</span>
                    ${name === this.activeSheetName ? '<span class="kraga-sheet-dropdown-check">✓</span>' : ''}
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>

            <!-- ✨ DÜZENLEME İSTE BUTONU (ChatGPT Canvas & Claude Artifacts 1:1) -->
            <button type="button" class="kraga-sheet-btn kraga-sheet-btn--ai" id="btnRequestAiEdit" title="Kraga AI'dan bu tabloyu düzenlemesini, formül yazmasını veya satır eklemesini iste">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
              <span>Düzenleme iste</span>
            </button>

            <!-- Arama Kutusu -->
            <div class="kraga-sheet-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                class="kraga-sheet-search-input"
                id="sheetSearchInput"
                placeholder="Ara..."
                value="${this.escapeHtml(this.searchQuery)}"
              />
              <span class="kraga-sheet-search-counter" id="sheetSearchCounter">
                ${this.searchMatches.length > 0 ? `${this.activeSearchMatchIndex + 1}/${this.searchMatches.length}` : ''}
              </span>
              <button type="button" class="kraga-sheet-icon-btn" id="btnSearchPrev" title="Önceki (Shift+F3)">▲</button>
              <button type="button" class="kraga-sheet-icon-btn" id="btnSearchNext" title="Sonraki (F3)">▼</button>
            </div>
          </div>

          <div class="kraga-sheet-toolbar__right">
            <!-- AI Sohbet Panelini Yan Yana Aç / Kapat Toggle -->
            <button type="button" class="kraga-sheet-icon-btn-action" id="btnToggleAgentChat" title="Kraga AI Sohbet Panelini Aç / Odakla (Split-View)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </button>

            <!-- Yakınlaştırma (Zoom) Dropdown Seçici -->
            <div class="kraga-sheet-zoom-wrap">
              <select class="kraga-sheet-zoom-select" id="sheetZoomSelect" title="Yakınlaştırma Ölçeği">
                <option value="50" ${this.zoomLevel === 50 ? 'selected' : ''}>%50</option>
                <option value="75" ${this.zoomLevel === 75 ? 'selected' : ''}>%75</option>
                <option value="90" ${this.zoomLevel === 90 ? 'selected' : ''}>%90</option>
                <option value="100" ${this.zoomLevel === 100 ? 'selected' : ''}>%100</option>
                <option value="125" ${this.zoomLevel === 125 ? 'selected' : ''}>%125</option>
                <option value="150" ${this.zoomLevel === 150 ? 'selected' : ''}>%150</option>
                <option value="200" ${this.zoomLevel === 200 ? 'selected' : ''}>%200</option>
              </select>
            </div>

            <!-- Satır ve Sütun Ekleme Butonları -->
            <button type="button" class="kraga-sheet-btn" id="btnAddRowBtn" title="Tabloya yeni satır ekle">
              ➕ Satır
            </button>
            <button type="button" class="kraga-sheet-btn" id="btnAddColBtn" title="Tabloya yeni sütun ekle">
              ➕ Sütun
            </button>

            <!-- Dışa Aktar / İndir Dropdown -->
            <div class="kraga-sheet-dropdown-wrap" id="sheetExportWrap">
              <button type="button" class="kraga-sheet-icon-btn-action" id="btnExportDropdown" title="Dışa Aktar / İndir">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              <div class="kraga-sheet-dropdown-menu kraga-sheet-dropdown-menu--right" id="sheetExportMenu" style="${this.isExportMenuOpen ? 'display: block;' : 'display: none;'}">
                <div class="kraga-sheet-dropdown-item" id="btnExportXlsx">
                  📊 Excel (.xlsx) Olarak İndir
                </div>
                <div class="kraga-sheet-dropdown-item" id="btnExportCsvOption">
                  📄 CSV (.csv) Olarak İndir
                </div>
                <div class="kraga-sheet-dropdown-divider"></div>
                <div class="kraga-sheet-dropdown-item" id="btnOpenInExcelOption">
                  🖥️ Bilgisayardaki Excel ile Aç
                </div>
              </div>
            </div>

            <!-- Kaydet Butonu -->
            <button type="button" class="kraga-sheet-btn kraga-sheet-btn--primary" id="btnSaveSheet" title="Değişiklikleri diske kaydet (Ctrl+S)">
              💾 Kaydet
            </button>

            <!-- Tam Ekran / Canvas Maximize Toggle -->
            <button type="button" class="kraga-sheet-icon-btn-action" id="btnToggleFullscreen" title="${this.isFullscreen ? 'Normal Görünüm' : 'Tam Ekran Odak'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${
                  this.isFullscreen
                    ? '<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>'
                    : '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'
                }
              </svg>
            </button>
          </div>
        </header>

        <!-- TABLO İÇİ AI DÜZENLEME AÇILIR KARTI (Floating AI Prompt Popover) -->
        <div class="kraga-sheet-ai-popover" id="sheetAiPopover" style="${this.isAiPopoverOpen ? 'display: flex;' : 'display: none;'}">
          <div class="kraga-sheet-ai-popover-header">
            <div class="kraga-sheet-ai-popover-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
              <span>Kraga AI ile Canlı Tablo Düzenleme</span>
            </div>
            <button type="button" class="kraga-sheet-ai-close" id="btnCloseAiPopover" title="Kapat">✕</button>
          </div>

          <div class="kraga-sheet-ai-context-badge">
            <span class="kraga-sheet-ai-context-icon">📍</span>
            <span id="sheetAiContextText">${this.escapeHtml(this.currentFileName)} | ${this.escapeHtml(this.activeSheetName)} | Seçili: ${coordLabel}</span>
          </div>

          <div class="kraga-sheet-ai-chips">
            <button type="button" class="kraga-sheet-ai-chip" data-prompt="Tablonun sonuna yeni veri satırları ekle">➕ Satır Ekle</button>
            <button type="button" class="kraga-sheet-ai-chip" data-prompt="Sayısal sütunların altına 'Genel Toplam' satırı ekle ve formülle topla">🧮 Genel Toplam Formülü</button>
            <button type="button" class="kraga-sheet-ai-chip" data-prompt="Sütun başlıklarını ve veri formatlarını düzenle, tutarlı hale getir">🎨 Başlıkları Düzenle</button>
            <button type="button" class="kraga-sheet-ai-chip" data-prompt="Eksik hücreleri mantıklı verilerle tamamla ve analitik özet satırı ekle">📊 Verileri Tamamla</button>
          </div>

          <textarea
            class="kraga-sheet-ai-textarea"
            id="sheetAiPromptInput"
            rows="3"
            placeholder="Ajanın bu tabloda ne yapmasını istersiniz? (Örn: Sorumlulara göre görevleri grupla ve sayıları topla)"
          ></textarea>

          <div class="kraga-sheet-ai-actions">
            <button type="button" class="kraga-sheet-btn" id="btnCancelAiEdit">İptal</button>
            <button type="button" class="kraga-sheet-btn kraga-sheet-btn--primary kraga-sheet-btn--ai" id="btnSubmitAiEdit">
              ✨ Düzenlemeyi Başlat
            </button>
          </div>
        </div>

        <!-- 2. Formül ve Koordinat Çubuğu (fx Bar) -->
        <div class="kraga-sheet-formula-bar">
          <div class="kraga-sheet-coord-pill" id="sheetCoordPill" title="Seçili Hücre Koordinatı">
            <span id="sheetActiveCoord">${coordLabel}</span>
          </div>
          <div class="kraga-sheet-formula-icon" title="Formül / Değer Çubuğu">
            <i>fx</i>
          </div>
          <input
            type="text"
            class="kraga-sheet-formula-input"
            id="sheetFormulaInput"
            value="${this.escapeHtml(String(activeVal ?? ''))}"
            placeholder="Hücre değeri veya formül..."
          />
        </div>

        <!-- 3. Elektronik Tablo Izgarası (Interactive Canvas Grid) -->
        <div class="kraga-sheet-grid-wrapper" id="sheetGridWrapper" tabindex="0">
          <table class="kraga-sheet-table" id="sheetTable" style="zoom: ${this.zoomLevel / 100};">
            <thead>
              <tr>
                <th class="kraga-sheet-corner-header">#</th>
                ${this.renderColumnHeaders()}
              </tr>
            </thead>
            <tbody>
              ${this.renderRows()}
            </tbody>
          </table>
        </div>

        <!-- 4. Alt Çalışma Sayfası Sekmeleri ve İstatistik Durum Çubuğu -->
        <footer class="kraga-sheet-footer">
          <div class="kraga-sheet-tabs-list">
            ${sheetNames
              .map(
                (name) => `
              <button
                type="button"
                class="kraga-sheet-tab-pill ${name === this.activeSheetName ? 'kraga-sheet-tab-pill--active' : ''}"
                data-sheet="${this.escapeHtml(name)}"
              >
                ${this.escapeHtml(name)}
              </button>
            `
              )
              .join('')}
            <button type="button" class="kraga-sheet-tab-add" id="btnAddNewSheet" title="Yeni Çalışma Sayfası Ekle">
              + Yeni Sayfa
            </button>
          </div>

          <div class="kraga-sheet-stats-bar" id="sheetStatsBar">
            <span class="kraga-sheet-dirty-badge ${this.isDirty ? 'kraga-sheet-dirty-badge--dirty' : ''}" id="sheetDirtyBadge">
              ${this.isDirty ? '● Değiştirildi' : '✓ Kaydedildi'}
            </span>
            <span class="kraga-sheet-stat-item">Satır: ${this.maxRows}</span>
            <span class="kraga-sheet-stat-item">Sütun: ${this.maxCols}</span>
            <span class="kraga-sheet-stat-item kraga-sheet-stat-highlight" id="sheetSelectionStats">
              ${this.computeSelectionStats()}
            </span>
          </div>
        </footer>
      </div>
    `;

    this.bindEvents();
    this.scrollToCell(this.selectedCell.r, this.selectedCell.c);
  }

  private renderColumnHeaders(): string {
    const headers: string[] = [];
    for (let c = 0; c < this.maxCols; c++) {
      const colLetter = colIndexToLetter(c);
      const isSelectedCol = this.selectedCell.c === c;
      headers.push(`
        <th class="kraga-sheet-col-header ${isSelectedCol ? 'kraga-sheet-col-header--selected' : ''}" data-col="${c}">
          ${colLetter}
        </th>
      `);
    }
    return headers.join('');
  }

  private renderRows(): string {
    const rows: string[] = [];
    for (let r = 0; r < this.maxRows; r++) {
      const isSelectedRow = this.selectedCell.r === r;
      const rowNum = r + 1;

      // Ekran görüntüsündeki gibi 1. satır başlık (Header Row) stiline sahipse
      const isHeaderRow = r === 0;

      let cellTds = '';
      for (let c = 0; c < this.maxCols; c++) {
        const val = this.getCellValue(r, c);
        const isSelected = this.selectedCell.r === r && this.selectedCell.c === c;
        const isInRange = this.isCellInRange(r, c);
        const isSearchMatch = this.isMatchingCell(r, c);
        const isActiveSearchMatch = this.isActiveSearchMatch(r, c);

        // Genel Toplam veya özet satırı kontrolü
        const isSummaryCell = typeof val === 'string' && val.toLowerCase().includes('toplam');

        const classes = [
          'kraga-sheet-cell',
          isHeaderRow ? 'kraga-sheet-cell--header' : '',
          isSummaryCell ? 'kraga-sheet-cell--summary' : '',
          isSelected ? 'kraga-sheet-cell--selected' : '',
          isInRange && !isSelected ? 'kraga-sheet-cell--in-range' : '',
          isSearchMatch ? 'kraga-sheet-cell--match' : '',
          isActiveSearchMatch ? 'kraga-sheet-cell--active-match' : '',
        ]
          .filter(Boolean)
          .join(' ');

        cellTds += `
          <td
            class="${classes}"
            data-r="${r}"
            data-c="${c}"
            title="${coordToA1(r, c)}: ${this.escapeHtml(String(val ?? ''))}"
          >
            <div class="kraga-sheet-cell-inner">${this.escapeHtml(String(val ?? ''))}</div>
          </td>
        `;
      }

      rows.push(`
        <tr data-r="${r}" class="${isHeaderRow ? 'kraga-sheet-row--header' : ''}">
          <th class="kraga-sheet-row-header ${isSelectedRow ? 'kraga-sheet-row-header--selected' : ''}" data-r="${r}">
            ${rowNum}
          </th>
          ${cellTds}
        </tr>
      `);
    }
    return rows.join('');
  }

  private isCellInRange(r: number, c: number): boolean {
    if (!this.selectionStart || !this.selectionEnd) return false;
    const minR = Math.min(this.selectionStart.r, this.selectionEnd.r);
    const maxR = Math.max(this.selectionStart.r, this.selectionEnd.r);
    const minC = Math.min(this.selectionStart.c, this.selectionEnd.c);
    const maxC = Math.max(this.selectionStart.c, this.selectionEnd.c);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }

  private bindEvents(): void {
    if (!this.containerEl) return;

    // 1. Hücre Tıklama, Seçim Aralığı ve Çift Tıklama
    const table = this.containerEl.querySelector('#sheetTable') as HTMLTableElement;

    table?.addEventListener('mousedown', (e) => {
      const target = (e.target as HTMLElement).closest('td.kraga-sheet-cell') as HTMLElement;
      if (!target) return;
      const r = parseInt(target.getAttribute('data-r') || '0', 10);
      const c = parseInt(target.getAttribute('data-c') || '0', 10);

      if (e.shiftKey) {
        // Shift ile aralık genişletme
        this.selectionEnd = { r, c };
        this.updateRangeVisuals();
      } else {
        this.selectCell(r, c);
        this.selectionStart = { r, c };
        this.selectionEnd = { r, c };
        this.isSelectingRange = true;
      }
    });

    table?.addEventListener('mouseover', (e) => {
      if (!this.isSelectingRange || !this.selectionStart) return;
      const target = (e.target as HTMLElement).closest('td.kraga-sheet-cell') as HTMLElement;
      if (!target) return;
      const r = parseInt(target.getAttribute('data-r') || '0', 10);
      const c = parseInt(target.getAttribute('data-c') || '0', 10);

      this.selectionEnd = { r, c };
      this.updateRangeVisuals();
    });

    document.addEventListener('mouseup', () => {
      this.isSelectingRange = false;
    });

    table?.addEventListener('dblclick', (e) => {
      const target = (e.target as HTMLElement).closest('td.kraga-sheet-cell') as HTMLElement;
      if (!target) return;
      const r = parseInt(target.getAttribute('data-r') || '0', 10);
      const c = parseInt(target.getAttribute('data-c') || '0', 10);
      this.startInlineEditing(r, c, target);
    });

    // 2. Formül Çubuğu Senkronizasyonu
    const formulaInput = this.containerEl.querySelector('#sheetFormulaInput') as HTMLInputElement;
    formulaInput?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      this.setCellValue(this.selectedCell.r, this.selectedCell.c, val);
      this.updateCellDom(this.selectedCell.r, this.selectedCell.c, val);
      this.markDirty(true);
    });

    formulaInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        formulaInput.blur();
        this.selectCell(this.selectedCell.r + 1, this.selectedCell.c);
        e.preventDefault();
      }
    });

    // 3. Klavye Gezinmesi
    const gridWrapper = this.containerEl.querySelector('#sheetGridWrapper') as HTMLElement;
    gridWrapper?.addEventListener('keydown', (e) => {
      if (this.isEditing) return;

      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.save();
        return;
      }

      if (e.key === 'ArrowUp') {
        if (this.selectedCell.r > 0) this.selectCell(this.selectedCell.r - 1, this.selectedCell.c);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (this.selectedCell.r < this.maxRows - 1) this.selectCell(this.selectedCell.r + 1, this.selectedCell.c);
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        if (this.selectedCell.c > 0) this.selectCell(this.selectedCell.r, this.selectedCell.c - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
        if (this.selectedCell.c < this.maxCols - 1) this.selectCell(this.selectedCell.r, this.selectedCell.c + 1);
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === 'F2') {
        const td = this.containerEl?.querySelector(
          `td[data-r="${this.selectedCell.r}"][data-c="${this.selectedCell.c}"]`
        ) as HTMLElement;
        if (td) this.startInlineEditing(this.selectedCell.r, this.selectedCell.c, td);
        e.preventDefault();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.setCellValue(this.selectedCell.r, this.selectedCell.c, '');
        this.updateCellDom(this.selectedCell.r, this.selectedCell.c, '');
        this.syncFormulaInput('');
        this.markDirty(true);
        e.preventDefault();
      }
    });

    // 4. [✨ Düzenleme İste] Popover ve AI Entegrasyonu
    const btnAi = this.containerEl.querySelector('#btnRequestAiEdit');
    const popover = this.containerEl.querySelector('#sheetAiPopover') as HTMLElement;

    btnAi?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isAiPopoverOpen = !this.isAiPopoverOpen;
      if (popover) {
        popover.style.display = this.isAiPopoverOpen ? 'flex' : 'none';
        if (this.isAiPopoverOpen) {
          const textarea = popover.querySelector('#sheetAiPromptInput') as HTMLTextAreaElement;
          textarea?.focus();
          // Context badge güncelle
          const contextLabel = this.containerEl?.querySelector('#sheetAiContextText');
          if (contextLabel) {
            contextLabel.textContent = `${this.currentFileName} | ${this.activeSheetName} | Seçili: ${this.getSelectedCellOrRange()}`;
          }
        }
      }
    });

    this.containerEl.querySelector('#btnCloseAiPopover')?.addEventListener('click', () => {
      this.isAiPopoverOpen = false;
      if (popover) popover.style.display = 'none';
    });

    this.containerEl.querySelector('#btnCancelAiEdit')?.addEventListener('click', () => {
      this.isAiPopoverOpen = false;
      if (popover) popover.style.display = 'none';
    });

    // Hızlı Chip Butonları
    this.containerEl.querySelectorAll('.kraga-sheet-ai-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt') || '';
        const textarea = popover?.querySelector('#sheetAiPromptInput') as HTMLTextAreaElement;
        if (textarea) {
          textarea.value = prompt;
          textarea.focus();
        }
      });
    });

    // AI İstek Gönder
    this.containerEl.querySelector('#btnSubmitAiEdit')?.addEventListener('click', () => {
      const textarea = popover?.querySelector('#sheetAiPromptInput') as HTMLTextAreaElement;
      const promptText = textarea?.value?.trim();
      if (!promptText) return;

      this.isAiPopoverOpen = false;
      if (popover) popover.style.display = 'none';

      const detail = {
        filePath: this.currentFilePath,
        activeSheet: this.activeSheetName,
        selectedCoord: this.getSelectedCellOrRange(),
        prompt: promptText,
      };

      // Kraga Agent paneline olayı dispatch et
      window.dispatchEvent(new CustomEvent('kraga:request-sheet-ai-edit', { detail }));
      this.showToast('✨ İstek Kraga Agent paneline iletildi...');
    });

    // 5. AI Chat Split-View Odaklama
    this.containerEl.querySelector('#btnToggleAgentChat')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kraga:focus-agent-chat'));
      this.showToast('💬 Kraga Agent paneli odaklandı');
    });

    // 6. Sayfa Seçici Dropdown
    const dropdownBtn = this.containerEl.querySelector('#sheetDropdownBtn');
    const dropdownMenu = this.containerEl.querySelector('#sheetDropdownMenu') as HTMLElement;
    dropdownBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isSheetDropdownOpen = !this.isSheetDropdownOpen;
      if (dropdownMenu) dropdownMenu.style.display = this.isSheetDropdownOpen ? 'block' : 'none';
    });

    this.containerEl.querySelectorAll('#sheetDropdownMenu .kraga-sheet-dropdown-item').forEach((item) => {
      item.addEventListener('click', () => {
        const targetSheet = item.getAttribute('data-sheet');
        if (targetSheet && targetSheet !== this.activeSheetName) {
          this.switchSheet(targetSheet);
        }
        this.isSheetDropdownOpen = false;
        if (dropdownMenu) dropdownMenu.style.display = 'none';
      });
    });

    // 7. Yakınlaştırma (Zoom)
    const zoomSelect = this.containerEl.querySelector('#sheetZoomSelect') as HTMLSelectElement;
    zoomSelect?.addEventListener('change', () => {
      this.zoomLevel = parseInt(zoomSelect.value, 10) || 100;
      const tableEl = this.containerEl?.querySelector('#sheetTable') as HTMLElement;
      if (tableEl) {
        tableEl.style.zoom = `${this.zoomLevel / 100}`;
      }
    });

    // 8. Dışa Aktarma (Export)
    const exportBtn = this.containerEl.querySelector('#btnExportDropdown');
    const exportMenu = this.containerEl.querySelector('#sheetExportMenu') as HTMLElement;
    exportBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.isExportMenuOpen = !this.isExportMenuOpen;
      if (exportMenu) exportMenu.style.display = this.isExportMenuOpen ? 'block' : 'none';
    });

    this.containerEl.querySelector('#btnExportXlsx')?.addEventListener('click', () => {
      this.exportXlsx();
      this.isExportMenuOpen = false;
      if (exportMenu) exportMenu.style.display = 'none';
    });

    this.containerEl.querySelector('#btnExportCsvOption')?.addEventListener('click', () => {
      this.exportCsv();
      this.isExportMenuOpen = false;
      if (exportMenu) exportMenu.style.display = 'none';
    });

    this.containerEl.querySelector('#btnOpenInExcelOption')?.addEventListener('click', () => {
      this.openInSystemExcel();
      this.isExportMenuOpen = false;
      if (exportMenu) exportMenu.style.display = 'none';
    });

    // 9. Tam Ekran / Odak Toggle
    this.containerEl.querySelector('#btnToggleFullscreen')?.addEventListener('click', () => {
      this.isFullscreen = !this.isFullscreen;
      this.render();
    });

    // Dışarı tıklama kapatıcıları
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#sheetDropdownWrap')) {
        this.isSheetDropdownOpen = false;
        if (dropdownMenu) dropdownMenu.style.display = 'none';
      }
      if (!target.closest('#sheetExportWrap')) {
        this.isExportMenuOpen = false;
        if (exportMenu) exportMenu.style.display = 'none';
      }
      if (!target.closest('#sheetAiPopover') && !target.closest('#btnRequestAiEdit')) {
        this.isAiPopoverOpen = false;
        if (popover) popover.style.display = 'none';
      }
    });

    // 10. Araç Çubuğu Butonları
    this.containerEl.querySelector('#btnSaveSheet')?.addEventListener('click', () => this.save());
    this.containerEl.querySelector('#btnAddRowBtn')?.addEventListener('click', () => this.addRow());
    this.containerEl.querySelector('#btnAddColBtn')?.addEventListener('click', () => this.addCol());

    // 11. Alt Tab Sekmeleri
    this.containerEl.querySelectorAll('.kraga-sheet-tab-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sheetName = btn.getAttribute('data-sheet');
        if (sheetName && sheetName !== this.activeSheetName) {
          this.switchSheet(sheetName);
        }
      });
    });

    this.containerEl.querySelector('#btnAddNewSheet')?.addEventListener('click', () => {
      this.addNewSheet();
    });

    // 12. Arama Kutusu ve Eşleşmeler
    const searchInput = this.containerEl.querySelector('#sheetSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.executeSearch((e.target as HTMLInputElement).value);
    });

    this.containerEl.querySelector('#btnSearchNext')?.addEventListener('click', () => {
      this.navigateSearch(1);
    });

    this.containerEl.querySelector('#btnSearchPrev')?.addEventListener('click', () => {
      this.navigateSearch(-1);
    });
  }

  private updateRangeVisuals(): void {
    if (!this.containerEl) return;
    const minR = Math.min(this.selectionStart?.r ?? 0, this.selectionEnd?.r ?? 0);
    const maxR = Math.max(this.selectionStart?.r ?? 0, this.selectionEnd?.r ?? 0);
    const minC = Math.min(this.selectionStart?.c ?? 0, this.selectionEnd?.c ?? 0);
    const maxC = Math.max(this.selectionStart?.c ?? 0, this.selectionEnd?.c ?? 0);

    this.containerEl.querySelectorAll('td.kraga-sheet-cell').forEach((td) => {
      const r = parseInt(td.getAttribute('data-r') || '-1', 10);
      const c = parseInt(td.getAttribute('data-c') || '-1', 10);
      const inRange = r >= minR && r <= maxR && c >= minC && c <= maxC;
      td.classList.toggle('kraga-sheet-cell--in-range', inRange);
    });

    const coordEl = this.containerEl.querySelector('#sheetActiveCoord');
    if (coordEl) coordEl.textContent = this.getSelectedCellOrRange();

    const statsEl = this.containerEl.querySelector('#sheetSelectionStats');
    if (statsEl) statsEl.textContent = this.computeSelectionStats();
  }

  private pulseHighlightCells(cells: string[]): void {
    if (!this.containerEl || !cells || cells.length === 0) return;

    for (const cellA1 of cells) {
      const coord = a1ToCoord(cellA1);
      const td = this.containerEl.querySelector(`td[data-r="${coord.r}"][data-c="${coord.c}"]`);
      if (td) {
        td.classList.remove('kraga-sheet-cell--agent-pulse');
        // Reflow tetikle
        void (td as HTMLElement).offsetWidth;
        td.classList.add('kraga-sheet-cell--agent-pulse');
        setTimeout(() => {
          td.classList.remove('kraga-sheet-cell--agent-pulse');
        }, 3500);
      }
    }
  }

  private selectCell(r: number, c: number): void {
    if (r < 0 || r >= this.maxRows || c < 0 || c >= this.maxCols) return;

    const prevSelected = this.containerEl?.querySelector('.kraga-sheet-cell--selected');
    prevSelected?.classList.remove('kraga-sheet-cell--selected');

    this.containerEl?.querySelectorAll('.kraga-sheet-cell--in-range').forEach((el) => {
      el.classList.remove('kraga-sheet-cell--in-range');
    });

    this.containerEl?.querySelectorAll('.kraga-sheet-col-header--selected').forEach((el) => {
      el.classList.remove('kraga-sheet-col-header--selected');
    });
    this.containerEl?.querySelectorAll('.kraga-sheet-row-header--selected').forEach((el) => {
      el.classList.remove('kraga-sheet-row-header--selected');
    });

    this.selectedCell = { r, c };
    this.selectionStart = { r, c };
    this.selectionEnd = { r, c };

    const nextSelected = this.containerEl?.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
    nextSelected?.classList.add('kraga-sheet-cell--selected');

    const colHeader = this.containerEl?.querySelector(`th.kraga-sheet-col-header[data-col="${c}"]`);
    colHeader?.classList.add('kraga-sheet-col-header--selected');

    const rowHeader = this.containerEl?.querySelector(`th.kraga-sheet-row-header[data-r="${r}"]`);
    rowHeader?.classList.add('kraga-sheet-row-header--selected');

    const coordLabel = coordToA1(r, c);
    const coordEl = this.containerEl?.querySelector('#sheetActiveCoord');
    if (coordEl) coordEl.textContent = coordLabel;

    const val = this.getCellValue(r, c);
    this.syncFormulaInput(val);

    const statsEl = this.containerEl?.querySelector('#sheetSelectionStats');
    if (statsEl) statsEl.textContent = this.computeSelectionStats();

    this.scrollToCell(r, c);
  }

  private startInlineEditing(r: number, c: number, tdEl: HTMLElement): void {
    if (this.isEditing) return;
    this.isEditing = true;

    const currentVal = this.getCellValue(r, c);
    const inner = tdEl.querySelector('.kraga-sheet-cell-inner') as HTMLElement;
    if (!inner) return;

    const originalDisplay = inner.style.display;
    inner.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'kraga-sheet-inline-editor';
    input.value = String(currentVal ?? '');
    tdEl.appendChild(input);

    input.focus();
    input.select();

    const finishEdit = (commit: boolean) => {
      if (!this.isEditing) return;
      this.isEditing = false;
      const newVal = input.value;
      input.remove();
      inner.style.display = originalDisplay;

      if (commit && newVal !== String(currentVal ?? '')) {
        this.setCellValue(r, c, newVal);
        this.updateCellDom(r, c, newVal);
        this.syncFormulaInput(newVal);
        this.markDirty(true);
      }

      const gridWrapper = this.containerEl?.querySelector('#sheetGridWrapper') as HTMLElement;
      gridWrapper?.focus();
    };

    input.addEventListener('blur', () => finishEdit(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        finishEdit(true);
        this.selectCell(r + 1, c);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        finishEdit(false);
        e.preventDefault();
      } else if (e.key === 'Tab') {
        finishEdit(true);
        this.selectCell(r, c + 1);
        e.preventDefault();
      }
    });
  }

  private updateCellDom(r: number, c: number, val: any): void {
    const td = this.containerEl?.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
    if (!td) return;
    const inner = td.querySelector('.kraga-sheet-cell-inner');
    if (inner) inner.textContent = String(val ?? '');
    td.setAttribute('title', `${coordToA1(r, c)}: ${String(val ?? '')}`);
  }

  private syncFormulaInput(val: any): void {
    const formulaInput = this.containerEl?.querySelector('#sheetFormulaInput') as HTMLInputElement;
    if (formulaInput) {
      formulaInput.value = String(val ?? '');
    }
  }

  private getCellValue(r: number, c: number): any {
    if (!this.sheetData[r]) return '';
    return this.sheetData[r][c] ?? '';
  }

  private setCellValue(r: number, c: number, val: any): void {
    if (!this.sheetData[r]) {
      this.sheetData[r] = [];
    }
    while (this.sheetData[r].length <= c) {
      this.sheetData[r].push('');
    }
    this.sheetData[r][c] = val;
  }

  private markDirty(dirty: boolean): void {
    this.isDirty = dirty;
    const badge = this.containerEl?.querySelector('#sheetDirtyBadge');
    if (badge) {
      if (dirty) {
        badge.classList.add('kraga-sheet-dirty-badge--dirty');
        badge.textContent = '● Değiştirildi';
      } else {
        badge.classList.remove('kraga-sheet-dirty-badge--dirty');
        badge.textContent = '✓ Kaydedildi';
      }
    }
    this.onDirtyChange?.(dirty, this.currentFilePath);
  }

  public async save(): Promise<boolean> {
    if (!this.workbook || !this.activeSheetName || !this.currentFilePath) {
      return false;
    }

    try {
      const newSheet = XLSX.utils.aoa_to_sheet(this.sheetData);
      this.workbook.Sheets[this.activeSheetName] = newSheet;

      const ext = this.currentFilePath.split('.').pop()?.toLowerCase() || 'xlsx';
      let bookType: XLSX.BookType = 'xlsx';
      if (ext === 'xls') bookType = 'biff8';
      else if (ext === 'csv') bookType = 'csv';

      const base64Out = XLSX.write(this.workbook, {
        bookType,
        type: 'base64',
      });

      if (window.kragaAPI?.fs?.writeBinaryFile) {
        await window.kragaAPI.fs.writeBinaryFile(this.currentFilePath, base64Out);
      } else {
        const binStr = atob(base64Out);
        await window.kragaAPI.fs.writeFile(this.currentFilePath, binStr);
      }

      this.markDirty(false);
      this.onSaveComplete?.(this.currentFilePath);
      this.showToast('✓ Değişiklikler başarıyla kaydedildi');
      return true;
    } catch (err: any) {
      console.error('[SpreadsheetWorkspace] Kaydetme hatası:', err);
      alert(`Kaydetme sırasında bir hata oluştu: ${err.message}`);
      return false;
    }
  }

  public async openInSystemExcel(): Promise<void> {
    if (!this.currentFilePath) return;
    try {
      if (window.kragaAPI?.fs?.openPath) {
        await window.kragaAPI.fs.openPath(this.currentFilePath);
      }
    } catch (err) {
      console.error('[SpreadsheetWorkspace] openInSystemExcel hatası:', err);
    }
  }

  public exportXlsx(): void {
    if (!this.workbook) return;
    try {
      const wbout = XLSX.write(this.workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = this.currentFileName.endsWith('.xlsx') ? this.currentFileName : `${this.currentFileName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('✓ Excel (.xlsx) indirildi');
    } catch (err) {
      console.error('[SpreadsheetWorkspace] XLSX dışa aktarma hatası:', err);
    }
  }

  public exportCsv(): void {
    if (!this.workbook || !this.activeSheetName) return;
    try {
      const newSheet = XLSX.utils.aoa_to_sheet(this.sheetData);
      const csvContent = XLSX.utils.sheet_to_csv(newSheet);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.activeSheetName}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('✓ CSV indirildi');
    } catch (err) {
      console.error('[SpreadsheetWorkspace] CSV dışa aktarılamadı:', err);
    }
  }

  public addRow(): void {
    this.maxRows++;
    const newRow = new Array(this.maxCols).fill('');
    this.sheetData.push(newRow);
    this.markDirty(true);
    this.render();
    this.selectCell(this.maxRows - 1, 0);
  }

  public addCol(): void {
    this.maxCols++;
    for (const row of this.sheetData) {
      row.push('');
    }
    this.markDirty(true);
    this.render();
    this.selectCell(0, this.maxCols - 1);
  }

  public switchSheet(sheetName: string): void {
    if (this.isDirty) {
      if (this.workbook) {
        this.workbook.Sheets[this.activeSheetName] = XLSX.utils.aoa_to_sheet(this.sheetData);
      }
    }

    this.activeSheetName = sheetName;
    this.loadCurrentSheetData();
    this.render();
  }

  public addNewSheet(): void {
    if (!this.workbook) return;
    let index = this.workbook.SheetNames.length + 1;
    let newName = `Sayfa${index}`;
    while (this.workbook.SheetNames.includes(newName)) {
      index++;
      newName = `Sayfa${index}`;
    }

    const newWs = XLSX.utils.aoa_to_sheet([['']]);
    XLSX.utils.book_append_sheet(this.workbook, newWs, newName);
    this.markDirty(true);
    this.switchSheet(newName);
  }

  private executeSearch(query: string): void {
    this.searchQuery = (query || '').trim().toLowerCase();
    this.searchMatches = [];
    this.activeSearchMatchIndex = -1;

    if (this.searchQuery) {
      for (let r = 0; r < this.maxRows; r++) {
        for (let c = 0; c < this.maxCols; c++) {
          const val = String(this.getCellValue(r, c)).toLowerCase();
          if (val && val.includes(this.searchQuery)) {
            this.searchMatches.push({ r, c });
          }
        }
      }
    }

    if (this.searchMatches.length > 0) {
      this.activeSearchMatchIndex = 0;
      const target = this.searchMatches[0];
      this.selectCell(target.r, target.c);
    }

    this.updateSearchHighlights();
  }

  private navigateSearch(delta: number): void {
    if (this.searchMatches.length === 0) return;
    this.activeSearchMatchIndex = (this.activeSearchMatchIndex + delta + this.searchMatches.length) % this.searchMatches.length;
    const target = this.searchMatches[this.activeSearchMatchIndex];
    this.selectCell(target.r, target.c);
    this.updateSearchHighlights();
  }

  private updateSearchHighlights(): void {
    const counterEl = this.containerEl?.querySelector('#sheetSearchCounter');
    if (counterEl) {
      counterEl.textContent =
        this.searchMatches.length > 0
          ? `${this.activeSearchMatchIndex + 1}/${this.searchMatches.length}`
          : this.searchQuery
          ? '0 eşleşme'
          : '';
    }

    this.containerEl?.querySelectorAll('td.kraga-sheet-cell').forEach((td) => {
      const r = parseInt(td.getAttribute('data-r') || '-1', 10);
      const c = parseInt(td.getAttribute('data-c') || '-1', 10);
      const isMatch = this.isMatchingCell(r, c);
      const isActiveMatch = this.isActiveSearchMatch(r, c);

      td.classList.toggle('kraga-sheet-cell--match', isMatch);
      td.classList.toggle('kraga-sheet-cell--active-match', isActiveMatch);
    });
  }

  private isMatchingCell(r: number, c: number): boolean {
    if (!this.searchQuery) return false;
    return this.searchMatches.some((m) => m.r === r && m.c === c);
  }

  private isActiveSearchMatch(r: number, c: number): boolean {
    if (this.activeSearchMatchIndex < 0 || this.activeSearchMatchIndex >= this.searchMatches.length) return false;
    const curr = this.searchMatches[this.activeSearchMatchIndex];
    return curr.r === r && curr.c === c;
  }

  private computeSelectionStats(): string {
    if (this.selectionStart && this.selectionEnd && (this.selectionStart.r !== this.selectionEnd.r || this.selectionStart.c !== this.selectionEnd.c)) {
      const minR = Math.min(this.selectionStart.r, this.selectionEnd.r);
      const maxR = Math.max(this.selectionStart.r, this.selectionEnd.r);
      const minC = Math.min(this.selectionStart.c, this.selectionEnd.c);
      const maxC = Math.max(this.selectionStart.c, this.selectionEnd.c);

      let sum = 0;
      let count = 0;
      let numCount = 0;

      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          count++;
          const val = this.getCellValue(r, c);
          const num = parseFloat(String(val).replace(',', '.'));
          if (!isNaN(num)) {
            sum += num;
            numCount++;
          }
        }
      }

      if (numCount > 0) {
        const avg = sum / numCount;
        return `Toplam: ${Math.round(sum * 100) / 100} | Ort: ${Math.round(avg * 100) / 100} | Sayı: ${count}`;
      }
      return `Seçili: ${count} hücre`;
    }

    const val = this.getCellValue(this.selectedCell.r, this.selectedCell.c);
    const num = parseFloat(String(val).replace(',', '.'));
    if (!isNaN(num)) {
      return `Değer: ${num}`;
    }
    return '';
  }

  private scrollToCell(r: number, c: number): void {
    const td = this.containerEl?.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
    if (td) {
      td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  private showToast(msg: string): void {
    const existing = document.getElementById('kragaSheetToast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'kragaSheetToast';
    toast.className = 'kraga-sheet-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('kraga-sheet-toast--visible');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('kraga-sheet-toast--visible');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  private escapeHtml(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const spreadsheetWorkspace = SpreadsheetWorkspace.getInstance();
