// src/components/GraphifyPanel.ts
// Kraga IDE — Cytoscape Tabanlı İnteraktif Kod Bilgi Grafı (Graphify Visualizer)
// - Dosyalar, sınıflar, fonksiyonlar ve import ilişkilerini dallanmış ağaç / kozmik graf olarak çizer
// - Neon Cyberpunk temalı düğümler ve yönlü oklar
// - Düğüme tıklandığında dosyayı Monaco Editor'de açar
// - Arama, filtreleme, layout değiştirme ve otomatik yeniden tarama desteği

import cytoscape, { Core, EventObject } from 'cytoscape';
import DOMPurify from 'dompurify';

export interface CodeNode {
  id: string;
  name: string;
  type: 'file' | 'function' | 'class' | 'module';
  filePath: string;
  inDegree: number;
  outDegree: number;
}

export interface CodeEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'defines';
}

export interface GraphReport {
  totalFiles: number;
  nodes: CodeNode[];
  edges: CodeEdge[];
  godNodes: CodeNode[];
}

export class GraphifyPanel {
  private container: HTMLElement;
  private cy: Core | null = null;
  private currentReport: GraphReport | null = null;
  private currentProjectPath: string | null = null;
  private activeFilter: 'all' | 'files' | 'symbols' = 'all';
  private currentLayoutName: 'breadthfirst' | 'cose' | 'concentric' = 'breadthfirst';
  private onOpenFileCallback?: (filePath: string) => void;

  constructor(containerId: string, onOpenFile?: (filePath: string) => void) {
    this.container = document.getElementById(containerId)!;
    this.onOpenFileCallback = onOpenFile;
  }

  public setProjectPath(projectPath: string | null): void {
    this.currentProjectPath = projectPath;
  }

  public setOpenFileCallback(cb: (filePath: string) => void): void {
    this.onOpenFileCallback = cb;
  }

  public getReport(): GraphReport | null {
    return this.currentReport;
  }

  public async loadAndRender(projectPath?: string): Promise<void> {
    const targetPath = projectPath || this.currentProjectPath;
    if (!targetPath) {
      this.renderEmptyState('Proje açılmadı. Kod bilgi grafını görüntülemek için bir klasör açın.');
      return;
    }
    this.currentProjectPath = targetPath;

    this.renderLoading();

    try {
      const report: GraphReport = await window.kragaAPI.graphify.analyze(targetPath);
      this.currentReport = report;
      this.renderGraphUI(report);
    } catch (err: any) {
      console.error('Graphify analiz hatası:', err);
      this.renderError(err.message || 'Analiz sırasında bilinmeyen bir hata oluştu.');
    }
  }

  private renderLoading(): void {
    this.container.innerHTML = `
      <div class="graphify-loading-state">
        <div class="graphify-spinner"></div>
        <div class="graphify-loading-text">Graphify AST ve kod bağımlılıkları taranıyor...</div>
      </div>
    `;
  }

  private renderEmptyState(message: string): void {
    this.container.innerHTML = `
      <div class="graphify-empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted, #64748b)" stroke-width="1.5">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        <p class="graphify-empty-title">Kod İlişkileri Grafı</p>
        <p class="graphify-empty-desc">${DOMPurify.sanitize(message)}</p>
      </div>
    `;
  }

  private renderError(errMsg: string): void {
    this.container.innerHTML = `
      <div class="graphify-error-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--status-red, #ff5555)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p class="graphify-error-title">Graphify Analiz Hatası</p>
        <p class="graphify-error-desc">${DOMPurify.sanitize(errMsg)}</p>
        <button class="graphify-btn graphify-btn--primary" id="btnGraphifyRetry">Tekrar Dene</button>
      </div>
    `;
    this.container.querySelector('#btnGraphifyRetry')?.addEventListener('click', () => {
      this.loadAndRender();
    });
  }

