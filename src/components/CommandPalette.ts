import * as icons from './icons';

export interface Command {
  id: string;
  label: string;
  category: string;
  keybinding?: string;
  icon?: string;
  action: () => void;
}

export class CommandPaletteManager {
  private overlay!: HTMLElement;
  private container!: HTMLElement;
  private input!: HTMLInputElement;
  private list!: HTMLElement;
  private commands: Command[] = [];
  private filteredCommands: Command[] = [];
  private activeIndex: number = -1;
  private isOpen: boolean = false;

  constructor() {
    this.createUI();
    this.registerDefaultCommands();
    this.setupEventListeners();
  }

  private createUI(): void {
    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'command-palette-overlay';
    this.overlay.style.display = 'none';

    // Container
    this.container = document.createElement('div');
    this.container.className = 'command-palette';

    // Input
    this.input = document.createElement('input');
    this.input.className = 'command-palette__input';
    this.input.type = 'text';
    this.input.placeholder = 'Bir komut yazın...';
    this.input.setAttribute('aria-label', 'Komut Paleti');

    // List
    this.list = document.createElement('ul');
    this.list.className = 'command-palette__list';

    // Append elements
    this.container.appendChild(this.input);
    this.container.appendChild(this.list);
    this.overlay.appendChild(this.container);
    
    // Append to body
    document.body.appendChild(this.overlay);
  }

