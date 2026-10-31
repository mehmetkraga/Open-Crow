// src/components/ReviewWorkspace.ts
// Kraga IDE — Antigravity & Cursor Tarzı "Agent Edits Review & Commit" Çalışma Alanı
// Ajanın bir turda değiştirdiği tüm dosyaları alt alta katlanabilir renkli farklarla gösterir,
// sağ tarafta "Agent Edits" gezgini ve üstte tek tıkla onaylama/Commit butonları sunar.

import {
  iconFileTs, iconFileJs, iconFileJson, iconFileHtml, iconFileCss,
  iconFilePy, iconFileMd, iconFileGeneric, iconCheck, iconClose
} from './icons';

export interface ChangedFileEntry {
  filePath: string;
  fileName: string;
  originalContent: string;
  newContent: string;
  additions: number;
  deletions: number;
}

export interface TurnReviewData {
  turnId: string;
  userPrompt: string;
  timestamp: Date;
  files: ChangedFileEntry[];
}

export function computeDiffStats(oldText: string, newText: string): { additions: number; deletions: number } {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];
  if (oldLines.length === 0) return { additions: newLines.length, deletions: 0 };
  if (newLines.length === 0) return { additions: 0, deletions: oldLines.length };

  let additions = 0;
  let deletions = 0;
  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oLine = oldLines[oldIdx];
    const nLine = newLines[newIdx];

    if (oLine === nLine) {
      oldIdx++;
      newIdx++;
    } else {
      let matchOld = -1;
      let matchNew = -1;
      const lookahead = Math.min(20, Math.max(oldLines.length - oldIdx, newLines.length - newIdx));

      for (let d = 1; d <= lookahead; d++) {
        if (oldIdx + d < oldLines.length && oldLines[oldIdx + d] === nLine) {
          matchOld = oldIdx + d;
          break;
        }
        if (newIdx + d < newLines.length && newLines[newIdx + d] === oLine) {
          matchNew = newIdx + d;
          break;
        }
      }

      if (matchOld !== -1) {
        deletions += (matchOld - oldIdx);
        oldIdx = matchOld;
      } else if (matchNew !== -1) {
        additions += (matchNew - newIdx);
        newIdx = matchNew;
      } else {
        if (oldIdx < oldLines.length) {
          deletions++;
          oldIdx++;
        }
        if (newIdx < newLines.length) {
          additions++;
          newIdx++;
        }
      }
    }
  }

  if (additions === 0 && deletions === 0 && oldText !== newText) {
    additions = Math.max(1, Math.abs(newLines.length - oldLines.length));
  }

  return { additions, deletions };
}

interface DiffLine {
  type: 'add' | 'del' | 'same';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

type DiffHunkBlock =
  | { type: 'lines'; lines: DiffLine[] }
  | { type: 'fold'; count: number; hiddenLines: DiffLine[] };

export class ReviewWorkspaceManager {
  private container: HTMLElement;
  private currentTurn: TurnReviewData | null = null;

  public onCommit?: (commitMessage: string) => Promise<void> | void;
  public onAcceptAll?: () => Promise<void> | void;
  public onRevertAll?: (files: ChangedFileEntry[]) => Promise<void> | void;
  public onClose?: () => void;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }

  public openReview(turnData: TurnReviewData): void {
    this.currentTurn = turnData;
    this.render();
    this.show();
  }

