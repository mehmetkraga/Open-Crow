// src/components/AppMenuBar.ts
// Kraga IDE v2.0 — Masaüstü Uygulama Menü Çubuğu (Dosya, Düzen, Görünüm, Terminal, Agent, Yardım)

export interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
}

export interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
}

export class AppMenuBarManager {
  private container: HTMLElement;
  private groups: MenuGroup[] = [];
  private activeMenuId: string | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.className = 'app-menu-bar';

    // Dışarı tıklamada menüyü kapat
    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target as Node)) {
        this.closeAll();
      }
    });

    // Escape ile menüyü kapat
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeMenuId) {
        this.closeAll();
      }
    });
  }

  public registerMenus(groups: MenuGroup[]): void {
    this.groups = groups;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';

    for (const group of this.groups) {
      const menuBtn = document.createElement('div');
      menuBtn.className = 'app-menu-item';
      menuBtn.setAttribute('data-menu-id', group.id);

      const labelEl = document.createElement('span');
      labelEl.className = 'app-menu-label';
      labelEl.textContent = group.label;
      menuBtn.appendChild(labelEl);

      // Dropdown kutusu
      const dropdown = document.createElement('div');
      dropdown.className = 'app-menu-dropdown';

      for (const item of group.items) {
        if (item.separator) {
          const sep = document.createElement('div');
          sep.className = 'app-menu-separator';
          dropdown.appendChild(sep);
          continue;
        }

        const itemEl = document.createElement('div');
        itemEl.className = 'app-menu-sub-item';
        itemEl.innerHTML = `
          <span class="app-menu-sub-label">${item.label}</span>
          ${item.shortcut ? `<span class="app-menu-sub-shortcut">${item.shortcut}</span>` : ''}
        `;

        itemEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeAll();
          item.action?.();
        });

        dropdown.appendChild(itemEl);
      }

      dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      menuBtn.appendChild(dropdown);

      // Tıklama ile aç/kapa
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.activeMenuId === group.id) {
          this.closeAll();
        } else {
          this.openMenu(group.id);
        }
      });

      // Biri açıkken fareyle diğerine geçiş
      menuBtn.addEventListener('mouseenter', () => {
        if (this.activeMenuId && this.activeMenuId !== group.id) {
          this.openMenu(group.id);
        }
      });

      this.container.appendChild(menuBtn);
    }
  }

  private openMenu(id: string): void {
    this.activeMenuId = id;
    const items = this.container.querySelectorAll('.app-menu-item');
    items.forEach((item) => {
      const match = item.getAttribute('data-menu-id') === id;
      item.classList.toggle('active', match);
    });
  }

  public closeAll(): void {
    this.activeMenuId = null;
    const items = this.container.querySelectorAll('.app-menu-item');
    items.forEach((item) => item.classList.remove('active'));
  }
}
