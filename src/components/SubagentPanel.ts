// src/components/SubagentPanel.ts
// Kraga IDE v2.7 — Subagent Paneli UI
// Aktif ve tamamlanmis subagent'larin gercek zamanli gorunumu

import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { SubagentManager, type SubagentSession, type SubagentStatus } from './SubagentManager';
import { iconChevronDown } from './icons';

export class SubagentPanel {
  private container: HTMLElement;
  private listEl: HTMLElement;
  private countEl: HTMLElement;
  private manager: SubagentManager;
  private timers = new Map<string, number>();

  constructor(manager: SubagentManager) {
    this.manager = manager;
    this.container = document.getElementById('subagentContainer')!;
    this.listEl = document.getElementById('subagentList')!;
    this.countEl = document.getElementById('subagentCount')!;

    // Event dinle
    manager.onEvent((type, session) => {
      this.handleEvent(type, session);
    });
  }

  private handleEvent(type: string, session: SubagentSession): void {
    this.container.style.display = 'block';
    this.updateCount();

    switch (type) {
      case 'spawn':
        this.renderSessionCard(session);
        break;
      case 'update':
      case 'tool':
        this.updateSessionCard(session);
        break;
      case 'complete':
      case 'error':
        this.finalizeSessionCard(session);
        break;
    }
  }

  private updateCount(): void {
    const active = this.manager.getActiveSessions().length;
    const total = this.manager.getAllSessions().length;
    this.countEl.textContent = active > 0 ? `${active} aktif` : `${total}`;
  }

  private getStatusDotClass(status: SubagentStatus): string {
    switch (status) {
      case 'running': return 'subagent-dot--running';
      case 'done': return 'subagent-dot--done';
      case 'error': return 'subagent-dot--error';
      case 'cancelled': return 'subagent-dot--cancelled';
      default: return '';
    }
  }

  private renderSessionCard(session: SubagentSession): void {
    const card = document.createElement('div');
    card.className = 'subagent-card subagent-card--running';
    card.id = `subagent-${session.id}`;
    card.innerHTML = `
      <div class="subagent-card-header" role="button" tabindex="0">
        <div class="subagent-card-header-left">
          <span class="subagent-dot ${this.getStatusDotClass(session.status)}"></span>
          <span class="subagent-card-icon">${session.roleDefinition.iconSvg}</span>
          <span class="subagent-card-role">${DOMPurify.sanitize(session.role)}</span>
        </div>
        <div class="subagent-card-header-right">
          <span class="subagent-card-timer">0.0s</span>
          <button class="subagent-card-kill" title="Durdur" data-id="${session.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </button>
          <span class="subagent-card-chevron">${iconChevronDown(12)}</span>
        </div>
      </div>
      <div class="subagent-card-task">${DOMPurify.sanitize(session.task.slice(0, 120))}</div>
      <div class="subagent-card-tools"></div>
      <div class="subagent-card-body subagent-card-body--collapsed">
        <div class="subagent-card-result"></div>
      </div>
    `;

    // Tiklama: expand/collapse
    const header = card.querySelector('.subagent-card-header') as HTMLElement;
    header.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.subagent-card-kill')) return;
      card.classList.toggle('subagent-card--expanded');
    });

    // Durdur butonu
    const killBtn = card.querySelector('.subagent-card-kill') as HTMLElement;
    killBtn.addEventListener('click', () => {
      this.manager.killSubagent(session.id);
    });

    this.listEl.prepend(card);

    // Timer baslat
    const timerEl = card.querySelector('.subagent-card-timer') as HTMLElement;
    const startTime = session.createdAt;
    const interval = window.setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      timerEl.textContent = `${elapsed}s`;
    }, 100);
    this.timers.set(session.id, interval);
  }

  private updateSessionCard(session: SubagentSession): void {
    const card = document.getElementById(`subagent-${session.id}`);
    if (!card) return;

    // Arac logunu guncelle
    const toolsEl = card.querySelector('.subagent-card-tools') as HTMLElement;
    if (session.toolLog.length > 0) {
      const last = session.toolLog[session.toolLog.length - 1];
      const statusIcon = last.status === 'running'
        ? '<span class="subagent-tool-spinner"></span>'
        : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--status-green, #50fa7b)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
      toolsEl.innerHTML = `
        <div class="subagent-tool-entry">
          ${statusIcon}
          <span class="subagent-tool-name">${last.tool}</span>
          <span class="subagent-tool-args">${DOMPurify.sanitize(last.args.slice(0, 60))}</span>
        </div>
      `;
    }
  }

  private finalizeSessionCard(session: SubagentSession): void {
    const card = document.getElementById(`subagent-${session.id}`);
    if (!card) return;

    // Timer durdur
    const timerId = this.timers.get(session.id);
    if (timerId) {
      clearInterval(timerId);
      this.timers.delete(session.id);
    }

    // Statu guncelle
    card.className = `subagent-card subagent-card--${session.status}`;
    const dot = card.querySelector('.subagent-dot') as HTMLElement;
    if (dot) dot.className = `subagent-dot ${this.getStatusDotClass(session.status)}`;

    const timerEl = card.querySelector('.subagent-card-timer') as HTMLElement;
    if (timerEl) timerEl.textContent = `${(session.elapsedMs / 1000).toFixed(1)}s`;

    // Kill butonu gizle
    const killBtn = card.querySelector('.subagent-card-kill') as HTMLElement;
    if (killBtn) killBtn.style.display = 'none';

    // Sonucu goster
    const resultEl = card.querySelector('.subagent-card-result') as HTMLElement;
    if (resultEl && session.result) {
      resultEl.innerHTML = DOMPurify.sanitize(marked.parse(session.result.slice(0, 2000)) as string);
    }

    // Araclari temizle
    const toolsEl = card.querySelector('.subagent-card-tools') as HTMLElement;
    if (toolsEl && session.toolLog.length > 0) {
      toolsEl.innerHTML = session.toolLog.map(t => `
        <div class="subagent-tool-entry subagent-tool-entry--done">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${t.status === 'error' ? 'var(--status-red, #ff5555)' : 'var(--status-green, #50fa7b)'}" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
          <span class="subagent-tool-name">${t.tool}</span>
        </div>
      `).join('');
    }

    this.updateCount();
  }
}
