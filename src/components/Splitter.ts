// src/components/Splitter.ts
// Kraga IDE — Akıcı Panel Ayırıcı ve Responsive Boyutlandırıcı (Center Fluid Architecture)

export interface SplitterOptions {
  direction: 'horizontal' | 'vertical';
  element: HTMLElement;
  prevPanel: HTMLElement;
  nextPanel: HTMLElement;
  minSize?: number;
  storageKey?: string;
  onResize?: (prevSize: number, nextSize: number) => void;
}

export class SplitterManager {
  private splitters: Map<HTMLElement, SplitterOptions> = new Map();

  constructor() {
    window.addEventListener('resize', () => this.handleWindowResize());
  }

  public createSplitter(options: SplitterOptions): void {
    const minSize = options.minSize ?? 100;
    options.minSize = minSize;

    this.splitters.set(options.element, options);

    options.element.classList.add('splitter');
    options.element.classList.add(`splitter--${options.direction}`);

    let isDragging = false;
    let startPos = 0;
    let startPrevSize = 0;
    let startNextSize = 0;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      isDragging = true;
      options.element.classList.add('splitter--active');
      options.element.setPointerCapture(e.pointerId);

      startPos = options.direction === 'horizontal' ? e.clientX : e.clientY;

      const prevRect = options.prevPanel.getBoundingClientRect();
      const nextRect = options.nextPanel.getBoundingClientRect();

      startPrevSize = options.direction === 'horizontal' ? prevRect.width : prevRect.height;
      startNextSize = options.direction === 'horizontal' ? nextRect.width : nextRect.height;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      const currentPos = options.direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPos;

      let newPrevSize = startPrevSize + delta;
      let newNextSize = startNextSize - delta;

      const windowWidth = window.innerWidth;

      if (options.direction === 'horizontal') {
        // Sol kenar çubuğu (Sidebar)
        if (options.prevPanel.id === 'sidebarContainer') {
          const maxSidebar = Math.min(420, Math.floor(windowWidth * 0.4));
          newPrevSize = Math.max(minSize, Math.min(maxSidebar, newPrevSize));
        }
        // Sağ panel (Agent Panel)
        else if (options.nextPanel.id === 'agentPanel') {
          const maxAgent = Math.min(750, Math.floor(windowWidth * 0.6));
          newNextSize = Math.max(minSize, Math.min(maxAgent, newNextSize));
        }
      } else {
        // Dikey (Terminal)
        const windowHeight = window.innerHeight;
        const maxBottom = Math.min(600, Math.floor(windowHeight * 0.65));
        newNextSize = Math.max(minSize, Math.min(maxBottom, newNextSize));
      }

      this.applySizes(options, newPrevSize, newNextSize);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      options.element.classList.remove('splitter--active');
      options.element.releasePointerCapture(e.pointerId);

      const prevRect = options.prevPanel.getBoundingClientRect();
      const nextRect = options.nextPanel.getBoundingClientRect();
      const finalPrev = options.direction === 'horizontal' ? prevRect.width : prevRect.height;
      const finalNext = options.direction === 'horizontal' ? nextRect.width : nextRect.height;

      if (options.storageKey) {
        if (options.prevPanel.id === 'sidebarContainer') {
          localStorage.setItem(`${options.storageKey}_sidebar`, finalPrev.toString());
        } else if (options.nextPanel.id === 'agentPanel') {
          localStorage.setItem(`${options.storageKey}_agent`, finalNext.toString());
        } else if (options.direction === 'vertical') {
          localStorage.setItem(`${options.storageKey}_bottom`, finalNext.toString());
        }
      }

      if (options.onResize) {
        options.onResize(finalPrev, finalNext);
      }
    };

    const onDoubleClick = () => {
      if (options.direction === 'horizontal') {
        if (options.prevPanel.id === 'sidebarContainer') {
          options.prevPanel.style.width = '240px';
          options.prevPanel.style.flex = '0 0 240px';
        }
        if (options.nextPanel.id === 'agentPanel') {
          options.nextPanel.style.width = '460px';
          options.nextPanel.style.flex = '0 0 460px';
        }
      } else {
        options.nextPanel.style.height = '200px';
        options.nextPanel.style.flex = '0 0 200px';
      }

      const center = document.getElementById('centerPanel');
      if (center) {
        center.style.flex = '1 1 0';
        center.style.minWidth = '0';
        center.style.width = 'auto';
      }

      if (options.storageKey) {
        localStorage.removeItem(`${options.storageKey}_sidebar`);
        localStorage.removeItem(`${options.storageKey}_agent`);
        localStorage.removeItem(`${options.storageKey}_bottom`);
      }
    };