  public show(): void {
    if (this.container) {
      this.container.style.display = 'flex';
    }
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public close(): void {
    this.hide();
    this.currentTurn = null;
    this.onClose?.();
  }

  public getCurrentTurn(): TurnReviewData | null {
    return this.currentTurn;
  }

  private render(): void {
    if (!this.currentTurn) return;

    const { userPrompt, files } = this.currentTurn;
    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

    const promptPreview = userPrompt.length > 70 ? userPrompt.substring(0, 67) + '...' : userPrompt;

    this.container.innerHTML = `
      <div class="review-workbench">
        <!-- 1. Üst İnceleme Araç Çubuğu (Top Bar) -->
        <div class="review-top-bar">
          <div class="review-top-left">
            <span class="review-badge">Review</span>
            <span class="review-for-turn-label">For Turn:</span>
            <div class="review-turn-prompt-pill" title="${this.escapeHtml(userPrompt)}">
              <span>${this.escapeHtml(promptPreview)}</span>
              <button class="review-turn-prompt-close" id="btnReviewCloseX" title="Kapat">
                ${iconClose(12)}
              </button>
            </div>
          </div>

          <div class="review-top-actions">
            <button class="review-action-btn review-action-btn--revert" id="btnReviewRevert" title="Ajanın bu turda yaptığı değişiklikleri geri al">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              <span>Geri Al</span>
            </button>
            <button class="review-action-btn review-action-btn--accept" id="btnReviewAccept" title="Tüm değişiklikleri kabul et">
              ${iconCheck(13)}
              <span>Kabul Et</span>
            </button>
            <button class="review-action-btn review-action-btn--commit" id="btnReviewCommit" title="Değişiklikleri Git'e Commit Et">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><line x1="1.05" y1="12" x2="7" y2="12"/><line x1="17.05" y1="12" x2="23" y2="12"/></svg>
              <span>Commit ▾</span>
            </button>
          </div>
        </div>

        <!-- 2. Ana Çalışma Bölümü: Çoklu Dosya Diff Akışı (Sol) & Agent Edits Gezgini (Sağ) -->
        <div class="review-main-area">
          <!-- Çoklu Dosya Diff Listesi -->
          <div class="review-diff-stream" id="reviewDiffStream">
            ${files.length === 0 ? `
              <div class="review-diff-empty">
                <p>Bu turda herhangi bir dosya değişikliği tespit edilmedi.</p>
              </div>
            ` : ''}
          </div>

          <!-- Sağ Taraf: Agent Edits Gezgini -->
          <aside class="review-agent-edits-sidebar">
            <div class="agent-edits-header">
              <span class="agent-edits-title">Agent Edits</span>
              <span class="agent-edits-count-badge">${files.length} dosya (+${totalAdditions} -${totalDeletions})</span>
            </div>
            <div class="agent-edits-list" id="agentEditsList"></div>
          </aside>
        </div>
      </div>
    `;

    // Buton Dinleyicileri
    this.container.querySelector('#btnReviewCloseX')?.addEventListener('click', () => {
      this.close();
    });

    this.container.querySelector('#btnReviewAccept')?.addEventListener('click', async () => {
      const btn = this.container.querySelector('#btnReviewAccept') as HTMLButtonElement;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `${iconCheck(13)} Kabul Edildi`;
      }
      try {
        await this.onAcceptAll?.();
      } finally {
        setTimeout(() => this.close(), 600);
      }
    });

    this.container.querySelector('#btnReviewRevert')?.addEventListener('click', async () => {
      if (!this.currentTurn) return;
      if (confirm('Ajanın bu turda yaptığı tüm değişiklikler diskten geri alınsın mı?')) {
        await this.onRevertAll?.(this.currentTurn.files);
        this.close();
      }
    });

    this.container.querySelector('#btnReviewCommit')?.addEventListener('click', async () => {
      if (!this.currentTurn) return;
      const defaultMsg = `feat: ${this.currentTurn.userPrompt.substring(0, 50).trim()}`;
      const msg = prompt('Git commit mesajı:', defaultMsg);
      if (msg) {
        await this.onCommit?.(msg);
      }
    });

    // Dosyaları ve Agent Edits kenar çubuğunu render et
    const diffStreamEl = this.container.querySelector('#reviewDiffStream') as HTMLElement;
    const editsListEl = this.container.querySelector('#agentEditsList') as HTMLElement;

    files.forEach((file, index) => {
      const cardEl = this.renderFileDiffCard(file, index);
      diffStreamEl.appendChild(cardEl);

      const navItem = this.renderAgentEditNavItem(file, index);
      editsListEl.appendChild(navItem);
    });
  }

  private renderFileDiffCard(file: ChangedFileEntry, index: number): HTMLElement {
    const card = document.createElement('div');
    card.className = 'review-file-card';
    card.id = `reviewFileCard_${index}`;
    card.setAttribute('data-file-path', file.filePath);

    const iconSvg = this.getFileIcon(file.fileName);
    const relPath = this.getShortPath(file.filePath);
    const isFirst = (index === 0);

    card.innerHTML = `
      <div class="review-file-header" id="header_${index}">
        <span class="review-file-chevron">${isFirst ? '▼' : '▶'}</span>
        <span class="review-file-icon">${iconSvg}</span>
        <span class="review-file-name">${this.escapeHtml(file.fileName)}</span>
        <span class="review-file-path">${this.escapeHtml(relPath)}</span>
        <div class="review-file-stats">
          <span class="stat-badge stat-badge--add">+${file.additions}</span>
          <span class="stat-badge stat-badge--del">-${file.deletions}</span>
        </div>
      </div>
      <div class="review-file-body" id="body_${index}" style="display: ${isFirst ? 'block' : 'none'};"></div>
    `;

    const bodyEl = card.querySelector(`#body_${index}`) as HTMLElement;
    const headerEl = card.querySelector(`#header_${index}`) as HTMLElement;
    const chevronEl = card.querySelector('.review-file-chevron') as HTMLElement;
    let hasRenderedDiff = false;

    const renderContent = () => {
      if (hasRenderedDiff) return;
      hasRenderedDiff = true;
      const hunks = this.computeDiffHunks(file.originalContent, file.newContent);
      this.renderHunksInto(bodyEl, hunks);
    };

    // Sadece ilk dosya hemen render edilir, diğerleri tıklanınca (0-Lag Lazy Loading)
    if (isFirst) {
      renderContent();
    }

    // Başlığa tıklayınca katla / aç
    headerEl.addEventListener('click', () => {
      const isHidden = bodyEl.style.display === 'none';
      if (isHidden) {
        renderContent();
        bodyEl.style.display = 'block';
        chevronEl.textContent = '▼';
      } else {
        bodyEl.style.display = 'none';
        chevronEl.textContent = '▶';
      }
    });

    return card;
  }