  private renderGraphUI(report: GraphReport): void {
    const godNodeCount = report.godNodes?.length || 0;

    this.container.innerHTML = `
      <div class="graphify-wrapper">
        <!-- Üst Kontrol & Arama Araç Çubuğu -->
        <div class="graphify-toolbar">
          <div class="graphify-stats-group">
            <span class="graphify-stat-pill" title="Toplam taranan dosya sayısı">
              <span class="graphify-stat-icon">📁</span>
              <strong>${report.totalFiles}</strong> dosya
            </span>
            <span class="graphify-stat-pill" title="Toplam düğüm sayısı">
              <span class="graphify-stat-icon">🔵</span>
              <strong>${report.nodes.length}</strong> düğüm
            </span>
            <span class="graphify-stat-pill" title="Toplam import / call ilişkisi">
              <span class="graphify-stat-icon">🔀</span>
              <strong>${report.edges.length}</strong> ilişki
            </span>
            ${godNodeCount > 0 ? `
              <span class="graphify-stat-pill graphify-stat-pill--god" title="Merkez dosyalar">
                <span class="graphify-stat-icon">⭐</span>
                <strong>${godNodeCount}</strong> merkez
              </span>
            ` : ''}
          </div>

          <div class="graphify-search-box">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" id="graphifySearchInput" placeholder="Düğüm veya dosya ara..." autocomplete="off" />
          </div>

          <div class="graphify-actions-group">
            <div class="graphify-filter-pills">
              <button class="graphify-pill-btn active" data-filter="all">Tümü</button>
              <button class="graphify-pill-btn" data-filter="files">Dosyalar</button>
              <button class="graphify-pill-btn" data-filter="symbols">Semboller</button>
            </div>

            <div class="graphify-layout-selector">
              <button class="graphify-tool-btn" id="btnGraphifyLayout" title="Düzeni Değiştir (Ağaç / Kozmik)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                </svg>
                <span id="graphifyLayoutLabel">Ağaç</span>
              </button>
            </div>

            <button class="graphify-tool-btn" id="btnGraphifyFit" title="Grafı Ekrana Sığdır">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            </button>

            <button class="graphify-tool-btn" id="btnGraphifyRefresh" title="Projeyi Yeniden Tara">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Cytoscape Tuval Alanı -->
        <div class="graphify-canvas-container" id="graphifyCyCanvas"></div>

        <!-- Düğüm Detay / İpucu Kartı -->
        <div class="graphify-node-tooltip" id="graphifyNodeTooltip" style="display: none;"></div>
      </div>
    `;

    this.initCytoscape(report);
    this.bindToolbarEvents(report);
  }

  private initCytoscape(report: GraphReport): void {
    const cyContainer = this.container.querySelector('#graphifyCyCanvas') as HTMLElement;
    if (!cyContainer) return;

    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }

    const godNodeSet = new Set((report.godNodes || []).map((g) => g.id));

    // Elementleri filtreye göre hazırla
    const elements: any[] = [];

    for (const node of report.nodes) {
      if (this.activeFilter === 'files' && node.type !== 'file') continue;
      if (this.activeFilter === 'symbols' && node.type === 'file') continue;

      const isGod = godNodeSet.has(node.id);
      elements.push({
        group: 'nodes',
        data: {
          id: node.id,
          name: node.name,
          type: node.type,
          filePath: node.filePath,
          inDegree: node.inDegree,
          outDegree: node.outDegree,
          isGod: isGod ? 'yes' : 'no',
        },
      });
    }

    const validNodeIds = new Set(elements.map((e) => e.data.id));

    for (let i = 0; i < report.edges.length; i++) {
      const edge = report.edges[i];
      if (validNodeIds.has(edge.from) && validNodeIds.has(edge.to)) {
        elements.push({
          group: 'edges',
          data: {
            id: `e_${i}_${edge.from}_${edge.to}`,
            source: edge.from,
            target: edge.to,
            type: edge.type,
          },
        });
      }
    }

