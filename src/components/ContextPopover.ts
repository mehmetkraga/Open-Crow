// src/components/ContextPopover.ts
// Bağlam penceresi detaylı breakdown popover'ı (Tokens: Messages, System, Buffer, Free)

import { iconBrain, iconInfo } from './icons';
import { TokenTracker } from '../core/TokenTracker';
import { formatContextLimit } from '../core/ModelCatalog';

export class ContextPopoverManager {
  private container: HTMLElement;
  private popoverEl: HTMLElement | null = null;
  private isVisible = false;
  private tokenTracker = TokenTracker.getInstance();

  constructor(container: HTMLElement) {
    this.container = container;
    this.init();
  }

  private init(): void {
    this.renderPopover();
    this.setupListeners();
  }

  private renderPopover(): void {
    this.popoverEl = document.createElement('div');
    this.popoverEl.className = 'context-popover context-popover--hidden';
    this.popoverEl.innerHTML = `
      <div class="context-popover__header">
        <div class="context-popover__title">
          ${iconBrain(16, 'var(--accent-color, #00f0ff)')}
          <span>Bağlam Penceresi Analizi</span>
        </div>
        <span class="context-popover__badge" id="ctxModelLimitBadge">200K</span>
      </div>

      <div class="context-popover__bar-wrapper">
        <div class="context-popover__multi-bar" id="ctxMultiBar">
          <div class="ctx-bar-slice ctx-bar-slice--messages" id="ctxSliceMsg" style="width: 0%" title="Mesajlar"></div>
          <div class="ctx-bar-slice ctx-bar-slice--system" id="ctxSliceSys" style="width: 5%" title="Sistem"></div>
          <div class="ctx-bar-slice ctx-bar-slice--buffer" id="ctxSliceBuf" style="width: 2%" title="Arabellek"></div>
        </div>
      </div>

      <div class="context-popover__breakdown">
        <div class="ctx-stat-row">
          <div class="ctx-stat-row__label">
            <span class="ctx-dot ctx-dot--messages"></span>
            <span>Sohbet Mesajları</span>
          </div>
          <span class="ctx-stat-row__val" id="ctxValMsg">0 / 0%</span>
        </div>

        <div class="ctx-stat-row">
          <div class="ctx-stat-row__label">
            <span class="ctx-dot ctx-dot--system"></span>
            <span>Sistem & Hafıza</span>
          </div>
          <span class="ctx-stat-row__val" id="ctxValSys">~1.2K / 1%</span>
        </div>

        <div class="ctx-stat-row">
          <div class="ctx-stat-row__label">
            <span class="ctx-dot ctx-dot--free"></span>
            <span>Kullanılabilir Boş Alan</span>
          </div>
          <span class="ctx-stat-row__val" id="ctxValFree">198.8K / 99%</span>
        </div>
      </div>

      <div class="context-popover__footer">
        ${iconInfo(14, 'var(--text-muted, #8b949e)')}
        <span>%85 üzerinde otomatik sıkıştırma önerilir.</span>
      </div>
    `;

    document.body.appendChild(this.popoverEl);
  }

  private setupListeners(): void {
    // Topbar context bar elementine tıklandığında aç/kapa
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Dışarı tıklanınca kapat
    document.addEventListener('click', (e) => {
      if (this.isVisible && this.popoverEl && !this.popoverEl.contains(e.target as Node) && !this.container.contains(e.target as Node)) {
        this.close();
      }
    });

    // TokenTracker güncellemelerini dinle
    this.tokenTracker.on('update', () => this.updateValues());
  }

  public toggle(): void {
    if (this.isVisible) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    if (!this.popoverEl) return;
    this.updateValues();

    // Container'a göre konumlandır
    const rect = this.container.getBoundingClientRect();
    this.popoverEl.style.top = `${rect.bottom + 8}px`;
    this.popoverEl.style.right = `${window.innerWidth - rect.right}px`;

    this.popoverEl.classList.remove('context-popover--hidden');
    this.isVisible = true;
  }

  public close(): void {
    if (!this.popoverEl) return;
    this.popoverEl.classList.add('context-popover--hidden');
    this.isVisible = false;
  }

  public updateValues(): void {
    if (!this.popoverEl) return;

    const state = this.tokenTracker.getState();
    const used = state.currentContextUsed || 0;
    const limit = state.currentContextLimit || 200000;
    const sysTokens = Math.min(1200, Math.floor(limit * 0.01));
    const msgTokens = Math.max(0, used - sysTokens);
    const freeTokens = Math.max(0, limit - used);

    const msgPct = Math.min(100, (msgTokens / limit) * 100);
    const sysPct = Math.min(100, (sysTokens / limit) * 100);
    const freePct = Math.max(0, 100 - (msgPct + sysPct));

    // Elementleri güncelle
    const badge = this.popoverEl.querySelector('#ctxModelLimitBadge');
    if (badge) badge.textContent = formatContextLimit(limit);

    const sliceMsg = this.popoverEl.querySelector('#ctxSliceMsg') as HTMLElement;
    const sliceSys = this.popoverEl.querySelector('#ctxSliceSys') as HTMLElement;
    if (sliceMsg) sliceMsg.style.width = `${msgPct.toFixed(1)}%`;
    if (sliceSys) sliceSys.style.width = `${sysPct.toFixed(1)}%`;

    const valMsg = this.popoverEl.querySelector('#ctxValMsg');
    const valSys = this.popoverEl.querySelector('#ctxValSys');
    const valFree = this.popoverEl.querySelector('#ctxValFree');

    const isEst = this.tokenTracker.isEstimated();
    const estTag = isEst ? ' (Tahmini)' : '';

    if (valMsg) valMsg.textContent = `${this.formatTokens(msgTokens)} / ${msgPct.toFixed(1)}%${estTag}`;
    if (valSys) valSys.textContent = `${this.formatTokens(sysTokens)} / ${sysPct.toFixed(1)}%${estTag}`;
    if (valFree) valFree.textContent = `${this.formatTokens(freeTokens)} / ${freePct.toFixed(1)}%`;
  }

  private formatTokens(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  }
}
