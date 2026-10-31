import { iconGitBranch, iconAlertCircle, iconAlertTriangle, kragaBirdImg } from './icons';

export class StatusBarManager {
  private container: HTMLElement;
  private leftGroup: HTMLElement;
  private rightGroup: HTMLElement;

  private elements = {
    zoom: document.createElement('div'),
    problems: document.createElement('div'),
    branch: document.createElement('div'),
    cursor: document.createElement('div'),
    indentation: document.createElement('div'),
    eol: document.createElement('div'),
    encoding: document.createElement('div'),
    language: document.createElement('div'),
    aiStatus: document.createElement('div'),
  };

  private currentZoom: number = 100;
  private lastCursorPos: string = 'Sat: 1, Krkt: 1';

  public onErrorClick?: () => void;
  public onZoomChange?: (zoom: number) => void;
  public onEolToggle?: (currentEol: string) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.classList.add('status-bar');

    this.leftGroup = document.createElement('div');
    this.leftGroup.classList.add('status-bar__left');

    this.rightGroup = document.createElement('div');
    this.rightGroup.classList.add('status-bar__right');

    this.container.appendChild(this.leftGroup);
    this.container.appendChild(this.rightGroup);

    this.initializeElements();
  }

  private initializeElements(): void {
    // 1. Sol taraf (Left Group) - Visual Studio 2022 Formatı

    // Yakınlaştırma (Zoom) Dropdown Seçicisi: 100% ▾ / 177% ▾
    this.setupItem(this.elements.zoom, this.leftGroup, true);
    this.setZoom(100);
    this.initZoomDropdown();

    // Sorun / Hata Göstergesi: ✓ Sorun bulunamadı veya ❌ 1 Hata
    this.setupItem(this.elements.problems, this.leftGroup, true);
    this.setErrors(0, 0);
    this.elements.problems.addEventListener('click', () => this.onErrorClick?.());

    // Git Branch
    this.setupItem(this.elements.branch, this.leftGroup, true);
    this.setBranch('main');

    // 2. Sağ taraf (Right Group) - Visual Studio Formatı

    // Satır ve Karakter Konumu: Sat: 97, Krkt: 24
    this.setupItem(this.elements.cursor, this.rightGroup, true);
    this.setCursorPosition(1, 1);

    // Boşluk Modu: BŞL (Visual Studio kısaltması)
    this.setupItem(this.elements.indentation, this.rightGroup, true);
    this.setIndentation('spaces', 2);

    // Satır Sonu: LF / CRLF
    this.setupItem(this.elements.eol, this.rightGroup, true);
    this.setEol('LF');
    this.elements.eol.addEventListener('click', () => {
      const current = this.elements.eol.textContent || 'LF';
      const next = current === 'LF' ? 'CRLF' : 'LF';
      this.setEol(next);
      this.onEolToggle?.(next);
    });

    // Kodlama: UTF-8
    this.setupItem(this.elements.encoding, this.rightGroup, true);
    this.setEncoding('UTF-8');

    // Dil: C# / TypeScript vb.
    this.setupItem(this.elements.language, this.rightGroup, true);
    this.setLanguage('TypeScript');

    // AI Bağlantı Durumu
    this.setupItem(this.elements.aiStatus, this.rightGroup, true);
    this.setAIStatus(false);

    // Canlı Ajan Aktivite Dinleyicisi (Reading, Analyzing, Writing vb.)
    window.addEventListener('kraga:agent-activity', (e: any) => {
      const text = e.detail?.text;
      this.setAIActivity(text);
    });
  }

  private setupItem(element: HTMLElement, parent: HTMLElement, clickable: boolean = false): void {
    element.classList.add('status-bar__item');
    if (clickable) {
      element.classList.add('status-bar__item--clickable');
    }
    parent.appendChild(element);
  }

  private initZoomDropdown(): void {
    this.elements.zoom.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showZoomMenu();
    });
  }

  private showZoomMenu(): void {
    const existing = document.querySelector('.vs-zoom-popover-menu');
    if (existing) {
      existing.remove();
      return;
    }

    const zoomOptions = [400, 300, 200, 177, 150, 125, 100, 75, 50];
    const popover = document.createElement('div');
    popover.className = 'vs-zoom-popover-menu';
    popover.style.bottom = '26px';
    popover.style.left = `${this.elements.zoom.getBoundingClientRect().left}px`;

    popover.innerHTML = `
      <div class="vs-zoom-title">Yakınlaştırma</div>
      <div class="vs-zoom-options">
        ${zoomOptions.map(z => `
          <button type="button" class="vs-zoom-opt ${z === this.currentZoom ? 'active' : ''}" data-zoom="${z}">
            ${z === this.currentZoom ? '✓ ' : ''}${z}%
          </button>
        `).join('')}
      </div>
    `;

    document.body.appendChild(popover);

    const closeHandler = (ev: MouseEvent) => {
      if (!popover.contains(ev.target as Node)) {
        popover.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);

    popover.querySelectorAll('.vs-zoom-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt((btn as HTMLElement).dataset.zoom || '100', 10);
        this.setZoom(val);
        this.onZoomChange?.(val);
        popover.remove();
      });
    });
  }

  public setZoom(percentage: number): void {
    this.currentZoom = percentage;
    this.elements.zoom.innerHTML = `<span class="vs-zoom-text">${percentage}%</span> <span class="vs-zoom-arrow">▾</span>`;
    this.elements.zoom.title = `Yakınlaştırma Seviyesi: ${percentage}% (Değiştirmek için tıkla)`;
  }

  public setCursorPosition(line: number, col: number): void {
    this.lastCursorPos = `Sat: ${line}, Krkt: ${col}`;
    this.elements.cursor.textContent = this.lastCursorPos;
  }

  public setSelectionStats(text: string | null): void {
    if (text) {
      this.elements.cursor.textContent = `${this.lastCursorPos} (${text})`;
    } else {
      this.elements.cursor.textContent = this.lastCursorPos;
    }
  }

  public setLanguage(lang: string): void {
    this.elements.language.textContent = lang;
  }

  public setBranch(name: string): void {
    this.elements.branch.innerHTML = `${iconGitBranch(13)} <span>${name}</span>`;
  }

  /**
   * Visual Studio Tarzı Teşhis / Hata Göstergesi
   */
  public setErrors(errors: number, warnings: number): void {
    this.elements.problems.className = 'status-bar__item status-bar__item--clickable';

    if (errors === 0 && warnings === 0) {
      this.elements.problems.classList.add('status-bar__item--clean');
      this.elements.problems.innerHTML = `
        <span class="vs-problems-clean-icon">✓</span>
        <span>Sorun bulunamadı</span>
      `;
      this.elements.problems.title = 'Sözdizimi ve kod yapısı temiz (Hata Listesini açmak için tıkla)';
      return;
    }

    if (errors > 0) {
      this.elements.problems.classList.add('status-bar__item--error');
    } else if (warnings > 0) {
      this.elements.problems.classList.add('status-bar__item--warning');
    }

    let text = '';
    if (errors > 0 && warnings > 0) {
      text = `${errors} Hata, ${warnings} Uyarı`;
    } else if (errors > 0) {
      text = `${errors} Hata`;
    } else {
      text = `${warnings} Uyarı`;
    }

    const iconHtml = errors > 0 ? iconAlertCircle(13) : iconAlertTriangle(13);
    this.elements.problems.innerHTML = `${iconHtml} <span>${text}</span>`;
    this.elements.problems.title = `${text} (Hata Listesinde görmek ve gitmek için tıkla)`;
  }

  public setAIStatus(connected: boolean): void {
    const text = connected ? 'Bağlı' : 'Bağlantı Yok';
    if (connected) {
      this.elements.aiStatus.classList.add('status-bar__item--success');
    } else {
      this.elements.aiStatus.classList.remove('status-bar__item--success');
    }
    this.elements.aiStatus.innerHTML = `${kragaBirdImg(14)} <span>${text}</span>`;
  }

  public setAIActivity(activityText?: string): void {
    if (!activityText || activityText === 'Hazır' || activityText === 'Tamamlandı') {
      this.elements.aiStatus.className = 'status-bar__item status-bar__item--clickable status-bar__item--success';
      this.elements.aiStatus.innerHTML = `${kragaBirdImg(14)} <span>Hazır</span>`;
      this.elements.aiStatus.title = 'Kraga AI Asistanı Hazır';
    } else {
      this.elements.aiStatus.className = 'status-bar__item status-bar__item--clickable status-bar__item--running';
      this.elements.aiStatus.innerHTML = `${kragaBirdImg(14)} <span class="status-bar-ai-pulse"></span> <span class="status-bar-ai-text">${activityText}</span>`;
      this.elements.aiStatus.title = `Kraga AI: ${activityText}`;
    }
  }

  public setIndentation(type: 'spaces' | 'tabs', size: number): void {
    // Visual Studio tarzı kısa etiket: BŞL (Boşluk) veya SEK (Sekme)
    const label = type === 'spaces' ? 'BŞL' : 'SEK';
    this.elements.indentation.textContent = `${label}: ${size}`;
    this.elements.indentation.title = `Girinti Modu: ${type === 'spaces' ? 'Boşluk' : 'Sekme'} (${size})`;
  }

  public setEol(eol: string): void {
    this.elements.eol.textContent = eol;
    this.elements.eol.title = `Satır Sonu Biçimi: ${eol} (Değiştirmek için tıkla)`;
  }

  public setEncoding(encoding: string): void {
    this.elements.encoding.textContent = encoding;
  }
}