    this.cy = cytoscape({
      container: cyContainer,
      elements,
      boxSelectionEnabled: false,
      autounselectify: false,
      style: [
        // Temel Düğüm Stili
        {
          selector: 'node',
          style: {
            label: 'data(name)',
            color: '#e6edf3',
            'font-size': '11px',
            'font-family': 'Consolas, "Fira Code", monospace',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-background-opacity': 0.85,
            'text-background-color': '#0c0e14',
            'text-background-padding': '3px',
            'text-background-shape': 'roundrectangle',
            width: 32,
            height: 32,
            'background-color': '#161923',
            'border-width': 2,
            'border-color': '#00f0ff',
            'transition-property': 'background-color, border-color, width, height',
            'transition-duration': 0.2,
          },
        },
        // Dosya Düğümleri (File)
        {
          selector: 'node[type = "file"]',
          style: {
            shape: 'roundrectangle',
            'background-color': 'rgba(0, 240, 255, 0.15)',
            'border-color': '#00f0ff',
            width: 36,
            height: 36,
          },
        },
        // Sınıf Düğümleri (Class)
        {
          selector: 'node[type = "class"]',
          style: {
            shape: 'hexagon',
            'background-color': 'rgba(189, 147, 249, 0.2)',
            'border-color': '#bd93f9',
            width: 32,
            height: 32,
          },
        },
        // Fonksiyon Düğümleri (Function)
        {
          selector: 'node[type = "function"]',
          style: {
            shape: 'ellipse',
            'background-color': 'rgba(241, 250, 140, 0.15)',
            'border-color': '#f1fa8c',
            width: 26,
            height: 26,
          },
        },
        // Merkez Dosyalar (God Nodes)
        {
          selector: 'node[isGod = "yes"]',
          style: {
            shape: 'diamond',
            'background-color': 'rgba(80, 250, 123, 0.25)',
            'border-color': '#50fa7b',
            'border-width': 3,
            width: 44,
            height: 44,
            'font-weight': 'bold',
            color: '#50fa7b',
          },
        },
        // Kenarlar (Edges)
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': 'rgba(100, 116, 139, 0.5)',
            'target-arrow-color': 'rgba(100, 116, 139, 0.5)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
          },
        },
        // Import Kenarları
        {
          selector: 'edge[type = "imports"]',
          style: {
            width: 2,
            'line-color': 'rgba(0, 240, 255, 0.6)',
            'target-arrow-color': '#00f0ff',
          },
        },
        // Tanım Kenarları (Defines)
        {
          selector: 'edge[type = "defines"]',
          style: {
            width: 1.2,
            'line-style': 'dashed',
            'line-color': 'rgba(189, 147, 249, 0.45)',
            'target-arrow-color': '#bd93f9',
          },
        },
        // Çağrı Kenarları (Calls)
        {
          selector: 'edge[type = "calls"]',
          style: {
            width: 1.8,
            'line-color': 'rgba(80, 250, 123, 0.65)',
            'target-arrow-color': '#50fa7b',
          },
        },
        // Seçili Düğüm
        {
          selector: 'node:selected',
          style: {
            'border-color': '#ff79c6',
            'border-width': 4,
            'background-color': 'rgba(255, 121, 198, 0.3)',
          },
        },
      ],
      layout: this.getLayoutConfig(),
    });

    this.bindCyEvents();
  }

  private getLayoutConfig(): any {
    if (this.currentLayoutName === 'breadthfirst') {
      return {
        name: 'breadthfirst',
        directed: true,
        padding: 40,
        spacingFactor: 1.4,
        animate: true,
        animationDuration: 400,
      };
    } else if (this.currentLayoutName === 'cose') {
      return {
        name: 'cose',
        animate: true,
        animationDuration: 500,
        padding: 40,
        nodeOverlap: 20,
        idealEdgeLength: 60,
        nodeRepulsion: 400000,
      };
    } else {
      return {
        name: 'concentric',
        padding: 40,
        animate: true,
        animationDuration: 400,
      };
    }
  }

  private bindCyEvents(): void {
    if (!this.cy) return;

    const tooltip = this.container.querySelector('#graphifyNodeTooltip') as HTMLElement;

    // Düğüme tıklama -> Monaco'da aç
    this.cy.on('tap', 'node', (evt: EventObject) => {
      const node = evt.target;
      const filePath = node.data('filePath');
      if (filePath) {
        let targetAbs = filePath;
        if (this.currentProjectPath && !filePath.includes(':') && !filePath.startsWith('/')) {
          const sep = this.currentProjectPath.includes('\\') ? '\\' : '/';
          targetAbs = `${this.currentProjectPath}${sep}${filePath}`;
        }
        this.onOpenFileCallback?.(targetAbs);
      }
    });

    // Hover -> Tooltip
    this.cy.on('mouseover', 'node', (evt: EventObject) => {
      const node = evt.target;
      const data = node.data();
      if (!tooltip) return;

      const renderedPos = node.renderedPosition();
      tooltip.style.display = 'block';
      tooltip.style.left = `${renderedPos.x + 20}px`;
      tooltip.style.top = `${renderedPos.y - 15}px`;

      const typeLabel = data.type === 'file' ? 'Dosya' : (data.type === 'class' ? 'Sınıf' : 'Fonksiyon');
      tooltip.innerHTML = `
        <div class="graphify-tip-header">
          <span class="graphify-tip-type">${typeLabel}</span>
          <strong>${DOMPurify.sanitize(data.name)}</strong>
        </div>
        <div class="graphify-tip-path">${DOMPurify.sanitize(data.filePath)}</div>
        <div class="graphify-tip-meta">
          <span>İçeren Ref: <strong>${data.inDegree || 0}</strong></span>
          <span>Dış Ref: <strong>${data.outDegree || 0}</strong></span>
          ${data.isGod === 'yes' ? '<span class="graphify-god-tag">Merkez Dosya (God Node)</span>' : ''}
        </div>
      `;
    });

    this.cy.on('mouseout', 'node', () => {
      if (tooltip) tooltip.style.display = 'none';
    });

    this.cy.on('pan zoom', () => {
      if (tooltip) tooltip.style.display = 'none';
    });
  }

  private bindToolbarEvents(report: GraphReport): void {
    // 1. Arama
    const searchInput = this.container.querySelector('#graphifySearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!this.cy) return;

      if (!q) {
        this.cy.elements().removeClass('dimmed highlighted');
        return;
      }

      this.cy.batch(() => {
        this.cy!.elements().addClass('dimmed').removeClass('highlighted');
        const matched = this.cy!.nodes().filter((n) => {
          const name = (n.data('name') || '').toLowerCase();
          const p = (n.data('filePath') || '').toLowerCase();
          return name.includes(q) || p.includes(q);
        });
        matched.removeClass('dimmed').addClass('highlighted');
        matched.connectedEdges().removeClass('dimmed');
      });
    });

    // 2. Filtre Butonları
    const filterBtns = this.container.querySelectorAll('.graphify-pill-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = (btn.getAttribute('data-filter') || 'all') as any;
        this.initCytoscape(report);
      });
    });

    // 3. Layout Değiştirici
    const btnLayout = this.container.querySelector('#btnGraphifyLayout');
    const layoutLabel = this.container.querySelector('#graphifyLayoutLabel');
    btnLayout?.addEventListener('click', () => {
      if (this.currentLayoutName === 'breadthfirst') {
        this.currentLayoutName = 'cose';
        if (layoutLabel) layoutLabel.textContent = 'Kozmik';
      } else if (this.currentLayoutName === 'cose') {
        this.currentLayoutName = 'concentric';
        if (layoutLabel) layoutLabel.textContent = 'Halkasal';
      } else {
        this.currentLayoutName = 'breadthfirst';
        if (layoutLabel) layoutLabel.textContent = 'Ağaç';
      }
      if (this.cy) {
        this.cy.layout(this.getLayoutConfig()).run();
      }
    });

    // 4. Fit Butonu
    this.container.querySelector('#btnGraphifyFit')?.addEventListener('click', () => {
      this.cy?.fit(undefined, 30);
    });

    // 5. Yenile Butonu
    this.container.querySelector('#btnGraphifyRefresh')?.addEventListener('click', () => {
      this.loadAndRender();
    });
  }

  public resize(): void {
    if (this.cy) {
      this.cy.resize();
      this.cy.fit(undefined, 30);
    }
  }
}