  private setupEventListeners(): void {
    // Toggle via Ctrl+Shift+P
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.toggle();
      }
    });

    window.addEventListener('kraga:quickopen-opened', () => {
      this.close();
    });

    // Close on overlay click
    this.overlay.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    // Handle input filtering
    this.input.addEventListener('input', () => {
      this.filterCommands(this.input.value);
    });

    // Handle keyboard navigation within the input
    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.moveSelection(1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.moveSelection(-1);
          break;
        case 'Enter':
          e.preventDefault();
          this.executeActiveCommand();
          break;
        case 'Escape':
          e.preventDefault();
          this.close();
          break;
      }
    });
  }

  private registerDefaultCommands(): void {
    // Helper to try resolving an icon function from the imported icons namespace
    const getIcon = (name: string, fallbackName?: string): string | undefined => {
      const iconFunc = (icons as any)[name] || (fallbackName && (icons as any)[fallbackName]);
      return typeof iconFunc === 'function' ? iconFunc(16) : undefined;
    };

    const defaultCommands: Command[] = [
      { id: 'view.toggleSidebar', label: 'Kenar Çubuğunu Göster/Gizle', category: 'Görünüm', icon: getIcon('sidebar', 'layout'), action: () => {} },
      { id: 'view.toggleTerminal', label: 'Terminal Göster/Gizle', category: 'Görünüm', keybinding: 'Ctrl+`', icon: getIcon('terminal'), action: () => {} },
      { id: 'view.toggleAgentPanel', label: 'Agent Paneli Göster/Gizle', category: 'Görünüm', icon: getIcon('bot', 'user'), action: () => {} },
      { id: 'file.openFolder', label: 'Klasör Aç', category: 'Dosya', keybinding: 'Ctrl+O', icon: getIcon('folder'), action: () => {} },
      { id: 'file.newFile', label: 'Yeni Dosya', category: 'Dosya', keybinding: 'Ctrl+N', icon: getIcon('filePlus', 'file'), action: () => {} },
      { id: 'file.save', label: 'Dosyayı Kaydet', category: 'Dosya', keybinding: 'Ctrl+S', icon: getIcon('save'), action: () => {} },
      { id: 'edit.find', label: 'Bul ve Değiştir', category: 'Düzenleme', keybinding: 'Ctrl+F', icon: getIcon('search'), action: () => {} },
      { id: 'theme.change', label: 'Tema Değiştir', category: 'Görünüm', icon: getIcon('palette'), action: () => {} },
      { id: 'settings.open', label: 'Ayarları Aç', category: 'Genel', icon: getIcon('settings'), action: () => {} },
      { id: 'terminal.new', label: 'Yeni Terminal', category: 'Terminal', keybinding: 'Ctrl+Shift+`', icon: getIcon('terminalSquare', 'plusSquare'), action: () => {} },
      { id: 'agent.newChat', label: 'Yeni Sohbet', category: 'Agent', icon: getIcon('messageSquare', 'messageCircle'), action: () => {} },
      { id: 'graphify.scan', label: 'Graphify Analizi Başlat', category: 'Analiz', icon: getIcon('activity'), action: () => {} },
      { id: 'app.reload', label: 'Pencereyi Yeniden Yükle', category: 'Genel', keybinding: 'Ctrl+Shift+R', icon: getIcon('refreshCw', 'refreshCcw'), action: () => {} }
    ];

    defaultCommands.forEach(cmd => this.registerCommand(cmd));
  }

  public registerCommand(cmd: Command): void {
    const existingIndex = this.commands.findIndex(c => c.id === cmd.id);
    if (existingIndex >= 0) {
      this.commands[existingIndex] = cmd;
    } else {
      this.commands.push(cmd);
    }
  }

  public updateAction(id: string, action: () => void): void {
    const cmd = this.commands.find(c => c.id === id);
    if (cmd) {
      cmd.action = action;
    }
  }

  public open(): void {
    this.isOpen = true;
    window.dispatchEvent(new CustomEvent('kraga:commandpalette-opened'));
    this.overlay.style.display = 'flex';
    this.input.value = '';
    this.filterCommands('');
    
    // Focus the input asynchronously to ensure it happens after display: flex is applied
    setTimeout(() => {
      this.input.focus();
    }, 10);
  }

  public close(): void {
    this.isOpen = false;
    this.overlay.style.display = 'none';
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private filterCommands(query: string): void {
    const q = query.toLowerCase();
    
    // Sort all commands first
    const sortedCommands = [...this.commands].sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.label.localeCompare(b.label);
    });

    // Fuzzy matching
    this.filteredCommands = sortedCommands
      .filter(cmd => 
        cmd.label.toLowerCase().includes(q) || 
        cmd.category.toLowerCase().includes(q)
      )
      .slice(0, 15); // Max 15 results

    this.activeIndex = this.filteredCommands.length > 0 ? 0 : -1;
    this.renderList();
  }

  private moveSelection(direction: number): void {
    if (this.filteredCommands.length === 0) return;

    this.activeIndex += direction;

    if (this.activeIndex < 0) {
      this.activeIndex = this.filteredCommands.length - 1;
    } else if (this.activeIndex >= this.filteredCommands.length) {
      this.activeIndex = 0;
    }

    this.renderList();
    
    // Scroll active item into view
    const activeItem = this.list.querySelector('.command-palette__item--active') as HTMLElement;
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }

  private executeActiveCommand(): void {
    if (this.activeIndex >= 0 && this.activeIndex < this.filteredCommands.length) {
      const cmd = this.filteredCommands[this.activeIndex];
      this.close();
      if (cmd && typeof cmd.action === 'function') {
        cmd.action();
      }
    }
  }

  private renderList(): void {
    this.list.innerHTML = '';

    if (this.filteredCommands.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'command-palette__empty';
      emptyItem.textContent = 'Eşleşen komut bulunamadı.';
      this.list.appendChild(emptyItem);
      return;
    }

    this.filteredCommands.forEach((cmd, index) => {
      const item = document.createElement('li');
      item.className = 'command-palette__item';
      
      if (index === this.activeIndex) {
        item.classList.add('command-palette__item--active');
      }

      // Left section (Icon + Label)
      const leftPart = document.createElement('div');
      leftPart.style.display = 'flex';
      leftPart.style.alignItems = 'center';
      leftPart.style.gap = '8px';

      if (cmd.icon) {
        const iconSpan = document.createElement('span');
        iconSpan.innerHTML = cmd.icon;
        leftPart.appendChild(iconSpan);
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = `${cmd.category}: ${cmd.label}`;
      leftPart.appendChild(labelSpan);

      item.appendChild(leftPart);

      // Right section (Keybinding)
      if (cmd.keybinding) {
        const keybindingSpan = document.createElement('span');
        keybindingSpan.className = 'command-palette__keybinding';
        keybindingSpan.textContent = cmd.keybinding;
        item.appendChild(keybindingSpan);
      }

      // Mouse events for hover and click
      item.addEventListener('mouseenter', () => {
        this.activeIndex = index;
        this.renderList();
      });

      item.addEventListener('click', () => {
        this.activeIndex = index;
        this.executeActiveCommand();
      });

      this.list.appendChild(item);
    });
  }
}
