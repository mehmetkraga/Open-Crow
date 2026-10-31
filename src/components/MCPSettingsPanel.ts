// src/components/MCPSettingsPanel.ts
// Open Crow v2.5 — Detaylı Model Context Protocol (MCP) Connectors Hub (Claude Desktop & Antigravity Tarzı)

import { MCP_CONNECTORS_CATALOG } from './mcpCatalogData';
import type { MCPConnectorDef, MCPConfigField } from './mcpCatalogData';
export type { MCPConnectorDef, MCPConfigField };
export { MCP_CONNECTORS_CATALOG };
import { iconPlug, iconPlus, iconTrash, iconRefresh, iconWrench, iconCheck, iconClose, iconSearch } from './icons';

export interface InstalledMCPServer {
  id: string;
  connectorId?: string;
  name: string;
  type: 'stdio' | 'sse' | 'http';
  command?: string;
  url?: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  toolCount: number;
  description: string;
  config?: Record<string, string>;
  tools?: { name: string; description: string }[];
  /** Son bağlantı hatasının nedeni (kullanıcıya gösterilir) */
  error?: string;
}

export class MCPSettingsPanel {
  private static instance: MCPSettingsPanel;
  private installedServers: InstalledMCPServer[] = [];
  private activeSubTab: 'directory' | 'installed' | 'custom' = 'directory';
  private directoryCategory: string = 'all';
  private directorySearchQuery: string = '';
  private storageKey = 'kraga-mcp-installed-v2';

  public static getInstance(): MCPSettingsPanel {
    if (!MCPSettingsPanel.instance) {
      MCPSettingsPanel.instance = new MCPSettingsPanel();
    }
    return MCPSettingsPanel.instance;
  }

  constructor() {
    MCPSettingsPanel.instance = this;
    this.loadInstalledServers();
    // Uygulama her açıldığında ana süreçte hiçbir bağlantı yoktur: kayıtlı "bağlı" durumları gerçek değildir.
    for (const srv of this.installedServers) {
      if (srv.status === 'connected' || srv.status === 'connecting') srv.status = 'disconnected';
    }
    this.saveInstalledServers();
    setTimeout(() => { void this.autoConnectAll(); }, 1500);
  }

  /** Gerçek bağlantı kurar; araç listesi yalnızca sunucunun döndürdüğü gerçek araçlardan oluşur. */
  public async connectInstalled(server: InstalledMCPServer): Promise<boolean> {
    const api = (window as any).kragaAPI?.mcp;
    if (!api) { server.status = 'error'; server.error = 'Bu özellik yalnızca masaüstü uygulamasında çalışır.'; return false; }
    server.status = 'connecting';
    server.error = undefined;
    try {
      const cfg = server.config || {};
      let ok = false;
      if (server.type === 'stdio') {
        if (!server.command) throw new Error('Komut tanımlı değil');
        ok = await api.connectServer(server.id, { command: server.command, env: cfg });
      } else {
        if (!server.url) throw new Error('Adres tanımlı değil');
        const headers: Record<string, string> = {};
        const token = cfg.TOKEN || cfg.API_KEY || cfg.AUTHORIZATION_TOKEN;
        if (token) headers.Authorization = /^bearer /i.test(token) ? token : 'Bearer ' + token;
        for (const [k, v] of Object.entries(cfg)) {
          if (k.startsWith('HEADER_') && v) headers[k.slice(7).replace(/_/g, '-')] = v;
        }
        ok = await api.connectServer(server.id, { url: server.url, headers });
      }
      if (!ok) {
        server.status = 'error';
        server.error = (await api.getLastError(server.id)) || 'Bağlanılamadı';
        return false;
      }
      const tools = await api.refreshTools();
      const own = tools.filter((t: any) => t.serverName === server.id);
      server.tools = own.map((t: any) => ({ name: t.name, description: t.description || '' }));
      server.toolCount = own.length;
      server.status = 'connected';
      return true;
    } catch (err: any) {
      server.status = 'error';
      server.error = String(err?.message || err);
      return false;
    } finally {
      this.saveInstalledServers();
    }
  }

