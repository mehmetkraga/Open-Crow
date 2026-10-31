// src/components/AuxiliaryPane.ts
// Kraga IDE — Antigravity Tarzı Auxiliary Pane (Oturum Bağlamı & Varlıklar Paneli)
// Subagents, Files Changed, Artifacts ve Uploads akordeonları

import DOMPurify from 'dompurify';
import { SubagentManager, SubagentSession } from './SubagentManager';

export interface ChangedFileItem {
  path: string;
  fileName: string;
  parentFolder: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
  gitStatus?: string; // 'M', 'M+', 'A', 'D', '??'
  timestamp: number;
}

export interface ArtifactItem {
  id: string;
  type: 'plan' | 'walkthrough' | 'task' | 'script' | 'media' | 'diagram';
  title: string;
  description?: string;
  timestamp: number;
  data?: any;
}

export interface UploadItem {
  id: string;
  name: string;
  title: string;
  path?: string;
  dataUrl?: string;
  timestamp: number;
  size?: number;
}

export class AuxiliaryPaneManager {
  private container: HTMLElement;
  private subagentManager?: SubagentManager;
  private currentProjectPath: string | null = null;

  // Durum koleksiyonları
  private changedFiles: Map<string, ChangedFileItem> = new Map();
  private artifacts: ArtifactItem[] = [];
  private uploads: UploadItem[] = [];

  // Akordeon açık/kapalı durumları (varsayılan: hepsi açık)
  private sectionState = {
    subagents: true,
    files: true,
    artifacts: true,
    uploads: true,
  };

  // 'See all' genişletme durumları (varsayılan: ilk 5 gösterilir)
  private expandedState = {
    subagents: false,
    files: false,
    artifacts: false,
    uploads: false,
  };

  // Dosya filtresi: 'uncommitted' | 'all'
  private fileFilter: 'uncommitted' | 'all' = 'uncommitted';

  // Callback'ler
  public onOpenFile?: (filePath: string) => Promise<void>;
  public onOpenArtifact?: (artifact: ArtifactItem) => void;
  public onOpenSubagent?: (session: SubagentSession) => void;
  public onOpenUpload?: (upload: UploadItem) => void;
  public onBadgeUpdate?: (totalCount: number) => void;

  constructor(containerId: string, subagentManager?: SubagentManager) {
    const el = document.getElementById(containerId);
    if (!el) {
      throw new Error(`AuxiliaryPane container bulunamadi: #${containerId}`);
    }
    this.container = el;
    this.container.className = 'aux-pane';

    if (subagentManager) {
      this.setSubagentManager(subagentManager);
    }

    this.render();
  }

  public setSubagentManager(sm: SubagentManager): void {
    this.subagentManager = sm;
    this.subagentManager.onEvent(() => {
      this.render();
      this.notifyBadge();
    });
  }

  public setProjectPath(path: string | null): void {
    this.currentProjectPath = path;
    if (path) {
      this.refreshGitStatus();
    }
  }

  // ─── Takip Metodları ────────────────────────────────────────────────────────

  /**
   * Oturumda değiştirilen/oluşturulan bir dosyayı kaydeder
   */
  public trackFileChange(
    filePath: string,
    status: 'modified' | 'added' | 'deleted' = 'modified',
    gitCode?: string
  ): void {
    const cleanPath = filePath.replace(/\\/g, '/');
    const parts = cleanPath.split('/');
    const fileName = parts.pop() || cleanPath;
    const parentFolder = parts.length > 0 ? parts[parts.length - 1] : '';

    this.changedFiles.set(cleanPath, {
      path: filePath,
      fileName,
      parentFolder,
      status,
      gitStatus: gitCode || (status === 'added' ? 'A' : status === 'deleted' ? 'D' : 'M+'),
      timestamp: Date.now(),
    });

    this.render();
    this.notifyBadge();
  }

  /**
   * Oturumda üretilen bir plan/rapor/script artifact'ını kaydeder
   */
  public trackArtifact(artifact: Omit<ArtifactItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): void {
    const id = artifact.id || `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = artifact.timestamp || Date.now();
    
    // Aynı id veya başlıkla varsa güncelle, yoksa başa ekle
    const existingIdx = this.artifacts.findIndex(a => a.id === id || a.title === artifact.title);
    if (existingIdx !== -1) {
      this.artifacts[existingIdx] = { ...this.artifacts[existingIdx], ...artifact, id, timestamp };
    } else {
      this.artifacts.unshift({ ...artifact, id, timestamp });
    }

    this.render();
    this.notifyBadge();
  }

  /**
   * Kullanıcının yüklediği bir görsel veya eki kaydeder
   */
  public trackUpload(upload: Omit<UploadItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): void {
    const id = upload.id || `upl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const timestamp = upload.timestamp || Date.now();
    this.uploads.unshift({ ...upload, id, timestamp });

    this.render();
    this.notifyBadge();
  }

