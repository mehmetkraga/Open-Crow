// src/components/SearchPanel.ts
// Kraga IDE v2.5 — Proje Genelinde Dosya İçi Arama ve Değiştirme Paneli (VS Code Tarzı)

import {
  iconSearch, iconRefresh, iconClose, iconChevronRight, iconChevronDown,
  iconFileTs, iconFileJs, iconFileJson, iconFileHtml, iconFileCss,
  iconFilePy, iconFileMd, iconFileGeneric
} from './icons';

export interface SearchMatch {
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchLength: number;
}

export interface FileSearchResult {
  filePath: string;
  fileName: string;
  relativePath: string;
  matches: SearchMatch[];
}

export class SearchPanelManager {
  private container: HTMLElement;
  private currentProjectPath: string | null = null;
  public isSearching: boolean = false;
  private results: FileSearchResult[] = [];

  // Options
  private matchCase: boolean = false;
  private matchWord: boolean = false;
  private useRegex: boolean = false;
  private showReplace: boolean = false;

  public onSelectMatch?: (filePath: string, line: number, col: number) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.initDOM();
  }

  public setProjectPath(path: string | null): void {
    this.currentProjectPath = path;
  }

  private initDOM(): void {
    this.container.innerHTML = `
      <div class="search-panel">
        <div class="search-panel__inputs">
          <div class="search-input-row">
            <button class="search-toggle-btn" id="btnToggleReplace" title="Değiştirmeyi Aç/Kapat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div class="search-box-wrapper">
              <input type="text" id="sidebarSearchQuery" class="search-input" placeholder="Dosyalarda Ara..." autocomplete="off" />
              <div class="search-options-strip">
                <button class="search-opt-btn" id="btnOptCase" title="Büyük/Küçük Harf Eşle (Alt+C)">Aa</button>
                <button class="search-opt-btn" id="btnOptWord" title="Tam Sözcük Eşle (Alt+W)">\\b</button>
                <button class="search-opt-btn" id="btnOptRegex" title="Normal İfade Kullan (Alt+R)">.*</button>
              </div>
            </div>
          </div>

          <div class="replace-input-row" id="replaceRow" style="display: none;">
            <div style="width: 20px;"></div>
            <div class="search-box-wrapper">
              <input type="text" id="sidebarReplaceQuery" class="search-input" placeholder="Değiştir..." autocomplete="off" />
              <button class="btn-replace-all" id="btnSidebarReplaceAll" title="Tüm Eşleşmeleri Değiştir">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div class="search-panel__actions">
          <span class="search-status-text" id="searchStatusText">Sonuç yok</span>
          <div class="search-actions-group">
            <button class="sidebar-action-btn" id="btnSearchRefresh" title="Aramayı Yenile">
              ${iconRefresh(14)}
            </button>
            <button class="sidebar-action-btn" id="btnSearchClear" title="Temizle">
              ${iconClose(14)}
            </button>
          </div>
        </div>

        <div class="search-panel__results" id="searchResultsContainer">
          <div class="search-empty-state">
            <span class="search-empty-icon">${iconSearch(32, 'var(--text-muted)')}</span>
            <p>Aramak için bir anahtar kelime yazıp Enter tuşuna basın.</p>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private bindEvents(): void {
    const queryInput = this.container.querySelector('#sidebarSearchQuery') as HTMLInputElement;
    const replaceInput = this.container.querySelector('#sidebarReplaceQuery') as HTMLInputElement;
    const btnToggleReplace = this.container.querySelector('#btnToggleReplace');
    const replaceRow = this.container.querySelector('#replaceRow') as HTMLElement;
    const btnOptCase = this.container.querySelector('#btnOptCase');
    const btnOptWord = this.container.querySelector('#btnOptWord');
    const btnOptRegex = this.container.querySelector('#btnOptRegex');
    const btnRefresh = this.container.querySelector('#btnSearchRefresh');
    const btnClear = this.container.querySelector('#btnSearchClear');
    const btnReplaceAll = this.container.querySelector('#btnSidebarReplaceAll');

    btnToggleReplace?.addEventListener('click', () => {
      this.showReplace = !this.showReplace;
      replaceRow.style.display = this.showReplace ? 'flex' : 'none';
      btnToggleReplace.classList.toggle('active', this.showReplace);
    });

    btnOptCase?.addEventListener('click', () => {
      this.matchCase = !this.matchCase;
      btnOptCase.classList.toggle('active', this.matchCase);
      if (queryInput.value.trim()) this.executeSearch(queryInput.value);
    });

    btnOptWord?.addEventListener('click', () => {
      this.matchWord = !this.matchWord;
      btnOptWord.classList.toggle('active', this.matchWord);
      if (queryInput.value.trim()) this.executeSearch(queryInput.value);
    });

    btnOptRegex?.addEventListener('click', () => {
      this.useRegex = !this.useRegex;
      btnOptRegex.classList.toggle('active', this.useRegex);
      if (queryInput.value.trim()) this.executeSearch(queryInput.value);
    });

    queryInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.executeSearch(queryInput.value);
      }
    });

    btnRefresh?.addEventListener('click', () => {
      if (queryInput.value.trim()) this.executeSearch(queryInput.value);
    });

    btnClear?.addEventListener('click', () => {
      queryInput.value = '';
      if (replaceInput) replaceInput.value = '';
      this.results = [];
      this.renderEmptyState();
    });

    btnReplaceAll?.addEventListener('click', async () => {
      const replaceText = replaceInput?.value ?? '';
      if (!this.results.length) return;
      if (confirm(`Tüm eşleşmeler "${replaceText}" ile değiştirilsin mi?`)) {
        await this.executeReplaceAll(replaceText);
      }
    });
  }

  public async executeSearch(query: string): Promise<void> {
    if (!query.trim()) {
      this.renderEmptyState();
      return;
    }
    if (!this.currentProjectPath) {
      this.renderMessage('Lütfen önce bir proje klasörü açın.');
      return;
    }

    const statusEl = this.container.querySelector('#searchStatusText');
    const resultsEl = this.container.querySelector('#searchResultsContainer');
    if (statusEl) statusEl.textContent = 'Aranıyor...';
    if (resultsEl) {
      resultsEl.innerHTML = '<div style="padding: 16px; color: var(--text-muted); font-size: 12px; text-align: center;">Taranıyor...</div>';
    }

    this.isSearching = true;
    this.results = [];

    try {
      // Projedeki tüm dosyaları bul
      const filePaths: string[] = [];
      const traverse = (items: any[]) => {
        for (const item of items) {
          if (!item.isDirectory) {
            // İkili ve çok büyük dosyaları atla
            const ext = item.name.split('.').pop()?.toLowerCase();
            const skipExts = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'exe', 'dll', 'bin', 'zip', 'tar', 'gz', 'map'];
            if (!skipExts.includes(ext || '')) {
              filePaths.push(item.path);
            }
          } else if (item.children && !item.name.startsWith('.') && item.name !== 'node_modules' && item.name !== 'dist') {
            traverse(item.children);
          }
        }
      };

      const tree = await window.kragaAPI.fs.readDirectory(this.currentProjectPath);
      traverse(tree);

      // Regex hazırla
      let regex: RegExp;
      try {
        let pattern = query;
        if (!this.useRegex) {
          pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        if (this.matchWord) {
          pattern = `\\b${pattern}\\b`;
        }
        const flags = this.matchCase ? 'g' : 'gi';
        regex = new RegExp(pattern, flags);
      } catch (err: any) {
        this.renderMessage(`Geçersiz arama deseni: ${err.message}`);
        this.isSearching = false;
        return;
      }

      // Dosyaları tara
      for (const filePath of filePaths) {
        try {
          const content = await window.kragaAPI.fs.readFile(filePath);
          if (!content) continue;

          const lines = content.split(/\r?\n/);
          const fileMatches: SearchMatch[] = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            regex.lastIndex = 0;
            let match: RegExpExecArray | null;

            while ((match = regex.exec(line)) !== null) {
              fileMatches.push({
                lineNumber: i + 1,
                lineContent: line,
                matchStart: match.index,
                matchLength: match[0].length
              });
              if (!regex.global) break;
            }
          }

          if (fileMatches.length > 0) {
            const fileName = filePath.split(/[\\/]/).pop() || filePath;
            const relPath = filePath.replace(this.currentProjectPath, '').replace(/^[\\/]/, '');
            this.results.push({
              filePath,
              fileName,
              relativePath: relPath,
              matches: fileMatches
            });
          }
        } catch {
          // okunmayan dosya, atla
        }
      }

      this.renderResults();
    } catch (err: any) {
      this.renderMessage(`Arama hatası: ${err.message}`);
    } finally {
      this.isSearching = false;
    }
  }

  private renderResults(): void {
    const statusEl = this.container.querySelector('#searchStatusText');
    const resultsEl = this.container.querySelector('#searchResultsContainer');
    if (!resultsEl) return;

    let totalMatches = 0;
    for (const res of this.results) {
      totalMatches += res.matches.length;
    }

    if (statusEl) {
      statusEl.textContent = `${this.results.length} dosyada ${totalMatches} sonuç`;
    }

    if (this.results.length === 0) {
      resultsEl.innerHTML = `
        <div class="search-empty-state">
          <p>Eşleşen sonuç bulunamadı.</p>
        </div>
      `;
      return;
    }

    resultsEl.innerHTML = '';

    for (const fileRes of this.results) {
      const fileNode = document.createElement('div');
      fileNode.className = 'search-file-group';

      const fileHeader = document.createElement('div');
      fileHeader.className = 'search-file-header';
      fileHeader.innerHTML = `
        <span class="search-file-chevron">${iconChevronDown(12)}</span>
        <span class="search-file-icon">${this.getFileIcon(fileRes.fileName)}</span>
        <span class="search-file-name">${fileRes.fileName}</span>
        <span class="search-file-path">${fileRes.relativePath}</span>
        <span class="search-badge">${fileRes.matches.length}</span>
      `;

      const matchesList = document.createElement('div');
      matchesList.className = 'search-matches-list';

      for (const m of fileRes.matches) {
        const lineItem = document.createElement('div');
        lineItem.className = 'search-match-item';

        const before = this.escapeHtml(m.lineContent.substring(0, m.matchStart));
        const matched = this.escapeHtml(m.lineContent.substring(m.matchStart, m.matchStart + m.matchLength));
        const after = this.escapeHtml(m.lineContent.substring(m.matchStart + m.matchLength));

        lineItem.innerHTML = `
          <span class="search-match-ln">${m.lineNumber}</span>
          <span class="search-match-code">${before}<mark class="search-highlight">${matched}</mark>${after}</span>
        `;

        lineItem.addEventListener('click', () => {
          if (this.onSelectMatch) {
            this.onSelectMatch(fileRes.filePath, m.lineNumber, m.matchStart + 1);
          }
        });

        matchesList.appendChild(lineItem);
      }

      fileHeader.addEventListener('click', () => {
        const isHidden = matchesList.style.display === 'none';
        matchesList.style.display = isHidden ? 'block' : 'none';
        const chev = fileHeader.querySelector('.search-file-chevron');
        if (chev) chev.innerHTML = isHidden ? iconChevronDown(12) : iconChevronRight(12);
      });

      fileNode.appendChild(fileHeader);
      fileNode.appendChild(matchesList);
      resultsEl.appendChild(fileNode);
    }
  }

  private async executeReplaceAll(replaceText: string): Promise<void> {
    const queryInput = this.container.querySelector('#sidebarSearchQuery') as HTMLInputElement;
    const query = queryInput?.value;
    if (!query) return;

    let pattern = query;
    if (!this.useRegex) {
      pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (this.matchWord) {
      pattern = `\\b${pattern}\\b`;
    }
    const regex = new RegExp(pattern, this.matchCase ? 'g' : 'gi');

    for (const fileRes of this.results) {
      try {
        const content = await window.kragaAPI.fs.readFile(fileRes.filePath);
        const replaced = content.replace(regex, replaceText);
        await window.kragaAPI.fs.writeFile(fileRes.filePath, replaced);
      } catch (err) {
        console.error('Değiştirme hatası:', err);
      }
    }

    await this.executeSearch(query);
  }

  private renderEmptyState(): void {
    const statusEl = this.container.querySelector('#searchStatusText');
    const resultsEl = this.container.querySelector('#searchResultsContainer');
    if (statusEl) statusEl.textContent = 'Sonuç yok';
    if (resultsEl) {
      resultsEl.innerHTML = `
        <div class="search-empty-state">
          <span class="search-empty-icon">${iconSearch(32, 'var(--text-muted)')}</span>
          <p>Aramak için bir anahtar kelime yazıp Enter tuşuna basın.</p>
        </div>
      `;
    }
  }

  private renderMessage(msg: string): void {
    const resultsEl = this.container.querySelector('#searchResultsContainer');
    if (resultsEl) {
      resultsEl.innerHTML = `<div style="padding: 16px; color: var(--text-muted); font-size: 12px; text-align: center;">${msg}</div>`;
    }
  }

  private getFileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return iconFileTs(14);
      case 'js': case 'jsx': return iconFileJs(14);
      case 'json': return iconFileJson(14);
      case 'html': return iconFileHtml(14);
      case 'css': case 'scss': return iconFileCss(14);
      case 'py': return iconFilePy(14);
      case 'md': return iconFileMd(14);
      default: return iconFileGeneric(14);
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
