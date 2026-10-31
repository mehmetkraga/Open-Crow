// src/components/Sidebar.ts
// Open Crow v2.5 — Çoklu Görünümlü Kenar Çubuğu Yöneticisi (Gezgin, Arama, Git, Eklentiler)

import {
  iconFolder, iconFolderOpen, iconChevronRight, iconChevronDown,
  iconFileTs, iconFileJs, iconFileJson, iconFileHtml, iconFileCss,
  iconFilePy, iconFileMd, iconFileGeneric, iconFilePlus, iconFolderPlus,
  iconTrash, iconRename, iconCopy, iconRefresh, iconNetwork
} from './icons';
import { SearchPanelManager } from './SearchPanel';
import { SourceControlPanelManager } from './SourceControlPanel';
import { ExtensionsPanelManager } from './ExtensionsPanel';

export type SidebarViewId = 'explorer' | 'search' | 'sourceControl' | 'extensions';

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileItem[];
}

export class SidebarManager {
  private sidebarContainer: HTMLElement;
  private currentPath: string | null = null;
  private currentView: SidebarViewId = 'explorer';
  private explorerMode: 'solution' | 'folder' = (localStorage.getItem('kraga-explorer-mode') as 'solution' | 'folder') || 'solution';
  private rawTreeItems: FileItem[] = [];

  // Sub-views containers
  private explorerViewEl: HTMLElement;
  private searchViewEl: HTMLElement;
  private gitViewEl: HTMLElement;
  private extensionsViewEl: HTMLElement;

  // View managers
  private searchPanel: SearchPanelManager;
  private sourceControlPanel: SourceControlPanelManager;
  private extensionsPanel: ExtensionsPanelManager;

  private treeContainer: HTMLElement;
  private contextMenuEl: HTMLElement | null = null;
  private activeContextItem: FileItem | null = null;

  private onFileSelectCallback: (filePath: string, line?: number, col?: number) => void;
  private onFolderOpenCallback: (folderPath: string) => void;

  constructor(
    sidebarContainerId: string,
    onFileSelect: (filePath: string, line?: number, col?: number) => void,
    onFolderOpen: (folderPath: string) => void
  ) {
    this.sidebarContainer = document.getElementById(sidebarContainerId)!;
    this.onFileSelectCallback = onFileSelect;
    this.onFolderOpenCallback = onFolderOpen;

    // View kaplarını oluştur
    this.explorerViewEl = document.createElement('div');
    this.explorerViewEl.className = 'sidebar-view sidebar-view--explorer';

    this.searchViewEl = document.createElement('div');
    this.searchViewEl.className = 'sidebar-view sidebar-view--search';
    this.searchViewEl.style.display = 'none';

    this.gitViewEl = document.createElement('div');
    this.gitViewEl.className = 'sidebar-view sidebar-view--git';
    this.gitViewEl.style.display = 'none';

    this.extensionsViewEl = document.createElement('div');
    this.extensionsViewEl.className = 'sidebar-view sidebar-view--extensions';
    this.extensionsViewEl.style.display = 'none';

    // Explorer view yapısını kur
    this.initExplorerDOM();

    // DOM'a ekle
    this.sidebarContainer.innerHTML = '';
    this.sidebarContainer.appendChild(this.explorerViewEl);
    this.sidebarContainer.appendChild(this.searchViewEl);
    this.sidebarContainer.appendChild(this.gitViewEl);
    this.sidebarContainer.appendChild(this.extensionsViewEl);

    this.treeContainer = this.explorerViewEl.querySelector('#fileTree')!;

    // Alt panel yöneticilerini başlat
    this.searchPanel = new SearchPanelManager(this.searchViewEl);
    this.searchPanel.onSelectMatch = (filePath, line, col) => {
      this.onFileSelectCallback(filePath, line, col);
    };

    this.sourceControlPanel = new SourceControlPanelManager(this.gitViewEl);
    this.sourceControlPanel.onSelectFile = (filePath) => {
      this.onFileSelectCallback(filePath);
    };

    this.extensionsPanel = new ExtensionsPanelManager(this.extensionsViewEl);

    this.initContextMenu();
    this.bindExplorerEvents();
  }