  private async autoConnectAll(): Promise<void> {
    for (const srv of this.installedServers) {
      if (srv.status !== 'disconnected') continue;
      if (srv.type === 'sse' && !srv.url) continue;
      await this.connectInstalled(srv);
      const hubBody = document.querySelector('#mcpHubBody') as HTMLElement | null;
      if (hubBody && this.activeSubTab === 'installed') this.renderSubTab(hubBody);
    }
  }

  private loadInstalledServers(): void {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.installedServers = JSON.parse(saved);
      } else {
        // Varsayılan: yalnızca gerçekten çalışan, anahtar gerektirmeyen bir sunucu (açılışta otomatik bağlanır)
        this.installedServers = [
          {
            id: 'sequential-thinking',
            connectorId: 'sequential-thinking',
            name: 'Sequential Thinking MCP',
            type: 'stdio',
            command: 'npx -y @modelcontextprotocol/server-sequential-thinking',
            status: 'disconnected',
            toolCount: 0,
            description: 'Karmaşık problemlerde adım adım akıl yürütme aracı.'
          }
        ];
      }
    } catch {
      this.installedServers = [];
    }
  }

  public saveInstalledServers(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.installedServers));
    } catch (e) {
      console.error('MCP sunucuları kaydedilemedi:', e);
    }
  }

  public getInstalledServers(): InstalledMCPServer[] {
    return this.installedServers;
  }

  public getActiveToolsCount(): number {
    return this.installedServers
      .filter(s => s.status === 'connected')
      .reduce((acc, s) => acc + s.toolCount, 0);
  }

  public getAllActiveTools(): { serverId: string; serverName: string; name: string; description: string; params?: string }[] {
    const list: { serverId: string; serverName: string; name: string; description: string; params?: string }[] = [];
    for (const server of this.installedServers) {
      if (server.status === 'connected' && server.tools) {
        for (const t of server.tools) {
          list.push({
            serverId: server.id,
            serverName: server.name,
            name: t.name,
            description: t.description || '',
            params: (t as any).params
          });
        }
      }
    }
    return list;
  }

  public render(container: HTMLElement): void {
    const totalConnected = this.installedServers.filter(s => s.status === 'connected').length;
    const totalTools = this.getActiveToolsCount();

    container.innerHTML = `
      <div class="mcp-hub">
        <!-- Başlık & İstatistik Çubuğu -->
        <div class="mcp-hub__header">
          <div class="mcp-hub__header-left">
            <h3 class="mcp-hub__title">
              ${iconPlug(22, 'var(--accent-color, #00f0ff)')}
              <span>Model Context Protocol (MCP) Connectors Hub</span>
            </h3>
            <p class="mcp-hub__subtitle">
              Claude Desktop ve Antigravity standardında yerel araçlar, veritabanı köprüleri ve üçüncü parti kurumsal platform entegrasyonları.
            </p>
          </div>
          <div class="mcp-hub__header-stats">
            <div class="mcp-hub-stat">
              <span class="mcp-hub-stat__val">${totalConnected}</span>
              <span class="mcp-hub-stat__label">Aktif Sunucu</span>
            </div>
            <div class="mcp-hub-stat">
              <span class="mcp-hub-stat__val">${totalTools}</span>
              <span class="mcp-hub-stat__label">Kullanılabilir Araç (Tool)</span>
            </div>
          </div>
        </div>

        <!-- Alt Sekmeler (Katalog, Kurulu Sunucular, Özel Ekle) -->
        <div class="mcp-hub__nav">
          <button class="mcp-nav-btn ${this.activeSubTab === 'directory' ? 'mcp-nav-btn--active' : ''}" data-sub="directory">
            <span>Konnektörler Pazarı (${MCP_CONNECTORS_CATALOG.length})</span>
          </button>
          <button class="mcp-nav-btn ${this.activeSubTab === 'installed' ? 'mcp-nav-btn--active' : ''}" data-sub="installed">
            <span>Yüklü Sunucular (${this.installedServers.length})</span>
          </button>
          <button class="mcp-nav-btn ${this.activeSubTab === 'custom' ? 'mcp-nav-btn--active' : ''}" data-sub="custom">
            ${iconPlus(14)}
            <span>Özel Sunucu Ekle (stdio / SSE)</span>
          </button>
        </div>

        <!-- Sekme İçeriği Konteyneri -->
        <div class="mcp-hub__body" id="mcpHubBody"></div>
      </div>
    `;

    const bodyEl = container.querySelector('#mcpHubBody') as HTMLElement;
    this.renderSubTab(bodyEl);

    // Sekme dinleyicileri
    container.querySelectorAll('.mcp-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sub = (e.currentTarget as HTMLElement).dataset.sub as any;
        if (sub) {
          this.activeSubTab = sub;
          container.querySelectorAll('.mcp-nav-btn').forEach(b => b.classList.remove('mcp-nav-btn--active'));
          (e.currentTarget as HTMLElement).classList.add('mcp-nav-btn--active');
          this.renderSubTab(bodyEl);
        }
      });
    });
  }

  private renderSubTab(bodyEl: HTMLElement): void {
    if (this.activeSubTab === 'directory') {
      this.renderDirectoryView(bodyEl);
    } else if (this.activeSubTab === 'installed') {
      this.renderInstalledView(bodyEl);
    } else {
      this.renderCustomAddView(bodyEl);
    }
  }

  // 1. KONNEKTÖRLER PAZARI (DIRECTORY)
  private renderDirectoryView(container: HTMLElement): void {
    container.innerHTML = `
      <div class="mcp-directory">
        <div class="mcp-directory__controls">
          <div class="mcp-search-wrap">
            <span class="mcp-search-icon">${iconSearch(14)}</span>
            <input type="text" id="mcpDirSearch" class="mcp-search-input" placeholder="Konnektör veya araç ara (örn: github, postgres, figma, docker)..." value="${this.directorySearchQuery}">
          </div>

          <div class="mcp-filter-pills">
            <button class="mcp-pill ${this.directoryCategory === 'all' ? 'mcp-pill--active' : ''}" data-cat="all">Hepsi (${MCP_CONNECTORS_CATALOG.length})</button>
            <button class="mcp-pill ${this.directoryCategory === 'dev' ? 'mcp-pill--active' : ''}" data-cat="dev">Geliştirici</button>
            <button class="mcp-pill ${this.directoryCategory === 'db' ? 'mcp-pill--active' : ''}" data-cat="db">Veritabanı</button>
            <button class="mcp-pill ${this.directoryCategory === 'cloud' ? 'mcp-pill--active' : ''}" data-cat="cloud">DevOps & Bulut</button>
            <button class="mcp-pill ${this.directoryCategory === 'search' ? 'mcp-pill--active' : ''}" data-cat="search">Web & Arama</button>
            <button class="mcp-pill ${this.directoryCategory === 'comms' ? 'mcp-pill--active' : ''}" data-cat="comms">İletişim & Görev</button>
            <button class="mcp-pill ${this.directoryCategory === 'design' ? 'mcp-pill--active' : ''}" data-cat="design">Tasarım & UI</button>
            <button class="mcp-pill ${this.directoryCategory === 'gamedev' ? 'mcp-pill--active' : ''}" data-cat="gamedev">Oyun & 3D</button>
            <button class="mcp-pill ${this.directoryCategory === 'ai' ? 'mcp-pill--active' : ''}" data-cat="ai">Yapay Zeka & Bellek</button>
          </div>
        </div>

        <div class="mcp-grid" id="mcpConnectorsGrid"></div>
      </div>
    `;

    const gridEl = container.querySelector('#mcpConnectorsGrid') as HTMLElement;
    this.renderDirectoryGrid(gridEl);

    // Arama dinleyicisi
    const searchInput = container.querySelector('#mcpDirSearch') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      this.directorySearchQuery = (e.target as HTMLInputElement).value.toLowerCase();
      this.renderDirectoryGrid(gridEl);
    });

    // Kategori filtre dinleyicileri
    container.querySelectorAll('.mcp-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.mcp-pill').forEach(b => b.classList.remove('mcp-pill--active'));
        (e.currentTarget as HTMLElement).classList.add('mcp-pill--active');
        this.directoryCategory = (e.currentTarget as HTMLElement).dataset.cat || 'all';
        this.renderDirectoryGrid(gridEl);
      });
    });
  }

  private renderDirectoryGrid(gridEl: HTMLElement): void {
    const filtered = MCP_CONNECTORS_CATALOG.filter(c => {
      const matchesCat = this.directoryCategory === 'all' || c.category === this.directoryCategory;
      const matchesQuery = !this.directorySearchQuery ||
        c.name.toLowerCase().includes(this.directorySearchQuery) ||
        c.description.toLowerCase().includes(this.directorySearchQuery) ||
        c.tools.some(t => t.name.toLowerCase().includes(this.directorySearchQuery));
      return matchesCat && matchesQuery;
    });

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <div class="mcp-empty-state">
          <p>Aramanıza uygun bir MCP konnektörü bulunamadı.</p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = filtered.map(connector => {
      const isInstalled = this.installedServers.some(s => s.connectorId === connector.id);

      return `
        <div class="mcp-connector-card ${isInstalled ? 'mcp-connector-card--installed' : ''}" data-id="${connector.id}">
          <div class="mcp-connector-card__top">
            <div class="mcp-connector-card__logo-wrap">
              ${connector.logo(28)}
            </div>
            <div class="mcp-connector-card__header-text">
              <div class="mcp-connector-card__title-row">
                <h4 class="mcp-connector-card__name">${connector.name}</h4>
                ${connector.featured ? '<span class="mcp-connector-card__badge-feat">Önerilen</span>' : ''}
              </div>
              <span class="mcp-connector-card__cat">${connector.categoryLabel}</span>
            </div>
          </div>

          <p class="mcp-connector-card__desc">${connector.description}</p>

          <div class="mcp-connector-card__footer">
            ${connector.tools.length ? `<button class="mcp-btn-inspect-tools" data-id="${connector.id}" title="Sağladığı araçları listele">
              ${iconWrench(12)}
              <span>${connector.tools.length} Araç</span>
            </button>` : `<span class="mcp-card-hint" style="font-size:0.75rem;color:var(--text-muted,#888)">Araçlar bağlanınca listelenir</span>`}

            ${isInstalled ? `
              <div class="mcp-installed-pill">
                ${iconCheck(12)}
                <span>Bağlı</span>
              </div>
            ` : `
              <button class="mcp-btn-connect" data-id="${connector.id}">
                ${iconPlus(12)}
                <span>Bağlan</span>
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Araç inceleme dinleyicileri
    gridEl.querySelectorAll('.mcp-btn-inspect-tools').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const connector = MCP_CONNECTORS_CATALOG.find(c => c.id === id);
        if (connector) this.showToolsModal(connector);
      });
    });

    // Bağlan dinleyicileri
    gridEl.querySelectorAll('.mcp-btn-connect').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const connector = MCP_CONNECTORS_CATALOG.find(c => c.id === id);
        if (connector) this.showConnectModal(connector);
      });
    });
  }

  // 2. YÜKLÜ & AKTİF SUNUCULAR
  private renderInstalledView(container: HTMLElement): void {
    if (this.installedServers.length === 0) {
      container.innerHTML = `
        <div class="mcp-empty-state">
          <p>Henüz bağlı bir MCP sunucunuz yok.</p>
          <button class="mcp-btn-primary" id="btnGoToDirectory">Konnektörler Pazarına Göz At</button>
        </div>
      `;
      container.querySelector('#btnGoToDirectory')?.addEventListener('click', () => {
        this.activeSubTab = 'directory';
        this.render(container.parentElement?.parentElement || container);
      });
      return;
    }

    container.innerHTML = `
      <div class="mcp-installed-list">
        ${this.installedServers.map(server => {
          const connector = server.connectorId ? MCP_CONNECTORS_CATALOG.find(c => c.id === server.connectorId) : null;
          const logoHtml = connector ? connector.logo(24) : iconPlug(24, 'var(--accent-color, #00f0ff)');

          return `
            <div class="mcp-server-row" data-id="${server.id}">
              <div class="mcp-server-row__left">
                <div class="mcp-server-row__logo">
                  ${logoHtml}
                </div>
                <div class="mcp-server-row__info">
                  <div class="mcp-server-row__title-line">
                    <span class="mcp-status-dot mcp-status-dot--${server.status}"></span>
                    <h4 class="mcp-server-row__name">${server.name}</h4>
                    <span class="mcp-server-row__badge">${server.type.toUpperCase()}</span>
                  </div>
                  <p class="mcp-server-row__desc">${server.description}</p>
                  ${server.status === 'error' && server.error ? `<p class="mcp-server-row__desc" style="color: var(--status-red, #ff5555);" title="${(server.error || '').replace(/"/g, '&quot;')}">Bağlanılamadı: ${(server.error || '').slice(0, 220).replace(/</g, '&lt;')}</p>` : ''}
                  <div class="mcp-server-row__meta">
                    <span>${iconWrench(12)} ${server.toolCount} Araç</span>
                    <span>${server.type === 'stdio' ? server.command : server.url}</span>
                  </div>
                </div>
              </div>

              <div class="mcp-server-row__actions">
                ${server.tools && server.tools.length > 0 ? `
                  <button class="mcp-row-btn mcp-row-btn--tools" data-id="${server.id}" title="Araçları Gör">
                    ${iconWrench(14)}
                    <span>Araçlar</span>
                  </button>
                ` : ''}
                <button class="mcp-row-btn mcp-row-btn--reconnect" data-id="${server.id}" title="Yeniden Bağlan">
                  ${iconRefresh(14)}
                </button>
                <button class="mcp-row-btn mcp-row-btn--delete" data-id="${server.id}" title="Kaldır">
                  ${iconTrash(14, 'var(--status-red, #ff5555)')}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Reconnect
    container.querySelectorAll('.mcp-row-btn--reconnect').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const server = this.installedServers.find(s => s.id === id);
        if (server) {
          server.status = 'connecting';
          this.renderInstalledView(container);
          await this.connectInstalled(server);
          this.renderInstalledView(container);
        }
      });
    });

    // Delete
    container.querySelectorAll('.mcp-row-btn--delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        if (id && confirm('Bu MCP sunucusunu kaldırmak istediğinize emin misiniz?')) {
          try {
            await (window as any).kragaAPI.mcp.disconnectServer(id);
          } catch {}
          this.installedServers = this.installedServers.filter(s => s.id !== id);
          this.saveInstalledServers();
          this.renderInstalledView(container);
        }
      });
    });

    // View tools
    container.querySelectorAll('.mcp-row-btn--tools').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.id;
        const server = this.installedServers.find(s => s.id === id);
        if (server && server.tools) {
          this.showToolsListModal(server.name, server.tools);
        }
      });
    });
  }

  // 3. ÖZEL SUNUCU EKLEME (CUSTOM STDIO / SSE)
  private renderCustomAddView(container: HTMLElement): void {
    container.innerHTML = `
      <div class="mcp-custom-form-container">
        <h4 class="mcp-custom-title">
          ${iconPlus(18, 'var(--accent-color, #00f0ff)')}
          <span>Özel Model Context Protocol (MCP) Sunucusu Ekle</span>
        </h4>
        <p class="mcp-custom-desc">
          Kendi geliştirdiğiniz veya harici olarak çalışan stdio JSON-RPC süreçlerini ya da SSE URL uç noktalarını IDE'ye bağlayın.
        </p>

        <form id="formCustomMCP" class="mcp-custom-form">
          <div class="mcp-form-group">
            <label>Sunucu Adı</label>
            <input type="text" id="customMcpName" class="settings-input" placeholder="Örn: SQLite Memory Server" required>
          </div>

          <div class="mcp-form-group">
            <label>Bağlantı Tipi</label>
            <select id="customMcpType" class="settings-select">
              <option value="stdio">Yerel Süreç (Local Stdio JSON-RPC)</option>
              <option value="sse">Uzak Sunucu (Remote HTTP / Server-Sent Events)</option>
            </select>
          </div>

          <div class="mcp-form-group" id="groupCommand">
            <label>Çalıştırma Komutu / Parametreler</label>
            <input type="text" id="customMcpCommand" class="settings-input" placeholder="Örn: npx -y @modelcontextprotocol/server-sqlite --db memory.db">
            <span class="settings-field-hint">Node, Python, uvx veya docker komutları doğrudan çalıştırılır.</span>
          </div>

          <div class="mcp-form-group" id="groupUrl" style="display: none;">
            <label>SSE Sunucu URL Adresi</label>
            <input type="text" id="customMcpUrl" class="settings-input" placeholder="https://mcp.domain.com/sse">
          </div>

          <div class="mcp-form-group">
            <label>Açıklama</label>
            <input type="text" id="customMcpDesc" class="settings-input" placeholder="Sunucunun görevi ve sağladığı araçlar...">
          </div>

          <button type="submit" class="settings-btn settings-btn--accent" style="margin-top: 10px;">
            ${iconCheck(16)} Sunucuyu Kaydet ve Bağlan
          </button>
        </form>
      </div>
    `;

    const form = container.querySelector('#formCustomMCP') as HTMLFormElement;
    const typeSelect = container.querySelector('#customMcpType') as HTMLSelectElement;
    const groupCommand = container.querySelector('#groupCommand') as HTMLElement;
    const groupUrl = container.querySelector('#groupUrl') as HTMLElement;

    typeSelect?.addEventListener('change', () => {
      const isStdio = typeSelect.value === 'stdio';
      groupCommand.style.display = isStdio ? 'block' : 'none';
      groupUrl.style.display = !isStdio ? 'block' : 'none';
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (container.querySelector('#customMcpName') as HTMLInputElement).value.trim();
      const type = (typeSelect.value === 'stdio' ? 'stdio' : 'http') as 'stdio' | 'http';
      const command = (container.querySelector('#customMcpCommand') as HTMLInputElement).value.trim();
      const url = (container.querySelector('#customMcpUrl') as HTMLInputElement).value.trim();
      const desc = (container.querySelector('#customMcpDesc') as HTMLInputElement).value.trim();

      if (!name) return;

      const newServer: InstalledMCPServer = {
        id: `custom-${Date.now()}`,
        name,
        type,
        command: type === 'stdio' ? command : undefined,
        url: type === 'http' ? url : undefined,
        status: 'connecting',
        toolCount: 0,
        description: desc || name
      };

      this.installedServers.push(newServer);
      this.saveInstalledServers();
      this.activeSubTab = 'installed';
      this.render(container.parentElement?.parentElement || container);

      await this.connectInstalled(newServer);
      const hubBody = document.querySelector('#mcpHubBody') as HTMLElement;
      if (hubBody) this.renderSubTab(hubBody);
    });
  }

  // Modallar (Araç İnceleme & Konfigürasyon)
  private showToolsModal(connector: MCPConnectorDef): void {
    this.showToolsListModal(connector.name, connector.tools);
  }

  private showToolsListModal(title: string, tools: { name: string; description: string }[]): void {
    const modal = document.createElement('div');
    modal.className = 'quick-open-overlay';
    modal.innerHTML = `
      <div class="mcp-modal-window">
        <div class="mcp-modal-header">
          <div class="mcp-modal-title">
            ${iconWrench(18, 'var(--accent-color, #00f0ff)')}
            <span>${title} — Sağlanan Araçlar (${tools.length})</span>
          </div>
          <button class="mcp-modal-close">${iconClose(16)}</button>
        </div>
        <div class="mcp-modal-body">
          <div class="mcp-tools-list">
            ${tools.map(t => `
              <div class="mcp-tool-item">
                <span class="mcp-tool-name">${t.name}</span>
                <p class="mcp-tool-desc">${t.description}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.mcp-modal-close')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  private showConnectModal(connector: MCPConnectorDef): void {
    const modal = document.createElement('div');
    modal.className = 'quick-open-overlay';
    modal.innerHTML = `
      <div class="mcp-modal-window">
        <div class="mcp-modal-header">
          <div class="mcp-modal-title">
            ${connector.logo(20)}
            <span>${connector.name} Konfigürasyonu</span>
          </div>
          <button class="mcp-modal-close">${iconClose(16)}</button>
        </div>
        <form id="connectForm" class="mcp-modal-body">
          <p class="mcp-modal-desc">${connector.description}</p>
          
          ${connector.authGuide ? `
            <div style="background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 0.82rem; color: #d0f4ff; line-height: 1.5; display: flex; gap: 10px; align-items: flex-start;">
              <span style="font-size: 1.1rem; line-height: 1; flex-shrink: 0;">ℹ️</span>
              <div>
                <strong style="color: #00f0ff; display: block; margin-bottom: 3px;">Kimlik Doğrulama & Kurulum Rehberi</strong>
                <span>${connector.authGuide}</span>
              </div>
            </div>
          ` : ''}

          ${connector.configFields.map(f => `
            <div class="mcp-form-group">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                <label style="font-weight: 500; font-size: 0.85rem;">${f.label}</label>
                ${f.optional ? '<span style="font-size: 0.72rem; color: #888; font-style: italic;">Opsiyonel</span>' : ''}
              </div>
              <input type="${f.type}" id="field_${f.key}" class="settings-input" placeholder="${f.placeholder}" ${f.optional ? '' : 'required'}>
              ${f.hint ? `<span class="settings-field-hint" style="font-size: 0.75rem; color: #9aa0a6; margin-top: 3px; display: block;">${f.hint}</span>` : ''}
            </div>
          `).join('')}

          <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px;">
            <button type="button" class="settings-btn" id="btnCancelConnect">İptal</button>
            <button type="submit" class="settings-btn settings-btn--accent">
              ${iconCheck(14)} Doğrula ve Bağla
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.mcp-modal-close')?.addEventListener('click', () => modal.remove());
    modal.querySelector('#btnCancelConnect')?.addEventListener('click', () => modal.remove());

    modal.querySelector('#connectForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const config: Record<string, string> = {};
      connector.configFields.forEach(f => {
        const input = modal.querySelector(`#field_${f.key}`) as HTMLInputElement;
        if (input && input.value.trim()) config[f.key] = input.value.trim();
      });

      let fullCommand = connector.defaultCommand || '';
      if (connector.id === 'sqlite' && config.SQLITE_DB_PATH) {
        fullCommand += ` --db "${config.SQLITE_DB_PATH}"`;
      } else if (connector.id === 'filesystem' && config.ALLOWED_DIRECTORIES) {
        fullCommand += ` ${config.ALLOWED_DIRECTORIES}`;
      } else if (connector.id === 'git' && config.GIT_REPO_PATH) {
        fullCommand += ` "${config.GIT_REPO_PATH}"`;
      }

      const newServer: InstalledMCPServer = {
        id: connector.id,
        connectorId: connector.id,
        name: connector.name,
        type: connector.type,
        command: fullCommand,
        url: connector.defaultUrl,
        status: 'connecting',
        toolCount: 0,
        description: connector.description,
        config
      };

      this.installedServers = this.installedServers.filter((x) => x.id !== newServer.id);
      this.installedServers.push(newServer);
      this.saveInstalledServers();
      modal.remove();

      await this.connectInstalled(newServer);
      this.saveInstalledServers();

      const hubBody = document.querySelector('#mcpHubBody') as HTMLElement;
      if (hubBody) this.renderSubTab(hubBody);
    });
  }
}
