// src/components/ProblemsPanel.ts
// Open Crow — Visual Studio 2022 Tarzı Hata Listesi & Tanı Tablosu (Visual Studio Error List & Diagnostics Grid)
// Hata, Uyarı ve İleti filtreleme, Kapsam seçici (Tüm Çözüm vs. Geçerli Belge),
// ve tıklandığında ilgili satıra anında atlayan tam donanımlı profesyonel veri tablosu.

import * as monaco from 'monaco-editor';
import { iconSearch, iconCheckCircle } from './icons';

export interface ProblemEntry {
  severity: monaco.MarkerSeverity;
  message: string;
  code?: string;
  source?: string;
  resourceUri: string;
  fileName: string;
  filePath: string;
  startLineNumber: number;
  startColumn: number;
}

export class ProblemsPanelManager {
  private container: HTMLElement;
  private badgeEl: HTMLElement | null = null;
  private filterInput: HTMLInputElement | null = null;
  private scopeSelect: HTMLSelectElement | null = null;
  private btnErrors: HTMLButtonElement | null = null;
  private btnWarnings: HTMLButtonElement | null = null;
  private btnInfos: HTMLButtonElement | null = null;
  private gridContainerEl: HTMLElement | null = null;

  private currentProblems: ProblemEntry[] = [];
  private filterQuery: string = '';
  private currentScope: 'all' | 'current' = 'all';
  private activeDocumentPath: string | null = null;

  // Visual Studio 2022 3-Way Toggles
  private showErrors: boolean = true;
  private showWarnings: boolean = true;
  private showInfos: boolean = true;

  public onSelectProblem?: (filePath: string, line: number, col: number) => void;