  private initExplorerDOM(): void {
    this.explorerViewEl.innerHTML = `
      <div class="sidebar-header">
        <span class="sidebar-title">GEZGİN</span>
        <div class="sidebar-header-actions">
          <button id="btnSidebarNewFile" class="sidebar-action-btn" title="Yeni Dosya">
            ${iconFilePlus(14)}
          </button>
          <button id="btnSidebarNewFolder" class="sidebar-action-btn" title="Yeni Klasör">
            ${iconFolderPlus(14)}
          </button>
          <button id="btnSidebarRefresh" class="sidebar-action-btn" title="Yenile">
            ${iconRefresh(14)}
          </button>
          <button id="btnOpenFolder" class="sidebar-action-btn" title="Klasör Aç">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      <!-- Visual Studio 2022: Çözüm Gezgini (Solution Explorer) vs Klasör Görünümü -->
      <div class="sidebar-view-mode-bar">
        <button class="view-mode-btn ${this.explorerMode === 'solution' ? 'active' : ''}" id="btnModeSolution" title="Çözüm Gezgini (Solution Explorer): Kaynak kodları gürültüsüz (node_modules vb. gizli) gösterir">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          <span>Çözüm (Solution)</span>
        </button>
        <button class="view-mode-btn ${this.explorerMode === 'folder' ? 'active' : ''}" id="btnModeFolder" title="Klasör Görünümü (Folder View): Tüm dosya ve klasörleri ham haliyle gösterir">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>Klasör Görünümü</span>
        </button>
      </div>

      <div class="explorer-sections">
        <!-- Klasör / Çalışma Alanı Bölümü -->
        <div class="explorer-accordion" id="secWorkspace">
          <div class="explorer-accordion__header">
            <span class="accordion-chevron">${iconChevronDown(12)}</span>
            <span class="accordion-title" id="explorerSectionTitle">KLASÖR AÇILMADI</span>
          </div>
          <div class="explorer-accordion__body" id="fileTree">
            <div class="empty-tree-notice">
              <p>Henüz bir çalışma alanı açılmadı.</p>
              <button id="btnOpenFolderHero" class="btn-primary-sm">Proje Klasörü Seç</button>
            </div>
          </div>
        </div>

        <!-- Anahat (Outline) -->
        <div class="explorer-accordion explorer-accordion--collapsed" id="secOutline">
          <div class="explorer-accordion__header">
            <span class="accordion-chevron">${iconChevronRight(12)}</span>
            <span class="accordion-title">ANAHAT (OUTLINE)</span>
          </div>
          <div class="explorer-accordion__body" style="display: none;">
            <p class="accordion-placeholder">Aktif dosyadaki semboller ve fonksiyonlar.</p>
          </div>
        </div>

        <!-- Zaman Çizelgesi (Timeline) -->
        <div class="explorer-accordion explorer-accordion--collapsed" id="secTimeline">
          <div class="explorer-accordion__header">
            <span class="accordion-chevron">${iconChevronRight(12)}</span>
            <span class="accordion-title">ZAMAN ÇİZELGESİ (TIMELINE)</span>
          </div>
          <div class="explorer-accordion__body" style="display: none;">
            <p class="accordion-placeholder">Yerel dosya ve Git değişiklik geçmişi.</p>
          </div>
        </div>
      </div>

      <div class="sidebar-footer">
        <button id="btnGraphifyScan" class="btn-sidebar-tool" title="Projeyi Graphify ile Tara">
          ${iconNetwork(16)}
          <span>Graphify Analizi</span>
        </button>
      </div>
    `;
  }

