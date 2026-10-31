// src/components/ModelSelector.ts
// Claude Tarzı Model ve Efor Seçici Popover

import { iconChevronDown, iconChevronRight, iconChevronLeft, iconCheck, iconPlus, iconRefresh, iconSparkles } from './icons';
import {
  getAllModels,
  getModelById,
  getDefaultModel,
  getCheapestModel,
  getEffortLevels,
  getModelReasoningCapabilities,
  formatContextLimit,
  getMultiplierClass,
  registerPromoModels,
  registerCustomModel,
  foldEffortSuffix,
  hasActiveProviderModels,
  type ModelInfo
} from '../core/ModelCatalog';
import { fetchAvailableModels } from '../core/proxyClient';
import { TokenTracker } from '../core/TokenTracker';
import { notificationManager } from '../core/NotificationManager';

export class ModelSelectorManager {
  private container: HTMLElement;
  private buttonEl!: HTMLButtonElement;
  private popoverEl!: HTMLDivElement;

  private selectedModelId: string = getDefaultModel().id;
  private selectedEffort: string = 'medium';
  private thinkingEnabled: boolean = false;

  private currentView: 'main' | 'effort' | 'models' = 'main';
  private hasNotifiedLowBalance = false;

  public onModelChange?: (modelId: string) => void;
  public onEffortChange?: (effort: string) => void;
  public onThinkingChange?: (enabled: boolean) => void;
  public hasActiveMessages?: () => boolean;