    options.element.addEventListener('pointerdown', onPointerDown);
    options.element.addEventListener('pointermove', onPointerMove);
    options.element.addEventListener('pointerup', onPointerUp);
    options.element.addEventListener('pointercancel', onPointerUp);
    options.element.addEventListener('dblclick', onDoubleClick);
  }

  private applySizes(options: SplitterOptions, prevSize: number, nextSize: number): void {
    if (options.direction === 'horizontal') {
      // 1. Sidebar Splitter (sidebar vs centerPanel)
      if (options.prevPanel.id === 'sidebarContainer') {
        options.prevPanel.style.width = `${prevSize}px`;
        options.prevPanel.style.flex = `0 0 ${prevSize}px`;

        // Orta panel her zaman akıcı (fluid) kalır!
        options.nextPanel.style.width = 'auto';
        options.nextPanel.style.flex = '1 1 0';
        options.nextPanel.style.minWidth = '0';
      }
      // 2. Agent Splitter (centerPanel vs agentPanel)
      else if (options.nextPanel.id === 'agentPanel') {
        // Orta panel her zaman akıcı (fluid) kalır!
        options.prevPanel.style.width = 'auto';
        options.prevPanel.style.flex = '1 1 0';
        options.prevPanel.style.minWidth = '0';

        options.nextPanel.style.width = `${nextSize}px`;
        options.nextPanel.style.flex = `0 0 ${nextSize}px`;
      } else {
        options.prevPanel.style.width = `${prevSize}px`;
        options.prevPanel.style.flex = `0 0 ${prevSize}px`;
        options.nextPanel.style.width = `${nextSize}px`;
        options.nextPanel.style.flex = `0 0 ${nextSize}px`;
      }
    } else {
      // Dikey splitter (Editör Viewport vs Terminal Bottom Panel)
      options.prevPanel.style.height = 'auto';
      options.prevPanel.style.flex = '1 1 0';
      options.prevPanel.style.minHeight = '0';

      options.nextPanel.style.height = `${nextSize}px`;
      options.nextPanel.style.flex = `0 0 ${nextSize}px`;
    }
  }

  public restoreAll(): void {
    for (const options of this.splitters.values()) {
      if (options.storageKey) {
        if (options.prevPanel.id === 'sidebarContainer') {
          const sVal = localStorage.getItem(`${options.storageKey}_sidebar`) || localStorage.getItem(`${options.storageKey}_prev`);
          if (sVal) {
            const sz = Math.min(360, Math.max(160, parseFloat(sVal)));
            this.applySizes(options, sz, 0);
          }
        } else if (options.nextPanel.id === 'agentPanel') {
          const aVal = localStorage.getItem(`${options.storageKey}_agent`) || localStorage.getItem(`${options.storageKey}_next`);
          if (aVal) {
            const sz = Math.min(700, Math.max(280, parseFloat(aVal)));
            this.applySizes(options, 0, sz);
          }
        } else if (options.direction === 'vertical') {
          const bVal = localStorage.getItem(`${options.storageKey}_bottom`) || localStorage.getItem(`${options.storageKey}_next`);
          if (bVal) {
            const sz = Math.min(500, Math.max(100, parseFloat(bVal)));
            this.applySizes(options, 0, sz);
          }
        }
      }
    }

    this.handleWindowResize();
  }

  public handleWindowResize(): void {
    const windowWidth = window.innerWidth;
    const sidebar = document.getElementById('sidebarContainer');
    const agent = document.getElementById('agentPanel');
    const center = document.getElementById('centerPanel');

    if (center) {
      center.style.flex = '1 1 0';
      center.style.minWidth = '0';
      center.style.width = 'auto';
    }

    if (!sidebar || !agent) return;

    // Pencere daraldığında yan panellerin ekranı kaplamasını engelle
    // Orta panel için her zaman minimum 300px pay ayrılır
    const availableWidth = windowWidth - 48 - 8; // Activity bar (48px) + splitters (8px)
    const maxSidebarWidth = Math.max(160, Math.min(300, Math.floor(availableWidth * 0.28)));
    const maxAgentWidth = Math.max(280, Math.min(680, Math.floor(availableWidth * 0.48)));

    const currentSidebar = sidebar.getBoundingClientRect().width;
    const currentAgent = agent.getBoundingClientRect().width;

    if (currentSidebar > maxSidebarWidth) {
      sidebar.style.width = `${maxSidebarWidth}px`;
      sidebar.style.flex = `0 0 ${maxSidebarWidth}px`;
    }

    if (currentAgent > maxAgentWidth) {
      agent.style.width = `${maxAgentWidth}px`;
      agent.style.flex = `0 0 ${maxAgentWidth}px`;
    }
  }

  public collapse(panel: HTMLElement): void {
    panel.dataset.originalDisplay = panel.style.display || getComputedStyle(panel).display;
    panel.style.display = 'none';
  }

  public expand(panel: HTMLElement): void {
    panel.style.display = panel.dataset.originalDisplay || '';
  }
}