  constructor(containerId: string, badgeId?: string) {
    this.container = document.getElementById(containerId)!;
    if (badgeId) {
      this.badgeEl = document.getElementById(badgeId);
    }
    this.initDOM();
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <div class="vs-error-list-workbench">
        <!-- Visual Studio 2022 Error List Üst Araç Çubuğu -->
        <div class="vs-error-list-toolbar">
          <div class="vs-error-list-toggles">
            <button class="vs-error-toggle-btn active" id="vsToggleErrors" title="Hataları Göster/Gizle">
              <span class="vs-error-icon-red">❌</span>
              <span class="vs-toggle-label" id="vsErrorsCountLabel">0 Hata</span>
            </button>
            <button class="vs-error-toggle-btn active" id="vsToggleWarnings" title="Uyarıları Göster/Gizle">
              <span class="vs-error-icon-yellow">⚠️</span>
              <span class="vs-toggle-label" id="vsWarningsCountLabel">0 Uyarı</span>
            </button>
            <button class="vs-error-toggle-btn active" id="vsToggleInfos" title="İletileri Göster/Gizle">
              <span class="vs-error-icon-blue">ℹ️</span>
              <span class="vs-toggle-label" id="vsInfosCountLabel">0 İleti</span>
            </button>
          </div>

          <div class="vs-error-toolbar-sep"></div>

          <!-- Kapsam Seçici (Scope) -->
          <div class="vs-error-scope-wrap">
            <select class="vs-error-scope-select" id="vsErrorScopeSelect" title="Hata Listesi Kapsamı">
              <option value="all" selected>Tüm Çözüm (Entire Solution)</option>
              <option value="current">Geçerli Belge (Current Document)</option>
            </select>
          </div>

          <div class="vs-error-toolbar-sep"></div>

          <!-- Arama Filtresi -->
          <div class="vs-error-search-wrap">
            <span class="vs-error-search-icon">${iconSearch(12, 'var(--text-muted, #8b949e)')}</span>
            <input
              type="text"
              class="vs-error-search-input"
              id="vsErrorSearchInput"
              placeholder="Sorunları filtrele (kod, dosya, mesaj)..."
              spellcheck="false"
            />
          </div>
        </div>

        <!-- Visual Studio 2022 Grid Tablosu -->
        <div class="vs-error-grid-host" id="vsErrorGridHost"></div>
      </div>
    `;

    this.filterInput = this.container.querySelector('#vsErrorSearchInput');
    this.scopeSelect = this.container.querySelector('#vsErrorScopeSelect');
    this.btnErrors = this.container.querySelector('#vsToggleErrors');
    this.btnWarnings = this.container.querySelector('#vsToggleWarnings');
    this.btnInfos = this.container.querySelector('#vsToggleInfos');
    this.gridContainerEl = this.container.querySelector('#vsErrorGridHost');

    // Arama Dinleyicisi
    this.filterInput?.addEventListener('input', () => {
      this.filterQuery = this.filterInput?.value.trim().toLowerCase() || '';
      this.render();
    });

    // Kapsam Değişimi Dinleyicisi
    this.scopeSelect?.addEventListener('change', (e) => {
      this.currentScope = (e.target as HTMLSelectElement).value as 'all' | 'current';
      this.render();
    });

    // Hata Butonu Toggle
    this.btnErrors?.addEventListener('click', () => {
      this.showErrors = !this.showErrors;
      this.btnErrors?.classList.toggle('active', this.showErrors);
      this.render();
    });

    // Uyarı Butonu Toggle
    this.btnWarnings?.addEventListener('click', () => {
      this.showWarnings = !this.showWarnings;
      this.btnWarnings?.classList.toggle('active', this.showWarnings);
      this.render();
    });

    // İleti Butonu Toggle
    this.btnInfos?.addEventListener('click', () => {
      this.showInfos = !this.showInfos;
      this.btnInfos?.classList.toggle('active', this.showInfos);
      this.render();
    });

    this.render();
  }

  public setActiveDocument(filePath: string | null): void {
    this.activeDocumentPath = filePath ? filePath.replace(/\\/g, '/') : null;
    if (this.currentScope === 'current') {
      this.render();
    }
  }

  /**
   * Monaco editörünün tüm aktif model tanı işaretçilerini günceller
   */
  public updateMarkers(markers: monaco.editor.IMarker[]): void {
    this.currentProblems = markers.map((m) => {
      const rawPath = m.resource.fsPath || m.resource.path || m.resource.toString();
      const filePath = rawPath.replace(/\\/g, '/');
      const fileName = filePath.split(/[\\/]/).pop() || filePath;
      const code = typeof m.code === 'string' ? m.code : m.code?.value || '';

      return {
        severity: m.severity,
        message: m.message,
        code,
        source: m.source || 'TS/Linter',
        resourceUri: m.resource.toString(),
        fileName,
        filePath,
        startLineNumber: m.startLineNumber,
        startColumn: m.startColumn,
      };
    });

    this.updateBadgeAndCounts();
    this.render();
  }

  private updateBadgeAndCounts(): void {
    const errorCount = this.currentProblems.filter((p) => p.severity === monaco.MarkerSeverity.Error).length;
    const warningCount = this.currentProblems.filter((p) => p.severity === monaco.MarkerSeverity.Warning).length;
    const infoCount = this.currentProblems.filter((p) => p.severity === monaco.MarkerSeverity.Info || p.severity === monaco.MarkerSeverity.Hint).length;

    const labelErrors = this.container.querySelector('#vsErrorsCountLabel');
    if (labelErrors) labelErrors.textContent = `${errorCount} Hata`;

    const labelWarnings = this.container.querySelector('#vsWarningsCountLabel');
    if (labelWarnings) labelWarnings.textContent = `${warningCount} Uyarı`;

    const labelInfos = this.container.querySelector('#vsInfosCountLabel');
    if (labelInfos) labelInfos.textContent = `${infoCount} İleti`;

    const totalActive = errorCount + warningCount;
    if (this.badgeEl) {
      if (totalActive > 0) {
        this.badgeEl.textContent = totalActive.toString();
        this.badgeEl.style.display = 'inline-flex';
        this.badgeEl.className = `badge-counter ${errorCount > 0 ? 'badge-counter--error' : 'badge-counter--warning'}`;
      } else {
        this.badgeEl.style.display = 'none';
      }
    }
  }

  private render(): void {
    if (!this.gridContainerEl) return;

    let filtered = this.currentProblems;

    // 1. Kapsam Filtresi (Scope)
    if (this.currentScope === 'current' && this.activeDocumentPath) {
      filtered = filtered.filter((p) => p.filePath === this.activeDocumentPath || p.filePath.endsWith(this.activeDocumentPath!));
    }

    // 2. Şiddet (Severity Toggles) Filtresi
    filtered = filtered.filter((p) => {
      if (p.severity === monaco.MarkerSeverity.Error) return this.showErrors;
      if (p.severity === monaco.MarkerSeverity.Warning) return this.showWarnings;
      return this.showInfos;
    });

    // 3. Metin Arama Filtresi
    if (this.filterQuery) {
      filtered = filtered.filter((p) => {
        return (
          p.message.toLowerCase().includes(this.filterQuery) ||
          p.fileName.toLowerCase().includes(this.filterQuery) ||
          (p.code && p.code.toLowerCase().includes(this.filterQuery)) ||
          (p.source && p.source.toLowerCase().includes(this.filterQuery))
        );
      });
    }

    if (filtered.length === 0) {
      this.gridContainerEl.innerHTML = `
        <div class="vs-error-empty-state">
          <span class="vs-error-empty-icon">${iconCheckCircle(30, '#38d430')}</span>
          <p>Seçili filtrelerde herhangi bir kod sorunu veya sözdizimi hatası bulunamadı.</p>
        </div>
      `;
      return;
    }

    // Visual Studio 2022 Data Grid Tablosu Oluştur
    const table = document.createElement('table');
    table.className = 'vs-error-grid-table';

    table.innerHTML = `
      <thead>
        <tr>
          <th style="width: 38px; text-align: center;">!</th>
          <th style="width: 90px;">Kod</th>
          <th style="min-width: 250px;">Açıklama</th>
          <th style="width: 160px;">Dosya</th>
          <th style="width: 60px; text-align: right;">Satır</th>
          <th style="width: 60px; text-align: right;">Sütun</th>
          <th style="width: 100px;">Kaynak</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody')!;

    filtered.forEach((item, index) => {
      const isError = item.severity === monaco.MarkerSeverity.Error;
      const isWarning = item.severity === monaco.MarkerSeverity.Warning;
      const row = document.createElement('tr');
      row.className = `vs-error-row ${index % 2 === 0 ? 'vs-error-row--even' : 'vs-error-row--odd'}`;

      let iconHtml = '<span class="vs-grid-badge vs-grid-badge--info">ℹ️</span>';
      if (isError) iconHtml = '<span class="vs-grid-badge vs-grid-badge--error">❌</span>';
      else if (isWarning) iconHtml = '<span class="vs-grid-badge vs-grid-badge--warning">⚠️</span>';

      row.innerHTML = `
        <td style="text-align: center;">${iconHtml}</td>
        <td class="vs-cell-code">${this.escapeHtml(item.code || 'Syntax')}</td>
        <td class="vs-cell-desc" title="${this.escapeHtml(item.message)}">${this.escapeHtml(item.message)}</td>
        <td class="vs-cell-file" title="${this.escapeHtml(item.filePath)}">${this.escapeHtml(item.fileName)}</td>
        <td class="vs-cell-num">${item.startLineNumber}</td>
        <td class="vs-cell-num">${item.startColumn}</td>
        <td class="vs-cell-source">${this.escapeHtml(item.source || 'Linter')}</td>
      `;

      row.addEventListener('click', () => {
        this.container.querySelectorAll('.vs-error-row').forEach((r) => r.classList.remove('selected'));
        row.classList.add('selected');
        this.onSelectProblem?.(item.filePath, item.startLineNumber, item.startColumn);
      });

      tbody.appendChild(row);
    });

    this.gridContainerEl.innerHTML = '';
    this.gridContainerEl.appendChild(table);
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