  private bindExplorerEvents(): void {
    const btnOpen = this.explorerViewEl.querySelector('#btnOpenFolder');
    const btnOpenHero = this.explorerViewEl.querySelector('#btnOpenFolderHero');
    const btnNewFile = this.explorerViewEl.querySelector('#btnSidebarNewFile');
    const btnNewFolder = this.explorerViewEl.querySelector('#btnSidebarNewFolder');
    const btnRefresh = this.explorerViewEl.querySelector('#btnSidebarRefresh');

    // Akordeon aç / kapa
    this.explorerViewEl.querySelectorAll('.explorer-accordion__header').forEach((header) => {
      header.addEventListener('click', () => {
        const parent = header.closest('.explorer-accordion') as HTMLElement;
        const body = parent.querySelector('.explorer-accordion__body') as HTMLElement;
        const chevron = parent.querySelector('.accordion-chevron');
        const isCollapsed = parent.classList.contains('explorer-accordion--collapsed');

        if (isCollapsed) {
          parent.classList.remove('explorer-accordion--collapsed');
          body.style.display = 'block';
          if (chevron) chevron.innerHTML = iconChevronDown(12);
        } else {
          parent.classList.add('explorer-accordion--collapsed');
          body.style.display = 'none';
          if (chevron) chevron.innerHTML = iconChevronRight(12);
        }
      });
    });

    const handleOpen = async () => {
      const folder = await window.kragaAPI.fs.openFolder();
      if (folder) {
        await this.loadFolder(folder);
      }
    };

    btnOpen?.addEventListener('click', handleOpen);
    btnOpenHero?.addEventListener('click', handleOpen);

    btnNewFile?.addEventListener('click', () => this.promptCreateNewFile());
    btnNewFolder?.addEventListener('click', () => this.promptCreateNewFolder());
    btnRefresh?.addEventListener('click', () => {
      if (this.currentPath) this.loadFolder(this.currentPath);
    });

    const btnModeSolution = this.explorerViewEl.querySelector('#btnModeSolution');
    const btnModeFolder = this.explorerViewEl.querySelector('#btnModeFolder');

    btnModeSolution?.addEventListener('click', () => {
      if (this.explorerMode === 'solution') return;
      this.setExplorerMode('solution');
    });

    btnModeFolder?.addEventListener('click', () => {
      if (this.explorerMode === 'folder') return;
      this.setExplorerMode('folder');
    });
  }

  public setExplorerMode(mode: 'solution' | 'folder'): void {
    this.explorerMode = mode;
    localStorage.setItem('kraga-explorer-mode', mode);

    const btnSolution = this.explorerViewEl.querySelector('#btnModeSolution');
    const btnFolder = this.explorerViewEl.querySelector('#btnModeFolder');
    btnSolution?.classList.toggle('active', mode === 'solution');
    btnFolder?.classList.toggle('active', mode === 'folder');

    this.refreshTreeDisplay();
  }

  public getExplorerMode(): 'solution' | 'folder' {
    return this.explorerMode;
  }

  private refreshTreeDisplay(): void {
    if (!this.treeContainer) return;
    const itemsToDisplay = this.explorerMode === 'solution'
      ? this.filterSolutionItems(this.rawTreeItems)
      : this.rawTreeItems;
    this.renderTree(itemsToDisplay, this.treeContainer);
  }

  private filterSolutionItems(items: FileItem[]): FileItem[] {
    const hiddenDirs = new Set([
      'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'out',
      '.next', '.nuxt', '.turbo', '.cache', 'coverage', 'bin', 'obj',
      '__pycache__', '.pytest_cache', '.venv', 'venv'
    ]);

    const hiddenFiles = new Set([
      'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', '.DS_Store', 'Thumbs.db'
    ]);

    return items
      .filter((item) => {
        const lowerName = item.name.toLowerCase();
        if (item.isDirectory) {
          return !hiddenDirs.has(lowerName);
        }
        return !hiddenFiles.has(lowerName);
      })
      .map((item) => {
        if (item.isDirectory && item.children) {
          return {
            ...item,
            children: this.filterSolutionItems(item.children),
          };
        }
        return item;
      });
  }

