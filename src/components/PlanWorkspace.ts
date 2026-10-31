// src/components/PlanWorkspace.ts
// Kraga IDE — Antigravity & Cyberpunk Uygulama Planı Çalışma Alanı (Plan Workspace Panel)
// - Hoş Geldiniz ekranı gibi ana merkez çalışma alanında (editorViewport) açılır
// - Zengin çok kolonlu kart ızgarası (Mimari Şema, Değişiklikler, Test Kontrol Listesi, Riskler)
// - Onayla ve Uygula, Monaco'da Düzenle, Markdown Kopyala ve Kapatma aksiyonları
// - İnteraktif tıklanabilir kontrol listeleri ve canlı Mermaid render

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { loadMermaid } from '../core/mermaidLoader';
import { ImplementationPlanData } from './AgentPanel';

export interface PlanWorkspaceOptions {
  planData: ImplementationPlanData;
  onApprove?: () => void;
  onOpenInEditor?: (title: string, markdown: string) => void;
  onClose?: () => void;
}

export class PlanWorkspaceManager {
  private container: HTMLElement;
  private currentOptions: PlanWorkspaceOptions | null = null;
  private lastOptions: PlanWorkspaceOptions | null = null;
  private status: 'pending' | 'approved' | 'rejected' = 'pending';