  private renderAgentEditNavItem(file: ChangedFileEntry, index: number): HTMLElement {
    const item = document.createElement('div');
    item.className = 'agent-edit-item';
    item.setAttribute('data-index', String(index));
    item.setAttribute('title', file.filePath);

    const iconSvg = this.getFileIcon(file.fileName);
    const shortDir = this.getShortPath(file.filePath);

    item.innerHTML = `
      <span class="agent-edit-icon">${iconSvg}</span>
      <div class="agent-edit-info">
        <span class="agent-edit-name">${this.escapeHtml(file.fileName)}</span>
        <span class="agent-edit-path">${this.escapeHtml(shortDir)}</span>
      </div>
      <div class="agent-edit-stats">
        <span class="stat-badge stat-badge--add">+${file.additions}</span>
        <span class="stat-badge stat-badge--del">-${file.deletions}</span>
      </div>
    `;

    item.addEventListener('click', () => {
      // Tüm seçimleri kaldır
      this.container.querySelectorAll('.agent-edit-item--active').forEach(i => i.classList.remove('agent-edit-item--active'));
      item.classList.add('agent-edit-item--active');

      // Sol taraftaki ilgili dosyaya pürüzsüz kaydır
      const targetCard = this.container.querySelector(`#reviewFileCard_${index}`);
      if (targetCard) {
        const bodyEl = targetCard.querySelector(`#body_${index}`) as HTMLElement;
        const headerEl = targetCard.querySelector(`#header_${index}`) as HTMLElement;
        if (bodyEl && bodyEl.style.display === 'none') {
          headerEl?.click();
        }
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        targetCard.classList.add('review-file-card--highlight');
        setTimeout(() => targetCard.classList.remove('review-file-card--highlight'), 1200);
      }
    });

    return item;
  }

  private computeDiffHunks(oldText: string, newText: string): DiffHunkBlock[] {
    const oldLines = oldText ? oldText.split('\n') : [];
    const newLines = newText ? newText.split('\n') : [];

    // Hızlı satır satır karşılaştırma
    const allDiffLines: DiffLine[] = [];

    let oldIdx = 0;
    let newIdx = 0;

    // Basit ve yüksek performanslı LCS tabanlı satır fark motoru
    if (oldLines.length === 0) {
      newLines.forEach((line, i) => {
        allDiffLines.push({ type: 'add', newLineNumber: i + 1, content: line });
      });
    } else if (newLines.length === 0) {
      oldLines.forEach((line, i) => {
        allDiffLines.push({ type: 'del', oldLineNumber: i + 1, content: line });
      });
    } else {
      // Standart satır eşleşmesi
      while (oldIdx < oldLines.length || newIdx < newLines.length) {
        const oLine = oldLines[oldIdx];
        const nLine = newLines[newIdx];

        if (oLine === nLine) {
          allDiffLines.push({
            type: 'same',
            oldLineNumber: oldIdx + 1,
            newLineNumber: newIdx + 1,
            content: oLine,
          });
          oldIdx++;
          newIdx++;
        } else {
          // İleride eşleşme arama
          let matchOld = -1;
          let matchNew = -1;
          const lookahead = Math.min(20, Math.max(oldLines.length - oldIdx, newLines.length - newIdx));

          for (let d = 1; d <= lookahead; d++) {
            if (oldIdx + d < oldLines.length && oldLines[oldIdx + d] === nLine) {
              matchOld = oldIdx + d;
              break;
            }
            if (newIdx + d < newLines.length && newLines[newIdx + d] === oLine) {
              matchNew = newIdx + d;
              break;
            }
          }

          if (matchOld !== -1) {
            while (oldIdx < matchOld) {
              allDiffLines.push({ type: 'del', oldLineNumber: oldIdx + 1, content: oldLines[oldIdx] });
              oldIdx++;
            }
          } else if (matchNew !== -1) {
            while (newIdx < matchNew) {
              allDiffLines.push({ type: 'add', newLineNumber: newIdx + 1, content: newLines[newIdx] });
              newIdx++;
            }
          } else {
            if (oldIdx < oldLines.length) {
              allDiffLines.push({ type: 'del', oldLineNumber: oldIdx + 1, content: oldLines[oldIdx] });
              oldIdx++;
            }
            if (newIdx < newLines.length) {
              allDiffLines.push({ type: 'add', newLineNumber: newIdx + 1, content: newLines[newIdx] });
              newIdx++;
            }
          }
        }
      }
    }

    // Değişmeyen satırları katla (Fold unchanged lines > 6)
    const blocks: DiffHunkBlock[] = [];
    let sameBuffer: DiffLine[] = [];

    const flushBuffer = () => {
      if (sameBuffer.length > 8) {
        // Baştan 2, sondan 2 satır göster, ortayı katla
        const head = sameBuffer.slice(0, 2);
        const fold = sameBuffer.slice(2, sameBuffer.length - 2);
        const tail = sameBuffer.slice(sameBuffer.length - 2);

        blocks.push({ type: 'lines', lines: head });
        blocks.push({ type: 'fold', count: fold.length, hiddenLines: fold });
        blocks.push({ type: 'lines', lines: tail });
      } else if (sameBuffer.length > 0) {
        blocks.push({ type: 'lines', lines: [...sameBuffer] });
      }
      sameBuffer = [];
    };

    for (const dl of allDiffLines) {
      if (dl.type === 'same') {
        sameBuffer.push(dl);
      } else {
        flushBuffer();
        blocks.push({ type: 'lines', lines: [dl] });
      }
    }
    flushBuffer();

    return blocks;
  }