  private isKeyProjectFile(name: string): boolean {
    const keyFiles = new Set([
      'package.json', 'tsconfig.json', 'vite.config.ts', 'vite.config.js',
      'webpack.config.js', 'rollup.config.js', 'index.html', 'main.ts',
      'main.js', 'app.tsx', 'app.ts', 'index.ts', 'index.js', 'cargo.toml',
      'go.mod', 'requirements.txt', 'dockerfile', 'gemfile', 'solution.sln'
    ]);
    return keyFiles.has(name.toLowerCase());
  }

  public switchView(viewId: SidebarViewId): void {
    this.currentView = viewId;

    // Tüm görünümleri gizle
    this.explorerViewEl.style.display = 'none';
    this.searchViewEl.style.display = 'none';
    this.gitViewEl.style.display = 'none';
    this.extensionsViewEl.style.display = 'none';

    // Seçilen görünümü göster
    switch (viewId) {
      case 'explorer':
        this.explorerViewEl.style.display = 'flex';
        break;
      case 'search':
        this.searchViewEl.style.display = 'flex';
        this.searchPanel.setProjectPath(this.currentPath);
        const searchInput = this.searchViewEl.querySelector('#sidebarSearchQuery') as HTMLInputElement;
        setTimeout(() => searchInput?.focus(), 50);
        break;
      case 'sourceControl':
        this.gitViewEl.style.display = 'flex';
        this.sourceControlPanel.setProjectPath(this.currentPath);
        break;
      case 'extensions':
        this.extensionsViewEl.style.display = 'flex';
        break;
    }
  }

  public getCurrentView(): SidebarViewId {
    return this.currentView;
  }
  public async loadFolder(folderPath: string): Promise<void> {
    this.currentPath = folderPath;
    const folderName = folderPath.split(/[\\/]/).pop() || folderPath;
    const titleEl = document.getElementById('currentProjectTitle');
    if (titleEl) {
      titleEl.textContent = folderName;
    }
    const secTitle = this.explorerViewEl.querySelector('#explorerSectionTitle');
    if (secTitle) {
      secTitle.textContent = this.explorerMode === 'solution'
        ? `ÇÖZÜM: ${folderName.toUpperCase()}`
        : folderName.toUpperCase();
    }

    this.searchPanel.setProjectPath(folderPath);
    this.sourceControlPanel.setProjectPath(folderPath);

    this.treeContainer.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 12px;">Taranıyor...</div>';
    this.rawTreeItems = await window.kragaAPI.fs.readDirectory(folderPath);
    this.refreshTreeDisplay();
    this.onFolderOpenCallback(folderPath);
  }