  public onStateChange?: (isOpen: boolean) => void;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
  }

  public openPlan(options: PlanWorkspaceOptions): void {
    if (!this.container) {
      this.container = document.getElementById('planWorkspaceView')!;
    }
    this.currentOptions = options;
    this.lastOptions = options;
    this.status = 'pending';
    if (this.container) {
      this.container.style.setProperty('display', 'flex', 'important');
    }
    this.render();
    this.onStateChange?.(true);
  }

  public show(): void {
    if (!this.container) {
      this.container = document.getElementById('planWorkspaceView')!;
    }
    if (this.container) {
      this.container.style.setProperty('display', 'flex', 'important');
    }
    if (!this.currentOptions && this.lastOptions) {
      this.currentOptions = this.lastOptions;
    }
    if (this.currentOptions) {
      this.render();
    }
    this.onStateChange?.(true);
  }

  public hide(): void {
    if (this.container) {
      this.container.style.setProperty('display', 'none', 'important');
    }
  }

  public refresh(): void {
    this.show();
  }

  public close(): void {
    this.hide();
    const closeCb = this.currentOptions?.onClose;
    this.currentOptions = null;
    this.lastOptions = null;
    closeCb?.();
    this.onStateChange?.(false);
  }

  public setApproved(): void {
    this.status = 'approved';
    this.updateStatusBadge();
  }

  public setRejected(): void {
    this.status = 'rejected';
    this.updateStatusBadge();
  }

  private updateStatusBadge(): void {
    const badge = this.container.querySelector('#planWorkspaceStatusBadge');
    if (!badge) return;

    if (this.status === 'approved') {
      badge.className = 'plan-status-badge plan-status-badge--approved';
      badge.innerHTML = `<span class="plan-status-dot"></span> Onaylandı & Uygulanıyor`;
    } else if (this.status === 'rejected') {
      badge.className = 'plan-status-badge plan-status-badge--rejected';
      badge.innerHTML = `<span class="plan-status-dot"></span> Reddedildi`;
    } else {
      badge.className = 'plan-status-badge plan-status-badge--pending';
      badge.innerHTML = `<span class="plan-status-dot"></span> Onay Bekliyor`;
    }
  }

  private getStatusBadgeHtml(): string {
    if (this.status === 'approved') {
      return `<span id="planWorkspaceStatusBadge" class="plan-status-badge plan-status-badge--approved"><span class="plan-status-dot"></span> Onaylandı & Uygulanıyor</span>`;
    } else if (this.status === 'rejected') {
      return `<span id="planWorkspaceStatusBadge" class="plan-status-badge plan-status-badge--rejected"><span class="plan-status-dot"></span> Reddedildi</span>`;
    }
    return `<span id="planWorkspaceStatusBadge" class="plan-status-badge plan-status-badge--pending"><span class="plan-status-dot"></span> Onay Bekliyor</span>`;
  }

  private render(): void {
    if (!this.currentOptions) return;
    const { planData } = this.currentOptions;
    const title = planData.title || 'Implementation Plan';
    const summary = planData.summary || 'Mimari uygulama ve değişiklik planı hazırlandı.';

    // Markdown içeriğini derle
    let fullMarkdown = planData.markdown || '';
    if (!fullMarkdown) {
      let md = `# ${title}\n\n${summary}\n\n`;
      if (planData.steps && planData.steps.length > 0) {
        md += `## Uygulama Adımları\n` + planData.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\n';
      }
      if (planData.files && planData.files.length > 0) {
        md += `## Etkilenen Dosyalar\n` + planData.files.map((f) => `- \`${f}\``).join('\n') + '\n\n';
      }
      if (planData.risks) {
        md += `> [!WARNING]\n> ${planData.risks}\n\n`;
      }
      fullMarkdown = md;
    }

    // Markdown formatlama
    let renderedHtml = '';
    try {
      renderedHtml = marked.parse(fullMarkdown) as string;
      renderedHtml = this.formatGithubAlerts(renderedHtml);
      renderedHtml = this.formatFileBadges(renderedHtml);
    } catch (e) {
      console.warn('Plan markdown render fallback:', e);
      renderedHtml = `<pre>${DOMPurify.sanitize(fullMarkdown)}</pre>`;
    }

    this.container.scrollTop = 0;
    this.container.innerHTML = `
      <div class="plan-workspace-container">
        <!-- Hero Header (Tıpkı Hoş Geldiniz Ekranı Gibi) -->
        <header class="plan-workspace-hero">
          <div class="plan-workspace-hero__left">
            <div class="plan-hero-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
            </div>
            <div class="plan-hero-titles">
              <div class="plan-hero-tag">ARTIFACT • IMPLEMENTATION PLAN</div>
              <h1 class="plan-hero-title">${DOMPurify.sanitize(title)}</h1>
              <div class="plan-hero-meta">
                ${this.getStatusBadgeHtml()}
                <span class="plan-meta-sep">•</span>
                <span class="plan-meta-text">${DOMPurify.sanitize(summary)}</span>
              </div>
            </div>
          </div>

          <div class="plan-workspace-hero__actions">
            <button class="plan-ws-btn plan-ws-btn--approve" id="btnWorkspaceApprove">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>Onayla ve Uygula</span>
            </button>
            <button class="plan-ws-btn plan-ws-btn--editor" id="btnWorkspaceOpenEditor" title="Monaco Editor sekmesi olarak aç">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span>Monaco'da Düzenle</span>
            </button>
            <button class="plan-ws-btn plan-ws-btn--copy" id="btnWorkspaceCopyMd" title="Tüm Markdown'ı panoya kopyala">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
              </svg>
              <span>Kopyala</span>
            </button>
            <button class="plan-ws-btn plan-ws-btn--close" id="btnWorkspaceClose" title="Plan Panelini Kapat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </header>

        <!-- Gövde Alanı (Full Scrollable Card) -->
        <div class="plan-workspace-body">
          <div class="plan-content-card">
            <div class="plan-markdown-render markdown-body" id="planWorkspaceMarkdownBody">
              ${DOMPurify.sanitize(renderedHtml)}
            </div>
          </div>
        </div>

        <!-- Alt Aksiyon Barı -->
        <footer class="plan-workspace-footer">
          <div class="plan-footer-left">
            <span class="plan-footer-tip">
              💡 <strong>İpucu:</strong> Planı onayladığınızda Kraga Agent otomatik olarak <code>Act (Eylem)</code> moduna geçerek belirtilen dosyaları ve komutları oluşturmaya başlar.
            </span>
          </div>
          <div class="plan-footer-right">
            <button class="plan-ws-btn plan-ws-btn--reject" id="btnWorkspaceReject">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              <span>Planı Reddet</span>
            </button>
            <button class="plan-ws-btn plan-ws-btn--approve-large" id="btnWorkspaceApproveBottom">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>Bu Planı Onayla ve Uygulamaya Başla</span>
            </button>
          </div>
        </footer>
      </div>
    `;

    // Mermaid şemalarını render et
    const bodyEl = this.container.querySelector('#planWorkspaceMarkdownBody') as HTMLElement;
    if (bodyEl) {
      this.renderMermaidDiagrams(bodyEl);
      this.bindInteractiveChecklists(bodyEl);
    }

    // Buton dinleyicileri
    const btnApproveTop = this.container.querySelector('#btnWorkspaceApprove');
    const btnApproveBottom = this.container.querySelector('#btnWorkspaceApproveBottom');
    const handleApprove = () => {
      this.setApproved();
      this.currentOptions?.onApprove?.();
    };
    btnApproveTop?.addEventListener('click', handleApprove);
    btnApproveBottom?.addEventListener('click', handleApprove);

    const btnReject = this.container.querySelector('#btnWorkspaceReject');
    btnReject?.addEventListener('click', () => {
      this.setRejected();
    });

    const btnEditor = this.container.querySelector('#btnWorkspaceOpenEditor');
    btnEditor?.addEventListener('click', () => {
      this.currentOptions?.onOpenInEditor?.(title, fullMarkdown);
    });

    const btnCopy = this.container.querySelector('#btnWorkspaceCopyMd');
    btnCopy?.addEventListener('click', async () => {
      await navigator.clipboard.writeText(fullMarkdown);
      const span = btnCopy.querySelector('span');
      if (span) {
        const orig = span.textContent;
        span.textContent = 'Kopyalandı!';
        setTimeout(() => {
          span.textContent = orig;
        }, 2000);
      }
    });

    const btnClose = this.container.querySelector('#btnWorkspaceClose');
    btnClose?.addEventListener('click', () => {
      this.close();
    });
  }

  private bindInteractiveChecklists(container: HTMLElement): void {
    const listItems = container.querySelectorAll('li');
    listItems.forEach((li) => {
      const text = li.innerHTML;
      if (text.includes('[ ]') || text.includes('[x]')) {
        const isChecked = text.includes('[x]');
        const cleanHtml = text.replace(/\[ \]/g, '').replace(/\[x\]/g, '').trim();
        li.className = 'plan-checklist-item';
        li.innerHTML = `
          <label class="plan-checkbox-label">
            <input type="checkbox" class="plan-checkbox-input" ${isChecked ? 'checked' : ''} />
            <span class="plan-checkbox-custom"></span>
            <span class="plan-checkbox-text">${cleanHtml}</span>
          </label>
        `;
      }
    });
  }

  private async renderMermaidDiagrams(container: HTMLElement): Promise<void> {
    const mermaidPres = container.querySelectorAll('pre code.language-mermaid, pre code.language-diagram');
    for (let i = 0; i < mermaidPres.length; i++) {
      const codeEl = mermaidPres[i];
      const preEl = codeEl.closest('pre');
      if (!preEl) continue;

      const mermaidCode = codeEl.textContent || '';
      const diagramId = `plan-mermaid-${Date.now()}-${i}`;
      try {
        const { svg } = await (await loadMermaid()).render(diagramId, mermaidCode);
        const div = document.createElement('div');
        div.className = 'plan-mermaid-diagram';
        div.innerHTML = svg;
        preEl.replaceWith(div);
      } catch (e) {
        console.warn('Plan Mermaid render hatası:', e);
      }
    }
  }

  private formatGithubAlerts(html: string): string {
    const alertTypes: Record<string, { label: string; icon: string; cls: string }> = {
      NOTE: {
        label: 'BİLGİ',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        cls: 'github-alert--note',
      },
      TIP: {
        label: 'İPUCU',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="M2 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"/></svg>',
        cls: 'github-alert--tip',
      },
      IMPORTANT: {
        label: 'ÖNEMLİ',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        cls: 'github-alert--important',
      },
      WARNING: {
        label: 'UYARI',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        cls: 'github-alert--warning',
      },
      CAUTION: {
        label: 'DİKKAT',
        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
        cls: 'github-alert--caution',
      },
    };

    return html.replace(
      /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*?)<\/p>\s*<\/blockquote>/gi,
      (_match, type, content) => {
        const uType = type.toUpperCase();
        const conf = alertTypes[uType] || alertTypes.NOTE;
        return `
          <div class="github-alert ${conf.cls}">
            <div class="github-alert__header">
              ${conf.icon}
              <span>${conf.label}</span>
            </div>
            <div class="github-alert__body">${content}</div>
          </div>
        `;
      }
    );
  }

  private formatFileBadges(html: string): string {
    return html
      .replace(/\[NEW\]/g, '<span class="file-badge file-badge--new">YENİ</span>')
      .replace(/\[MODIFY\]/g, '<span class="file-badge file-badge--modify">DEĞİŞTİR</span>')
      .replace(/\[DELETE\]/g, '<span class="file-badge file-badge--delete">SİL</span>');
  }
}