  private renderHunksInto(container: HTMLElement, blocks: DiffHunkBlock[]): void {
    const table = document.createElement('div');
    table.className = 'diff-table';

    let htmlBuffer = '';
    const MAX_VISIBLE_LINES = 500;
    let totalRenderedLines = 0;
    let hitLimit = false;

    for (let bIndex = 0; bIndex < blocks.length; bIndex++) {
      const block = blocks[bIndex];
      if (block.type === 'lines') {
        for (const line of block.lines) {
          if (totalRenderedLines >= MAX_VISIBLE_LINES) {
            hitLimit = true;
            break;
          }
          totalRenderedLines++;
          const oldNumStr = line.oldLineNumber !== undefined ? String(line.oldLineNumber) : '';
          const newNumStr = line.newLineNumber !== undefined ? String(line.newLineNumber) : '';
          const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';

          htmlBuffer += `
            <div class="diff-line diff-line--${line.type}">
              <span class="diff-num diff-num--old">${oldNumStr}</span>
              <span class="diff-num diff-num--new">${newNumStr}</span>
              <span class="diff-prefix">${prefix}</span>
              <span class="diff-code">${this.escapeHtml(line.content)}</span>
            </div>`;
        }
        if (hitLimit) break;
      } else if (block.type === 'fold') {
        htmlBuffer += `
          <div class="diff-fold-bar" data-fold-index="${bIndex}">
            <span class="fold-btn-expand">+ ${block.count} satır daha (tıkla ve aç)</span>
          </div>`;
      }
    }

    if (hitLimit) {
      htmlBuffer += `
        <div class="diff-fold-bar diff-fold-bar--ceiling">
          <span class="fold-btn-expand">⚠️ Devasa dosya koruması (${MAX_VISIBLE_LINES}+ satır gösterildi). Tam dosya için lütfen editörde açın.</span>
        </div>`;
    }

    table.innerHTML = htmlBuffer;

    // Katlanmış blokları açma dinleyicileri
    table.querySelectorAll('.diff-fold-bar[data-fold-index]').forEach((foldBar) => {
      foldBar.addEventListener('click', () => {
        const idx = Number(foldBar.getAttribute('data-fold-index'));
        const block = blocks[idx];
        if (block && block.type === 'fold') {
          let foldHtml = '';
          for (const line of block.hiddenLines) {
            const oldNumStr = line.oldLineNumber !== undefined ? String(line.oldLineNumber) : '';
            const newNumStr = line.newLineNumber !== undefined ? String(line.newLineNumber) : '';
            const prefix = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
            foldHtml += `
              <div class="diff-line diff-line--${line.type}">
                <span class="diff-num diff-num--old">${oldNumStr}</span>
                <span class="diff-num diff-num--new">${newNumStr}</span>
                <span class="diff-prefix">${prefix}</span>
                <span class="diff-code">${this.escapeHtml(line.content)}</span>
              </div>`;
          }
          const tempWrap = document.createElement('div');
          tempWrap.innerHTML = foldHtml;
          const fragment = document.createDocumentFragment();
          while (tempWrap.firstChild) {
            fragment.appendChild(tempWrap.firstChild);
          }
          foldBar.replaceWith(fragment);
        }
      });
    });

    container.appendChild(table);
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

  private getShortPath(fullPath: string): string {
    const parts = fullPath.replace(/\\/g, '/').split('/');
    if (parts.length <= 3) return fullPath;
    return '.../' + parts.slice(-3, -1).join('/');
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