  private renderTree(items: FileItem[], container: HTMLElement): void {
    container.innerHTML = '';
    if (items.length === 0) {
      container.innerHTML = '<div style="padding: 12px; color: var(--text-muted); font-size: 12px;">Klasör veya çözüm içeriği boş.</div>';
      return;
    }

    for (const item of items) {
      const nodeEl = document.createElement('div');
      nodeEl.className = `tree-node ${item.isDirectory ? 'folder' : 'file'}`;

      if (item.isDirectory) {
        nodeEl.innerHTML = `
          <span class="tree-node__chevron">${iconChevronRight(12)}</span>
          <span class="tree-node__icon">${iconFolder(16, '#e0af68')}</span>
          <span class="tree-node__label">${item.name}</span>
        `;

        const childrenContainer = document.createElement('div');
        childrenContainer.style.paddingLeft = '14px';
        childrenContainer.style.display = 'none';

        if (item.children && item.children.length > 0) {
          this.renderTree(item.children, childrenContainer);
        }

        nodeEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = childrenContainer.style.display === 'none';
          childrenContainer.style.display = isHidden ? 'block' : 'none';

          const chevron = nodeEl.querySelector('.tree-node__chevron');
          const folderIcon = nodeEl.querySelector('.tree-node__icon');
          if (chevron) chevron.innerHTML = isHidden ? iconChevronDown(12) : iconChevronRight(12);
          if (folderIcon) folderIcon.innerHTML = isHidden ? iconFolderOpen(16, '#e0af68') : iconFolder(16, '#e0af68');
        });

        nodeEl.addEventListener('contextmenu', (e) => this.showContextMenu(e, item));

        container.appendChild(nodeEl);
        container.appendChild(childrenContainer);
      } else {
        const isKey = this.isKeyProjectFile(item.name);
        const fileIconSvg = this.getFileIcon(item.name);
        if (isKey && this.explorerMode === 'solution') {
          nodeEl.classList.add('tree-node--key-file');
        }

        nodeEl.innerHTML = `
          <span class="tree-node__indent" style="width: 12px; display: inline-block;"></span>
          <span class="tree-node__icon">${fileIconSvg}</span>
          <span class="tree-node__label">${item.name}</span>
          ${isKey && this.explorerMode === 'solution' ? '<span class="tree-node-badge">ÇÖZÜM</span>' : ''}
        `;

        nodeEl.addEventListener('click', () => {
          this.treeContainer.querySelectorAll('.tree-node--active').forEach(n => n.classList.remove('tree-node--active'));
          nodeEl.classList.add('tree-node--active');
          this.onFileSelectCallback(item.path);
        });

        nodeEl.setAttribute('data-file-path', item.path);
        nodeEl.addEventListener('contextmenu', (e) => this.showContextMenu(e, item));

        container.appendChild(nodeEl);
      }
    }
  }

  public setActiveFile(filePath: string): void {
    if (!this.treeContainer) return;
    this.treeContainer.querySelectorAll('.tree-node--active').forEach(n => n.classList.remove('tree-node--active'));
    const target = this.treeContainer.querySelector(`[data-file-path="${CSS.escape(filePath)}"]`);
    if (target) {
      target.classList.add('tree-node--active');
      target.scrollIntoView({ block: 'nearest' });
    }
  }

  private initContextMenu(): void {
    this.contextMenuEl = document.createElement('div');
    this.contextMenuEl.className = 'tree-context-menu tree-context-menu--hidden';
    this.contextMenuEl.innerHTML = `
      <div class="tree-context-menu__item" data-action="new-file">
        ${iconFilePlus(14)} <span>Yeni Dosya</span>
      </div>
      <div class="tree-context-menu__item" data-action="new-folder">
        ${iconFolderPlus(14)} <span>Yeni Klasör</span>
      </div>
      <div class="tree-context-menu__separator"></div>
      <div class="tree-context-menu__item" data-action="rename">
        ${iconRename(14)} <span>Yeniden Adlandır</span>
      </div>
      <div class="tree-context-menu__item" data-action="copy-path">
        ${iconCopy(14)} <span>Dosya Yolunu Kopyala</span>
      </div>
      <div class="tree-context-menu__item" data-action="copy-relative-path">
        ${iconCopy(14)} <span>Bağıl Yolu Kopyala</span>
      </div>
      <div class="tree-context-menu__item" data-action="reveal-explorer">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> <span>Dosya Gezgininde Göster</span>
      </div>
      <div class="tree-context-menu__separator"></div>
      <div class="tree-context-menu__item tree-context-menu__item--danger" data-action="delete">
        ${iconTrash(14, '#ff5555')} <span>Sil</span>
      </div>
    `;

    document.body.appendChild(this.contextMenuEl);

    document.addEventListener('click', () => this.hideContextMenu());

    this.contextMenuEl.querySelectorAll('.tree-context-menu__item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = (e.currentTarget as HTMLElement).dataset.action;
        this.handleContextMenuAction(action);
        this.hideContextMenu();
      });
    });
  }

  private showContextMenu(e: MouseEvent, item: FileItem): void {
    e.preventDefault();
    e.stopPropagation();
    if (!this.contextMenuEl) return;

    this.activeContextItem = item;
    this.contextMenuEl.style.top = `${e.clientY}px`;
    this.contextMenuEl.style.left = `${e.clientX}px`;
    this.contextMenuEl.classList.remove('tree-context-menu--hidden');
  }

  private hideContextMenu(): void {
    if (this.contextMenuEl) {
      this.contextMenuEl.classList.add('tree-context-menu--hidden');
    }
  }

  private async handleContextMenuAction(action?: string): Promise<void> {
    if (!this.activeContextItem || !this.currentPath) return;
    const targetPath = this.activeContextItem.isDirectory
      ? this.activeContextItem.path
      : this.activeContextItem.path.substring(0, this.activeContextItem.path.lastIndexOf(/[\\/]/.exec(this.activeContextItem.path)?.[0] || ''));

    switch (action) {
      case 'new-file': {
        const name = prompt('Yeni dosya adı:');
        if (name) {
          const sep = targetPath.includes('/') ? '/' : '\\';
          const newPath = `${targetPath}${sep}${name}`;
          await window.kragaAPI.fs.writeFile(newPath, '');
          this.loadFolder(this.currentPath);
        }
        break;
      }
      case 'new-folder': {
        const name = prompt('Yeni klasör adı:');
        if (name) {
          const sep = targetPath.includes('/') ? '/' : '\\';
          const newPath = `${targetPath}${sep}${name}`;
          await window.kragaAPI.fs.createDirectory(newPath);
          this.loadFolder(this.currentPath);
        }
        break;
      }
      case 'rename': {
        const newName = prompt('Yeni isim:', this.activeContextItem.name);
        if (newName && newName !== this.activeContextItem.name) {
          const oldPath = this.activeContextItem.path;
          const parentDir = oldPath.substring(0, oldPath.lastIndexOf(/[\\/]/.exec(oldPath)?.[0] || ''));
          const sep = oldPath.includes('/') ? '/' : '\\';
          const newPath = `${parentDir}${sep}${newName}`;
          await window.kragaAPI.fs.rename(oldPath, newPath);
          this.loadFolder(this.currentPath);
        }
        break;
      }
      case 'copy-path': {
        navigator.clipboard.writeText(this.activeContextItem.path);
        break;
      }
      case 'copy-relative-path': {
        const root = this.currentPath || '';
        let rel = this.activeContextItem.path;
        if (rel.startsWith(root)) {
          rel = rel.substring(root.length).replace(/^[\\/]/, '');
        }
        navigator.clipboard.writeText(rel);
        break;
      }
      case 'reveal-explorer': {
        await window.kragaAPI.fs.revealInFolder?.(this.activeContextItem.path);
        break;
      }
      case 'delete': {
        if (confirm(`"${this.activeContextItem.name}" silinsin mi?`)) {
          await window.kragaAPI.fs.deletePath(this.activeContextItem.path);
          this.loadFolder(this.currentPath);
        }
        break;
      }
    }
  }

  private async promptCreateNewFile(): Promise<void> {
    if (!this.currentPath) return;
    const name = prompt('Yeni dosya adı:');
    if (name) {
      const sep = this.currentPath.includes('/') ? '/' : '\\';
      const path = `${this.currentPath}${sep}${name}`;
      await window.kragaAPI.fs.writeFile(path, '');
      await this.loadFolder(this.currentPath);
      this.onFileSelectCallback(path);
    }
  }

  private async promptCreateNewFolder(): Promise<void> {
    if (!this.currentPath) return;
    const name = prompt('Yeni klasör adı:');
    if (name) {
      const sep = this.currentPath.includes('/') ? '/' : '\\';
      const path = `${this.currentPath}${sep}${name}`;
      await window.kragaAPI.fs.createDirectory(path);
      await this.loadFolder(this.currentPath);
    }
  }

  private getFileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts': case 'tsx': return iconFileTs(16);
      case 'js': case 'jsx': return iconFileJs(16);
      case 'json': return iconFileJson(16);
      case 'html': return iconFileHtml(16);
      case 'css': case 'scss': return iconFileCss(16);
      case 'py': return iconFilePy(16);
      case 'md': return iconFileMd(16);
      default: return iconFileGeneric(16);
    }
  }

  public getCurrentPath(): string | null {
    return this.currentPath;
  }

  public getSearchPanel(): SearchPanelManager {
    return this.searchPanel;
  }

  public getSourceControlPanel(): SourceControlPanelManager {
    return this.sourceControlPanel;
  }

  public getExtensionsPanel(): ExtensionsPanelManager {
    return this.extensionsPanel;
  }
}