  constructor(container: HTMLElement) {
    this.container = container;
    this.loadState();
    this.initUI();
    document.addEventListener('click', this.handleOutsideClick.bind(this));

    // TokenTracker güncellemelerini dinle ve bakiye uyarısını güncelle
    TokenTracker.getInstance().on('update', () => {
      this.updateButtonUI();
    });

    // Modern AI IDE Kısayolu (Cursor/Windsurf style): Ctrl+. veya Alt+M ile hızlı model popover'ı
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key === '.') || (e.altKey && (e.key === 'm' || e.key === 'M'))) {
        e.preventDefault();
        this.togglePopover();
      }
    });

    window.addEventListener('kraga:default-model-changed', (e: any) => {
      if (e.detail?.modelId) {
        this.setModel(e.detail.modelId);
      }
    });

    window.addEventListener('kraga:models-updated', () => {
      const all = getAllModels();
      const userLocked = localStorage.getItem('kraga:user-locked-model') === 'true';
      const isValid = all.some(m => m.id.toLowerCase() === (this.selectedModelId || '').toLowerCase()) ||
                      getModelById(this.selectedModelId) !== null;
      if (!isValid && !userLocked) {
        const cheapest = getCheapestModel();
        this.selectedModelId = cheapest.id;
        this.saveState();
        if (this.onModelChange) this.onModelChange(cheapest.id);
      }
      this.updateButtonUI();
      if (this.currentView === 'models' || !this.popoverEl.classList.contains('model-popover--hidden')) {
        this.renderPopover();
      }
    });
  }

  public getSelectedModel(): string {
    return this.selectedModelId;
  }

  public getSelectedEffort(): string {
    return this.selectedEffort;
  }

  public isThinkingEnabled(): boolean {
    return this.thinkingEnabled;
  }

  public setModel(modelId: string): void {
    this.selectedModelId = modelId;
    const cap = getModelReasoningCapabilities(modelId);
    if (cap.supportsThinking) {
      if (!cap.availableLevels.some(l => l.id === this.selectedEffort)) {
        this.selectedEffort = cap.defaultLevel;
      }
      if (cap.canToggleThinking && localStorage.getItem('kraga:thinking') === null) {
        this.thinkingEnabled = true;
      }
    }
    this.saveState();
    this.updateButtonUI();
    if (this.onModelChange) this.onModelChange(modelId);
    if (this.onEffortChange) this.onEffortChange(this.selectedEffort);
    if (this.onThinkingChange) this.onThinkingChange(this.thinkingEnabled);
    window.dispatchEvent(new CustomEvent('kraga:default-model-changed', { detail: { modelId } }));
  }

  private loadState(): void {
    const savedModel = localStorage.getItem('kraga:model');
    const savedEffort = localStorage.getItem('kraga:effort');
    const savedThinking = localStorage.getItem('kraga:thinking');

    const cleanSavedModel = savedModel ? foldEffortSuffix(savedModel) : null;
    if (cleanSavedModel && getModelById(cleanSavedModel)) {
      this.selectedModelId = cleanSavedModel;
      if (cleanSavedModel !== savedModel) {
        localStorage.setItem('kraga:model', cleanSavedModel);
      }
    } else {
      const cheapest = getCheapestModel();
      this.selectedModelId = cheapest.id;
      localStorage.setItem('kraga:model', this.selectedModelId);
    }
    const cap = getModelReasoningCapabilities(this.selectedModelId);
    if (savedEffort && cap.availableLevels.some(l => l.id === savedEffort)) {
      this.selectedEffort = savedEffort;
    } else if (cap.supportsThinking && cap.defaultLevel) {
      this.selectedEffort = cap.defaultLevel;
    } else if (savedEffort) {
      this.selectedEffort = savedEffort;
    }
    if (savedThinking !== null) {
      this.thinkingEnabled = savedThinking === 'true';
    } else {
      this.thinkingEnabled = cap.supportsThinking;
    }
  }

  private saveState(): void {
    localStorage.setItem('kraga:model', this.selectedModelId);
    localStorage.setItem('kraga:effort', this.selectedEffort);
    localStorage.setItem('kraga:thinking', this.thinkingEnabled ? 'true' : 'false');
  }

  private initUI(): void {
    // Create Button
    this.buttonEl = document.createElement('button');
    this.buttonEl.id = 'btnModelSelector';
    this.buttonEl.className = 'model-selector-btn model-selector-btn--pill';
    this.buttonEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePopover();
    });
    this.container.appendChild(this.buttonEl);

    // Global event listener to open model selector
    window.addEventListener('kraga:open-model-selector', (e: any) => {
      const view = e.detail?.view || 'models';
      this.openPopover(view);
    });

    // Create Popover
    this.popoverEl = document.createElement('div');
    this.popoverEl.className = 'model-popover model-popover--hidden';
    this.popoverEl.addEventListener('click', (e) => e.stopPropagation());

    this.container.style.position = 'relative';
    this.container.appendChild(this.popoverEl);

    this.updateButtonUI();
    this.renderPopover();
  }

  private updateButtonUI(): void {
    const model = getModelById(this.selectedModelId);
    const modelName = model ? model.name : this.selectedModelId;
    const multVal = model ? model.multiplier : 1.0;
    const multClass = getMultiplierClass(multVal);

    // Kalan Bakiye & Kritik Kota Uyarısı (%10 ve altı)
    const tokenTracker = TokenTracker.getInstance();
    const tokenState = tokenTracker.getState();
    const isPromo = tokenState.isPromoMode;
    const hasQuotaLimit = tokenState.tokenLimit > 0 || tokenState.costLimit > 0;
    const remainingPct = tokenTracker.getRemainingPercentage();

    let warningBadgeHtml = '';
    if (isPromo && hasQuotaLimit) {
      if (tokenTracker.getRemainingBalance() <= 0 || remainingPct <= 0) {
        warningBadgeHtml = `
          <span class="model-quota-warning-badge model-quota-warning-badge--depleted" title="🚫 Kullanım hakkınız tükendi (%0)! Bakiye kalmadı. Tıklayıp yeni bir promo tanımlayın.">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span class="quota-warn-text">%0 Bitti</span>
          </span>
        `;
      } else if (remainingPct <= 10) {
        warningBadgeHtml = `
          <span class="model-quota-warning-badge model-quota-warning-badge--critical" title="⚠️ Kalan kullanım hakkınız: %${remainingPct.toFixed(0)} (%10'dan az kaldı)! Bakiye tükenmek üzere. Tıklayıp inceleyin.">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <span class="quota-warn-text">%${remainingPct.toFixed(0)}</span>
          </span>
        `;

        // Kritik eşik ilk aşıldığında bir defalık uyarı bildirimi fırlat
        if (!this.hasNotifiedLowBalance && remainingPct > 0) {
          this.hasNotifiedLowBalance = true;
          notificationManager.showToast({
            title: '⚠️ Promo Bakiyesi %10\'un Altında',
            message: `Kalan kullanım hakkınız %${remainingPct.toFixed(0)}. Bakiye tükenmek üzere!`,
            type: 'warning',
            durationMs: 7000,
            action: {
              label: 'Bakiye Yükle',
              onClick: () => window.dispatchEvent(new CustomEvent('kraga:open-account')),
            },
          });
        }
      } else if (remainingPct > 15) {
        this.hasNotifiedLowBalance = false;
      }
    }

    const cap = getModelReasoningCapabilities(this.selectedModelId);
    let effortBadgeHtml = '';
    if (cap.supportsThinking) {
      if (!cap.canToggleThinking || this.thinkingEnabled) {
        const activeLevel = cap.availableLevels.find(l => l.id === this.selectedEffort) || cap.availableLevels[0];
        const label = activeLevel ? activeLevel.label : this.getEffortLabel(this.selectedEffort);
        const isUltra = this.selectedEffort === 'max' || this.selectedEffort === '16k';
        effortBadgeHtml = `<span class="model-selector-btn__effort ${isUltra ? 'model-selector-btn__effort--ultra' : ''}">🧠 ${label}</span>`;
      }
    }

    this.buttonEl.innerHTML = `
      <span class="model-selector-btn__name">${modelName}</span>
      ${warningBadgeHtml}
      <span class="model-selector-btn__mult ${multClass}">${multVal}x</span>
      ${effortBadgeHtml}
      <span class="model-selector-btn__icon">${iconChevronDown(14)}</span>
    `;

    // Uyarı rozetine tıklandığında doğrudan Hesap modalını aç
    const warnBadge = this.buttonEl.querySelector('.model-quota-warning-badge');
    warnBadge?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent('kraga:open-account'));
    });
  }

  private getEffortLabel(effort: string): string {
    const cap = getModelReasoningCapabilities(this.selectedModelId);
    const found = cap.availableLevels.find(l => l.id === effort);
    if (found) return found.label;
    const levels = getEffortLevels();
    const level = levels.find(l => l.id === effort);
    return level ? level.label : 'Orta';
  }

  public openPopover(view: 'main' | 'effort' | 'models' = 'models'): void {
    this.currentView = view;
    this.renderPopover();
    this.popoverEl.classList.remove('model-popover--hidden');
  }

  public closePopover(): void {
    this.popoverEl.classList.add('model-popover--hidden');
  }

  private togglePopover(): void {
    const isHidden = this.popoverEl.classList.contains('model-popover--hidden');
    if (isHidden) {
      this.openPopover('main');
    } else {
      this.closePopover();
    }
  }

  private handleOutsideClick(): void {
    if (!this.popoverEl.classList.contains('model-popover--hidden')) {
      this.popoverEl.classList.add('model-popover--hidden');
    }
  }

  private renderPopover(): void {
    this.popoverEl.innerHTML = '';

    const viewContainer = document.createElement('div');
    viewContainer.className = 'model-popover__view';

    switch (this.currentView) {
      case 'main':
        viewContainer.appendChild(this.createMainView());
        break;
      case 'effort':
        viewContainer.appendChild(this.createEffortView());
        break;
      case 'models':
        viewContainer.appendChild(this.createModelsView());
        break;
    }

    this.popoverEl.appendChild(viewContainer);
  }

  private createMainView(): DocumentFragment {
    const fragment = document.createDocumentFragment();
    const model = getModelById(this.selectedModelId);
    const cap = getModelReasoningCapabilities(this.selectedModelId);
    const levels = cap.supportsThinking && cap.availableLevels.length > 0 ? cap.availableLevels : [];
    const activeLevelIndex = Math.max(0, levels.findIndex(l => l.id === this.selectedEffort));
    const activeLevel = levels[activeLevelIndex] || levels[0];
    const isUltra = this.selectedEffort === 'max' || this.selectedEffort === '16k';

    // Header container (Top centered level button + model name, right refresh action)
    const header = document.createElement('div');
    header.className = 'effort-header-row';

    let levelColorClass = 'effort-level-text--medium';
    if (isUltra) levelColorClass = 'effort-level-text--ultra';
    else if (this.selectedEffort === 'high' || this.selectedEffort === '8k') levelColorClass = 'effort-level-text--high';
    else if (this.selectedEffort === 'low' || this.selectedEffort === '1k' || this.selectedEffort === '2k') levelColorClass = 'effort-level-text--low';

    const headerLabel = cap.supportsThinking && activeLevel
      ? (cap.canToggleThinking && !this.thinkingEnabled ? 'Düşünme Kapalı' : activeLevel.label)
      : 'Standart Model';

    header.innerHTML = `
      <div class="effort-header-center">
        <button class="effort-level-title-btn ${levelColorClass}" id="btnLevelToModels" title="Modelleri listele ve değiştir">
          <span>${headerLabel}</span>
          <span class="effort-chevron">${iconChevronRight(14)}</span>
        </button>
        <div class="effort-model-sub" id="btnModelNameToModels" title="Modelleri listele">
          ${model ? model.name : this.selectedModelId}
        </div>
      </div>
      <div class="effort-header-actions">
        <button class="effort-action-icon-btn" id="btnRefreshModelsHeader" title="Modelleri Sağlayıcıdan Yenile">
          ${iconRefresh(14)}
        </button>
      </div>
    `;

    header.querySelector('#btnLevelToModels')?.addEventListener('click', () => {
      this.currentView = 'models';
      this.renderPopover();
    });
    header.querySelector('#btnModelNameToModels')?.addEventListener('click', () => {
      this.currentView = 'models';
      this.renderPopover();
    });
    header.querySelector('#btnRefreshModelsHeader')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget as HTMLElement;
      btn.classList.add('spin-animation');
      try {
        const fetched = await fetchAvailableModels();
        if (fetched && fetched.length > 0) {
          registerPromoModels(fetched);
          notificationManager.showToast({
            title: 'Modeller Yenilendi',
            message: `${fetched.length} model güncellendi.`,
            type: 'info',
            durationMs: 3000
          });
        }
      } catch {}
      btn.classList.remove('spin-animation');
      this.renderPopover();
    });

    fragment.appendChild(header);

    // EĞER MODEL THINKING DESTEKLEMİYORSA:
    if (!cap.supportsThinking) {
      const infoCard = document.createElement('div');
      infoCard.style.cssText = 'padding: 12px 14px; margin: 10px 0; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color, #232738); border-radius: 8px; display: flex; align-items: center; gap: 10px;';
      infoCard.innerHTML = `
        <span style="font-size: 20px;">⚡</span>
        <div>
          <div style="font-size: 12px; font-weight: 600; color: var(--text-primary, #ffffff);">Hızlı / Standart Yanıt</div>
          <div style="font-size: 11px; color: var(--text-muted, #8b949e); line-height: 1.4;">${cap.reasoningTitle || 'Bu model doğrudan çıktı üretir (düşünme süreci yoktur).'}</div>
        </div>
      `;
      fragment.appendChild(infoCard);
    } else {
      // THINKING DESTEKLENİYOR
      // 1. Thinking Toggle (Eğer model aç/kapa destekliyorsa)
      if (cap.canToggleThinking) {
        const thinkingRow = document.createElement('div');
        thinkingRow.className = 'model-popover__item';
        thinkingRow.style.cssText = 'margin: 6px 0 8px 0; padding: 6px 8px; border-radius: 6px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color, #232738);';
        thinkingRow.innerHTML = `
          <div class="model-popover__row-left" style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px;">🧠</span>
            <span class="model-popover__row-label" style="font-weight: 500;">Düşünme Modu (Thinking)</span>
          </div>
          <div class="model-popover__row-right">
            <label class="skill-toggle-switch">
              <input type="checkbox" id="chkThinkingMode" ${this.thinkingEnabled ? 'checked' : ''}>
              <span class="skill-toggle-slider"></span>
            </label>
          </div>
        `;
        const checkbox = thinkingRow.querySelector('#chkThinkingMode') as HTMLInputElement;
        checkbox?.addEventListener('change', () => {
          this.thinkingEnabled = checkbox.checked;
          this.saveState();
          this.updateButtonUI();
          if (this.onThinkingChange) this.onThinkingChange(this.thinkingEnabled);
          this.renderPopover();
        });
        fragment.appendChild(thinkingRow);
      }

      // 2. Dynamic Slider
      const isDimmed = cap.canToggleThinking && !this.thinkingEnabled;
      if (levels.length > 1) {
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'effort-slider-box';
        if (isDimmed) {
          sliderContainer.style.opacity = '0.35';
          sliderContainer.style.pointerEvents = 'none';
        }

        const activeRatio = activeLevelIndex / (levels.length - 1);
        const fillCss = `calc(11px + (100% - 22px) * ${activeRatio})`;

        let sparklesHtml = '';
        if (isUltra && !isDimmed) {
          sparklesHtml = `
            <div class="slider-sparkles-layer">
              <span class="slider-sparkle" style="left: 8%; top: 30%; animation-delay: 0s; --sparkle-size: 3px;"></span>
              <span class="slider-sparkle" style="left: 20%; top: 60%; animation-delay: 0.5s; --sparkle-size: 2px;"></span>
              <span class="slider-sparkle" style="left: 34%; top: 25%; animation-delay: 1.1s; --sparkle-size: 3.5px;"></span>
              <span class="slider-sparkle" style="left: 48%; top: 65%; animation-delay: 0.3s; --sparkle-size: 2.5px;"></span>
              <span class="slider-sparkle" style="left: 62%; top: 30%; animation-delay: 1.4s; --sparkle-size: 3px;"></span>
              <span class="slider-sparkle" style="left: 74%; top: 55%; animation-delay: 0.7s; --sparkle-size: 2px;"></span>
              <span class="slider-sparkle" style="left: 86%; top: 25%; animation-delay: 1.2s; --sparkle-size: 4px;"></span>
            </div>
          `;
        }

        let dotsHtml = '';
        levels.forEach((lvl, i) => {
          const dotRatio = i / (levels.length - 1);
          const isPast = i <= activeLevelIndex;
          dotsHtml += `
            <span class="effort-slider-dot ${isPast ? 'effort-slider-dot--active' : ''}" style="left: calc(11px + (100% - 22px) * ${dotRatio});" data-index="${i}" title="${lvl.label}: ${lvl.description}"></span>
          `;
        });

        sliderContainer.innerHTML = `
          <div class="effort-slider-track ${isUltra ? 'effort-slider-track--ultra' : ''}" id="effortSliderTrack">
            <div class="effort-slider-fill" style="width: ${fillCss};"></div>
            ${sparklesHtml}
            <div class="effort-slider-dots">
              ${dotsHtml}
            </div>
            <div class="effort-slider-thumb ${isUltra ? 'effort-slider-thumb--ultra' : ''}" id="effortSliderThumb" style="left: ${fillCss};"></div>
          </div>
          <div class="effort-slider-labels">
            ${levels.map((lvl, i) => `
              <span class="effort-slider-label ${i === activeLevelIndex ? 'effort-slider-label--active' : ''}" data-index="${i}">
                ${lvl.label}
              </span>
            `).join('')}
          </div>
        `;

        const track = sliderContainer.querySelector('#effortSliderTrack') as HTMLElement;
        const fillEl = sliderContainer.querySelector('.effort-slider-fill') as HTMLElement;
        const thumbEl = sliderContainer.querySelector('#effortSliderThumb') as HTMLElement;
        const dotEls = sliderContainer.querySelectorAll('.effort-slider-dot');
        const labelEls = sliderContainer.querySelectorAll('.effort-slider-label');
        const titleBtn = header.querySelector('#btnLevelToModels') as HTMLElement;
        const titleTextSpan = titleBtn?.querySelector('span:first-child');

        let isDragging = false;
        let currentHoverIndex = activeLevelIndex;

        const updateSliderVisuals = (ratio: number, targetIdx: number, animated: boolean) => {
          const clampedRatio = Math.max(0, Math.min(1, ratio));
          const posCss = `calc(11px + (100% - 22px) * ${clampedRatio})`;

          if (animated) {
            thumbEl.style.transition = 'left 0.26s cubic-bezier(0.34, 1.3, 0.64, 1)';
            fillEl.style.transition = 'width 0.26s cubic-bezier(0.34, 1.3, 0.64, 1)';
          } else {
            thumbEl.style.transition = 'none';
            fillEl.style.transition = 'none';
          }

          thumbEl.style.left = posCss;
          fillEl.style.width = posCss;

          dotEls.forEach((dot, idx) => {
            if (idx <= targetIdx) {
              dot.classList.add('effort-slider-dot--active');
            } else {
              dot.classList.remove('effort-slider-dot--active');
            }
          });

          labelEls.forEach((lbl, idx) => {
            if (idx === targetIdx) {
              lbl.classList.add('effort-slider-label--active');
            } else {
              lbl.classList.remove('effort-slider-label--active');
            }
          });

          const lvl = levels[targetIdx];
          if (lvl && titleTextSpan) {
            titleTextSpan.textContent = lvl.label;
          }
          if (titleBtn && lvl) {
            let colClass = 'effort-level-text--medium';
            if (lvl.id === 'max' || lvl.id === '16k') colClass = 'effort-level-text--ultra';
            else if (lvl.id === 'high' || lvl.id === '8k') colClass = 'effort-level-text--high';
            else if (lvl.id === 'low' || lvl.id === '1k' || lvl.id === '2k') colClass = 'effort-level-text--low';
            titleBtn.className = `effort-level-title-btn ${colClass}`;
          }

          if (lvl?.id === 'max' || lvl?.id === '16k') {
            track.classList.add('effort-slider-track--ultra');
            thumbEl.classList.add('effort-slider-thumb--ultra');
          } else {
            track.classList.remove('effort-slider-track--ultra');
            thumbEl.classList.remove('effort-slider-thumb--ultra');
          }
        };

        const commitLevel = (index: number) => {
          const safeIndex = Math.max(0, Math.min(levels.length - 1, index));
          const chosen = levels[safeIndex];
          if (chosen && chosen.id !== this.selectedEffort) {
            this.selectedEffort = chosen.id;
            this.saveState();
            this.updateButtonUI();
            if (this.onEffortChange) this.onEffortChange(chosen.id);
            setTimeout(() => {
              if (!this.popoverEl.classList.contains('model-popover--hidden') && this.currentView === 'main') {
                this.renderPopover();
              }
            }, 220);
          }
        };

        const getRatioFromPointer = (clientX: number): { ratio: number; index: number } => {
          const rect = track.getBoundingClientRect();
          const rawX = clientX - rect.left;
          const usableWidth = Math.max(1, rect.width - 22);
          const ratio = Math.max(0, Math.min(1, (rawX - 11) / usableWidth));
          const index = Math.round(ratio * (levels.length - 1));
          return { ratio, index };
        };

        track.addEventListener('pointerdown', (e) => {
          isDragging = true;
          track.classList.add('effort-slider-track--dragging');
          track.setPointerCapture(e.pointerId);
          const { ratio, index } = getRatioFromPointer(e.clientX);
          currentHoverIndex = index;
          updateSliderVisuals(ratio, index, false);
        });

        track.addEventListener('pointermove', (e) => {
          if (isDragging) {
            const { ratio, index } = getRatioFromPointer(e.clientX);
            currentHoverIndex = index;
            updateSliderVisuals(ratio, index, false);
          }
        });

        const finishPointer = (e: PointerEvent) => {
          if (!isDragging) return;
          isDragging = false;
          track.classList.remove('effort-slider-track--dragging');
          try { track.releasePointerCapture(e.pointerId); } catch {}
          const finalRatio = currentHoverIndex / (levels.length - 1);
          updateSliderVisuals(finalRatio, currentHoverIndex, true);
          commitLevel(currentHoverIndex);
        };

        track.addEventListener('pointerup', finishPointer);
        track.addEventListener('pointercancel', finishPointer);

        sliderContainer.querySelectorAll('.effort-slider-dot, .effort-slider-label').forEach((el) => {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            const idxStr = (el as HTMLElement).dataset.index;
            if (idxStr !== undefined) {
              const idx = parseInt(idxStr, 10);
              currentHoverIndex = idx;
              const ratio = idx / (levels.length - 1);
              updateSliderVisuals(ratio, idx, true);
              commitLevel(idx);
            }
          });
        });

        fragment.appendChild(sliderContainer);

        // Footer info text
        if (activeLevel && !isDimmed) {
          const footer = document.createElement('div');
          footer.className = 'model-popover__footer';
          footer.style.padding = '6px 4px 2px 4px';
          footer.innerHTML = `
            <span class="model-popover__footer-text" style="font-size: 11px; color: var(--text-muted, #8b949e);">
              ${activeLevel.description}
            </span>
          `;
          fragment.appendChild(footer);
        }
      }
    }

    // Diğer Modeller Listesi Satırı
    const modelsRow = document.createElement('div');
    modelsRow.className = 'model-popover__item';
    modelsRow.style.marginTop = '8px';
    modelsRow.innerHTML = `
      <div class="model-popover__row-left">
        <span class="model-popover__row-label">Tüm Modelleri Gör & Değiştir</span>
      </div>
      <div class="model-popover__row-right" style="color: var(--text-muted, #8b949e);">
        <span class="model-popover__row-icon">${iconChevronRight(16)}</span>
      </div>
    `;
    modelsRow.addEventListener('click', () => {
      this.currentView = 'models';
      this.renderPopover();
    });
    fragment.appendChild(modelsRow);

    return fragment;
  }

  private createEffortView(): DocumentFragment {
    return this.createMainView();
  }

  private createModelsView(): DocumentFragment {
    const fragment = document.createDocumentFragment();

    // Back header
    const header = document.createElement('div');
    header.className = 'model-popover__back-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';
    header.style.padding = '4px 0 8px 0';
    header.style.borderBottom = '1px solid var(--border-color, #232738)';
    const models = getAllModels();
    const hasProvider = hasActiveProviderModels();
    const countBadge = hasProvider ? ` (${models.length} Sağlayıcı Modeli)` : '';
    header.innerHTML = `
      <button class="model-popover__back-btn" style="background: transparent; border: none; color: inherit; cursor: pointer; display: flex; align-items: center;">${iconChevronLeft(16)}</button>
      <span class="model-popover__back-title" style="font-weight: 700; font-size: 12px;">Modeller${countBadge}</span>
    `;
    header.querySelector('.model-popover__back-btn')?.addEventListener('click', () => {
      this.currentView = 'main';
      this.renderPopover();
    });
    fragment.appendChild(header);

    // Group models by category (SADECE BaseURL / Promo / Özel API'den dönen aktif modeller listelenir)
    const grouped = models.reduce((acc, model) => {
      const cat = model.categoryLabel || model.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(model);
      return acc;
    }, {} as Record<string, ModelInfo[]>);

    const listContainer = document.createElement('div');
    listContainer.style.maxHeight = '320px';
    listContainer.style.overflowY = 'auto';

    for (const [category, categoryModels] of Object.entries(grouped)) {
      const catHeader = document.createElement('div');
      catHeader.className = 'model-popover__category-title';
      catHeader.textContent = category;
      listContainer.appendChild(catHeader);

      categoryModels.forEach(model => {
        const row = document.createElement('div');
        const isActive = this.selectedModelId === model.id;
        row.className = `model-popover__item ${isActive ? 'model-popover__item--active' : ''}`;

        const multClass = getMultiplierClass(model.multiplier);
        row.innerHTML = `
          <div class="model-popover__model-left" style="display: flex; align-items: center; gap: 8px;">
            <span class="model-popover__model-name">${model.name}</span>
            <span class="model-mult-badge ${multClass}">${model.multiplier}x</span>
            ${model.contextLimit ? `<span style="font-size: 9px; color: var(--text-muted); font-family: var(--font-mono);">${formatContextLimit(model.contextLimit)}</span>` : ''}
          </div>
          <div class="model-popover__model-right">
            ${isActive ? iconCheck(16, 'var(--accent-color, #00f0ff)') : ''}
          </div>
        `;

        row.addEventListener('click', () => {
          this.requestModelChange(model.id);
        });

        listContainer.appendChild(row);
      });
    }

    fragment.appendChild(listContainer);

    // Sağlayıcıdan Modelleri Yenile Butonu (BaseURL / Promo)
    const fetchPromoBtn = document.createElement('div');
    fetchPromoBtn.className = 'model-popover__item';
    fetchPromoBtn.style.marginTop = '6px';
    fetchPromoBtn.style.borderTop = '1px solid var(--border-color, #232738)';
    fetchPromoBtn.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: #00E676;">
        <span>${iconRefresh(14)}</span>
        <span class="fetch-promo-label">Modelleri Yenile (BaseURL / Promo)</span>
      </div>
    `;
    fetchPromoBtn.addEventListener('click', async () => {
      const label = fetchPromoBtn.querySelector('.fetch-promo-label') as HTMLElement;
      if (label) label.textContent = 'Modeller Alınıyor...';
      fetchPromoBtn.style.opacity = '0.5';
      fetchPromoBtn.style.pointerEvents = 'none';

      try {
        let savedBaseUrl: string | undefined;
        let savedApiKey: string | undefined;
        try {
          const saved = localStorage.getItem('kraga-ide-settings');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.mode === 'custom') {
              savedBaseUrl = parsed.baseUrl;
              savedApiKey = parsed.apiKey;
            }
          }
        } catch {}

        const fetched = await fetchAvailableModels({
          customBaseUrl: savedBaseUrl,
          customApiKey: savedApiKey,
        });

        if (fetched && fetched.length > 0) {
          const registered = registerPromoModels(fetched);
          const cheapest = getCheapestModel(registered);
          const cleanSelected = foldEffortSuffix(this.selectedModelId || '');
          const currentValid = registered.some(m => m.id.toLowerCase() === cleanSelected.toLowerCase());
          if (currentValid) {
            if (this.selectedModelId !== cleanSelected) {
              this.selectedModelId = cleanSelected;
              this.saveState();
              this.updateButtonUI();
              if (this.onModelChange) this.onModelChange(cleanSelected);
            }
          } else if (cheapest) {
            this.selectedModelId = cheapest.id;
            this.saveState();
            this.updateButtonUI();
            if (this.onModelChange) this.onModelChange(cheapest.id);
            localStorage.removeItem('kraga:user-locked-model');
          }

          const cheapestTxt = cheapest ? `${cheapest.name} (${cheapest.multiplier}x)` : `${fetched.length} Model`;
          if (label) label.textContent = `✓ ${fetched.length} Model Yüklendi! En Ucuz: ${cheapestTxt}`;
          notificationManager.showToast({
            title: 'Modeller Güncellendi',
            message: `${fetched.length} model başarıyla yüklendi.`,
            type: 'success'
          });
          setTimeout(() => {
            this.currentView = 'models';
            this.renderPopover();
          }, 800);
        } else {
          if (label) label.textContent = 'Sağlayıcıda model bulunamadı';
          notificationManager.showToast({
            title: 'Model Bulunamadı',
            message: 'Sağlayıcıdan model listesi alınamadı.',
            type: 'warning'
          });
          setTimeout(() => {
            fetchPromoBtn.style.opacity = '1';
            fetchPromoBtn.style.pointerEvents = 'auto';
            if (label) label.textContent = 'Modelleri Yenile (BaseURL / Promo)';
          }, 1800);
        }
      } catch (err: any) {
        if (label) label.textContent = 'Bağlantı Hatası';
        notificationManager.showToast({
          title: 'Model Yenileme Hatası',
          message: err?.message || 'Bağlantı sağlanamadı.',
          type: 'error'
        });
        setTimeout(() => {
          fetchPromoBtn.style.opacity = '1';
          fetchPromoBtn.style.pointerEvents = 'auto';
          if (label) label.textContent = 'Modelleri Yenile (BaseURL / Promo)';
        }, 1800);
      }
    });
    fragment.appendChild(fetchPromoBtn);

    // Custom Model Button
    const customBtn = document.createElement('div');
    customBtn.className = 'model-popover__item';
    customBtn.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; color: var(--accent-color, #00f0ff);">
        <span>${iconPlus(14)}</span>
        <span>+ Özel Model Gir</span>
      </div>
    `;
    customBtn.addEventListener('click', () => {
      this.showCustomModelModal();
    });
    fragment.appendChild(customBtn);

    return fragment;
  }

  public showCustomModelModal(onDone?: (modelId: string) => void): void {
    this.closePopover();
    document.querySelector('.kraga-switch-model-backdrop')?.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'kraga-switch-model-backdrop';
    backdrop.innerHTML = `
      <div class="kraga-switch-model-modal" role="dialog" aria-modal="true" style="max-width: 480px;">
        <div class="kraga-switch-model-title" style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--accent-color, #00f0ff);">${iconSparkles(18)}</span>
          <span>Özel Model Tanımla & Seç</span>
        </div>
        <div class="kraga-switch-model-desc" style="margin-bottom: 12px;">
          Kullandığınız API sağlayıcısının veya yerel modelin desteklediği kimliği (Model ID) girin veya aşağıdaki hızlı önerilere tıklayın.
        </div>

        <div style="margin-bottom: 14px;">
          <div style="font-size: 11px; color: var(--text-muted, #8b949e); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">
            Hızlı Seçim Önerileri
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;" id="customModelChips">
            <button type="button" class="custom-model-chip" data-id="claude-3-7-sonnet">claude-3-7-sonnet</button>
            <button type="button" class="custom-model-chip" data-id="claude-3-5-sonnet">claude-3-5-sonnet</button>
            <button type="button" class="custom-model-chip" data-id="claude-opus-4-6-thinking">claude-opus-4-6-thinking</button>
            <button type="button" class="custom-model-chip" data-id="claude-sonnet-4-6">claude-sonnet-4-6</button>
            <button type="button" class="custom-model-chip" data-id="gpt-4o">gpt-4o</button>
            <button type="button" class="custom-model-chip" data-id="o3-mini">o3-mini</button>
            <button type="button" class="custom-model-chip" data-id="deepseek-chat">deepseek-chat</button>
            <button type="button" class="custom-model-chip" data-id="deepseek-reasoner">deepseek-reasoner</button>
            <button type="button" class="custom-model-chip" data-id="qwen-2.5-coder-32b">qwen-2.5-coder-32b</button>
          </div>
        </div>

        <div style="margin-bottom: 18px;">
          <label style="display: block; font-size: 12px; font-weight: 600; color: #c9d1d9; margin-bottom: 6px;">
            Model Kimliği (Model ID)
          </label>
          <input
            type="text"
            id="customModelInput"
            class="settings-input"
            placeholder="örn: claude-3-7-sonnet, deepseek-chat, mistral-large"
            style="width: 100%; box-sizing: border-box; padding: 9px 12px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; font-family: var(--font-mono, monospace); font-size: 13px; outline: none;"
          />
        </div>

        <div class="kraga-switch-model-actions">
          <button type="button" class="kraga-btn-switch-cancel" id="btnCancelCustomModel">İptal</button>
          <button type="button" class="kraga-btn-switch-confirm" id="btnConfirmCustomModel" style="background: var(--accent-color, #00f0ff); border-color: var(--accent-color, #00f0ff); color: #000;">
            Modeli Ekle & Seç
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const input = backdrop.querySelector('#customModelInput') as HTMLInputElement;
    const btnCancel = backdrop.querySelector('#btnCancelCustomModel') as HTMLButtonElement;
    const btnConfirm = backdrop.querySelector('#btnConfirmCustomModel') as HTMLButtonElement;
    const chips = backdrop.querySelectorAll('.custom-model-chip');

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const id = (chip as HTMLElement).dataset.id;
        if (id && input) {
          input.value = id;
          input.focus();
        }
      });
    });

    const closeModal = () => {
      backdrop.remove();
    };

    btnCancel.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    const doSubmit = () => {
      const val = input?.value.trim();
      if (!val) {
        input?.focus();
        return;
      }
      closeModal();
      const added = registerCustomModel(val);
      this.requestModelChange(added.id);
      notificationManager.showToast({
        title: 'Özel Model Seçildi',
        message: `${added.name} (${added.id}) başarıyla aktif edildi.`,
        type: 'success'
      });
      if (onDone) onDone(added.id);
    };

    btnConfirm.addEventListener('click', doSubmit);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        doSubmit();
      }
    });

    const escListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        window.removeEventListener('keydown', escListener);
      }
    };
    window.addEventListener('keydown', escListener);

    setTimeout(() => {
      input?.focus();
    }, 50);
  }

  private requestModelChange(targetModelId: string): void {
    if (targetModelId === this.selectedModelId) {
      this.currentView = 'main';
      this.renderPopover();
      return;
    }

    const dontAsk = localStorage.getItem('kraga:dont-ask-switch-model') === 'true';
    const hasMessages = this.hasActiveMessages ? this.hasActiveMessages() : (TokenTracker.getInstance().getState().currentContextUsed > 0);

    if (!dontAsk && hasMessages) {
      const oldModelObj = getModelById(this.selectedModelId);
      const newModelObj = getModelById(targetModelId);
      const oldName = oldModelObj ? oldModelObj.name : this.selectedModelId;
      const newName = newModelObj ? newModelObj.name : targetModelId;

      this.showSwitchModelModal(oldName, newName, () => {
        this.applyModelChange(targetModelId);
      });
      return;
    }

    this.applyModelChange(targetModelId);
  }

  private applyModelChange(modelId: string): void {
    this.selectedModelId = modelId;
    localStorage.setItem('kraga:user-locked-model', 'true');
    this.saveState();
    this.updateButtonUI();
    if (this.onModelChange) this.onModelChange(modelId);
    window.dispatchEvent(new CustomEvent('kraga:default-model-changed', { detail: { modelId } }));
    this.currentView = 'main';
    this.renderPopover();
  }

  private showSwitchModelModal(oldModelName: string, newModelName: string, onConfirm: () => void): void {
    this.closePopover();
    // Varsa eski açık modalı kaldır
    document.querySelector('.kraga-switch-model-backdrop')?.remove();

    const backdrop = document.createElement('div');
    backdrop.className = 'kraga-switch-model-backdrop';
    backdrop.innerHTML = `
      <div class="kraga-switch-model-modal" role="dialog" aria-modal="true">
        <div class="kraga-switch-model-title">Switch model?</div>
        <div class="kraga-switch-model-desc">
          This session is cached for <strong>${oldModelName}</strong>. Switching to <strong>${newModelName}</strong> means Open Crow AI re-reads the whole session on your next message, which uses more of your limit.
          <br><br>
          <span style="font-size: 12px; color: var(--text-muted, #8b949e);">
            (Bu oturum <strong>${oldModelName}</strong> için önbelleğe alındı. <strong>${newModelName}</strong> modeline geçmek, bir sonraki mesajda oturumun tamamının baştan okunmasına ve kotanızın harcanmasına neden olabilir.)
          </span>
        </div>
        <label class="kraga-switch-model-checkbox-label">
          <input type="checkbox" id="dontAskSwitchCheckbox" class="kraga-switch-model-checkbox" />
          <span>Don't ask again (Bir daha sorma)</span>
        </label>
        <div class="kraga-switch-model-actions">
          <button type="button" class="kraga-btn-switch-cancel" id="btnCancelSwitch">Cancel</button>
          <button type="button" class="kraga-btn-switch-confirm" id="btnConfirmSwitch">Switch model</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const chk = backdrop.querySelector('#dontAskSwitchCheckbox') as HTMLInputElement;
    const btnCancel = backdrop.querySelector('#btnCancelSwitch') as HTMLButtonElement;
    const btnConfirm = backdrop.querySelector('#btnConfirmSwitch') as HTMLButtonElement;

    const closeModal = () => {
      backdrop.remove();
    };

    btnCancel.addEventListener('click', () => {
      closeModal();
    });

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal();
      }
    });

    btnConfirm.addEventListener('click', () => {
      if (chk && chk.checked) {
        localStorage.setItem('kraga:dont-ask-switch-model', 'true');
      }
      closeModal();
      onConfirm();
    });

    const escListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escListener);
      }
    };
    document.addEventListener('keydown', escListener);
  }
}
