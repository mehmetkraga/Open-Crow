import {
  iconFileTs,
  iconFileJs,
  iconFileJson,
  iconFileHtml,
  iconFileCss,
  iconFilePy,
  iconFileMd,
  iconFileGeneric
} from './icons';

export class QuickOpenManager {
  private overlay: HTMLDivElement;
  private container: HTMLDivElement;
  private input: HTMLInputElement;
  private list: HTMLDivElement;
  
  private files: string[] = [];
  private filteredFiles: string[] = [];
  private recentFiles: string[] = [];
  private selectedIndex: number = 0;
  private isOpen: boolean = false;
  
  private fileProvider: (() => Promise<string[]>) | null = null;
  public onFileSelect: ((filePath: string) => void) | null = null;
  
  constructor() {
    this.overlay = document.createElement('div');
    this.container = document.createElement('div');
    this.input = document.createElement('input');
    this.list = document.createElement('div');
    
    this.createDomElements();
    this.setupEventListeners();
  }
  
  private createDomElements(): void {
    // overlay
    this.overlay.className = 'quick-open-overlay';
    this.overlay.style.display = 'none';
    
    // container
    this.container.className = 'quick-open';
    
    // input
    this.input.className = 'quick-open__input';
    this.input.type = 'text';
    this.input.placeholder = 'Dosya adı ile ara...';
    
    // list
    this.list.className = 'quick-open__list';
    
    this.container.appendChild(this.input);
    this.container.appendChild(this.list);
    this.overlay.appendChild(this.container);
    
    document.body.appendChild(this.overlay);
  }
  
  private setupEventListeners(): void {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // Sadece Ctrl+P (Shift basılı olmamalı, yoksa Komut Paleti ile çakışır)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.close();
      }
    });

    window.addEventListener('kraga:commandpalette-opened', () => {
      this.close();
    });
    
    this.input.addEventListener('input', () => {
      this.filterFiles(this.input.value);
    });
    
    this.input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (!this.isOpen) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.moveSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.moveSelection(-1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.selectCurrent();
      }
    });
    
    this.overlay.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });
  }
  
  public setFileProvider(provider: () => Promise<string[]>): void {
    this.fileProvider = provider;
  }
  
  public async open(): Promise<void> {
    if (this.isOpen) return;
    this.isOpen = true;
    window.dispatchEvent(new CustomEvent('kraga:quickopen-opened'));
    
    this.overlay.style.display = 'flex';
    this.input.value = '';
    
    this.list.innerHTML = '';
    
    if (this.fileProvider) {
      try {
        this.files = await this.fileProvider();
      } catch (error) {
        console.error('Dosya listesi alınamadı:', error);
        this.files = [];
      }
    }
    
    this.filterFiles('');
    // Focus after rendering so it's visible
    setTimeout(() => {
      this.input.focus();
    }, 0);
  }
  
  public close(): void {
    if (!this.isOpen) return;
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
  
  public addRecentFile(path: string): void {
    this.recentFiles = this.recentFiles.filter(p => p !== path);
    this.recentFiles.unshift(path);
    if (this.recentFiles.length > 10) {
      this.recentFiles.pop();
    }
  }
  
  private filterFiles(query: string): void {
    const lowerQuery = query.toLowerCase();
    let results: string[] = [];
    
    if (lowerQuery === '') {
      results = [...this.recentFiles];
      const otherFiles = this.files.filter(f => !this.recentFiles.includes(f));
      results = results.concat(otherFiles).slice(0, 20);
    } else {
      const matched = this.files.filter(f => f.toLowerCase().includes(lowerQuery));
      results = matched.sort((a, b) => {
        const aRecent = this.recentFiles.indexOf(a);
        const bRecent = this.recentFiles.indexOf(b);
        if (aRecent !== -1 && bRecent !== -1) return aRecent - bRecent;
        if (aRecent !== -1) return -1;
        if (bRecent !== -1) return 1;
        return 0;
      }).slice(0, 20);
    }
    
    this.filteredFiles = results;
    this.selectedIndex = 0;
    this.renderList();
  }
  
  private getIconForFile(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': return iconFileTs(16);
      case 'js': return iconFileJs(16);
      case 'json': return iconFileJson(16);
      case 'html': return iconFileHtml(16);
      case 'css': return iconFileCss(16);
      case 'py': return iconFilePy(16);
      case 'md': return iconFileMd(16);
      default: return iconFileGeneric(16);
    }
  }
  
  private renderList(): void {
    this.list.innerHTML = '';
    
    if (this.filteredFiles.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'quick-open__item';
      emptyItem.textContent = 'Sonuç bulunamadı.';
      this.list.appendChild(emptyItem);
      return;
    }
    
    this.filteredFiles.forEach((filePath, index) => {
      const item = document.createElement('div');
      item.className = 'quick-open__item';
      if (index === this.selectedIndex) {
        item.classList.add('quick-open__item--active');
      }
      
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      
      const iconSpan = document.createElement('span');
      iconSpan.className = 'quick-open__icon';
      iconSpan.innerHTML = this.getIconForFile(fileName);
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'quick-open__file-name';
      nameSpan.textContent = fileName;
      
      const pathSpan = document.createElement('span');
      pathSpan.className = 'quick-open__file-path';
      pathSpan.textContent = filePath;
      
      item.appendChild(iconSpan);
      item.appendChild(nameSpan);
      item.appendChild(pathSpan);
      
      item.addEventListener('click', () => {
        this.selectedIndex = index;
        this.selectCurrent();
      });
      
      item.addEventListener('mouseenter', () => {
        const prevActive = this.list.querySelector('.quick-open__item--active');
        if (prevActive) {
          prevActive.classList.remove('quick-open__item--active');
        }
        item.classList.add('quick-open__item--active');
        this.selectedIndex = index;
      });
      
      this.list.appendChild(item);
    });
    
    this.scrollToSelection();
  }
  
  private moveSelection(delta: number): void {
    if (this.filteredFiles.length === 0) return;
    
    this.selectedIndex += delta;
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.filteredFiles.length - 1;
    } else if (this.selectedIndex >= this.filteredFiles.length) {
      this.selectedIndex = 0;
    }
    
    const items = this.list.querySelectorAll('.quick-open__item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('quick-open__item--active');
      } else {
        item.classList.remove('quick-open__item--active');
      }
    });
    
    this.scrollToSelection();
  }
  
  private scrollToSelection(): void {
    const activeItem = this.list.querySelector('.quick-open__item--active') as HTMLElement;
    if (activeItem) {
      const listRect = this.list.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      
      if (itemRect.bottom > listRect.bottom) {
        this.list.scrollTop += itemRect.bottom - listRect.bottom;
      } else if (itemRect.top < listRect.top) {
        this.list.scrollTop -= listRect.top - itemRect.top;
      }
    }
  }
  
  private selectCurrent(): void {
    if (this.filteredFiles.length === 0) return;
    
    const selectedPath = this.filteredFiles[this.selectedIndex];
    this.addRecentFile(selectedPath);
    
    if (this.onFileSelect) {
      this.onFileSelect(selectedPath);
    }
    
    this.close();
  }
}
