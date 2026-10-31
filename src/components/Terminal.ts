// src/components/Terminal.ts
// Open Crow v2.0 Çoklu Terminal ve Tema Uyumlu xterm.js Yöneticisi

import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { iconPlus, iconClose, iconTerminal } from './icons';

interface TerminalInstance {
  id: string;
  name: string;
  term: Terminal;
  fitAddon: FitAddon;
  element: HTMLElement;
}

export class TerminalManager {
  private container: HTMLElement;
  private tabsContainer: HTMLElement | null = null;
  private contentContainer: HTMLElement | null = null;
  private instances: TerminalInstance[] = [];
  private activeInstance: TerminalInstance | null = null;
  private unsubscribeData: (() => void) | null = null;
  private currentCwd: string = '';
  private currentThemeId: string = 'original-dark';

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.initLayout();
  }

  private initLayout(): void {
    this.container.innerHTML = `
      <div class="terminal-workbench">
        <div class="terminal-tabs-bar">
          <div class="terminal-tabs-list" id="termTabsList"></div>
          <button class="terminal-btn-add" id="btnNewTerminal" title="Yeni Terminal">
            ${iconPlus(14)}
          </button>
        </div>
        <div class="terminal-viewport-container" id="termViewportContainer"></div>
      </div>
    `;

    this.tabsContainer = this.container.querySelector('#termTabsList');
    this.contentContainer = this.container.querySelector('#termViewportContainer');

    this.container.querySelector('#btnNewTerminal')?.addEventListener('click', () => {
      this.createTerminalSession();
    });

    // Global IPC dinleyici
    this.unsubscribeData = window.kragaAPI.terminal.onData(({ sessionId, data }) => {
      const inst = this.instances.find(i => i.id === sessionId);
      if (inst) {
        inst.term.write(data);
      }
    });

    window.addEventListener('resize', () => {
      this.activeInstance?.fitAddon.fit();
    });

    if (typeof ResizeObserver !== 'undefined' && this.contentContainer) {
      const ro = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          this.activeInstance?.fitAddon.fit();
        });
      });
      ro.observe(this.contentContainer);
    }
  }

  public async startSession(cwd?: string): Promise<void> {
    this.currentCwd = cwd || '';
    if (this.instances.length === 0) {
      await this.createTerminalSession(cwd);
    }
  }

  public async createTerminalSession(cwd?: string): Promise<void> {
    const id = `term-${Date.now()}`;
    const name = `PowerShell ${this.instances.length + 1}`;
    const workingDir = cwd || this.currentCwd;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "'JetBrains Mono', Consolas, monospace",
      theme: this.getThemeColors(this.currentThemeId),
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    const termWrapper = document.createElement('div');
    termWrapper.className = 'terminal-instance-wrapper';
    termWrapper.style.width = '100%';
    termWrapper.style.height = '100%';
    termWrapper.style.display = 'none';
    this.contentContainer?.appendChild(termWrapper);

    term.open(termWrapper);

    term.onData((data) => {
      window.kragaAPI.terminal.writeSession(id, data);
    });

    const instance: TerminalInstance = {
      id,
      name,
      term,
      fitAddon,
      element: termWrapper
    };

    this.instances.push(instance);
    this.renderTabs();
    this.switchTerminal(instance);

    term.writeln('\x1b[36mOpen Crow Terminal Hazır\x1b[0m\r\n');
    await window.kragaAPI.terminal.createSession(id, workingDir);
    setTimeout(() => fitAddon.fit(), 50);
    setTimeout(() => fitAddon.fit(), 200);
  }

  public switchTerminal(inst: TerminalInstance): void {
    this.activeInstance = inst;

    for (const item of this.instances) {
      item.element.style.display = item.id === inst.id ? 'block' : 'none';
    }

    this.renderTabs();
    setTimeout(() => {
      inst.fitAddon.fit();
      inst.term.focus();
    }, 50);
    setTimeout(() => inst.fitAddon.fit(), 200);
  }

  public closeTerminal(inst: TerminalInstance): void {
    const idx = this.instances.indexOf(inst);
    if (idx === -1) return;

    window.kragaAPI.terminal.killSession(inst.id);
    inst.term.dispose();
    inst.element.remove();
    this.instances.splice(idx, 1);

    if (this.activeInstance === inst) {
      const next = this.instances[idx] || this.instances[idx - 1] || null;
      if (next) {
        this.switchTerminal(next);
      } else {
        this.activeInstance = null;
      }
    }

    this.renderTabs();
  }

  private renderTabs(): void {
    if (!this.tabsContainer) return;
    this.tabsContainer.innerHTML = '';

    for (const inst of this.instances) {
      const tabEl = document.createElement('div');
      tabEl.className = `terminal-tab ${this.activeInstance === inst ? 'terminal-tab--active' : ''}`;
      tabEl.innerHTML = `
        <span class="terminal-tab__icon">${iconTerminal(12)}</span>
        <span class="terminal-tab__title">${inst.name}</span>
        <button class="terminal-tab__close" title="Terminali Kapat">
          ${iconClose(10)}
        </button>
      `;

      tabEl.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.terminal-tab__close')) {
          e.stopPropagation();
          this.closeTerminal(inst);
        } else {
          this.switchTerminal(inst);
        }
      });

      this.tabsContainer.appendChild(tabEl);
    }
  }

  public setTheme(themeId: string): void {
    this.currentThemeId = themeId;
    const colors = this.getThemeColors(themeId);
    for (const inst of this.instances) {
      inst.term.options.theme = colors;
    }
  }

  private getThemeColors(themeId: string) {
    const themes: Record<string, any> = {
      'kraga-cyberpunk': {
        background: '#07070e',
        foreground: '#f1f5f9',
        cursor: '#00f0ff',
        black: '#07070e',
        red: '#ff2d78',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#00f0ff',
        magenta: '#b44dff',
        cyan: '#00f0ff',
        white: '#f1f5f9'
      },
      'original-dark': {
        background: '#08080a',
        foreground: '#ffffff',
        cursor: '#ffffff',
        black: '#08080a',
        red: '#ff5555',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#e2e8f0',
        magenta: '#cbd5e1',
        cyan: '#ffffff',
        white: '#ffffff'
      },
      'dracula': {
        background: '#282a36',
        foreground: '#f8f8f2',
        cursor: '#8be9fd',
        black: '#21222c',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#f8f8f2'
      },
      'minimal-light': {
        background: '#ffffff',
        foreground: '#0f172a',
        cursor: '#0284c7',
        black: '#000000',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#d97706',
        blue: '#0284c7',
        magenta: '#7c3aed',
        cyan: '#06b6d4',
        white: '#f8fafc'
      }
    };

    return themes[themeId] || themes['kraga-cyberpunk'];
  }

  public write(data: string): void {
    if (this.activeInstance) {
      window.kragaAPI.terminal.writeSession(this.activeInstance.id, data);
    }
  }

  public async runCommand(cmd: string): Promise<void> {
    if (this.instances.length === 0) {
      await this.startSession();
    }
    this.write(`${cmd}\r\n`);
  }

  public fit(): void {
    this.activeInstance?.fitAddon.fit();
  }

  public destroy(): void {
    this.unsubscribeData?.();
    for (const inst of this.instances) {
      window.kragaAPI.terminal.killSession(inst.id);
      inst.term.dispose();
    }
    this.instances = [];
  }
}