  /**
   * Git durumunu sorgulayıp değiştirilen dosyaları günceller
   */
  public async refreshGitStatus(): Promise<void> {
    if (!this.currentProjectPath || !(window as any).kragaAPI?.terminal?.runCommand) return;

    try {
      const res = await (window as any).kragaAPI.terminal.runCommand('git status --porcelain', this.currentProjectPath);
      if (res && res.stdout) {
        const lines = res.stdout.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const statusCode = trimmed.slice(0, 2).trim();
          const relPath = trimmed.slice(2).trim();
          if (!relPath) continue;

          let status: 'modified' | 'added' | 'deleted' | 'untracked' = 'modified';
          if (statusCode.includes('A')) status = 'added';
          else if (statusCode.includes('D')) status = 'deleted';
          else if (statusCode.includes('?')) status = 'untracked';

          const fullPath = this.currentProjectPath.includes('\\')
            ? `${this.currentProjectPath}\\${relPath.replace(/\//g, '\\')}`
            : `${this.currentProjectPath}/${relPath}`;

          const cleanPath = fullPath.replace(/\\/g, '/');
          const parts = cleanPath.split('/');
          const fileName = parts.pop() || cleanPath;
          const parentFolder = parts.length > 0 ? parts[parts.length - 1] : '';

          this.changedFiles.set(cleanPath, {
            path: fullPath,
            fileName,
            parentFolder,
            status,
            gitStatus: statusCode === '??' ? '??' : statusCode.includes('M') ? 'M+' : statusCode,
            timestamp: Date.now(),
          });
        }
        this.render();
        this.notifyBadge();
      }
    } catch {}
  }

  /**
   * Oturumu sıfırlar
   */
  public clearSession(): void {
    this.changedFiles.clear();
    this.artifacts = [];
    this.uploads = [];
    this.render();
    this.notifyBadge();
  }

  public getTotalCount(): number {
    const subagentsCount = this.subagentManager?.getAllSessions().length || 0;
    return subagentsCount + this.changedFiles.size + this.artifacts.length + this.uploads.length;
  }

  private notifyBadge(): void {
    const count = this.getTotalCount();
    this.onBadgeUpdate?.(count);
  }

  // ─── Render Metodları ───────────────────────────────────────────────────────

  public render(): void {
    const subagents = this.subagentManager?.getAllSessions() || [];
    const files = Array.from(this.changedFiles.values());
    const artifacts = this.artifacts;
    const uploads = this.uploads;

    this.container.innerHTML = `
      <div class="aux-scroll-host">
        <!-- 1. Subagents Bölümü -->
        ${this.renderSubagentsSection(subagents)}

        <!-- 2. Files Changed Bölümü -->
        ${this.renderFilesSection(files)}

        <!-- 3. Artifacts Bölümü -->
        ${this.renderArtifactsSection(artifacts)}

        <!-- 4. Uploads Bölümü -->
        ${this.renderUploadsSection(uploads)}
      </div>
    `;

    this.attachEventListeners();
  }

  // ─── 1. Subagents Bölümü ────────────────────────────────────────────────────
  private renderSubagentsSection(sessions: SubagentSession[]): string {
    const isOpen = this.sectionState.subagents;
    const count = sessions.length;
    const isExpanded = this.expandedState.subagents;
    const displayed = isExpanded ? sessions : sessions.slice(0, 5);

    return `
      <div class="aux-section" data-section="subagents">
        <div class="aux-section-header" data-toggle="subagents">
          <div class="aux-section-title">
            <span>Subagents</span>
            <span class="aux-count-badge">${count}</span>
          </div>
          <button class="aux-chevron-btn ${isOpen ? 'aux-chevron--open' : ''}" aria-label="Genişlet/Daralt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        <div class="aux-section-content" style="display: ${isOpen ? 'block' : 'none'};">
          ${count === 0 ? `
            <div class="aux-empty-state">Bu oturumda henüz alt ajan çalıştırılmadı</div>
          ` : `
            <div class="aux-items-list">
              ${displayed.map(s => this.renderSubagentItem(s)).join('')}
            </div>
            ${count > 5 ? `
              <button class="aux-see-all-btn" data-see-all="subagents">
                ${isExpanded ? 'Daha az göster' : `See all (${count})`}
              </button>
            ` : ''}
          `}
        </div>
      </div>
    `;
  }

  private renderSubagentItem(s: SubagentSession): string {
    const elapsedMinutes = Math.max(1, Math.round(s.elapsedMs / 60000));
    const timeText = `Worked for ${elapsedMinutes}m`;
    const isRunning = s.status === 'running';

    return `
      <div class="aux-item aux-item-subagent" data-subagent-id="${s.id}">
        <div class="aux-item-subagent-info">
          <div class="aux-item-subagent-name">${DOMPurify.sanitize(s.role)}</div>
          <div class="aux-item-subagent-sub">${timeText}</div>
        </div>
        <div class="aux-item-status-col">
          ${isRunning ? `
            <div class="aux-spinner" title="Çalışıyor..."></div>
          ` : s.status === 'done' ? `
            <div class="aux-icon-check" title="Tamamlandı">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>
            </div>
          ` : `
            <div class="aux-icon-error" title="Hata veya İptal">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff5555" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // ─── 2. Files Changed Bölümü ────────────────────────────────────────────────
  private renderFilesSection(files: ChangedFileItem[]): string {
    const isOpen = this.sectionState.files;
    const count = files.length;
    const isExpanded = this.expandedState.files;

    let filtered = files;
    if (this.fileFilter === 'uncommitted') {
      filtered = files.filter(f => f.gitStatus !== undefined && f.gitStatus !== '');
    }
    const displayed = isExpanded ? filtered : filtered.slice(0, 5);

    return `
      <div class="aux-section" data-section="files">
        <div class="aux-section-header" data-toggle="files">
          <div class="aux-section-title">
            <span>Files Changed</span>
            <span class="aux-count-badge">${count}</span>
          </div>
          <div class="aux-header-right" onclick="event.stopPropagation();">
            <select class="aux-filter-select" id="auxFileFilterSelect">
              <option value="uncommitted" ${this.fileFilter === 'uncommitted' ? 'selected' : ''}>Uncommitted</option>
              <option value="all" ${this.fileFilter === 'all' ? 'selected' : ''}>All</option>
            </select>
            <button class="aux-chevron-btn ${isOpen ? 'aux-chevron--open' : ''}" aria-label="Genişlet/Daralt">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>

        <div class="aux-section-content" style="display: ${isOpen ? 'block' : 'none'};">
          ${filtered.length === 0 ? `
            <div class="aux-empty-state">Değiştirilen dosya bulunamadı</div>
          ` : `
            <div class="aux-items-list">
              ${displayed.map(f => this.renderFileItem(f)).join('')}
            </div>
            ${filtered.length > 5 ? `
              <button class="aux-see-all-btn" data-see-all="files">
                ${isExpanded ? 'Daha az göster' : `See all (${filtered.length})`}
              </button>
            ` : ''}
          `}
        </div>
      </div>
    `;
  }

  private renderFileItem(f: ChangedFileItem): string {
    const gitCode = f.gitStatus || 'M+';
    const isMPlus = gitCode === 'M+' || gitCode === 'M';
    const isA = gitCode === 'A' || gitCode === '??';
    const isD = gitCode === 'D';

    return `
      <div class="aux-item aux-item-file" data-file-path="${DOMPurify.sanitize(f.path)}">
        <div class="aux-file-status-icon ${isMPlus ? 'status--modified' : isA ? 'status--added' : 'status--deleted'}">
          ${isD ? `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ` : isA ? `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          ` : `
            <span class="aux-git-code">M+</span>
          `}
        </div>
        <div class="aux-file-name" title="${DOMPurify.sanitize(f.path)}">${DOMPurify.sanitize(f.fileName)}</div>
        ${f.parentFolder ? `
          <div class="aux-folder-pill" title="${DOMPurify.sanitize(f.parentFolder)}">
            <span>${DOMPurify.sanitize(f.parentFolder)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  // ─── 3. Artifacts Bölümü ───────────────────────────────────────────────────
  private renderArtifactsSection(artifacts: ArtifactItem[]): string {
    const isOpen = this.sectionState.artifacts;
    const count = artifacts.length;
    const isExpanded = this.expandedState.artifacts;
    const displayed = isExpanded ? artifacts : artifacts.slice(0, 5);

    return `
      <div class="aux-section" data-section="artifacts">
        <div class="aux-section-header" data-toggle="artifacts">
          <div class="aux-section-title">
            <span>Artifacts</span>
            <span class="aux-count-badge">${count}</span>
          </div>
          <button class="aux-chevron-btn ${isOpen ? 'aux-chevron--open' : ''}" aria-label="Genişlet/Daralt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        <div class="aux-section-content" style="display: ${isOpen ? 'block' : 'none'};">
          ${count === 0 ? `
            <div class="aux-empty-state">Bu oturumda henüz plan veya çıktı üretilmedi</div>
          ` : `
            <div class="aux-items-list">
              ${displayed.map(a => this.renderArtifactItem(a)).join('')}
            </div>
            ${count > 5 ? `
              <button class="aux-see-all-btn" data-see-all="artifacts">
                ${isExpanded ? 'Daha az göster' : `See all (${count})`}
              </button>
            ` : ''}
          `}
        </div>
      </div>
    `;
  }

  private renderArtifactItem(a: ArtifactItem): string {
    return `
      <div class="aux-item aux-item-artifact" data-artifact-id="${a.id}">
        <div class="aux-artifact-icon">
          ${this.getArtifactIcon(a.type)}
        </div>
        <div class="aux-artifact-title">${DOMPurify.sanitize(a.title)}</div>
        <div class="aux-artifact-time">${this.formatTimestamp(a.timestamp)}</div>
      </div>
    `;
  }

  private getArtifactIcon(type: string): string {
    switch (type) {
      case 'walkthrough':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>`;
      case 'task':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
      case 'media':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
      case 'script':
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
      case 'plan':
      default:
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
    }
  }

  // ─── 4. Uploads Bölümü ─────────────────────────────────────────────────────
  private renderUploadsSection(uploads: UploadItem[]): string {
    const isOpen = this.sectionState.uploads;
    const count = uploads.length;
    const isExpanded = this.expandedState.uploads;
    const displayed = isExpanded ? uploads : uploads.slice(0, 5);

    return `
      <div class="aux-section" data-section="uploads">
        <div class="aux-section-header" data-toggle="uploads">
          <div class="aux-section-title">
            <span>Uploads</span>
            <span class="aux-count-badge">${count}</span>
          </div>
          <button class="aux-chevron-btn ${isOpen ? 'aux-chevron--open' : ''}" aria-label="Genişlet/Daralt">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>

        <div class="aux-section-content" style="display: ${isOpen ? 'block' : 'none'};">
          ${count === 0 ? `
            <div class="aux-empty-state">Henüz görsel veya dosya yüklenmedi</div>
          ` : `
            <div class="aux-items-list">
              ${displayed.map(u => this.renderUploadItem(u)).join('')}
            </div>
            ${count > 5 ? `
              <button class="aux-see-all-btn" data-see-all="uploads">
                ${isExpanded ? 'Daha az göster' : `See all (${count})`}
              </button>
            ` : ''}
          `}
        </div>
      </div>
    `;
  }

  private renderUploadItem(u: UploadItem): string {
    return `
      <div class="aux-item aux-item-upload" data-upload-id="${u.id}">
        <div class="aux-upload-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
        </div>
        <div class="aux-upload-name">${DOMPurify.sanitize(u.title || u.name)}</div>
        <div class="aux-upload-time">${this.formatTimestamp(u.timestamp)}</div>
      </div>
    `;
  }

  // ─── Yardımcı Fonksiyonlar ─────────────────────────────────────────────────
  private formatTimestamp(ts: number): string {
    const date = new Date(ts);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  // ─── Event Dinleyicileri ───────────────────────────────────────────────────
  private attachEventListeners(): void {
    // 1. Akordeon Başlık Tıklamaları
    this.container.querySelectorAll('[data-toggle]').forEach(header => {
      header.addEventListener('click', () => {
        const key = (header as HTMLElement).dataset.toggle as keyof typeof this.sectionState;
        if (key && this.sectionState[key] !== undefined) {
          this.sectionState[key] = !this.sectionState[key];
          this.render();
        }
      });
    });

    // 2. 'See all' Butonları
    this.container.querySelectorAll('[data-see-all]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = (btn as HTMLElement).dataset.seeAll as keyof typeof this.expandedState;
        if (key && this.expandedState[key] !== undefined) {
          this.expandedState[key] = !this.expandedState[key];
          this.render();
        }
      });
    });

    // 3. Dosya Filtre Seçimi
    const filterSelect = this.container.querySelector('#auxFileFilterSelect') as HTMLSelectElement;
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        e.stopPropagation();
        this.fileFilter = filterSelect.value as 'uncommitted' | 'all';
        this.render();
      });
    }

    // 4. Subagent Tıklaması -> Detay Modalı
    this.container.querySelectorAll('.aux-item-subagent').forEach(item => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.subagentId;
        if (id && this.subagentManager) {
          const session = this.subagentManager.getSession(id);
          if (session) {
            if (this.onOpenSubagent) {
              this.onOpenSubagent(session);
            } else {
              this.showSubagentDetailModal(session);
            }
          }
        }
      });
    });

    // 5. Dosya Tıklaması -> Editörde Aç
    this.container.querySelectorAll('.aux-item-file').forEach(item => {
      item.addEventListener('click', () => {
        const path = (item as HTMLElement).dataset.filePath;
        if (path && this.onOpenFile) {
          this.onOpenFile(path);
        }
      });
    });

    // 6. Artifact Tıklaması -> Görüntüleyiciyi Aç
    this.container.querySelectorAll('.aux-item-artifact').forEach(item => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.artifactId;
        const art = this.artifacts.find(a => a.id === id);
        if (art && this.onOpenArtifact) {
          this.onOpenArtifact(art);
        }
      });
    });

    // 7. Upload Tıklaması -> Önizleme
    this.container.querySelectorAll('.aux-item-upload').forEach(item => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.uploadId;
        const upl = this.uploads.find(u => u.id === id);
        if (upl) {
          if (this.onOpenUpload) {
            this.onOpenUpload(upl);
          } else {
            this.showUploadPreviewModal(upl);
          }
        }
      });
    });
  }

  // ─── Detay Modalları ───────────────────────────────────────────────────────

  public showSubagentDetailModal(session: SubagentSession): void {
    const existing = document.querySelector('.aux-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'aux-modal-overlay';

    const elapsedMinutes = Math.max(1, Math.round(session.elapsedMs / 60000));

    overlay.innerHTML = `
      <div class="aux-modal-card">
        <div class="aux-modal-header">
          <div class="aux-modal-title-group">
            <div class="aux-modal-badge">SUBAGENT</div>
            <h3 class="aux-modal-title">${DOMPurify.sanitize(session.role)}</h3>
            <span class="aux-modal-sub">${DOMPurify.sanitize(session.roleDefinition?.description || '')} · Worked for ${elapsedMinutes}m</span>
          </div>
          <button class="aux-modal-close-btn" id="btnAuxModalClose">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="aux-modal-body">
          <div class="aux-modal-section">
            <div class="aux-modal-section-title">GÖREV (TASK)</div>
            <div class="aux-modal-task-box">${DOMPurify.sanitize(session.task)}</div>
          </div>

          ${session.toolLog && session.toolLog.length > 0 ? `
            <div class="aux-modal-section">
              <div class="aux-modal-section-title">ARAÇ LOGLARI (${session.toolLog.length})</div>
              <div class="aux-modal-tool-list">
                ${session.toolLog.map(t => `
                  <div class="aux-tool-log-row">
                    <span class="aux-tool-name">${DOMPurify.sanitize(t.tool)}</span>
                    <span class="aux-tool-args">${DOMPurify.sanitize(t.args)}</span>
                    <span class="aux-tool-status ${t.status}">${t.status}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="aux-modal-section">
            <div class="aux-modal-section-title">SONUÇ RAPORU</div>
            <div class="aux-modal-result-box">${DOMPurify.sanitize(session.result || '(Henüz sonuç üretilmedi)')}</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#btnAuxModalClose');
    closeBtn?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  public showUploadPreviewModal(upload: UploadItem): void {
    const existing = document.querySelector('.aux-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'aux-modal-overlay';

    overlay.innerHTML = `
      <div class="aux-modal-card aux-modal-card--media">
        <div class="aux-modal-header">
          <div class="aux-modal-title-group">
            <div class="aux-modal-badge">UPLOAD</div>
            <h3 class="aux-modal-title">${DOMPurify.sanitize(upload.title || upload.name)}</h3>
          </div>
          <button class="aux-modal-close-btn" id="btnAuxModalClose">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="aux-modal-body aux-modal-body--media">
          ${upload.dataUrl ? `
            <img src="${upload.dataUrl}" alt="${DOMPurify.sanitize(upload.name)}" class="aux-preview-img" />
          ` : `
            <div class="aux-preview-placeholder">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              <span>${DOMPurify.sanitize(upload.name)}</span>
            </div>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('#btnAuxModalClose');
    closeBtn?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
}
