// src/components/AgentPanel.ts
// Kraga IDE v2.5 AI Agent Paneli
// - Otonom Araç Çağırma Döngüsü (Autonomous Tool Calling Loop & Multi-Turn Reasoning)
// - Etkileşimli Slash Komutları Popover'ı (/compact, /clear, /council, /security, /refactor, /test, /debug, /plan, /act, /skills, /mcp, /help)
// - Otomatik ve Manuel Bağlam Sıkıştırma (Auto-Compact Engine)
// - Gelişmiş Düşünme (Thinking) Göstergesi & Diff/Apply

import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { sendAgentStream, ChatMessage } from '../core/proxyClient';
import { DiffApplyManager } from './DiffApply';
import { SmartMemoryManager } from '../core/SmartMemory';
import { SkillsHubManager, type Skill } from './SkillsHub';
import { MCPSettingsPanel } from './MCPSettingsPanel';
import { TokenTracker } from '../core/TokenTracker';
import { getModelById, resolveModelContextLimit } from '../core/ModelCatalog';
import {
  iconShield, iconAlertTriangle, iconChevronDown, iconZap, iconTerminal,
  iconCheck, iconSparkles, iconPuzzle, iconPlug, iconRefresh, iconBookOpen,
  iconGitBranch, iconFiles, iconFolder, iconBrain,
  getFileIconByExtension
} from './icons';
import { permissionManager, type PermissionRequest, type PermissionMode, type PermissionSettings } from '../core/PermissionManager';
import { ChatHistoryManager } from './ChatHistoryManager';
import { SubagentManager } from './SubagentManager';
import { AuxiliaryPaneManager, type ArtifactItem } from './AuxiliaryPane';
import { notificationManager } from '../core/NotificationManager';
import { loadMermaid } from '../core/mermaidLoader';
import { TurnReviewData, ChangedFileEntry, computeDiffStats } from './ReviewWorkspace';
import {
  readSpreadsheetFile,
  createSpreadsheetFile,
  editSpreadsheetFile,
} from '../core/spreadsheetAgentTools';
import { spreadsheetWorkspace } from './SpreadsheetWorkspace';

export interface AttachedFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  content: string; // Kod / Metin içeriği
  dataUrl?: string; // Görseller için data URL
  isImage: boolean;
  lineCount?: number;
}

export interface ImplementationPlanData {
  title: string;
  summary: string;
  markdown?: string;
  steps?: string[];
  files?: string[];
  risks?: string;
}

export interface SlashCommandItem {
  command: string;
  label: string;
  description: string;
  iconSvg: string;
  category: 'action' | 'skill' | 'system';
  isImmediate: boolean;
  promptPrefix?: string;
}

export interface ContextMentionItem {
  id: string;
  mention: string;
  label: string;
  description: string;
  iconSvg: string;
  category: 'file' | 'folder' | 'terminal' | 'git' | 'memory';
  action: () => Promise<void> | void;
}

export interface ActiveStreamSession {
  sessionId: string;
  abortController: AbortController;
  agentBubble: HTMLElement;
  accumulatedMessages: ChatMessage[];
  rawResponse: string;
  responseText: string;
  thinkingText: string;
  liveScriptStarted: boolean;
  startTime: number;
}

export class AgentPanelManager {
  private chatFlow: HTMLElement;
  private promptInput: HTMLTextAreaElement;
  private btnSend: HTMLButtonElement;
  private btnStop: HTMLButtonElement | null = null;
  private statusEl: HTMLElement;
  private messages: ChatMessage[] = [];
  private currentProjectPath: string | null = null;
  private isProcessing = false;
  private currentAbortController: AbortController | null = null;
  private activeStreams = new Map<string, ActiveStreamSession>();
  private deletedSessionIds = new Set<string>();

  // Mod Seçimi: 'act' (Doğrudan Yanıt) veya 'plan' (Önce Plan Çıkar)
  private currentMode: 'act' | 'plan' = 'act';

  // Dış servis entegrasyonları
  private diffApply: DiffApplyManager;
  private smartMemory?: SmartMemoryManager;
  private skillsHub?: SkillsHubManager;
  private selectedModel = localStorage.getItem('kraga:model') || 'gpt-5.4-mini';
  private selectedEffort = localStorage.getItem('kraga:effort') || 'medium';
  private isThinking = localStorage.getItem('kraga:thinking') !== 'false';

  // Slash Komutları Sistemi
  private slashPopover: HTMLElement | null = null;
  private slashCommands: SlashCommandItem[] = [];
  private filteredSlashCommands: SlashCommandItem[] = [];
  private slashSelectedIndex = 0;
  private isSlashPopoverOpen = false;

  // @ Bağlam Bahsetme (Context Mentions) Sistemi
  private mentionPopover: HTMLElement | null = null;
  private mentionItems: ContextMentionItem[] = [];
  private filteredMentionItems: ContextMentionItem[] = [];
  private mentionSelectedIndex = 0;
  private isMentionPopoverOpen = false;

  // Akıllı Kaydırma & Yüzen Aşağı Butonu
  private isUserScrolledUp = false;
  private scrollBottomBtn: HTMLElement | null = null;

  private chatHistory = new ChatHistoryManager();
  private currentSessionId: string = '';
  private historySidebar: HTMLElement | null = null;
  private subagentManager = new SubagentManager();
  private auxiliaryPane: AuxiliaryPaneManager | null = null;
  private activeView: 'chat' | 'auxiliary' = 'chat';

  // Eklenen Dosyalar (Ataç / Widget Sistemi)
  private attachedFiles: AttachedFileItem[] = [];

  // Yerel Sistem Dizinleri (Windows Desktop, Home, Downloads, Platform)
  private systemPaths: { desktop: string; home: string; downloads: string; temp: string; platform: string } = {
    desktop: '',
    home: '',
    downloads: '',
    temp: '',
    platform: 'win32',
  };

  // Antigravity Smart Step Bars (Explored, Ran, Edited, Working)
  private activeStepGroups = new Map<string, {
    container: HTMLElement;
    headerRow: HTMLElement;
    titleEl: HTMLElement;
    subList: HTMLElement;
    fileCount: number;
    cmdCount: number;
  }>();
  private activeWorkingRows = new Map<string, HTMLElement>();

  // Asılı Kalan İzin Promise'leri Kalkanı (Hanging Promise Guard)
  private pendingPermissionResolvers = new Set<() => void>();

  // Antigravity & Cursor Değişiklik İnceleme (Review) Takibi
  private currentTurnPrompt: string = '';
  private currentTurnChanges: Map<string, ChangedFileEntry> = new Map();
  private turnReviewHistory: Map<string, TurnReviewData> = new Map();

  private cancelPendingPermissions(): void {
    for (const cancel of this.pendingPermissionResolvers) {
      try { cancel(); } catch {}
    }
    this.pendingPermissionResolvers.clear();
  }

  // Kod Panelleri ve Editör Entegrasyonu (Visual Studio / Cursor Tarzı)
  public onOpenFile?: (filePath: string) => Promise<void>;
  public onOpenSnippet?: (title: string, code: string, language: string) => Promise<void>;
  public onRefreshExplorer?: () => Promise<void>;

  // Antigravity Canlı Script ve Kod Çalışma Alanı
  public onLiveScriptStart?: (fileName: string, language: string, initialCode: string) => void;
  public onLiveScriptChunk?: (code: string) => void;
  public onLiveScriptFinish?: (finalCode?: string) => void;

  // Antigravity Uygulama Planı Çalışma Alanı
  public onOpenPlanWorkspace?: (planData: ImplementationPlanData, onApprove?: () => void) => void;

  // Antigravity Sohbet Oturumları ve Geçmiş Çalışma Alanı
  public onOpenSessionWorkspace?: () => void;

  // Antigravity Canlı Önizleme Çalışma Alanı (HTML, PDF, Web App, Markdown)
  public onOpenPreview?: (filePath?: string, content?: string, title?: string) => void;

  // Antigravity & Cursor Değişiklik İnceleme (Review & Commit) Çalışma Alanı
  public onOpenReview?: (turnData: TurnReviewData) => void;

  constructor(
    chatFlowId: string,
    promptInputId: string,
    btnSendId: string,
    statusId: string,
    diffApply: DiffApplyManager,
    smartMemory?: SmartMemoryManager,
    skillsHub?: SkillsHubManager
  ) {
    this.wireSubagentPermissions();
    this.chatFlow = document.getElementById(chatFlowId)!;
    this.promptInput = document.getElementById(promptInputId) as HTMLTextAreaElement;
    this.btnSend = document.getElementById(btnSendId) as HTMLButtonElement;
    this.statusEl = document.getElementById(statusId)!;
    this.diffApply = diffApply;
    this.smartMemory = smartMemory;
    this.skillsHub = skillsHub;

    this.initSystemPaths();
    this.initSlashCommands();
    this.initContextMentions();
    this.bindEvents();
    this.initModeSwitcher();
    this.initScrollBottomButton();
    this.initChatHistory();
    this.initAuxiliaryPane();
    this.initViewSwitcher();
    this.initFileAttachment();
    this.initInputStatusRow();
    this.initQuickPillsAndPopovers();
    this.initFloatingPlanBanner();

    window.addEventListener('kraga:default-model-changed', (e: any) => {
      if (e.detail?.modelId) {
        this.setModel(e.detail.modelId);
      }
    });

    // ChatGPT Canvas Tarzı Canlı Tablo Düzenleme Talepleri
    window.addEventListener('kraga:request-sheet-ai-edit', async (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const agentPanelEl = document.getElementById('agentPanel');
      if (agentPanelEl && agentPanelEl.style.display === 'none') {
        agentPanelEl.style.display = 'flex';
      }
      this.promptInput.value = `Lütfen açık olan elektronik tabloyu düzenle:\n- Dosya: ${detail.filePath}\n- Çalışma Sayfası: ${detail.activeSheet}\n- Seçili Hücre/Aralık: ${detail.selectedCoord}\n\nİstek: ${detail.prompt}`;
      this.promptInput.focus();
      await this.handleSend();
    });

    window.addEventListener('kraga:focus-agent-chat', () => {
      const agentPanelEl = document.getElementById('agentPanel');
      if (agentPanelEl && agentPanelEl.style.display === 'none') {
        agentPanelEl.style.display = 'flex';
      }
      this.promptInput?.focus();
    });

    const initialModelInfo = getModelById(this.selectedModel);
    const initialLimit = initialModelInfo?.contextLimit || resolveModelContextLimit(this.selectedModel);
    TokenTracker.getInstance().setContextUsage(0, initialLimit);
  }

  private initSystemPaths(): void {
    if (window.kragaAPI?.system?.getPaths) {
      window.kragaAPI.system.getPaths().then((paths) => {
        if (paths) {
          this.systemPaths = paths;
        }
      }).catch((err) => {
        console.warn('[AgentPanel] Sistem dizinleri alınamadı:', err);
      });
    }
  }

  // ─── Slash Komutları Popover'ı ──────────────────────────────────────────────
  private initSlashCommands(): void {
    this.slashCommands = [
      {
        command: '/compact',
        label: 'Bağlamı Sıkıştır',
        description: 'Eski mesajları özetler, 70-85% token tasarrufu sağlar',
        iconSvg: iconZap(14, 'var(--accent-color, #00f0ff)'),
        category: 'system',
        isImmediate: true,
      },
      {
        command: '/clear',
        label: 'Sohbeti Temizle',
        description: 'Oturumu sıfırlar ve temiz bir sohbet başlatır',
        iconSvg: iconRefresh(14, '#ff5555'),
        category: 'system',
        isImmediate: true,
      },
      {
        command: '/council',
        label: 'Modeller Konseyi',
        description: 'Andrej Karpathy 3-üye (Architect, Skeptic, Pragmatist) hakemliği',
        iconSvg: iconSparkles(14, '#b388ff'),
        category: 'skill',
        isImmediate: false,
        promptPrefix: '/council ',
      },
      {
        command: '/security',
        label: 'Güvenlik Denetimi',
        description: 'OWASP Top 10, path traversal ve kod güvenlik analizi',
        iconSvg: iconShield(14, '#ffaa00'),
        category: 'skill',
        isImmediate: false,
        promptPrefix: '/security ',
      },
      {
        command: '/refactor',
        label: 'Temiz Mimari Refaktör',
        description: 'SOLID ve Clean Code prensipleriyle refaktör',
        iconSvg: iconPuzzle(14, '#00e676'),
        category: 'skill',
        isImmediate: false,
        promptPrefix: '/refactor ',
      },
      {
        command: '/test',
        label: 'Test Sihirbazı',
        description: 'Kapsamlı birim (Unit) ve uçtan uca (E2E) test senaryoları',
        iconSvg: iconCheck(14, '#29b6f6'),
        category: 'skill',
        isImmediate: false,
        promptPrefix: '/test ',
      },
      {
        command: '/debug',
        label: 'Hata Teşhis Cerrahı',
        description: 'Kök neden analizi ve cerrahi hata onarımı',
        iconSvg: iconAlertTriangle(14, '#ff5252'),
        category: 'skill',
        isImmediate: false,
        promptPrefix: '/debug ',
      },
      {
        command: '/plan',
        label: 'Plan Modu',
        description: 'Doğrudan kod yazmadan önce adımlı plan çıkarır',
        iconSvg: iconBookOpen(14, '#ffd600'),
        category: 'action',
        isImmediate: true,
      },
      {
        command: '/act',
        label: 'Eylem (Act) Modu',
        description: 'Doğrudan eyleme geçer ve kodları uygular',
        iconSvg: iconTerminal(14, '#00e5ff'),
        category: 'action',
        isImmediate: true,
      },
      {
        command: '/skills',
        label: 'Yetenekler (Skills) Hub',
        description: 'Aktif ve kurulu 14 yazılım geliştirici yeteneğini listeler',
        iconSvg: iconPuzzle(14, '#e040fb'),
        category: 'system',
        isImmediate: true,
      },
      {
        command: '/mcp',
        label: 'MCP Sunucuları & Araçlar',
        description: 'Bağlı MCP sunucuları ve kullanılabilir araçları döker',
        iconSvg: iconPlug(14, '#64ffda'),
        category: 'system',
        isImmediate: true,
      },
      {
        command: '/help',
        label: 'Yardim ve Kilavuz',
        description: 'Tum slash komutlari ve klavye kisayollarini gosterir',
        iconSvg: iconSparkles(14, '#ffffff'),
        category: 'system',
        isImmediate: true,
      },
      {
        command: '/subagents',
        label: 'Subagent Durumu',
        description: 'Aktif ve tamamlanmis subagent oturumlarini listeler',
        iconSvg: iconPuzzle(14, '#f1fa8c'),
        category: 'system',
        isImmediate: true,
      },
    ];

    // Popover konteynerini textarea wrapper'ına ekle
    const wrapper = this.promptInput.parentElement;
    if (wrapper) {
      if (getComputedStyle(wrapper).position === 'static') {
        wrapper.style.position = 'relative';
      }

      this.slashPopover = document.createElement('div');
      this.slashPopover.className = 'slash-commands-popover slash-commands-popover--hidden';
      this.slashPopover.id = 'slashCommandsPopover';
      wrapper.appendChild(this.slashPopover);
    }

    // Input dinleyicisi
    this.promptInput.addEventListener('input', () => this.handlePromptInput());

    // Popover dışına tıklandığında kapat
    document.addEventListener('click', (e) => {
      if (
        this.isSlashPopoverOpen &&
        !this.slashPopover?.contains(e.target as Node) &&
        e.target !== this.promptInput
      ) {
        this.hideSlashPopover();
      }
    });
  }

  private handlePromptInput(): void {
    const val = this.promptInput.value;

    // 1. Slash Komutları (Başında / varsa)
    if (val.startsWith('/')) {
      this.hideMentionPopover();
      const firstSpaceIndex = val.indexOf(' ');
      if (firstSpaceIndex !== -1) {
        this.hideSlashPopover();
        return;
      }

      const query = val.slice(1).toLowerCase().trim();
      this.filteredSlashCommands = this.slashCommands.filter((cmd) => {
        return (
          cmd.command.slice(1).toLowerCase().includes(query) ||
          cmd.label.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query)
        );
      });

      if (this.filteredSlashCommands.length > 0) {
        this.slashSelectedIndex = 0;
        this.renderSlashPopover();
        this.showSlashPopover();
      } else {
        this.hideSlashPopover();
      }
      return;
    } else {
      this.hideSlashPopover();
    }

    // 2. @ Bağlam Bahsetme (Metin içinde @ varsa)
    const cursorPos = this.promptInput.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtMatch = textBeforeCursor.match(/@([a-zA-Z0-9_-ğüşıöçĞÜŞİÖÇ]*)$/);

    if (lastAtMatch) {
      const query = lastAtMatch[1].toLowerCase().trim();
      this.filteredMentionItems = this.mentionItems.filter((m) => {
        return (
          m.mention.slice(1).toLowerCase().includes(query) ||
          m.label.toLowerCase().includes(query) ||
          m.description.toLowerCase().includes(query)
        );
      });

      if (this.filteredMentionItems.length > 0) {
        this.mentionSelectedIndex = 0;
        this.renderMentionPopover();
        this.showMentionPopover();
      } else {
        this.hideMentionPopover();
      }
    } else {
      this.hideMentionPopover();
    }
  }

  private renderSlashPopover(): void {
    if (!this.slashPopover) return;

    this.slashPopover.innerHTML = `
      <div class="slash-commands-header">
        <span>Komut Seçin (Yukarı / Aşağı ok tuşları, Enter ile seçin)</span>
        <span class="slash-commands-count">${this.filteredSlashCommands.length} komut</span>
      </div>
      <div class="slash-commands-list">
        ${this.filteredSlashCommands
          .map((cmd, idx) => `
            <div class="slash-command-item ${idx === this.slashSelectedIndex ? 'slash-command-item--active' : ''}" data-index="${idx}">
              <div class="slash-command-icon">${cmd.iconSvg}</div>
              <div class="slash-command-info">
                <div class="slash-command-main">
                  <span class="slash-command-cmd">${cmd.command}</span>
                  <span class="slash-command-label">${cmd.label}</span>
                </div>
                <div class="slash-command-desc">${cmd.description}</div>
              </div>
              <span class="slash-command-badge">${cmd.category.toUpperCase()}</span>
            </div>
          `)
          .join('')}
      </div>
    `;

    // Tıklama dinleyicileri
    this.slashPopover.querySelectorAll('.slash-command-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10);
        if (this.filteredSlashCommands[idx]) {
          this.executeSlashCommand(this.filteredSlashCommands[idx]);
        }
      });
    });
  }

  private showSlashPopover(): void {
    if (!this.slashPopover) return;
    this.slashPopover.classList.remove('slash-commands-popover--hidden');
    this.isSlashPopoverOpen = true;
  }

  private hideSlashPopover(): void {
    if (!this.slashPopover) return;
    this.slashPopover.classList.add('slash-commands-popover--hidden');
    this.isSlashPopoverOpen = false;
  }

  private updateSlashSelection(): void {
    if (!this.slashPopover) return;
    const items = this.slashPopover.querySelectorAll('.slash-command-item');
    items.forEach((item, idx) => {
      item.classList.toggle('slash-command-item--active', idx === this.slashSelectedIndex);
    });
    const activeItem = items[this.slashSelectedIndex] as HTMLElement;
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }

  private async executeSlashCommand(cmd: SlashCommandItem): Promise<void> {
    this.hideSlashPopover();

    if (cmd.isImmediate) {
      this.promptInput.value = '';
      if (cmd.command === '/compact') {
        await this.compactConversation(true);
      } else if (cmd.command === '/clear') {
        this.clearChat();
      } else if (cmd.command === '/plan') {
        this.setMode('plan');
        this.addMessage('agent', '**Plan Modu Etkinleştirildi:** Model artık doğrudan kod yazmak yerine önce adımlı plan hazırlayacaktır.');
      } else if (cmd.command === '/act') {
        this.setMode('act');
        this.addMessage('agent', '**Eylem (Act) Modu Etkinleştirildi:** Model doğrudan kod blokları üretecek ve araçları kullanacaktır.');
      } else if (cmd.command === '/skills') {
        this.renderSkillsStatusInChat();
      } else if (cmd.command === '/mcp') {
        this.renderMCPStatusInChat();
      } else if (cmd.command === '/help') {
        this.renderHelpInChat();
      }
    } else {
      this.promptInput.value = cmd.promptPrefix || `${cmd.command} `;
      this.promptInput.focus();
    }
  }

  // ─── @ Bağlam Bahsetme (Context Mentions) Popover'ı ─────────────────────────
  private initContextMentions(): void {
    this.mentionItems = [
      {
        id: 'mention-file',
        mention: '@dosya',
        label: 'Açık Dosya / Proje Dosyası',
        description: 'Açık editör dosyalarını veya proje dosyasını bağlama ekler',
        iconSvg: iconFiles(14, 'var(--accent-color, #00f0ff)'),
        category: 'file',
        action: async () => {
          const openFiles = this.diffApply.onGetOpenFiles?.() || [];
          if (openFiles.length > 0) {
            const target = openFiles[0];
            try {
              const content = await window.kragaAPI.fs.readFile(target.path);
              this.attachContextSnippet(target.name, content, target.name.split('.').pop() || 'txt');
              notificationManager.showToast({
                title: 'Dosya Bağlama Eklendi',
                message: `${target.name} içeriği ajana aktarıldı.`,
                type: 'info',
                durationMs: 3000,
              });
            } catch {
              notificationManager.showToast({
                title: 'Dosya Okunamadı',
                message: `${target.name} okunamadı.`,
                type: 'warning',
                durationMs: 3000,
              });
            }
          } else {
            notificationManager.showToast({
              title: 'Açık Dosya Yok',
              message: 'Önce editörde bir dosya açın veya sol gezginden dosya seçin.',
              type: 'info',
              durationMs: 3000,
            });
          }
        },
      },
      {
        id: 'mention-folder',
        mention: '@klasör',
        label: 'Proje Klasör Ağacı',
        description: 'Projenin dizin ve dosya hiyerarşisini bağlama ekler',
        iconSvg: iconFolder(14, '#ffaa00'),
        category: 'folder',
        action: async () => {
          const wsPath = this.currentProjectPath || this.diffApply.onGetWorkspacePath?.();
          if (!wsPath) {
            notificationManager.showToast({
              title: 'Proje Açık Değil',
              message: 'Lütfen önce bir çalışma klasörü açın.',
              type: 'warning',
              durationMs: 3000,
            });
            return;
          }
          try {
            const files = await window.kragaAPI.fs.readDirectory(wsPath);
            const summary = files.map((f: any) => `${f.isDirectory ? '📁' : '📄'} ${f.name}`).join('\n');
            this.attachContextSnippet('proje-dizin-yapisi.txt', `Proje Kökü: ${wsPath}\n\n${summary}`, 'txt');
            notificationManager.showToast({
              title: 'Proje Ağacı Eklendi',
              message: 'Klasör yapısı bağlama eklendi.',
              type: 'info',
              durationMs: 3000,
            });
          } catch {}
        },
      },
      {
        id: 'mention-terminal',
        mention: '@terminal',
        label: 'Aktif Terminal Çıktısı',
        description: 'Son terminal komutlarını ve hata çıktılarını bağlama ekler',
        iconSvg: iconTerminal(14, '#29b6f6'),
        category: 'terminal',
        action: async () => {
          const wsPath = this.currentProjectPath || '';
          try {
            const res = await window.kragaAPI.terminal.runCommand('git status --short || echo "Terminal Hazir"', wsPath);
            const out = (res.stdout || res.stderr || 'Terminal tamponu hazır.').trim();
            this.attachContextSnippet('terminal-tamponu.txt', out, 'txt');
            notificationManager.showToast({
              title: 'Terminal Çıktısı Eklendi',
              message: 'Son terminal logu bağlama aktarıldı.',
              type: 'info',
              durationMs: 3000,
            });
          } catch {}
        },
      },
      {
        id: 'mention-git',
        mention: '@git',
        label: 'Git Değişiklikleri & Diff',
        description: 'Çalışma alanındaki commit edilmemiş git farklarını ekler',
        iconSvg: iconGitBranch(14, '#00e676'),
        category: 'git',
        action: async () => {
          const wsPath = this.currentProjectPath || '';
          try {
            const res = await window.kragaAPI.terminal.runCommand('git status -s && git diff --stat', wsPath);
            const diffOut = (res.stdout || res.stderr || 'Temiz çalışma dizini (No changes).').trim();
            this.attachContextSnippet('git-diff.diff', diffOut, 'diff');
            notificationManager.showToast({
              title: 'Git Durumu Eklendi',
              message: 'Git diff özeti bağlama aktarıldı.',
              type: 'info',
              durationMs: 3000,
            });
          } catch {}
        },
      },
      {
        id: 'mention-memory',
        mention: '@hafıza',
        label: 'Akıllı Hafıza (Smart Memory)',
        description: 'Kullanıcı ve proje tercihlerini bağlama ekler',
        iconSvg: iconBrain(14, '#b388ff'),
        category: 'memory',
        action: () => {
          const memories = this.smartMemory?.getItems() || [];
          if (memories.length > 0) {
            const memText = memories.map((m) => `- ${m.content}`).join('\n');
            this.attachContextSnippet('akilli-hafiza.md', `### Akıllı Hafıza Notları:\n${memText}`, 'md');
            notificationManager.showToast({
              title: 'Hafıza Eklendi',
              message: `${memories.length} adet hafıza maddesi bağlama aktarıldı.`,
              type: 'info',
              durationMs: 3000,
            });
          } else {
            notificationManager.showToast({
              title: 'Hafıza Boş',
              message: 'Kayıtlı hafıza maddesi bulunmuyor.',
              type: 'info',
              durationMs: 3000,
            });
          }
        },
      },
    ];

    const wrapper = this.promptInput.parentElement;
    if (wrapper) {
      this.mentionPopover = document.createElement('div');
      this.mentionPopover.className = 'slash-commands-popover slash-commands-popover--hidden context-mentions-popover';
      this.mentionPopover.id = 'contextMentionsPopover';
      wrapper.appendChild(this.mentionPopover);
    }

    // Popover dışına tıklandığında kapat
    document.addEventListener('click', (e) => {
      if (
        this.isMentionPopoverOpen &&
        !this.mentionPopover?.contains(e.target as Node) &&
        e.target !== this.promptInput
      ) {
        this.hideMentionPopover();
      }
    });
  }

  private attachContextSnippet(name: string, content: string, ext: string): void {
    const id = `mention-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const lineCount = content ? content.split('\n').length : 0;
    this.attachedFiles.push({
      id,
      name,
      size: content.length,
      type: 'text/plain',
      extension: ext,
      content,
      isImage: false,
      lineCount,
    });
    this.renderAttachedFilesBar();
  }

  private renderMentionPopover(): void {
    if (!this.mentionPopover) return;

    this.mentionPopover.innerHTML = `
      <div class="slash-commands-header">
        <span>@ Bağlam Ekle (Enter ile seçin)</span>
        <span class="slash-commands-count">${this.filteredMentionItems.length} kaynak</span>
      </div>
      <div class="slash-commands-list">
        ${this.filteredMentionItems
          .map((item, idx) => `
            <div class="slash-command-item ${idx === this.mentionSelectedIndex ? 'slash-command-item--active' : ''}" data-index="${idx}">
              <div class="slash-command-icon">${item.iconSvg}</div>
              <div class="slash-command-info">
                <div class="slash-command-main">
                  <span class="slash-command-cmd">${item.mention}</span>
                  <span class="slash-command-label">${item.label}</span>
                </div>
                <div class="slash-command-desc">${item.description}</div>
              </div>
              <span class="slash-command-badge">${item.category.toUpperCase()}</span>
            </div>
          `)
          .join('')}
      </div>
    `;

    this.mentionPopover.querySelectorAll('.slash-command-item').forEach((el) => {
      el.addEventListener('click', (e) => {
        const idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '0', 10);
        if (this.filteredMentionItems[idx]) {
          this.executeMention(this.filteredMentionItems[idx]);
        }
      });
    });
  }

  private showMentionPopover(): void {
    if (!this.mentionPopover) return;
    this.mentionPopover.classList.remove('slash-commands-popover--hidden');
    this.isMentionPopoverOpen = true;
  }

  private hideMentionPopover(): void {
    if (!this.mentionPopover) return;
    this.mentionPopover.classList.add('slash-commands-popover--hidden');
    this.isMentionPopoverOpen = false;
  }

  private updateMentionSelection(): void {
    if (!this.mentionPopover) return;
    const items = this.mentionPopover.querySelectorAll('.slash-command-item');
    items.forEach((item, idx) => {
      item.classList.toggle('slash-command-item--active', idx === this.mentionSelectedIndex);
    });
    const activeItem = items[this.mentionSelectedIndex] as HTMLElement;
    activeItem?.scrollIntoView({ block: 'nearest' });
  }

  private async executeMention(item: ContextMentionItem): Promise<void> {
    this.hideMentionPopover();

    // promptInput içindeki son @query kısmını kaldır
    const val = this.promptInput.value;
    const cursorPos = this.promptInput.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const textAfterCursor = val.slice(cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    if (lastAtIdx !== -1) {
      this.promptInput.value = textBeforeCursor.slice(0, lastAtIdx).trimEnd() + ' ' + textAfterCursor.trimStart();
      this.adjustPromptInputHeight();
    }

    await item.action();
    this.promptInput.focus();
  }

  public injectPromptAndSend(prompt: string): void {
    this.promptInput.value = prompt;
    this.adjustPromptInputHeight();
    this.handleSend();
  }

  // ─── Mod ve Temel Ayarlar ──────────────────────────────────────────────────
  private initModeSwitcher(): void {
    const headerRight = document.querySelector('.agent-header__right') || document.querySelector('.agent-header');
    if (!headerRight) return;

    // Stop butonu
    this.btnStop = document.getElementById('btnStopPrompt') as HTMLButtonElement;
    if (this.btnStop) {
      this.btnStop.addEventListener('click', () => this.handleStop());
    }

    // Plan / Act Switcher
    const modeSwitcher = document.getElementById('agentModeSwitcher');
    if (modeSwitcher) {
      modeSwitcher.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest('.agent-mode-btn');
        if (!target) return;
        const mode = (target as HTMLElement).dataset.mode as 'act' | 'plan';
        if (mode) {
          this.setMode(mode);
        }
      });
    }

    try {
      const savedMode = localStorage.getItem('kraga:agent-mode') as 'act' | 'plan';
      if (savedMode === 'plan' || savedMode === 'act') {
        this.setMode(savedMode);
      }
    } catch {}
  }

  public setMode(mode: 'act' | 'plan'): void {
    this.currentMode = mode;
    try {
      localStorage.setItem('kraga:agent-mode', mode);
    } catch {}
    const btns = document.querySelectorAll('.agent-mode-btn');
    btns.forEach(btn => {
      btn.classList.toggle('agent-mode-btn--active', (btn as HTMLElement).dataset.mode === mode);
    });
  }

  public setModel(modelId: string): void {
    this.selectedModel = modelId;
    localStorage.setItem('kraga:model', modelId);
    this.updatePromptEstimator();

    // Model değiştiğinde TokenTracker bağlam limitini anında güncelle
    const modelInfo = getModelById(modelId);
    const limit = modelInfo?.contextLimit || resolveModelContextLimit(modelId);
    const currentTokens = Math.round(
      this.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 3.5
    );
    TokenTracker.getInstance().setContextUsage(currentTokens, limit);
  }

  public hasMessages(): boolean {
    return Array.isArray(this.messages) && this.messages.length > 0;
  }

  public setEffort(effort: string): void {
    this.selectedEffort = effort;
  }

  public setThinking(thinking: boolean): void {
    this.isThinking = thinking;
  }

  private bindEvents(): void {
    this.btnSend.addEventListener('click', () => this.handleSend());

    // Dosya Eylem Kartları (Klasörde Göster, Editörde Aç, Yolu Kopyala) & file:/// Bağlantıları Dinleyicisi
    this.chatFlow.addEventListener('click', async (e) => {
      const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (target) {
        const action = target.getAttribute('data-action');
        const rawPath = target.getAttribute('data-path');
        const filePath = rawPath ? decodeURIComponent(rawPath) : '';

        if (action === 'reveal-file' && filePath) {
          e.preventDefault();
          e.stopPropagation();
          if (window.kragaAPI?.fs?.revealInFolder) {
            await window.kragaAPI.fs.revealInFolder(filePath);
          }
          return;
        }

        if (action === 'open-file' && filePath) {
          e.preventDefault();
          e.stopPropagation();
          if (this.onOpenFile) {
            await this.onOpenFile(filePath);
          }
          return;
        }

        if (action === 'preview-file' && filePath) {
          e.preventDefault();
          e.stopPropagation();
          if (this.onOpenPreview) {
            this.onOpenPreview(filePath);
          }
          return;
        }

        if (action === 'copy-path' && filePath) {
          e.preventDefault();
          e.stopPropagation();
          try {
            await navigator.clipboard.writeText(filePath);
            const span = target.querySelector('span');
            if (span) {
              const old = span.textContent;
              span.textContent = 'Kopyalandı!';
              setTimeout(() => { span.textContent = old; }, 1800);
            }
          } catch {}
          return;
        }
      }

      // file:/// bağlantılarına tıklandığında doğrudan dosya yöneticisinde göster
      const anchor = (e.target as HTMLElement).closest('a') as HTMLAnchorElement | null;
      if (anchor && anchor.href) {
        if (anchor.href.startsWith('file:///')) {
          e.preventDefault();
          e.stopPropagation();
          const cleanPath = decodeURIComponent(anchor.href.replace(/^file:\/\/\/?/, ''));
          const winPath = cleanPath.includes(':') ? cleanPath : `/${cleanPath}`;
          if (window.kragaAPI?.fs?.revealInFolder) {
            await window.kragaAPI.fs.revealInFolder(winPath);
          }
        }
      }
    });

    // Auto-resize textarea & live token estimator
    this.promptInput.addEventListener('input', () => {
      this.adjustPromptInputHeight();
      this.updatePromptEstimator();
    });

    // Tool pills (.agent-tool-pill) click handler
    document.querySelectorAll('.agent-tool-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const cmd = (pill as HTMLElement).dataset.cmd;
        if (cmd) {
          if (cmd === '/help') {
            this.promptInput.value = '/help';
            this.handleSend();
          } else {
            this.promptInput.value = cmd;
            this.adjustPromptInputHeight();
            this.promptInput.focus();
          }
        }
      });
    });

    this.promptInput.addEventListener('keydown', (e) => {
      // @ Mention Popover açıkken ok tuşları ve seçim yönetimi
      if (this.isMentionPopoverOpen && this.filteredMentionItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.mentionSelectedIndex = (this.mentionSelectedIndex + 1) % this.filteredMentionItems.length;
          this.updateMentionSelection();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.mentionSelectedIndex = (this.mentionSelectedIndex - 1 + this.filteredMentionItems.length) % this.filteredMentionItems.length;
          this.updateMentionSelection();
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const selected = this.filteredMentionItems[this.mentionSelectedIndex];
          if (selected) {
            this.executeMention(selected);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          this.hideMentionPopover();
          return;
        }
      }

      // Slash Popover açıkken ok tuşları ve seçim yönetimi
      if (this.isSlashPopoverOpen && this.filteredSlashCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.slashSelectedIndex = (this.slashSelectedIndex + 1) % this.filteredSlashCommands.length;
          this.updateSlashSelection();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.slashSelectedIndex = (this.slashSelectedIndex - 1 + this.filteredSlashCommands.length) % this.filteredSlashCommands.length;
          this.updateSlashSelection();
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const selected = this.filteredSlashCommands[this.slashSelectedIndex];
          if (selected) {
            this.executeSlashCommand(selected);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          this.hideSlashPopover();
          return;
        }
      }

      // Normal Enter ile gönderme
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  private adjustPromptInputHeight(): void {
    if (!this.promptInput) return;
    this.promptInput.style.height = 'auto';
    const targetH = Math.min(Math.max(this.promptInput.scrollHeight, 38), 180);
    this.promptInput.style.height = `${targetH}px`;
  }

  public setProjectPath(path: string): void {
    this.currentProjectPath = path;
    this.subagentManager.setProjectPath(path);
    this.auxiliaryPane?.setProjectPath(path);
    const wsTextEl = document.getElementById('agentWorkspaceStatusText');
    if (wsTextEl) {
      const folderName = path ? (path.split(/[\\/]/).filter(Boolean).pop() || 'Local') : 'Local';
      wsTextEl.textContent = folderName;
    }
  }

  /** Alt ajanların riskli işlemleri de aynı izin kartından geçsin. */
  private wireSubagentPermissions(): void {
    this.subagentManager.setPermissionHandler((req) =>
      this.requestPermissionInChat({ type: req.type, title: req.title, detail: req.detail, targetSessionId: this.currentSessionId })
    );
  }

  public getSubagentManager(): SubagentManager {
    return this.subagentManager;
  }

  public getAuxiliaryPane(): AuxiliaryPaneManager | null {
    return this.auxiliaryPane;
  }

  public getActiveView(): 'chat' | 'auxiliary' {
    return this.activeView;
  }

  private handleStop(): void {
    this.cancelPendingPermissions();
    this.hideAntigravityWorking(this.currentSessionId);

    const active = this.activeStreams.get(this.currentSessionId);
    if (active) {
      active.abortController.abort();
      this.activeStreams.delete(this.currentSessionId);
    }
    if (this.currentAbortController) {
      this.currentAbortController.abort();
      this.currentAbortController = null;
    }

    // Aktif çalışan alt ajanları ve betikleri sonlandır
    try {
      for (const s of this.subagentManager.getActiveSessions()) {
        this.subagentManager.killSubagent(s.id);
      }
    } catch {}

    this.onLiveScriptFinish?.();
    this.isProcessing = false;
    this.btnSend.disabled = false;
    this.setStatus('Durduruldu');
    this.toggleSendStopButtons(false);
  }

  private toggleSendStopButtons(isStreaming: boolean): void {
    if (this.btnStop) {
      this.btnStop.style.display = isStreaming ? 'flex' : 'none';
    }
    this.btnSend.style.display = isStreaming ? 'none' : 'flex';
    this.updateScrollBottomBtnState();
  }

  // ─── Bağlam Sıkıştırma (Auto-Compact Engine) ───────────────────────────────
  public async compactConversation(isManual: boolean = false): Promise<void> {
    if (this.messages.length <= 4) {
      if (isManual) {
        this.addMessage(
          'agent',
          'ℹ️ **Bağlam Sıkıştırma:** Konuşmada özetlenecek yeterli geçmiş bulunmuyor (en az 5 mesaj gereklidir).'
        );
      }
      return;
    }

    const olderMessages = this.messages.slice(0, -4);
    const recentMessages = this.messages.slice(-4);

    const tokensBefore = Math.round(
      this.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 3.5
    );

    // Konuşma başlıklarını ve dosya eylemlerini yapılandır
    const topics: string[] = [];
    const filesReferenced: string[] = [];

    for (const m of olderMessages) {
      if (m.role === 'user') {
        const firstLine = m.content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 80);
        if (firstLine && !topics.includes(firstLine)) topics.push(firstLine);
      } else if (m.role === 'assistant') {
        const fileMatches = m.content.match(/(?:[a-zA-Z0-9_\-\.]+\/)+[a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+/g);
        if (fileMatches) {
          for (const f of fileMatches) {
            if (!filesReferenced.includes(f) && filesReferenced.length < 8) {
              filesReferenced.push(f);
            }
          }
        }
      }
    }

    const summaryContent = `## [Önceki Konuşma Özeti (Auto-Compact)]
Bu oturumdaki önceki ${olderMessages.length} mesaj bağlam penceresini rahatlatmak için sıkıştırılmıştır.
- **Ele Alınan İstekler:** ${topics.slice(0, 6).join('; ') || 'Geliştirme ve analiz görevleri'}
- **İncelenen / Değiştirilen Dosyalar:** ${filesReferenced.length > 0 ? filesReferenced.map(f => `\`${f}\``).join(', ') : 'Belirtilmedi'}
- **Bağlam Devamlılığı:** Kullanıcı önceki adımların tamamlandığını kabul ederek devam etmektedir. Yeni adımları bu geçmiş bağlam ışığında yürüt.`;

    this.messages = [
      { role: 'user', content: summaryContent },
      {
        role: 'assistant',
        content: 'Önceki konuşma özeti başarıyla hafızama alındı. Bağlam penceresi ferahlatıldı, güncel kodlama görevlerinize devam edebiliriz.',
      },
      ...recentMessages,
    ];

    const tokensAfter = Math.round(
      this.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 3.5
    );
    const tokensSaved = Math.max(0, tokensBefore - tokensAfter);

    const modelInfo = getModelById(this.selectedModel);
    const limit = modelInfo?.contextLimit || resolveModelContextLimit(this.selectedModel);
    TokenTracker.getInstance().setContextUsage(tokensAfter, limit);

    // Sohbette şık bildirim kartı ekle
    const bubble = this.createMessageBubble('tool');
    bubble.className = 'chat-bubble tool compact-notification-card';
    bubble.innerHTML = `
      <div class="compact-notification-header">
        <div class="compact-notification-icon">${iconZap(18, 'var(--accent-color, #00f0ff)')}</div>
        <div class="compact-notification-text">
          <div class="compact-notification-title">Bağlam Sıkıştırıldı (Auto-Compact)</div>
          <div class="compact-notification-subtitle">
            ${olderMessages.length} mesaj özetlendi • ~${tokensSaved.toLocaleString()} token tasarruf edildi • Güncel kullanım: ~${tokensAfter.toLocaleString()} / ${Math.round(limit / 1000)}K
          </div>
        </div>
      </div>
    `;
    this.scrollToBottom();
  }

  public clearChat(): void {
    this.messages = [];
    this.chatFlow.innerHTML = `
      <div class="agent-welcome" id="agentWelcomeScreen">
        <div class="agent-chat-hero-container">
          <h2 class="agent-chat-hero-title">Ne üzerinde çalışalım?</h2>
        </div>
        <div class="agent-welcome-prompts">
          <button class="welcome-prompt-chip" data-prompt="Proje mimarisini ve dosya yapısını analiz et">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>Proje mimarisini analiz et</span>
          </button>
          <button class="welcome-prompt-chip" data-prompt="/plan Bu projeye yeni bir özellik eklemek istiyorum">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>Yeni özellik planla (/plan)</span>
          </button>
          <button class="welcome-prompt-chip" data-prompt="$ git status">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/></svg>
            <span>Git durumunu incele ($)</span>
          </button>
          <button class="welcome-prompt-chip" data-prompt="Kod tabanındaki olası hataları ve eksikleri denetle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Hata ve güvenlik denetimi</span>
          </button>
        </div>
      </div>
    `;

    // Hook welcome prompt chips
    this.chatFlow.querySelectorAll('.welcome-prompt-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const p = (chip as HTMLElement).dataset.prompt;
        if (p) {
          this.promptInput.value = p;
          this.adjustPromptInputHeight();
          this.promptInput.focus();
        }
      });
    });

    const modelInfo = getModelById(this.selectedModel);
    const limit = modelInfo?.contextLimit || resolveModelContextLimit(this.selectedModel);
    TokenTracker.getInstance().setContextUsage(0, limit);
    this.setStatus('Hazır');
    this.adjustPromptInputHeight();
  }

  // ─── Bilgi Kartları (Skills, MCP, Help) ─────────────────────────────────────
  private renderSkillsStatusInChat(): void {
    if (!this.skillsHub) {
      this.addMessage('agent', 'Yetenekler Yöneticisi (Skills Hub) yüklenemedi.');
      return;
    }
    const skills: Skill[] = this.skillsHub.getAllSkills();
    const enabledCount = skills.filter((s: Skill) => s.enabled).length;

    let html = `### Kraga Skills Hub (14 Geliştirici Yeteneği)\n`;
    html += `**Aktif Yetenek Sayısı:** ${enabledCount} / ${skills.length}\n\n`;
    html += `| Yetenek Adı | Kategori | Durum | Tetikleyiciler |\n`;
    html += `| :--- | :--- | :---: | :--- |\n`;

    for (const s of skills) {
      const statusBadge = s.enabled ? '✅ Aktif' : '⚪ Pasif';
      html += `| **${s.name}** | \`${s.category}\` | ${statusBadge} | \`${s.triggers.join(', ')}\` |\n`;
    }

    html += `\n*Yetenekleri etkinleştirmek veya yeni eklemek için Ayarlar -> Yetenekler sekmesini açabilirsiniz.*`;
    this.addMessage('agent', html);
  }

  private renderMCPStatusInChat(): void {
    const mcpPanel = MCPSettingsPanel.getInstance();
    const servers = mcpPanel.getInstalledServers();
    const activeTools = mcpPanel.getAllActiveTools();

    let html = `### Model Context Protocol (MCP) Durumu\n`;
    html += `- **Bağlı Sunucular:** ${servers.filter((s) => s.status === 'connected').length} / ${servers.length}\n`;
    html += `- **Kullanılabilir Toplam Araç (Tool):** ${activeTools.length}\n\n`;

    if (servers.length > 0) {
      html += `#### Bağlı MCP Sunucuları:\n`;
      for (const s of servers) {
        html += `- **${s.name}** (\`${s.type}\`): ${s.status === 'connected' ? '🟢 Bağlı' : '🔴 Bağlantı Kesildi'} — ${s.toolCount} araç\n`;
      }
    }

    if (activeTools.length > 0) {
      html += `\n#### En Sık Kullanılan Araçlar:\n`;
      for (const t of activeTools.slice(0, 10)) {
        html += `- \`${t.name}\`: ${t.description} *(Sunucu: ${t.serverName})*\n`;
      }
    }

    this.addMessage('agent', html);
  }

  private renderHelpInChat(): void {
    const helpMarkdown = `### Kraga IDE v1.9.0 Komut & Kısayol Kılavuzu

#### Slash Komutları (\`/\`):
- \`/compact\`: Konuşma geçmişini özetler ve bağlam penceresini boşaltır.
- \`/clear\`: Sohbet geçmişini sıfırlar ve temiz bir oturum başlatır.
- \`/council <soru>\`: Andrej Karpathy Modeller Konseyi 3-hakemli kör analizini başlatır.
- \`/plan\`: Ajanı Plan Moduna geçirir (önce adım adım mimari plan çıkarır).
- \`/act\`: Ajanı Eylem Moduna geçirir (doğrudan kod üretir ve diske yazar).
- \`/skills\`: 100 seçkin Claude & Antigravity geliştirici yeteneğinin durumunu listeler.
- \`/mcp\`: 68 hazır MCP sunucusunu ve kullanılabilir araçları listeler.
- \`/shortcuts\`: Klavye kısayolları ve komut rehberi modalini açar.
- \`/about\`: Kraga IDE sürüm, sistem ve mimari bilgilerini görüntüler.
- \`/help\`: Bu kılavuzu görüntüler.

#### Hızlı Terminal & Araç Kısayolları:
- \`$ <komut>\` veya \`run: <komut>\`: Proje klasöründe doğrudan terminal komutu çalıştırır (örn: \`$ npm test\`).
- \`graphify\` veya \`kod haritası\`: Projenin bağımlılık grafiğini ve God Node'larını çıkarır.
`;
    this.addMessage('agent', helpMarkdown);
  }

  // ─── Gönderim ve Çok Adımlı Otonom Araç Döngüsü (Tool Loop) ────────────────
  private async handleSend(): Promise<void> {
    const text = this.promptInput.value.trim();
    const hasAttachments = this.attachedFiles.length > 0;
    if ((!text && !hasAttachments) || this.isProcessing) return;

    this.promptInput.value = '';
    this.adjustPromptInputHeight();
    this.hideSlashPopover();

    // Karşılama ekranı varsa sohbete başlandığında derhal kaldır
    const welcomeEl = document.getElementById('agentWelcomeScreen');
    if (welcomeEl) welcomeEl.remove();

    // Ekli dosyaları al ve girdi çubuğunu temizle
    const sentAttachments = [...this.attachedFiles];
    this.attachedFiles = [];
    this.renderAttachedFilesBar();

    // 1. Slash Komutu Tetikleyicileri
    if (text === '/compact') {
      await this.compactConversation(true);
      return;
    }
    if (text === '/clear') {
      this.clearChat();
      return;
    }
    if (text === '/plan') {
      this.setMode('plan');
      this.addMessage('agent', '**Plan Modu Etkinleştirildi:** Model artık önce adımlı plan hazırlayacaktır.');
      return;
    }
    if (text === '/act') {
      this.setMode('act');
      this.addMessage('agent', '**Eylem (Act) Modu Etkinleştirildi:** Model doğrudan kod üretecektir.');
      return;
    }
    if (text === '/skills') {
      this.renderSkillsStatusInChat();
      return;
    }
    if (text === '/mcp') {
      this.renderMCPStatusInChat();
      return;
    }
    if (text === '/help') {
      this.renderHelpInChat();
      return;
    }
    if (text === '/subagents') {
      this.renderSubagentsStatusInChat();
      return;
    }

    // 2. Hızlı Terminal Komutu: "$ npm test" veya "run: dir"
    if (text.startsWith('$') || text.toLowerCase().startsWith('run:')) {
      const command = text.startsWith('$') ? text.slice(1).trim() : text.slice(4).trim();
      this.addMessage('user', text, sentAttachments);
      this.isProcessing = true;
      this.setStatus('Komut Çalıştırılıyor...');
      this.toggleSendStopButtons(true);
      await this.executeTerminalCommand(command);
      this.finishProcessing('Hazır');
      return;
    }

    // 3. Graphify tetikleyici
    if (text.toLowerCase().includes('graphify') || text.toLowerCase().includes('kod haritası')) {
      this.addMessage('user', text, sentAttachments);
      this.isProcessing = true;
      this.setStatus('AST Analizi Yapılıyor...');
      this.toggleSendStopButtons(true);
      await this.executeGraphifyAnalysis();
      this.finishProcessing('Hazır');
      return;
    }

    // 4. Otomatik Bağlam Sıkıştırma (Auto-Compact) Kontrolü
    const ctxPct = TokenTracker.getInstance().getContextPercentage();
    if (ctxPct >= 70 || this.messages.length >= 14) {
      await this.compactConversation(false);
    }

    // 5. Yetenekleri tetikleyicilere göre otomatik devreye sokma
    if (this.skillsHub) {
      if (text.startsWith('/council') || text.startsWith('/konsey')) {
        this.skillsHub.enableSkill('modeller-konseyi');
      } else if (text.startsWith('/security')) {
        this.skillsHub.enableSkill('security-auditor');
      } else if (text.startsWith('/refactor')) {
        this.skillsHub.enableSkill('clean-architect');
      } else if (text.startsWith('/test')) {
        this.skillsHub.enableSkill('test-master');
      } else if (text.startsWith('/debug')) {
        this.skillsHub.enableSkill('debugger-surgeon');
      }
    }

    // Kullanıcı mesajını ve dosya widget'larını sohbete ekle
    this.addMessage('user', text, sentAttachments);
    this.isUserScrolledUp = false;
    this.scrollToBottom(true);

    // LLM için prompt içeriği: Kullanıcı metni + Eklenen kod ve belge içerikleri
    let promptForLLM = text;
    if (sentAttachments.length > 0) {
      const fileBlocks = sentAttachments.map((f) => {
        if (f.isImage) {
          return `[Ekli Görsel: ${f.name} (${this.formatFileSize(f.size)})]`;
        } else if (f.content) {
          const lang = f.extension || 'txt';
          // Güvenlik Kalkanı: Çok büyük dosyalar için akıllı kesme uygulayarak 413 Payload Too Large hatasını önle
          const MAX_ATTACHED_FILE_CHARS = 60000;
          let fileBody = f.content;
          if (fileBody.length > MAX_ATTACHED_FILE_CHARS) {
            const cutChars = fileBody.length - MAX_ATTACHED_FILE_CHARS;
            fileBody = fileBody.slice(0, MAX_ATTACHED_FILE_CHARS) + `\n\n[... DİKKAT: Dosya çok büyük olduğu için geri kalan ${cutChars} karakter AI sağlayıcısının Payload Too Large (413) sınırını aşmamak amacıyla kesildi. Tam dosya üzerinde çalışmak için sol gezginden klasörü açın veya ilgili kod bloğunu paylaşın ...]`;
          }
          return `\`\`\`${lang} [Dosya: ${f.name}]\n${fileBody}\n\`\`\``;
        } else {
          return `[Ekli Dosya: ${f.name} (${this.formatFileSize(f.size)})]`;
        }
      }).join('\n\n');

      if (promptForLLM) {
        promptForLLM = `${promptForLLM}\n\n### Eklenen Dosyalar:\n${fileBlocks}`;
      } else {
        promptForLLM = `Aşağıdaki ekli dosyaları incele ve açıkla:\n\n${fileBlocks}`;
      }
    }

    this.messages.push({ role: 'user', content: promptForLLM });

    // Antigravity Review tur takibini sıfırla
    this.currentTurnPrompt = text;
    this.currentTurnChanges.clear();

    this.isProcessing = true;
    this.setStatus('Düşünüyor...');
    this.toggleSendStopButtons(true);

    // Sistem promptunu hazırla
    const systemPrompt = this.buildSystemPrompt();

    // Çok turlu otonom araç döngüsünü başlat (max 5 adım)
    await this.runToolCallingStreamLoop(systemPrompt, 0);
  }

  public renderMarkdownWithMedia(rawMarkdown: string): string {
    if (!rawMarkdown) return '';
    let html = marked.parse(rawMarkdown) as string;

    // Audio: @[audio:Title|CoverUrl|Duration|Type](url)
    html = html.replace(/@\[audio:([^\]]*)\]\(([^)]+)\)/g, (_, meta, audioSrc) => {
      const parts = (meta || '').split('|');
      const title = (parts[0] || 'Ses / Müzik').trim();
      const coverUrl = (parts[1] || '').trim();
      const duration = parts[2] ? `${parts[2]}s` : '';
      const typeLabel = (parts[3] || 'Müzik').trim();

      const cleanSrc = (audioSrc || '').trim().replace(/&amp;/g, '&');
      const safeSrc = cleanSrc.replace(/"/g, '&quot;');
      const safeCover = coverUrl.replace(/&amp;/g, '&').replace(/"/g, '&quot;');
      const isMp3 = cleanSrc.toLowerCase().includes('.mp3');
      const downloadFilename = isMp3 ? 'kraga-music.mp3' : 'kraga-audio.mp4';

      return `
        <div class="kraga-music-card">
          <div class="kraga-music-header">
            ${safeCover ? `<img class="kraga-music-cover" src="${safeCover}" alt="${title}" loading="lazy" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';"><div class="kraga-music-cover-placeholder" style="display:none;">🎵</div>` : `<div class="kraga-music-cover-placeholder">🎵</div>`}
            <div class="kraga-music-info">
              <div class="kraga-music-title">${title}</div>
              <div class="kraga-music-meta">
                <span class="kraga-music-tag">${typeLabel}</span>
                ${duration ? `<span class="kraga-music-duration">⏱️ ${duration}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="kraga-music-player-row">
            <audio class="kraga-audio-element" controls preload="metadata" src="${safeSrc}">
              <source src="${safeSrc}" type="${isMp3 ? 'audio/mpeg' : 'audio/mp4'}">
              Tarayıcınız ses oynatmayı desteklemiyor.
            </audio>
            <a class="kraga-media-download-btn" href="${safeSrc}" download="${downloadFilename}" title="Müziği İndir" target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>İndir</span>
            </a>
          </div>
        </div>
      `;
    });

    // Video: @[video:Title|Aspect|Duration|ThumbUrl](url)
    html = html.replace(/@\[video:([^\]]*)\]\(([^)]+)\)/g, (_, meta, videoSrc) => {
      const parts = (meta || '').split('|');
      const title = (parts[0] || 'Video').trim();
      const aspect = (parts[1] || '16:9').trim();
      const duration = parts[2] ? `${parts[2]}s` : '';
      const thumbUrl = (parts[3] || '').trim();

      const cleanSrc = (videoSrc || '').trim().replace(/&amp;/g, '&');
      const safeSrc = cleanSrc.replace(/"/g, '&quot;');
      const safeThumb = thumbUrl.replace(/&amp;/g, '&').replace(/"/g, '&quot;');
      const safeTitle = title.replace(/"/g, '&quot;');

      return `
        <div class="kraga-video-card">
          <div class="kraga-video-container">
            <video class="kraga-video-element" controls preload="metadata" playsinline title="${safeTitle}" ${safeThumb ? `poster="${safeThumb}"` : ''} src="${safeSrc}">
              <source src="${safeSrc}" type="video/mp4">
              Tarayıcınız video oynatmayı desteklemiyor.
            </video>
          </div>
          <div class="kraga-video-footer">
            <div class="kraga-video-meta">
              <span class="kraga-video-tag">${aspect}</span>
              ${duration ? `<span class="kraga-video-duration">⏱️ ${duration}</span>` : ''}
            </div>
            <a class="kraga-media-download-btn" href="${safeSrc}" download="kraga-video.mp4" title="Videoyu İndir" target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>İndir</span>
            </a>
          </div>
        </div>
      `;
    });

    // Image tag: @[image:Title](url)
    html = html.replace(/@\[image:([^\]]*)\]\(([^)]+)\)/g, (_, title, imgSrc) => {
      const cleanTitle = (title || 'Görsel').trim();
      const cleanSrc = (imgSrc || '').trim().replace(/&amp;/g, '&');
      const safeSrc = cleanSrc.replace(/"/g, '&quot;');

      return `
        <div class="generated-image-container">
          <img class="generated-image" src="${safeSrc}" alt="${cleanTitle}" loading="lazy" />
          <div class="generated-image-actions">
            <a class="kraga-media-download-btn" href="${safeSrc}" download="kraga-image.png" title="Görseli İndir" target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>İndir</span>
            </a>
          </div>
        </div>
      `;
    });

    // Generated images in standard markdown img tags: wrap with download button if from api.kraga.org or generated
    html = html.replace(/<img\s+([^>]*src="([^"]+)"[^>]*)>/gi, (fullMatch, attrs, src) => {
      const isGenerated = src.includes('api.kraga.org') || src.includes('/generated/') || src.startsWith('data:image/');
      if (isGenerated && !fullMatch.includes('class="kraga-music-cover"') && !fullMatch.includes('generated-image')) {
        return `
          <div class="generated-image-container">
            <img ${attrs} class="generated-image" loading="lazy" />
            <div class="generated-image-actions">
              <a class="kraga-media-download-btn" href="${src}" download="kraga-image.png" title="İndir" target="_blank" rel="noopener noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>İndir</span>
              </a>
            </div>
          </div>
        `;
      }
      return fullMatch;
    });

    return DOMPurify.sanitize(html, {
      ALLOW_DATA_ATTR: true,
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|blob:|fsimg:|data:(?:image\/(?:png|jpe?g|gif|webp|svg\+xml)|audio\/(?:wav|mp3|ogg|aac|flac|mpeg)|video\/(?:webm|mp4));base64,[a-z0-9+/=\s]+$|\/?(?:[^:/?#]+\/)*[^:/?#]*$)/i,
      ADD_TAGS: ['audio', 'video', 'source', 'img', 'svg', 'path', 'line', 'polyline', 'circle', 'track'],
      ADD_ATTR: [
        'controls', 'preload', 'poster', 'playsinline', 'download', 'target', 'rel',
        'src', 'href', 'title', 'alt', 'type', 'loading', 'data-action', 'data-image-url', 'data-fsimg'
      ],
    });
  }

  private buildSystemPrompt(): ChatMessage {
    const memoryPrompt = this.smartMemory ? this.smartMemory.getSystemPromptInjection() : '';
    const skillsPrompt = this.skillsHub ? this.skillsHub.getSystemPromptInjections() : '';

    let modeInstruction = '';
    if (this.currentMode === 'plan') {
      modeInstruction = `\n\n## MOD: PLANLAMA (PLAN MODE — Antigravity & Claude Standards)
Kullanici plan modunu secti. Dogrudan kod yazmak veya dosya degistirmek KESINLIKLE YASAKTIR.
Gorevi ayrintili bir Implementation Plan olarak hazirla ve <implementation_plan>...</implementation_plan> etiketleri arasinda sun.

KRITIK BİÇİMLENDİRME VE İZOLASYON KURALLARI:
1. Plan iceriginin TAMAMINI <implementation_plan>...</implementation_plan> etiketleri arasina yerlestir.
2. Planin tamamini ASLA tek bir kod blogu (\`\`\`) veya \`\`\`mermaid icine hapsetme! Plan basliklar, aciklamalar, tablolar ve listelerden olusan ZENGIN MARKDOWN olarak akmalidir.
3. Kod bloklarini (\`\`\`mermaid veya \`\`\`typescript) SADECE ilgili sema veya kucuk kod ornegi icin ac ve ayni blok bitince hemen \`\`\` ile kapat!
4. Sohbette sadece 1 kisa cumlelik dostane giris (orn: "Mimari uygulama planini hazirliyorum:") yazabilirsin. Plan govdesi KESINLIKLE <implementation_plan> icinde olmalidir.
5. KESIN KURAL: Plan govdesini sunduktan ve </implementation_plan> etiketini kapattiktan sonra KESINLIKLE KOD YAZMA, dosya icerigi uretme (\`\`\`html, \`\`\`javascript vb.) veya dosya/terminal araci calistirma! Yanitini </implementation_plan> etiketini kapattigin anda tamamen BITIR. Tum kodlama ve uygulama islemleri YALNIZCA kullanici "Onayla ve Uygula" butonuna bastiktan sonra Act modunda baslayacaktir.

Planda MUTLAKA asagidaki basliklar ve zengin formatlar yer almalidir:
1. # [Proje / Ozellik Basligi veya Asama X — ...]
2. ### Amac: Hedefin ve problemin net ozeti.
3. ### Icerik: Maddeler halinde kapsam.
4. ### Dosya Sorumluluklari: Markdown tablosu (| Dosya | Sorumluluk |).
5. ### Uygulama Sirasi: Numarali adim adim uygulama listesi (1. ..., 2. ...).
6. ## Mimari Genel Bakis: En az bir adet \`\`\`mermaid akis semasi veya bilesen diyagrami (graph TD veya sequenceDiagram).
7. ## Riskler ve Dikkat Edilmesi Gerekenler: > [!WARNING] veya > [!IMPORTANT] bloklari.

Kullanici bu plani onayladiktan sonra ("Onayla ve Uygula") uygulama asamasina gecilecektir.`;
    } else {
      modeInstruction = `\n\n## MOD: UYGULAMA (ACT MODE — Hızlı ve Doğrudan Kodlama)
Kullanici uygulama modunu secti veya onaylanmis bir plani baslatti.
1. HIZLI VE DOGRUDAN OL: Gereksiz uzun felsefi analiz veya dakikalar suren derin muhakeme YAPMA.
2. DOSYALARI DERHAL OLUSTUR: Gorevi gerceklestirmek icin gereken dosyalari write_file veya edit araclariyla vakit kaybetmeden olustur veya degistir.
3. KODU EKSIKSIZ YAZ: Plan onaylandigi veya dogrudan kodlama istendigi icin duraksamadan isi bitir.`;
    }

    // Karmasik gorev icin otomatik plan onerisi (act modunda bile)
    const planHint = `\n\n## PLAN ARTIFACT SISTEMI (Antigravity Plan Architecture)
Eger bir uygulama plani, asama listesi (Asama 1, Asama 2...), yol haritasi, mimari tasarim veya yapilacaklar listesi sunuyorsan:
1. Plani yanitinda MUTLAKA <implementation_plan>...</implementation_plan> etiketleri icinde sun!
2. Sohbette ASLA plan govdesini duz metin olarak birakma; sohbete yalnizca 1 cumlelik kisa bir giris (orn: "Uygulama planini hazirliyorum:") yaz.
3. Plan icerigi zengin Markdown olmali: # Baslik, ### Amac, ### Icerik, ### Dosya Sorumlulugu (tablo), ### Uygulama Sirasi (numarali liste).
Sistem bu blogu kullaniciya Antigravity standartlarinda canli plan widgeti olarak sunacaktir.`;

    // Aktif MCP araçlarını al
    const mcpToolsDesc = this.getActiveMCPToolsDescription();

    const toolsInstruction = `\n\n## KULLANILABİLİR ARAÇLAR (Autonomous Tool Calling)
İhtiyaç duyduğunda aşağıdaki araçları çağırabilirsin. Bir aracı çağırmak için yanıtında tam olarak şu formatta tek bir markdown JSON bloğu üret:
\`\`\`tool_call
{
  "tool": "araç_adı",
  "arguments": { ... }
}
\`\`\`
Sistem aracı çalıştırıp çıktısını sana iletecek ve görevi tamamlayana kadar devam etmeni sağlayacaktır.

Yerel Çalışma Alanı ve Medya Üretim Araçları:
- read_file: { "filePath": "dosya/yolu", "offset"?: 1, "limit"?: 400 } -> Metin dosyasını satır numaralarıyla okur (büyük dosyalarda offset/limit kullan). PDF/Word/PowerPoint için read_document kullan.
- write_file: { "filePath": "dosya/yolu", "content": "kod..." } -> Dosyaya yazar veya yeni dosya oluşturur.
- list_dir: { "dirPath": "klasor/yolu" } -> Dizin içindeki dosyaları ve klasörleri listeler.
- run_command: { "command": "terminal komutu" } -> Proje kök dizininde güvenli komut çalıştırır.
- read_spreadsheet: { "filePath": "tablo.xlsx", "sheetName"?: "Sayfa1", "range"?: "A1:D10" } -> Excel (.xlsx, .xls) veya CSV dosyasının sayfalarını, başlıklarını ve verilerini JSON & Markdown tablo olarak okur.
- create_spreadsheet: { "filePath": "tablo.xlsx", "sheets": [ { "name": "Genel Takip", "headers": ["No", "Başlık"], "rows": [[1, "Örnek"]] } ] } -> Sıfırdan çok sayfalı zengin bir Excel (.xlsx) çalışma kitabı oluşturur ve IDE'de Canvas olarak açar.
- edit_spreadsheet: { "filePath": "tablo.xlsx", "sheetName"?: "Genel Takip", "operations": [ { "type": "set_cell", "cell": "A1", "value": "Değer" }, { "type": "set_formula", "cell": "D8", "formula": "=SUM(D2:D7)" }, { "type": "append_row", "row": [5, "Yeni Görev"] }, { "type": "update_range", "startCell": "A2", "rows": [[...]] } ] } -> Excel tablosunu canlı olarak günceller ve düzenlenen hücreleri ekranda parlatır.
- edit_file: { "filePath": "dosya/yolu", "oldString": "değişecek tam metin", "newString": "yeni metin", "replaceAll"?: false } -> Dosyada tam eşleşen metni değiştirir. oldString dosyada TEK olmalı (birden fazlaysa daha fazla bağlam ekle veya replaceAll:true ver). Küçük değişiklikler için write_file yerine bunu tercih et.
- grep_search: { "pattern": "regex veya kelime", "glob"?: "*.ts", "ignoreCase"?: true, "literal"?: false } -> Proje içinde metin arar; dosya:satır:metin döner.
- find_files: { "pattern": "**/*.test.ts" } -> Proje içinde dosya adı/glob ile dosya bulur.
- web_search: { "query": "arama ifadesi" } -> İnternette arar (başlık, adres, özet).
- web_fetch: { "url": "https://..." } -> Bir web sayfasını okunabilir metne çevirip getirir.
- read_document: { "filePath": "rapor.pdf|.docx|.pptx", "range"?: "1-3", "maxChars"?: 60000 } -> PDF, Word veya PowerPoint dosyasının metnini okur (PDF'te sayfa, PPTX'te slayt aralığı verilebilir).
- create_document: { "filePath": "rapor.docx|.pdf|.pptx", "title"?: "Başlık", "markdown"?: "# Başlık\n\nMetin\n- madde\n| A | B |\n|---|---|\n| 1 | 2 |", "slides"?: [ { "title": "Slayt başlığı", "subtitle"?: "...", "bullets"?: ["..."], "text"?: "...", "table"?: { "headers": ["Ay","Satış"], "rows": [["Ocak", 10]] }, "notes"?: "konuşmacı notu" } ] } -> .docx ve .pdf için markdown (veya blocks) ver; .pptx için slides ver. Gerçek, açılabilir dosya üretir.
- edit_document: { "filePath": "rapor.docx|.pptx", "operations": [ { "type": "replace_text", "find": "eski", "replace": "yeni", "all"?: true }, { "type": "append_blocks", "markdown": "## Ek\n\nYeni bölüm" } ] } -> Word/PowerPoint dosyasındaki metni yerinde değiştirir (biçim korunur); append_blocks yalnızca .docx. PDF yerinde düzenlenemez: read_document ile oku, create_document ile yeniden üret.
- generate_image: { "prompt": "görsel açıklaması", "size": "1024x1024" } -> Görsel üretir (DALL-E 3 / Imagen 3 / Flux).
- generate_video: { "prompt": "video açıklaması", "duration": 5, "aspect": "16:9" } -> Google Veo ile video üretir (5 saniye, 16:9 / 9:16 / 1:1).
- generate_music: { "prompt": "müzik açıklaması, enstrümanlar veya melodi", "duration": 30, "musicType": "instrumental" | "vocal" } -> Google Lyria 3.5 ile stüdyo kalitesinde müzik/ses üretir.
- mcp_call: { "server": "sunucu_adı", "tool": "araç_adı", "arguments": { ... } } -> MCP aracını tetikler.
- spawn_subagent: { "role": "Planlayici|Kod Yazici|Test Kosturucu|Hata Ayiklayici|Kod Inceleyici|Dokumantasyon", "task": "gorev aciklamasi", "tools": ["read_file", "write_file"] } -> Izole bir subagent baslatir. Karmasik gorevleri bolerek paralel calistirabilirsin.

Kullanıcı görsel, video veya müzik/ses istediğinde tereddüt etmeden generate_image, generate_video veya generate_music araçlarını çağır. Araç tamamlandığında gelen @[audio:...], @[video:...] veya @[image:...] etiketlerini doğrudan nihai yanıtında kullanıcıya göster.

Aktif MCP Sunucuları ve Araçları:
${mcpToolsDesc}`;

    const platform = this.systemPaths.platform || (navigator.userAgent.includes('Mac') ? 'darwin' : (navigator.userAgent.includes('Linux') ? 'linux' : 'win32'));
    const osName = platform === 'win32' ? 'Windows' : (platform === 'darwin' ? 'macOS' : 'Linux');
    const desktopPath = this.systemPaths.desktop || (platform === 'win32' ? 'Desktop' : '~/Desktop');
    const homePath = this.systemPaths.home || (platform === 'win32' ? 'Home' : '~');
    const projectPath = this.currentProjectPath || 'Henüz proje klasörü açılmadı';

    const localEnvInstruction = `\n\n## KULLANICI ÇALIŞMA ORTAMI (Yerel Bilgisayar):
- İşletim Sistemi: ${osName} (${platform})
- Kullanıcı Masaüstü Yolu (Desktop): ${desktopPath}
- Kullanıcı Ana Dizini (Home): ${homePath}
- Açık Proje Dizini: ${projectPath}

KRİTİK OTONOM ÇALIŞMA VE YEREL ARAÇ KURALI:
1. Sen kullanıcının yerel Windows/macOS/Linux bilgisayarında çalışan Kraga IDE'nin otonom asistanısın.
2. Yerel dosya sistemi ve terminal üzerinde TAM YETKİN vardır. "Ben buluttayım, senin bilgisayarına bağlanamam, dosyaları doğrudan işleyemem, kendin .bat oluşturup çalıştır" şeklinde yanıt vermek KESİNLİKLE YASAKTIR.
3. Excel / Veri / Tablo Görevleri (ChatGPT Canvas Seviyesi Canlı Elektronik Tablo):
   - KESİNLİKLE YASAKTIR: Kullanıcı bir Excel, tablo, hesap tablosu, CSV veya veri/EBA listesi istediğinde ASLA Python betiği (openpyxl, pandas) yazıp "terminalden çalıştırın", "pip install yapın" DEME! Kullanıcıya kod çalıştırtmak YASAKTIR.
   - Sıfırdan bir Excel tablosu oluşturmak için DOĞRUDAN VE İSTİSNASIZ OLARAK \`create_spreadsheet\` ARACINI ÇAĞIR:
\`\`\`tool_call
{
  "tool": "create_spreadsheet",
  "arguments": {
    "filePath": "eba_sorulari.xlsx",
    "sheets": [
      {
        "name": "EBA_Sorulari",
        "headers": ["Soru No", "Kazanım", "Ders", "Soru Metni", "A", "B", "C", "D", "Doğru Cevap", "Puan"],
        "rows": [
          [1, "BT.7.1.1.1", "Bilişim", "Algoritma nedir?", "Adım adım çözüm yolu", "Donanım", "Monitör", "Klavye", "A", 20],
          [2, "BT.7.1.1.2", "Bilişim", "Hangisi döngüdür?", "For / While", "If / Else", "Print", "Input", "A", 20]
        ]
      }
    ]
  }
}
\`\`\`
   - Excel (.xlsx, .xls, .csv) dosyalarını okumak için doğrudan \`read_spreadsheet\` aracını çağır.
   - Açık olan veya belirtilen bir Excel tablosunda hücre değiştirmek, yeni satır eklemek, formül yazmak için doğrudan \`edit_spreadsheet\` aracını çağır. (IDE bu değişiklikleri canlı olarak tabloya yansıtır ve düzenlenen hücreleri ekranda yeşil parıltıyla vurgular).
4. PDF / Word / PowerPoint Görevleri:
   - Kullanıcı bir .pdf, .docx veya .pptx dosyasını incelemeni istediğinde read_document ile oku (python/pip gerekmez). Rapor, özet, mektup, sözleşme, CV gibi belgeler için create_document ile gerçek .docx veya .pdf üret; sunum için slides ile .pptx üret. Dosyayı üretmeden "oluşturdum" deme.
   - Var olan Word/PowerPoint dosyasında metin değişikliği için edit_document kullan (önce read_document ile içeriği gör).
   - Güncel bilgi gerekiyorsa web_search, bulduğun sayfayı okumak için web_fetch kullan. Kod aramak için grep_search/find_files, küçük kod değişikliği için edit_file.
5. Fotoğraf, Resim ve Yüz Kırpma / İşleme Görevleri:
   - Kullanıcı "fotoğrafları yüz hizasından kırp", "öğrenci resimlerini Excel'e listele" veya toplu görsel düzenleme istediğinde:
   - PIL (Pillow), OpenCV veya face_recognition kullanan temiz, self-contained bir Python betiği (örn: \`process_students.py\`) yaz (\`write_file\`).
   - Bu betiği \`run_command\` ile hemen çalıştır (\`python process_students.py\`). Gerekli kütüphane eksikse \`run_command\` ile kur (\`pip install Pillow openpyxl opencv-python\`).
   - İşlem bittiğinde üretilen görselleri ve güncellenen Excel dosyasını kullanıcıya özetle.
6. Kullanıcı masaüstünde veya bir klasörde dosya oluşturmanı/değiştirmeni istediğinde:
   - Hedef dosya yolunu "${desktopPath.replace(/\\/g, '/')}/dosya_adi.uzanti" olarak belirle ve \`\`\`tool_call ile write_file aracını çağır:
\`\`\`tool_call
{
  "tool": "write_file",
  "arguments": {
    "filePath": "${desktopPath.replace(/\\/g, '/')}/ornek.txt",
    "content": "dosya içeriği"
  }
}
\`\`\`
Kraga IDE bu aracı yerel işletim sisteminde çalıştıracak ve dosyayı kullanıcının bilgisayarına gerçek olarak kaydedecektir.`;

    const thinkingInstruction = this.isThinking
      ? 'Dusuncelerini, mimari analizini ve adim adim muhakeme surecini MUTLAKA <think>...</think> etiketleri icerisine yaz. Kullaniciya iletilecek nihai dogrudan yaniti veya kodlari bu etiketin disina koy.'
      : 'Hizli, dogrudan ve kesin ol. Uzun felsefi analiz yapma. Istenen kodlari ve write_file arac cagrilari derhal uret.';

    return {
      role: 'system',
      content: `Sen Kraga IDE icindeki akilli yazilim mimari ve otonom kodlama asistanisin.
Mevcut acik proje dizini: ${this.currentProjectPath || 'Henuz proje klasoru acilmadi'}.
Teknik, dogrudan ve yuksek sinyalli yanitlar ver. Kod bloklarini dogru dil etiketiyle (ts, js, html, css, json vb.) yaz.
${thinkingInstruction}${localEnvInstruction}${modeInstruction}${planHint}${toolsInstruction}${memoryPrompt}${skillsPrompt}`,
    };
  }

  private getActiveMCPToolsDescription(): string {
    try {
      const tools = MCPSettingsPanel.getInstance().getAllActiveTools();
      if (!tools || tools.length === 0) {
        return '- (Henüz bağlı üçüncü parti MCP aracı bulunmuyor)';
      }
      return tools
        .slice(0, 40)
        .map((t) => `- ${t.name}: ${String(t.description || "").slice(0, 160)} (Sunucu: ${t.serverName})`)
        .join('\n');
    } catch {
      return '- (MCP araçları yüklenemedi)';
    }
  }

  // ─── Antigravity Smart Step Bars (Explored, Ran, Edited, Working) ─────────
  private formatGroupTitle(fileCount: number, cmdCount: number, isActive: boolean): string {
    if (isActive) {
      if (fileCount > 0 && cmdCount > 0) {
        return `Exploring ${fileCount} file${fileCount > 1 ? 's' : ''}, running ${cmdCount} command${cmdCount > 1 ? 's' : ''}`;
      } else if (fileCount > 0) {
        return `Exploring ${fileCount} file${fileCount > 1 ? 's' : ''}`;
      } else if (cmdCount > 0) {
        return `Running ${cmdCount} command${cmdCount > 1 ? 's' : ''}`;
      }
      return 'Exploring...';
    } else {
      if (fileCount > 0 && cmdCount > 0) {
        return `Explored ${fileCount} file${fileCount > 1 ? 's' : ''}, ran ${cmdCount} command${cmdCount > 1 ? 's' : ''}`;
      } else if (fileCount > 0) {
        return `Explored ${fileCount} file${fileCount > 1 ? 's' : ''}`;
      } else if (cmdCount > 0) {
        return `Ran ${cmdCount} command${cmdCount > 1 ? 's' : ''}`;
      }
      return 'Explored files';
    }
  }

  private getFileExtBadge(filePath: string): { ext: string; isPlan: boolean; className: string } {
    const clean = (filePath || '').toLowerCase();
    if (clean.includes('implementation_plan') || clean.includes('plan.md')) {
      return { ext: '📄', isPlan: true, className: 'ag-badge-ext--doc' };
    }
    const parts = (filePath || '').split(/[/\\]/);
    const fileName = parts[parts.length - 1] || '';
    const dotIdx = fileName.lastIndexOf('.');
    const ext = dotIdx > 0 ? fileName.slice(dotIdx + 1).toLowerCase() : '';

    if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') {
      return { ext: 'JS', isPlan: false, className: 'ag-badge-ext--js' };
    }
    if (ext === 'ts' || ext === 'tsx' || ext === 'mts' || ext === 'cts') {
      return { ext: 'TS', isPlan: false, className: 'ag-badge-ext--ts' };
    }
    if (ext === 'html' || ext === 'htm') {
      return { ext: '<>', isPlan: false, className: 'ag-badge-ext--html' };
    }
    if (ext === 'css' || ext === 'scss' || ext === 'less') {
      return { ext: '{}', isPlan: false, className: 'ag-badge-ext--css' };
    }
    if (ext === 'json') {
      return { ext: '{}', isPlan: false, className: 'ag-badge-ext--json' };
    }
    if (ext === 'py') {
      return { ext: 'PY', isPlan: false, className: 'ag-badge-ext--py' };
    }
    if (ext === 'ps1' || ext === 'sh' || ext === 'bash' || ext === 'bat' || ext === 'cmd') {
      return { ext: '>_', isPlan: false, className: 'ag-badge-ext--script' };
    }
    if (ext === 'md' || ext === 'txt' || ext === 'markdown') {
      return { ext: 'MD', isPlan: false, className: 'ag-badge-ext--md' };
    }

    return { ext: ext.toUpperCase().slice(0, 4) || '📄', isPlan: false, className: 'ag-badge-ext--doc' };
  }

  private computeDiffStats(toolName: string, toolArgs: any): { added: number; deleted: number } {
    const clean = (toolName || '').toLowerCase();
    let added = 0;
    let deleted = 0;

    if (clean === 'replace_file_content') {
      const target = toolArgs.targetContent || toolArgs.TargetContent || '';
      const replace = toolArgs.replacementContent || toolArgs.ReplacementContent || '';
      deleted = target ? target.split('\n').length : 0;
      added = replace ? replace.split('\n').length : 0;
    } else if (clean === 'write_file' || clean === 'write_to_file') {
      const code = toolArgs.content || toolArgs.CodeContent || toolArgs.code || '';
      added = code ? code.split('\n').length : 1;
      deleted = 0;
    } else {
      added = 1;
      deleted = 0;
    }
    return { added, deleted };
  }

  private formatCommandSnippet(cmd: string): string {
    if (!cmd) return '';
    const singleLine = cmd.replace(/[\r\n]+/g, ' ').trim();
    if (singleLine.length > 55) {
      return singleLine.slice(0, 52) + '...';
    }
    return singleLine;
  }

  private showAntigravityWorking(sessionId: string, parentEl: HTMLElement): void {
    this.hideAntigravityWorking(sessionId);
    const row = document.createElement('div');
    row.className = 'ag-working-row';
    row.innerHTML = `
      <span class="ag-working-spinner"></span>
      <span>Working...</span>
    `;
    parentEl.appendChild(row);
    this.activeWorkingRows.set(sessionId, row);
    if (this.currentSessionId === sessionId) {
      this.scrollToBottom();
    }
  }

  private hideAntigravityWorking(sessionId: string): void {
    const row = this.activeWorkingRows.get(sessionId);
    if (row && row.parentNode) {
      row.remove();
    }
    this.activeWorkingRows.delete(sessionId);
  }

  private renderAntigravityStepBar(
    sessionId: string,
    toolName: string,
    toolArgs: any,
    parentContainer: HTMLElement
  ): { updateResult: (output: string, success: boolean) => void } {
    const clean = (toolName || '').toLowerCase().trim();

    // Kategori belirle
    const isExplore = ['read_file', 'view_file', 'grep_search', 'search_codebase', 'find_by_name', 'find_files', 'list_dir', 'search_web', 'web_search', 'web_fetch', 'read_document'].includes(clean);
    const isCommand = ['run_command', 'execute_command'].includes(clean);
    const isEdit = ['write_file', 'replace_file_content', 'edit_file', 'write_to_file', 'create_document', 'edit_document'].includes(clean);

    let feed = parentContainer.querySelector('.ag-step-feed') as HTMLElement;
    if (!feed) {
      feed = document.createElement('div');
      feed.className = 'ag-step-feed';
      parentContainer.appendChild(feed);
    }

    this.hideAntigravityWorking(sessionId);

    let activeGroup = this.activeStepGroups.get(sessionId);
    let stepResultCallback: (output: string, success: boolean) => void = () => {};

    if (isExplore) {
      const rawTarget = toolArgs.filePath || toolArgs.path || toolArgs.AbsolutePath || toolArgs.dirPath || toolArgs.query || toolArgs.pattern || 'file';
      const parts = String(rawTarget).split(/[/\\]/);
      const shortTarget = parts[parts.length - 1] || rawTarget;
      const badge = this.getFileExtBadge(String(rawTarget));

      let lineRange = '';
      if (toolArgs.StartLine !== undefined && toolArgs.EndLine !== undefined) {
        lineRange = `#L${toolArgs.StartLine}-${toolArgs.EndLine}`;
      } else if (toolArgs.startLine !== undefined && toolArgs.endLine !== undefined) {
        lineRange = `#L${toolArgs.startLine}-${toolArgs.endLine}`;
      } else if (toolArgs.LineNumber !== undefined) {
        lineRange = `#L${toolArgs.LineNumber}`;
      }

      const exploreAction = lineRange || clean === 'grep_search' || clean === 'find_by_name' || clean === 'search_codebase' ? 'Analyzed' : (clean === 'read_file' ? 'Read' : 'Analyzed');

      const subRow = document.createElement('div');
      subRow.className = 'ag-step-row ag-step-subrow';
      subRow.innerHTML = `
        <div class="ag-step-row__left">
          <span class="ag-step-row__action">${exploreAction}</span>
          <span class="ag-badge-ext ${badge.className}">${badge.ext}</span>
          <span class="ag-step-row__code" title="${DOMPurify.sanitize(String(rawTarget))}">${DOMPurify.sanitize(String(shortTarget))}</span>
          ${lineRange ? `<span class="ag-step-row__lines">${lineRange}</span>` : ''}
        </div>
        <div class="ag-step-row__right">
          <span class="ag-step-chevron">›</span>
        </div>
      `;
      const detailBox = document.createElement('div');
      detailBox.className = 'ag-step-detail-box';
      subRow.addEventListener('click', (e) => {
        e.stopPropagation();
        subRow.classList.toggle('ag-step-row--expanded');
      });

      if (activeGroup) {
        activeGroup.fileCount++;
        activeGroup.titleEl.textContent = this.formatGroupTitle(activeGroup.fileCount, activeGroup.cmdCount, true);
        activeGroup.subList.appendChild(subRow);
        activeGroup.subList.appendChild(detailBox);
      } else {
        const groupEl = document.createElement('div');
        groupEl.className = 'ag-step-group ag-step-group--expanded';

        const headerRow = document.createElement('div');
        headerRow.className = 'ag-step-row';
        headerRow.innerHTML = `
          <div class="ag-step-row__left">
            <span class="ag-step-row__highlight ag-group-title">${this.formatGroupTitle(1, 0, true)}</span>
          </div>
          <div class="ag-step-row__right">
            <span class="ag-step-chevron">›</span>
          </div>
        `;
        const titleEl = headerRow.querySelector('.ag-group-title') as HTMLElement;
        const subList = document.createElement('div');
        subList.className = 'ag-step-sublist';

        headerRow.addEventListener('click', () => {
          groupEl.classList.toggle('ag-step-group--expanded');
        });

        subList.appendChild(subRow);
        subList.appendChild(detailBox);

        groupEl.appendChild(headerRow);
        groupEl.appendChild(subList);
        feed.appendChild(groupEl);

        activeGroup = {
          container: groupEl,
          headerRow,
          titleEl,
          subList,
          fileCount: 1,
          cmdCount: 0
        };
        this.activeStepGroups.set(sessionId, activeGroup);
      }

      stepResultCallback = (output: string) => {
        detailBox.textContent = output.slice(0, 1000);
      };
    } else if (isCommand) {
      const rawCmd = String(toolArgs.command || toolArgs.CommandLine || '');
      const cmdSnippet = this.formatCommandSnippet(rawCmd);

      const subRow = document.createElement('div');
      subRow.className = 'ag-step-row ag-step-subrow';
      subRow.innerHTML = `
        <div class="ag-step-row__left">
          <span class="ag-step-row__action">Ran</span>
          <span class="ag-step-row__code" title="${DOMPurify.sanitize(rawCmd)}">${DOMPurify.sanitize(cmdSnippet)}</span>
        </div>
        <div class="ag-step-row__right">
          <span class="ag-step-chevron">›</span>
        </div>
      `;
      const detailBox = document.createElement('div');
      detailBox.className = 'ag-step-detail-box';
      subRow.addEventListener('click', (e) => {
        e.stopPropagation();
        subRow.classList.toggle('ag-step-row--expanded');
      });

      if (activeGroup) {
        activeGroup.cmdCount++;
        activeGroup.titleEl.textContent = this.formatGroupTitle(activeGroup.fileCount, activeGroup.cmdCount, true);
        activeGroup.subList.appendChild(subRow);
        activeGroup.subList.appendChild(detailBox);
      } else {
        const groupEl = document.createElement('div');
        groupEl.className = 'ag-step-group ag-step-group--expanded';

        const headerRow = document.createElement('div');
        headerRow.className = 'ag-step-row';
        headerRow.innerHTML = `
          <div class="ag-step-row__left">
            <span class="ag-step-row__highlight ag-group-title">${this.formatGroupTitle(0, 1, true)}</span>
          </div>
          <div class="ag-step-row__right">
            <span class="ag-step-chevron">›</span>
          </div>
        `;
        const titleEl = headerRow.querySelector('.ag-group-title') as HTMLElement;
        const subList = document.createElement('div');
        subList.className = 'ag-step-sublist';

        headerRow.addEventListener('click', () => {
          groupEl.classList.toggle('ag-step-group--expanded');
        });

        subList.appendChild(subRow);
        subList.appendChild(detailBox);

        groupEl.appendChild(headerRow);
        groupEl.appendChild(subList);
        feed.appendChild(groupEl);

        activeGroup = {
          container: groupEl,
          headerRow,
          titleEl,
          subList,
          fileCount: 0,
          cmdCount: 1
        };
        this.activeStepGroups.set(sessionId, activeGroup);
      }

      stepResultCallback = (output: string) => {
        detailBox.textContent = output.slice(0, 2000);
      };
    } else if (isEdit) {
      if (activeGroup) {
        activeGroup.titleEl.textContent = this.formatGroupTitle(activeGroup.fileCount, activeGroup.cmdCount, false);
        this.activeStepGroups.delete(sessionId);
      }

      const rawPath = String(toolArgs.filePath || toolArgs.path || toolArgs.TargetFile || 'file');
      const parts = rawPath.split(/[/\\]/);
      const fileName = parts[parts.length - 1] || rawPath;
      const badgeInfo = this.getFileExtBadge(rawPath);
      const diff = this.computeDiffStats(toolName, toolArgs);

      const row = document.createElement('div');
      row.className = 'ag-step-row';
      const displayBadge = badgeInfo.isPlan
        ? `<span class="ag-badge-ext ag-badge-ext--doc">📄</span>`
        : `<span class="ag-badge-ext ${badgeInfo.className}">${badgeInfo.ext}</span>`;
      const displayFileName = badgeInfo.isPlan ? 'Implementation Plan' : fileName;

      row.innerHTML = `
        <div class="ag-step-row__left">
          <span class="ag-step-row__action">Edited</span>
          ${displayBadge}
          <span class="ag-step-row__highlight">${DOMPurify.sanitize(displayFileName)}</span>
          <span class="ag-diff-stat">
            <span class="ag-diff-stat__add">+${diff.added}</span>
            <span class="ag-diff-stat__del">-${diff.deleted}</span>
          </span>
        </div>
        <div class="ag-step-row__right">
          <span class="ag-step-chevron">›</span>
        </div>
      `;

      const detailBox = document.createElement('div');
      detailBox.className = 'ag-step-detail-box';
      row.addEventListener('click', () => {
        row.classList.toggle('ag-step-row--expanded');
      });

      feed.appendChild(row);
      feed.appendChild(detailBox);

      stepResultCallback = (output: string) => {
        detailBox.textContent = output.slice(0, 1000);
      };
    } else if (toolName === 'generate_image' || toolName === 'generate_video' || toolName === 'generate_music') {
      if (activeGroup) {
        activeGroup.titleEl.textContent = this.formatGroupTitle(activeGroup.fileCount, activeGroup.cmdCount, false);
        this.activeStepGroups.delete(sessionId);
      }
      const actionLabel = toolName === 'generate_image' ? 'Created Image' : (toolName === 'generate_video' ? 'Created Video' : 'Generated Music');
      const promptSnippet = (toolArgs.prompt || toolArgs.description || '').slice(0, 45);

      const row = document.createElement('div');
      row.className = 'ag-step-row';
      row.innerHTML = `
        <div class="ag-step-row__left">
          <span class="ag-step-row__action">${actionLabel}</span>
          <span class="ag-step-row__highlight" title="${DOMPurify.sanitize(String(toolArgs.prompt || toolArgs.description || ''))}">${DOMPurify.sanitize(promptSnippet || toolName)}</span>
        </div>
        <div class="ag-step-row__right">
          <span class="ag-step-chevron">›</span>
        </div>
      `;
      const detailBox = document.createElement('div');
      detailBox.className = 'ag-step-detail-box';
      row.addEventListener('click', () => {
        row.classList.toggle('ag-step-row--expanded');
      });
      feed.appendChild(row);
      feed.appendChild(detailBox);

      stepResultCallback = (output: string) => {
        detailBox.innerHTML = this.renderMarkdownWithMedia(output);
      };
    } else {
      if (activeGroup) {
        activeGroup.titleEl.textContent = this.formatGroupTitle(activeGroup.fileCount, activeGroup.cmdCount, false);
        this.activeStepGroups.delete(sessionId);
      }

      const row = document.createElement('div');
      row.className = 'ag-step-row';
      row.innerHTML = `
        <div class="ag-step-row__left">
          <span class="ag-step-row__action">Executed</span>
          <span class="ag-step-row__highlight">${DOMPurify.sanitize(toolName)}</span>
        </div>
        <div class="ag-step-row__right">
          <span class="ag-step-chevron">›</span>
        </div>
      `;
      const detailBox = document.createElement('div');
      detailBox.className = 'ag-step-detail-box';
      row.addEventListener('click', () => {
        row.classList.toggle('ag-step-row--expanded');
      });
      feed.appendChild(row);
      feed.appendChild(detailBox);

      stepResultCallback = (output: string) => {
        detailBox.textContent = output.slice(0, 1000);
      };
    }

    this.showAntigravityWorking(sessionId, feed);
    return { updateResult: stepResultCallback };
  }

  private getMaxToolLoops(): number {
    try {
      const saved = localStorage.getItem('kraga-ide-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.maxToolLoops && typeof parsed.maxToolLoops === 'number' && parsed.maxToolLoops > 0) {
          return parsed.maxToolLoops;
        }
      }
    } catch {}
    const permMode = permissionManager.getSettings().mode;
    if (permMode === 'auto') return 50;
    if (permMode === 'ask_critical') return 35;
    return 25;
  }

  private async runToolCallingStreamLoop(
    systemPrompt: ChatMessage,
    loopDepth: number,
    targetSessionId?: string,
    initialSessionMessages?: ChatMessage[]
  ): Promise<void> {
    const streamSessionId = targetSessionId || this.currentSessionId;
    const maxToolLoops = this.getMaxToolLoops();

    // Hedef oturumun mesaj dizisini sabitle
    let sessionMessages = initialSessionMessages;
    if (!sessionMessages) {
      const existingStream = this.activeStreams.get(streamSessionId);
      if (existingStream) {
        sessionMessages = existingStream.accumulatedMessages;
      } else if (this.currentSessionId === streamSessionId) {
        sessionMessages = this.messages;
      } else {
        sessionMessages = this.chatHistory.getSessionMessages(streamSessionId);
      }
    }
    if (!sessionMessages) {
      sessionMessages = this.messages;
    }

    if (loopDepth >= maxToolLoops) {
      this.finishProcessing(`Otonom araç adımı limitine (${maxToolLoops} adım) ulaşıldı`, streamSessionId);
      if (this.currentTurnChanges.size > 0) {
        const turnFiles = Array.from(this.currentTurnChanges.values());
        const turnData: TurnReviewData = {
          turnId: `turn_${Date.now()}`,
          userPrompt: this.currentTurnPrompt,
          timestamp: new Date(),
          files: turnFiles,
        };
        this.turnReviewHistory.set(turnData.turnId, turnData);
        const lastBubble = this.chatFlow.querySelector('.message--agent:last-child') as HTMLElement;
        if (lastBubble) {
          this.renderTurnChangesCard(turnData, lastBubble);
        }
        this.currentTurnChanges.clear();
      }

      // Kullanıcının tek tıkla devam edebilmesi için "Göreve Devam Et" aksiyon butonu ekle
      const lastBubble = this.chatFlow.querySelector('.message--agent:last-child') as HTMLElement;
      if (lastBubble && !lastBubble.querySelector('.ag-continue-loop-card')) {
        const continueCard = document.createElement('div');
        continueCard.className = 'ag-continue-loop-card';
        continueCard.style.cssText = 'margin-top: 12px; padding: 12px 16px; background: rgba(0, 240, 255, 0.04); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;';
        continueCard.innerHTML = `
          <div style="font-size: 0.82rem; color: var(--text-secondary, #94a3b8);">
            ⚡ <strong>${maxToolLoops} adımlık</strong> otonom çalışma tamamlandı. Kalan görevler için devam edilsin mi?
          </div>
          <button class="ag-btn-continue-loop" style="padding: 7px 16px; background: var(--accent-color, #00f0ff); color: #000; font-weight: 600; font-size: 0.82rem; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.2s;">
            ▶️ Göreve Devam Et (+${maxToolLoops} Adım)
          </button>
        `;
        const btnContinue = continueCard.querySelector('.ag-btn-continue-loop') as HTMLButtonElement;
        const targetMessages = sessionMessages;
        btnContinue?.addEventListener('click', async () => {
          btnContinue.disabled = true;
          btnContinue.innerHTML = `<span>⏳ Devam Ediliyor...</span>`;
          continueCard.style.opacity = '0.6';
          this.isProcessing = true;
          this.setStatus('Görevin devamı yürütülüyor...');
          this.toggleSendStopButtons(true);
          targetMessages.push({
            role: 'user',
            content: 'Önceki adımlardan devam et. Kalan adımları ve görevleri tamamlamak için araç çalıştırmayı sürdür.'
          });
          await this.runToolCallingStreamLoop(systemPrompt, 0, streamSessionId, targetMessages);
        });
        lastBubble.appendChild(continueCard);
        this.scrollToBottom(true);
      }
      return;
    }

    if (loopDepth === maxToolLoops - 1) {
      // Son adımda modeli durdurmak yerine durumu özetlemeye yönlendir
      systemPrompt = {
        role: 'system',
        content: `${systemPrompt.content}\n\n[BİLGİ: Otonom araç çağırma adım sınırına (${maxToolLoops} adım) gelindi. Bu adımda lütfen şu ana kadar yaptığın tüm işlemleri, ulaşılan sonuçları ve kalan adımları özetle. Kullanıcı tek tıkla devam edebilecek.]`
      };
    }

    const effectiveEffort = loopDepth > 0 ? 'low' : this.selectedEffort;
    const effectiveThinking = this.isThinking;

    const modelObj = getModelById(this.selectedModel);
    const modelDisplayName = modelObj ? modelObj.name : this.selectedModel;

    const agentBubble = this.createMessageBubble('agent', streamSessionId);
    agentBubble.innerHTML = `
      <div class="ag-auto-routed-badge">
        <span class="ag-route-dot"></span>
        <span>Auto routed task to <strong>${DOMPurify.sanitize(modelDisplayName)}</strong></span>
      </div>
      <div class="antigravity-thinking-pill antigravity-thinking-pill--running antigravity-thinking-pill--expanded">
        <div class="antigravity-thinking-pill__header" role="button" tabindex="0">
          <div class="antigravity-thinking-pill__left">
            <span class="antigravity-pill-spinner"></span>
            <span class="antigravity-thinking-pill__title">Düşünülüyor...</span>
            <span class="antigravity-thinking-pill__timer">(0.0s)</span>
          </div>
          <span class="antigravity-thinking-pill__chevron">${iconChevronDown(12)}</span>
        </div>
        <div class="antigravity-thinking-pill__body">
          <div class="antigravity-thinking-pill__content">Düşünce süreci yürütülüyor...</div>
        </div>
      </div>
      <div class="agent-response-content"></div>
    `;

    const thinkingPill = agentBubble.querySelector('.antigravity-thinking-pill') as HTMLElement;
    const thinkingHeader = agentBubble.querySelector('.antigravity-thinking-pill__header') as HTMLElement;
    const thinkingBody = agentBubble.querySelector('.antigravity-thinking-pill__body') as HTMLElement;
    const thinkingContent = agentBubble.querySelector('.antigravity-thinking-pill__content') as HTMLElement;
    const thinkingTitle = agentBubble.querySelector('.antigravity-thinking-pill__title') as HTMLElement;
    const thinkingTimer = agentBubble.querySelector('.antigravity-thinking-pill__timer') as HTMLElement;
    const responseContainer = agentBubble.querySelector('.agent-response-content') as HTMLElement;

    thinkingHeader.addEventListener('click', () => {
      thinkingBody.classList.toggle('antigravity-thinking-pill__body--collapsed');
      thinkingPill.classList.toggle('antigravity-thinking-pill--expanded');
    });

    const startTime = Date.now();
    const timerInterval = setInterval(() => {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      thinkingTimer.textContent = `(${elapsed}s)`;
    }, 100);

    const abortController = new AbortController();
    if (this.currentSessionId === streamSessionId) {
      this.currentAbortController = abortController;
    }

    const streamEntry: ActiveStreamSession = {
      sessionId: streamSessionId,
      abortController,
      agentBubble,
      accumulatedMessages: sessionMessages,
      rawResponse: '',
      responseText: '',
      thinkingText: '',
      liveScriptStarted: false,
      startTime
    };
    this.activeStreams.set(streamSessionId, streamEntry);

    // ── Streaming Throttle: DOM güncellemelerini 30ms'de max 1 kez yap ──
    const RENDER_INTERVAL = 30; // ms (daha akıcı ve canlı kodlama)
    let renderTimer: ReturnType<typeof setTimeout> | null = null;
    let thinkingRenderTimer: ReturnType<typeof setTimeout> | null = null;
    let planRenderTimer: ReturnType<typeof setTimeout> | null = null;

    const extractThinkingBlock = (raw: string): { thinking: string; response: string } => {
      // 1. Ters tırnak içindeki kural veya dokümantasyon `<think>` anlatımlarını koru
      const placeholderMap = new Map<string, string>();
      let safeRaw = raw.replace(/`[^`\n]*<think>[^`\n]*`/gi, (m) => {
        const ph = `__THINK_PH_${placeholderMap.size}__`;
        placeholderMap.set(ph, m);
        return ph;
      });

      // 2. Gerçek <think>...</think> bloğunu yakala
      const thinkMatch = safeRaw.match(/<think>([\s\S]*?)(?:<\/think>|$)/i);
      let thinking = '';
      let response = safeRaw;

      if (thinkMatch) {
        thinking = thinkMatch[1].trim();
        response = safeRaw.replace(/<think>[\s\S]*?(?:<\/think>|$)/i, '').trim();
      }

      // 3. Placeholder'ları geri yükle
      for (const [ph, orig] of placeholderMap.entries()) {
        thinking = thinking.replace(ph, orig);
        response = response.replace(ph, orig);
      }

      return { thinking, response };
    };

    const doChunkRender = () => {
      renderTimer = null;
      const { thinking, response } = extractThinkingBlock(streamEntry.rawResponse);

      if (thinking) {
        streamEntry.thinkingText = thinking;
        thinkingPill.style.display = 'flex';
        thinkingContent.innerHTML = DOMPurify.sanitize(marked.parse(streamEntry.thinkingText) as string);
        streamEntry.responseText = response;
      } else {
        streamEntry.responseText = response;
        if (!streamEntry.thinkingText && streamEntry.responseText.trim().length > 0) {
          thinkingPill.style.display = 'none';
        }
      }

      const { preamble, livePlanRaw, isPlan } = this.separateChatAndPlan(streamEntry.responseText);

      if (isPlan && livePlanRaw) {
        if (preamble) {
          responseContainer.innerHTML = this.renderMarkdownWithMedia(preamble);
        } else {
          responseContainer.innerHTML = '';
        }
        this.updatePlanArtifactWidget(agentBubble, livePlanRaw, false, systemPrompt, loopDepth);
      } else {
        const cleanStream = this.sanitizeStreamingText(streamEntry.responseText);

        // Canlı Kodlama Paneli (LiveScriptWorkspace) Akışı
        if (this.currentSessionId === streamSessionId && this.currentMode !== 'plan') {
          // A) write_file tool call canlı akışı:
          let targetRelPath = '';
          let rawStreamedContent = '';

          const toolWriteMatch = streamEntry.rawResponse.match(
            /"(?:tool|name)"\s*:\s*"(?:write_file|write_to_file|create_file)"[\s\S]*?"(?:filePath|path|TargetFile|targetFile)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[\s\S]*?"(?:content|CodeContent|code)"\s*:\s*"([\s\S]*)$/i
          );
          if (toolWriteMatch) {
            targetRelPath = toolWriteMatch[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"').trim().replace(/[/\\]+$/, '');
            rawStreamedContent = toolWriteMatch[2];
          } else if (streamEntry.rawResponse.includes('"write_file"') || streamEntry.rawResponse.includes('"write_to_file"') || streamEntry.rawResponse.includes('"create_file"')) {
            const pathM = streamEntry.rawResponse.match(/"(?:filePath|path|TargetFile|targetFile)"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
            const contentM = streamEntry.rawResponse.match(/"(?:content|CodeContent|code)"\s*:\s*"([\s\S]*)$/i);
            if (pathM && contentM) {
              targetRelPath = pathM[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"').trim().replace(/[/\\]+$/, '');
              rawStreamedContent = contentM[1];
            } else if (pathM && !contentM) {
              targetRelPath = pathM[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"').trim().replace(/[/\\]+$/, '');
              rawStreamedContent = '// Kod oluşturuluyor...';
            }
          }

          if (targetRelPath && rawStreamedContent) {
            // Canlı dosya kodlaması başlasa dahi düşünce süreci kartını ASLA gizleme; tamamlanmış olarak katla
            if (streamEntry.thinkingText) {
              thinkingPill.style.display = 'flex';
              thinkingPill.classList.remove('antigravity-thinking-pill--running', 'antigravity-thinking-pill--expanded');
              thinkingPill.classList.add('antigravity-thinking-pill--completed');
              thinkingBody.classList.add('antigravity-thinking-pill__body--collapsed');
            }
            const unescapedContent = rawStreamedContent
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .replace(/"\s*\}[\s\S]*$/, '');

            const parts = targetRelPath.split(/[/\\]/);
            const rawName = parts[parts.length - 1] || targetRelPath;
            const fileName = rawName.replace(/[^a-zA-Z0-9_\-\.]/g, '_') || 'untitled.txt';
            const dotIdx = fileName.lastIndexOf('.');
            const ext = dotIdx > 0 ? fileName.slice(dotIdx + 1).toLowerCase() : 'txt';
            const langMap: Record<string, string> = {
              html: 'html', htm: 'html', js: 'javascript', ts: 'typescript', css: 'css',
              py: 'python', json: 'json', md: 'markdown', cs: 'csharp', cpp: 'cpp'
            };
            const lang = langMap[ext] || 'plaintext';

            const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
            const indicatorHtml = `
              <div class="ag-live-tool-indicator">
                <span class="antigravity-pill-spinner"></span>
                <span>⚡ <strong>${DOMPurify.sanitize(fileName)}</strong> kodlanıyor... (${elapsedSec}s)</span>
              </div>
            `;
            if (cleanStream) {
              responseContainer.innerHTML = this.renderMarkdownWithMedia(cleanStream) + indicatorHtml;
            } else {
              responseContainer.innerHTML = indicatorHtml;
            }

            if (!streamEntry.liveScriptStarted) {
              streamEntry.liveScriptStarted = true;
              this.onLiveScriptStart?.(fileName, lang, unescapedContent);
            } else {
              this.onLiveScriptChunk?.(unescapedContent);
            }
          } else {
            // B) Standart Markdown kod blokları canlı akışı
            if (cleanStream) {
              responseContainer.innerHTML = this.renderMarkdownWithMedia(cleanStream);
            } else {
              responseContainer.innerHTML = '';
            }

            const codeMatch = streamEntry.responseText.match(/```([a-zA-Z0-9_\-\.]+)?\n([\s\S]*)$/);
            if (codeMatch && codeMatch[2] && codeMatch[2].length > 15) {
              const rawLang = (codeMatch[1] || '').toLowerCase();
              const nonScriptLangs = ['tool_call', 'implementation_plan', 'plan', 'markdown', 'md', 'mermaid', 'text', 'txt', 'json'];
              if (!nonScriptLangs.includes(rawLang)) {
                const lang = rawLang || 'javascript';
                const extMap: Record<string, string> = {
                  html: 'index.html', js: 'script.js', ts: 'app.ts', css: 'style.css', py: 'main.py'
                };
                const defaultName = extMap[lang] || `script.${lang}`;
                if (!streamEntry.liveScriptStarted) {
                  streamEntry.liveScriptStarted = true;
                  this.onLiveScriptStart?.(defaultName, lang, codeMatch[2]);
                } else {
                  this.onLiveScriptChunk?.(codeMatch[2]);
                }
              }
            }
          }
        } else {
          if (cleanStream) {
            responseContainer.innerHTML = this.renderMarkdownWithMedia(cleanStream);
          } else {
            responseContainer.innerHTML = '';
          }
        }
      }

      if (this.currentSessionId === streamSessionId) {
        this.scrollToBottom();
      }
    };

    await sendAgentStream(
      [systemPrompt, ...sessionMessages],
      {
        onThinking: (chunk) => {
          streamEntry.thinkingText += chunk;
          thinkingPill.style.display = 'flex';
          thinkingBody.classList.remove('antigravity-thinking-pill__body--collapsed');
          thinkingPill.classList.add('antigravity-thinking-pill--expanded');
          // Throttle: thinking DOM güncellemesi 40ms'de max 1 kez
          if (!thinkingRenderTimer) {
            thinkingRenderTimer = setTimeout(() => {
              thinkingRenderTimer = null;
              thinkingContent.innerHTML = DOMPurify.sanitize(marked.parse(streamEntry.thinkingText) as string);
              thinkingContent.scrollTop = thinkingContent.scrollHeight;
              if (this.currentSessionId === streamSessionId) {
                this.scrollToBottom();
              }
            }, 40);
          }
        },
        onChunk: (chunk) => {
          this.hideAntigravityWorking(streamSessionId);
          streamEntry.rawResponse += chunk;

          const { thinking, response } = extractThinkingBlock(streamEntry.rawResponse);
          const isStillThinkingTag = streamEntry.rawResponse.includes('<think>') && !streamEntry.rawResponse.includes('</think>');

          if (thinking) {
            streamEntry.thinkingText = thinking;
          }

          if (isStillThinkingTag) {
            // Model hâlâ <think> etiketi içinde düşünüyor; açık ve canlı tut
            thinkingPill.style.display = 'flex';
            thinkingPill.classList.add('antigravity-thinking-pill--running', 'antigravity-thinking-pill--expanded');
            thinkingPill.classList.remove('antigravity-thinking-pill--completed');
            thinkingBody.classList.remove('antigravity-thinking-pill__body--collapsed');
            if (thinking) {
              thinkingContent.innerHTML = DOMPurify.sanitize(marked.parse(thinking) as string);
              thinkingContent.scrollTop = thinkingContent.scrollHeight;
            }
          } else if (streamEntry.thinkingText) {
            // Düşünce süreci tamamlandı ve asıl yanıta geçildi; katla ve sayacı durdur
            if (timerInterval) clearInterval(timerInterval);
            if (thinkingPill.classList.contains('antigravity-thinking-pill--running')) {
              thinkingPill.classList.remove('antigravity-thinking-pill--running', 'antigravity-thinking-pill--expanded');
              thinkingPill.classList.add('antigravity-thinking-pill--completed');
              thinkingBody.classList.add('antigravity-thinking-pill__body--collapsed');
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
              thinkingTimer.textContent = `(${elapsed}s)`;
              thinkingTitle.textContent = 'Düşünce Süreci Tamamlandı';
              const spinnerEl = thinkingPill.querySelector('.antigravity-pill-spinner');
              if (spinnerEl) {
                spinnerEl.outerHTML = iconSparkles(12, 'var(--accent-color, #00f0ff)');
              }
            }
            thinkingPill.style.display = 'flex';
          } else if (response.trim().length > 0) {
            // Model düşünce üretmedi, doğrudan yanıt veriyor
            if (timerInterval) clearInterval(timerInterval);
            thinkingPill.style.display = 'none';
          }
          // Throttle: DOM güncellemesi 30ms'de max 1 kez
          if (!renderTimer) {
            renderTimer = setTimeout(() => doChunkRender(), RENDER_INTERVAL);
          }
        },
        onToolCallDelta: (toolName, accArgs) => {
          const writeTools = ['write_file', 'write_to_file', 'create_file'];
          if (!writeTools.includes(toolName)) return;
          if (this.currentSessionId !== streamSessionId || this.currentMode === 'plan') return;

          let filePath = '';
          let content = '';

          try {
            // Tam JSON parse başarılı mı?
            const parsed = JSON.parse(accArgs);
            filePath = parsed.filePath || parsed.path || parsed.TargetFile || parsed.targetFile || '';
            content = parsed.content || parsed.CodeContent || parsed.code || '';
          } catch {
            // JSON henüz tamamlanmadı — partial extraction
            const fpMatch = accArgs.match(/"(?:filePath|path|TargetFile|targetFile)"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
            if (!fpMatch) return;
            filePath = fpMatch[1].replace(/\\\\/g, '\\').replace(/\\"/g, '"');

            const contentMatch = accArgs.match(/"(?:content|CodeContent|code)"\s*:\s*"([\s\S]*)$/i);
            if (!contentMatch) return;
            content = contentMatch[1]
              .replace(/\\n/g, '\n')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\')
              .replace(/"\s*\}[\s\S]*$/, '');
          }

          if (!filePath || !content) return;

          const parts = filePath.split(/[/\\]/);
          const rawName = parts[parts.length - 1] || filePath;
          const fileName = rawName.replace(/[^a-zA-Z0-9_\-\.]/g, '_') || 'untitled.txt';
          const dotIdx = fileName.lastIndexOf('.');
          const ext = dotIdx > 0 ? fileName.slice(dotIdx + 1).toLowerCase() : 'txt';
          const langMap: Record<string, string> = {
            html: 'html', htm: 'html', js: 'javascript', ts: 'typescript', css: 'css',
            py: 'python', json: 'json', md: 'markdown', cs: 'csharp', cpp: 'cpp'
          };
          const lang = langMap[ext] || 'plaintext';

          if (!streamEntry.liveScriptStarted) {
            streamEntry.liveScriptStarted = true;
            this.onLiveScriptStart?.(fileName, lang, content);
          } else {
            this.onLiveScriptChunk?.(content);
          }
        },
        onDone: async () => {
          // ── Throttle timer'larını temizle ve son halini kesin render et ──
          if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
          if (thinkingRenderTimer) { clearTimeout(thinkingRenderTimer); thinkingRenderTimer = null; }
          if (planRenderTimer) { clearTimeout(planRenderTimer); planRenderTimer = null; }
          doChunkRender(); // Son biriken chunk'ları kesin render et

          clearInterval(timerInterval);
          const finalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);

          if (this.currentSessionId === streamSessionId) {
            this.onLiveScriptFinish?.();
          }

          if (!streamEntry.thinkingText || streamEntry.thinkingText.trim().length === 0) {
            thinkingPill.style.display = 'none';
          } else {
            thinkingPill.style.display = 'flex';
            thinkingPill.classList.remove('antigravity-thinking-pill--running', 'antigravity-thinking-pill--expanded');
            thinkingPill.classList.add('antigravity-thinking-pill--completed');
            thinkingBody.classList.add('antigravity-thinking-pill__body--collapsed');
            thinkingTimer.textContent = `(${finalElapsed}s)`;
            thinkingTitle.textContent = 'Düşünce Süreci Tamamlandı';
            const spinnerEl = thinkingPill.querySelector('.antigravity-pill-spinner');
            if (spinnerEl) {
              spinnerEl.outerHTML = iconSparkles(12, 'var(--accent-color, #00f0ff)');
            }
          }

          let finalText = streamEntry.responseText || streamEntry.rawResponse;

          // 1. Implementation Plan artifact tespiti ve nihai widget tamamlama
          const { preamble, livePlanRaw, isPlan } = this.separateChatAndPlan(finalText);
          if (isPlan && livePlanRaw) {
            if (preamble) {
              responseContainer.innerHTML = this.renderMarkdownWithMedia(preamble);
              this.diffApply.enhanceCodeBlocks(responseContainer);
            } else {
              responseContainer.innerHTML = '';
            }

            // Widget'ı tamamlanmış ve onay bekliyor durumuna geçir
            this.updatePlanArtifactWidget(agentBubble, livePlanRaw, true, systemPrompt, loopDepth);

            const cleanedMd = this.cleanPlanMarkdown(livePlanRaw);
            const titleMatch = cleanedMd.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1].trim() : 'Implementation Plan';

            // Mesaj geçmişine temiz formatta kaydet
            const assistantMsg: ChatMessage = {
              role: 'assistant',
              content: preamble
                ? `${preamble}\n\n<implementation_plan>\n${cleanedMd}\n</implementation_plan>`
                : `<implementation_plan>\n${cleanedMd}\n</implementation_plan>`,
            };
            sessionMessages.push(assistantMsg);
            this.activeStreams.delete(streamSessionId);

            if (this.currentSessionId === streamSessionId) {
              this.messages = sessionMessages;
              if (this.currentMode === 'plan') {
                const planData: ImplementationPlanData = {
                  title,
                  summary: 'Mimari uygulama ve değişiklik planı hazırlandı.',
                  markdown: cleanedMd,
                };
                if (this.onOpenPlanWorkspace) {
                  this.onOpenPlanWorkspace(planData);
                }
              }
              this.finishProcessing('Plan onayı bekleniyor', streamSessionId);
            } else {
              // Zombi Oturum Diriltme Kalkanı: Silinen oturumu tekrar kaydetme!
              if (this.chatHistory.loadSession(streamSessionId)) {
                const sessionTitle = this.chatHistory.generateTitle(sessionMessages);
                this.chatHistory.saveSession(streamSessionId, sessionTitle, sessionMessages, this.selectedModel);
                notificationManager.notifyResponseCompletion(sessionTitle).catch(() => {});
                this.updateHistoryCountBadge();
              }
            }
            return;
          }

          if (streamEntry.liveScriptStarted) {
            this.onLiveScriptFinish?.();
          }

          // Araç çağrısı tespiti (hem ```tool_call hem de ham JSON formatlarını %100 yakala)
          let detectedToolJson: string | null = null;
          const extractedTool = this.extractToolCall(finalText);
          if (extractedTool) {
            detectedToolJson = JSON.stringify(extractedTool.toolJson);
            finalText = finalText.replace(extractedTool.rawMatch, '').trim();
          }

          const hasThinking = streamEntry.thinkingText && streamEntry.thinkingText.trim().length > 0;
          const hasResponse = finalText && finalText.trim().length > 0;
          const hasPlan = agentBubble.querySelector('.plan-artifact-widget') !== null;

          if (detectedToolJson && !hasThinking && !hasResponse && !hasPlan) {
            // Model sadece araç çağrısı üretti ve bu adımda hiçbir metin yok; adım izleyicisi gösterileceği için boş balonu kaldır
            agentBubble.remove();
          } else {
            if (hasResponse) {
              responseContainer.innerHTML = this.renderMarkdownWithMedia(finalText);
              this.diffApply.enhanceCodeBlocks(responseContainer);
            } else if (!hasThinking && !hasPlan && !detectedToolJson) {
              // HATA / BOŞ YANIT KORUMASI: Modelden hiçbir metin veya araç gelmediyse balonu ASLA silme!
              responseContainer.innerHTML = `
                <div class="agent-empty-response-card" style="padding: 10px 14px; background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.3); border-radius: 8px; color: #eab308; font-size: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                  <span>⚠️ Modelden yanıt metni alınamadı (Boş yanıt).</span>
                  <button type="button" class="agent-error-btn agent-error-btn--primary btn-retry-prompt" style="padding: 4px 10px; font-size: 11px;">Tekrar Dene</button>
                </div>
              `;
              const btnRetry = responseContainer.querySelector('.btn-retry-prompt');
              btnRetry?.addEventListener('click', async () => {
                if (this.isProcessing) return;
                agentBubble.remove();
                this.isProcessing = true;
                this.setStatus('Düşünüyor...');
                this.toggleSendStopButtons(true);
                const sp = this.buildSystemPrompt();
                await this.runToolCallingStreamLoop(sp, 0, streamSessionId, sessionMessages);
              });
            } else {
              responseContainer.innerHTML = '';
            }
          }

          const savedThinking = streamEntry.thinkingText && streamEntry.thinkingText.trim()
            ? `<think>\n${streamEntry.thinkingText.trim()}\n</think>\n\n`
            : '';
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: `${savedThinking}${finalText || (detectedToolJson ? 'Araç çalıştırılıyor...' : '')}`.trim(),
          };
          sessionMessages.push(assistantMsg);

          if (this.currentSessionId === streamSessionId) {
            this.messages = sessionMessages;
            // Token kullanımını güncelle
            const currentTokens = Math.round(
              this.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 3.5
            );
            const modelInfo = getModelById(this.selectedModel);
            const limit = modelInfo?.contextLimit || resolveModelContextLimit(this.selectedModel);
            TokenTracker.getInstance().setContextUsage(currentTokens, limit);
          }

          clearInterval(timerInterval);
          if (!streamEntry.thinkingText) {
            thinkingPill.style.display = 'none';
          }

          if (detectedToolJson) {
            await this.handleToolCallExecution(detectedToolJson, systemPrompt, loopDepth, streamSessionId, sessionMessages);
          } else {
            this.activeStreams.delete(streamSessionId);
            const shouldPlayChime = Boolean(hasResponse || hasPlan);
            if (this.currentSessionId === streamSessionId) {
              this.finishProcessing(hasResponse ? 'Hazır' : 'Tamamlandı', streamSessionId, shouldPlayChime);
            } else {
              // Zombi Oturum Diriltme Kalkanı: Silinen oturumu tekrar kaydetme!
              if (this.chatHistory.loadSession(streamSessionId)) {
                const sessionTitle = this.chatHistory.generateTitle(sessionMessages);
                this.chatHistory.saveSession(streamSessionId, sessionTitle, sessionMessages, this.selectedModel);
                if (shouldPlayChime) {
                  notificationManager.notifyResponseCompletion(sessionTitle).catch(() => {});
                }
                this.updateHistoryCountBadge();
              }
            }

            // Antigravity & Cursor Agent Edits Review Card
            if (this.currentTurnChanges.size > 0) {
              const turnFiles = Array.from(this.currentTurnChanges.values());
              const turnData: TurnReviewData = {
                turnId: `turn_${Date.now()}`,
                userPrompt: this.currentTurnPrompt,
                timestamp: new Date(),
                files: turnFiles,
              };
              this.turnReviewHistory.set(turnData.turnId, turnData);
              this.renderTurnChangesCard(turnData, agentBubble);
              this.currentTurnChanges.clear();
            }
          }
        },
        onError: (err) => {
          clearInterval(timerInterval);
          this.activeStreams.delete(streamSessionId);
          thinkingPill.style.display = 'flex';
          thinkingPill.classList.remove('antigravity-thinking-pill--running');
          thinkingPill.classList.add('antigravity-thinking-pill--error');
          thinkingTitle.textContent = 'İşlem Başarısız';
          const spinnerEl = thinkingPill.querySelector('.antigravity-pill-spinner');
          if (spinnerEl) {
            spinnerEl.outerHTML = iconAlertTriangle(12, 'var(--status-red, #ff5555)');
          }
          const isPromoOrAuthError = err.message.toLowerCase().includes('promo') ||
                                     err.message.toLowerCase().includes('token') ||
                                     err.message.toLowerCase().includes('bakiye') ||
                                     err.message.includes('409') || err.message.includes('401');

          responseContainer.innerHTML = `
            <div class="agent-error-card" style="margin-top: 6px; padding: 8px 12px; background: rgba(255, 85, 85, 0.08); border: 1px solid rgba(255, 85, 85, 0.25); border-radius: 6px; color: var(--status-red, #ff5555); font-size: 12px;">
              <strong>Hata:</strong> ${DOMPurify.sanitize(err.message)}
              <div class="agent-error-actions">
                <button type="button" class="agent-error-btn agent-error-btn--primary btn-retry-prompt">Tekrar Dene</button>
                <button type="button" class="agent-error-btn btn-open-model-selector">Modeli Değiştir</button>
                ${isPromoOrAuthError ? '<button type="button" class="agent-error-btn btn-open-account">Hesap & Promo</button>' : ''}
                <button type="button" class="agent-error-btn btn-open-settings">Ayarları Aç</button>
              </div>
            </div>
          `;

          const btnRetry = responseContainer.querySelector('.btn-retry-prompt');
          btnRetry?.addEventListener('click', async () => {
            if (this.isProcessing) return;
            agentBubble.remove();
            this.isProcessing = true;
            this.setStatus('Düşünüyor...');
            this.toggleSendStopButtons(true);
            const systemPrompt = this.buildSystemPrompt();
            await this.runToolCallingStreamLoop(systemPrompt, 0, streamSessionId, sessionMessages);
          });

          const btnModel = responseContainer.querySelector('.btn-open-model-selector');
          btnModel?.addEventListener('click', (e) => {
            e.stopPropagation();
            const modelSelectorBtn = document.getElementById('btnModelSelector') || (document.querySelector('.model-selector-btn') as HTMLElement);
            if (modelSelectorBtn) {
              modelSelectorBtn.click();
            } else {
              window.dispatchEvent(new CustomEvent('kraga:open-model-selector', { detail: { view: 'models' } }));
            }
          });

          const btnAccount = responseContainer.querySelector('.btn-open-account');
          btnAccount?.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('kraga:open-account'));
          });

          const btnSettings = responseContainer.querySelector('.btn-open-settings');
          btnSettings?.addEventListener('click', () => {
            if (isPromoOrAuthError) {
              window.dispatchEvent(new CustomEvent('kraga:open-account'));
            } else {
              window.dispatchEvent(new CustomEvent('kraga:open-settings', { detail: { tab: 'api' } }));
            }
          });

          if (this.currentSessionId === streamSessionId) {
            this.finishProcessing('Hata', streamSessionId, false);
          } else {
            // Zombi Oturum Diriltme Kalkanı: Silinen oturumu tekrar kaydetme!
            if (this.chatHistory.loadSession(streamSessionId)) {
              const sessionTitle = this.chatHistory.generateTitle(sessionMessages);
              this.chatHistory.saveSession(streamSessionId, sessionTitle, sessionMessages, this.selectedModel);
            }
          }
        },
      },
      {
        model: this.selectedModel,
        effort: effectiveEffort,
        thinking: effectiveThinking,
        signal: abortController.signal,
      }
    );
  }

  private async handleToolCallExecution(
    toolJsonStr: string,
    systemPrompt: ChatMessage,
    loopDepth: number,
    targetSessionId?: string,
    targetMessages?: ChatMessage[]
  ): Promise<void> {
    const streamSessionId = targetSessionId || this.currentSessionId;
    const sessionMessages = targetMessages || (this.activeStreams.get(streamSessionId)?.accumulatedMessages) || this.messages;

    let toolCall: { tool?: string; name?: string; arguments?: any; args?: any; server?: string };
    try {
      toolCall = JSON.parse(toolJsonStr);
    } catch (e) {
      console.error('Araç JSON ayrıştırma hatası:', e);
      this.finishProcessing('Hazır', streamSessionId);
      return;
    }

    const toolName = toolCall.tool || toolCall.name || 'unknown_tool';
    const toolArgs = toolCall.arguments || toolCall.args || {};
    const serverName = toolCall.server;

    const parentContainer = (this.currentSessionId === streamSessionId)
      ? this.chatFlow
      : (this.activeStreams.get(streamSessionId)?.agentBubble || this.chatFlow);

    // Antigravity Smart Step Bar (Explored, Ran, Edited, Working)
    const stepTracker = this.renderAntigravityStepBar(streamSessionId, toolName, toolArgs, parentContainer);
    if (this.currentSessionId === streamSessionId) {
      this.scrollToBottom();
    }

    // Antigravity Canlı Durum Çubuğu Bildirimi (Status Bar Live Activity Feed)
    const cleanTool = (toolName || '').toLowerCase().trim();
    let activityText = 'Çalışıyor...';
    if (['read_file', 'view_file', 'grep_search', 'search_codebase', 'find_by_name', 'find_files', 'list_dir', 'search_web', 'web_search', 'web_fetch', 'read_document'].includes(cleanTool)) {
      const rawTarget = toolArgs.filePath || toolArgs.path || toolArgs.AbsolutePath || toolArgs.targetFile || toolArgs.dirPath || toolArgs.query || toolArgs.pattern || toolArgs.url || 'file';
      const parts = String(rawTarget).split(/[/\\]/);
      const shortTarget = parts[parts.length - 1] || rawTarget;
      let lineRange = '';
      if (toolArgs.StartLine !== undefined && toolArgs.EndLine !== undefined) {
        lineRange = `#L${toolArgs.StartLine}-${toolArgs.EndLine}`;
      } else if (toolArgs.startLine !== undefined && toolArgs.endLine !== undefined) {
        lineRange = `#L${toolArgs.startLine}-${toolArgs.endLine}`;
      }
      if (lineRange) {
        activityText = `Analyzed: ${shortTarget} ${lineRange}`;
      } else if (cleanTool === 'read_file' || cleanTool === 'view_file') {
        activityText = `Read: ${shortTarget}`;
      } else {
        activityText = `Analyzed: ${shortTarget}`;
      }
    } else if (['run_command', 'execute_command'].includes(cleanTool)) {
      activityText = `Running: ${this.formatCommandSnippet(toolArgs.command || toolArgs.CommandLine || '')}`;
    } else if (['write_file', 'write_to_file', 'replace_file_content', 'edit_file', 'create_document', 'edit_document'].includes(cleanTool)) {
      const rawPath = String(toolArgs.filePath || toolArgs.path || toolArgs.TargetFile || 'file');
      const parts = rawPath.split(/[/\\]/);
      const fileName = parts[parts.length - 1] || rawPath;
      activityText = cleanTool.includes('write') ? `Writing: ${fileName}` : `Editing: ${fileName}`;
    } else if (['read_spreadsheet', 'create_spreadsheet', 'edit_spreadsheet'].includes(cleanTool)) {
      const rawTarget = toolArgs.filePath || toolArgs.path || 'tablo.xlsx';
      const parts = String(rawTarget).split(/[/\\]/);
      const fileName = parts[parts.length - 1] || rawTarget;
      if (cleanTool === 'read_spreadsheet') activityText = `Reading: ${fileName}`;
      else if (cleanTool === 'create_spreadsheet') activityText = `Creating: ${fileName}`;
      else activityText = `Updating: ${fileName}`;
    } else {
      activityText = `${toolName}...`;
    }

    try {
      window.dispatchEvent(new CustomEvent('kraga:agent-activity', { detail: { text: activityText } }));
    } catch {}

    // Güvenlik & İzin Kontrolü (Yazma veya Terminal komutlarında sor)
    const GATED_FILE_TOOLS = ['write_file', 'edit_file', 'replace_file_content', 'create_document', 'edit_document'];
    if (GATED_FILE_TOOLS.includes(toolName) || toolName === 'run_command') {
      const isFileTool = toolName !== 'run_command';
      const isAllowed = await this.requestPermissionInChat({
        type: isFileTool ? 'file_write' : 'terminal',
        title: isFileTool ? (toolName === 'edit_document' || toolName === 'create_document' ? 'Belge Yazma İzni' : (toolName === 'write_file' ? 'Dosya Yazma İzni' : 'Dosya Düzenleme İzni')) : 'Terminal Komut İzni',
        detail: isFileTool ? (toolArgs.filePath || toolArgs.path) : toolArgs.command,
        targetSessionId: streamSessionId,
      });

      if (!isAllowed) {
        stepTracker.updateResult('Kullanıcı güvenlik gerekçesiyle bu işlemi onaylamadı.', false);
        this.hideAntigravityWorking(streamSessionId);

        sessionMessages.push({
          role: 'user',
          content: `[Araç Reddedildi (${toolName})]: Kullanıcı bu işlemi onaylamadı. Lütfen alternatif bir yol öner.`,
        });
        if (this.currentSessionId === streamSessionId) {
          this.messages = sessionMessages;
        }

        await this.runToolCallingStreamLoop(systemPrompt, loopDepth + 1, streamSessionId, sessionMessages);
        return;
      }
    }

    // Aracı çalıştır
    let resultOutput = '';
    let isSuccess = true;

    try {
      if (toolName === 'read_file' || toolName === 'view_file') {
        const targetPath = this.resolveWorkspacePath(toolArgs.filePath || toolArgs.path || toolArgs.AbsolutePath || toolArgs.targetFile || '.');
        if (/\.(pdf|docx|pptx)$/i.test(targetPath)) {
          throw new Error('Bu bir ofis belgesi; read_document aracını kullan.');
        }
        if (/\.(png|jpe?g|gif|webp|ico|zip|7z|rar|exe|dll|mp3|mp4|mov|xlsx|xls)$/i.test(targetPath)) {
          throw new Error('İkili dosya metin olarak okunamaz (Excel için read_spreadsheet kullan).');
        }
        const rawText = await window.kragaAPI.fs.readFile(targetPath);
        const offset = Math.max(1, Number(toolArgs.offset ?? toolArgs.startLine ?? toolArgs.StartLine ?? 1) || 1);
        const limitArg = Number(toolArgs.limit);
        const endArg = Number(toolArgs.endLine ?? toolArgs.EndLine);
        const allLines = rawText.split('\n');
        const wantsRange = toolArgs.offset !== undefined || toolArgs.limit !== undefined || toolArgs.startLine !== undefined || toolArgs.StartLine !== undefined;
        if (wantsRange || rawText.length > 60000) {
          const end = Number.isFinite(endArg) && endArg >= offset ? endArg : offset - 1 + (Number.isFinite(limitArg) && limitArg > 0 ? limitArg : 400);
          const slice = allLines.slice(offset - 1, end);
          const numbered = slice.map((ln, i) => String(offset + i).padStart(5) + '  ' + ln).join('\n');
          resultOutput = numbered + (end < allLines.length ? `\n\n[... toplam ${allLines.length} satır; devamı için offset:${end + 1} ile tekrar oku]` : '');
        } else {
          resultOutput = rawText;
        }
        if (this.onOpenFile) {
          try { await this.onOpenFile(targetPath); } catch {}
        }
      } else if (toolName === 'write_file' || toolName === 'write_to_file') {
        const relPath = toolArgs.filePath || toolArgs.path || toolArgs.TargetFile || toolArgs.targetFile || 'untitled.txt';
        const fileContent = toolArgs.content || toolArgs.CodeContent || toolArgs.code || '';
        const targetPath = this.resolveWorkspacePath(relPath);

        let originalContent = '';
        try {
          originalContent = await window.kragaAPI.fs.readFile(targetPath);
        } catch {}

        let wroteToDisk = false;
        try {
          await window.kragaAPI.fs.writeFile(targetPath, fileContent);
          wroteToDisk = true;
          this.auxiliaryPane?.trackFileChange(targetPath, 'modified');
          this.auxiliaryPane?.trackArtifact({
            type: 'script',
            title: relPath,
            data: fileContent,
          });

          // Antigravity & Cursor Review Takibi
          const diffStats = computeDiffStats(originalContent, fileContent);
          const fileName = relPath.split(/[/\\]/).pop() || relPath;
          this.currentTurnChanges.set(targetPath, {
            filePath: targetPath,
            fileName,
            originalContent,
            newContent: fileContent,
            additions: diffStats.additions,
            deletions: diffStats.deletions,
          });
        } catch (writeErr) {
          console.warn('Diske yazma hatası, hafıza paneline yönlendiriliyor:', writeErr);
        }

        const ext = relPath.split('.').pop() || 'txt';
        const langMap: Record<string, string> = {
          html: 'html', htm: 'html', js: 'javascript', ts: 'typescript',
          css: 'css', py: 'python', json: 'json', md: 'markdown'
        };
        const lang = langMap[ext.toLowerCase()] || 'plaintext';

        if (this.onOpenFile && wroteToDisk) {
          try { await this.onOpenFile(targetPath); } catch {}
        } else if (this.onOpenSnippet) {
          await this.onOpenSnippet(relPath, fileContent, lang);
        }

        if (this.onRefreshExplorer && wroteToDisk) {
          try { await this.onRefreshExplorer(); } catch {}
        }

        if (wroteToDisk) {
          const fileName = relPath.split(/[/\\]/).pop() || 'dosya';
          const isPreviewable = /\.(html?|svg|md|markdown|pdf|png|jpe?g|gif|webp)$/i.test(fileName);
          const previewBtnHtml = isPreviewable ? `
                <button class="agent-file-btn agent-file-btn--preview" data-action="preview-file" data-path="${encodeURIComponent(targetPath)}" title="Canlı Önizleme Sekmesinde Aç">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                  <span>Canlı Önizle</span>
                </button>
          ` : '';
          const cardHtml = `
            <div class="agent-file-action-card">
              <div class="agent-file-action-header">
                <div class="agent-file-action-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>${fileName}</span>
                </div>
                <span class="agent-file-action-badge">Diske Yazıldı</span>
              </div>
              <div class="agent-file-action-path" data-action="reveal-file" data-path="${encodeURIComponent(targetPath)}" title="Dosya yöneticisinde açmak için tıkla">${targetPath}</div>
              <div class="agent-file-action-buttons">
                <button class="agent-file-btn agent-file-btn--reveal" data-action="reveal-file" data-path="${encodeURIComponent(targetPath)}" title="Windows Dosya Yöneticisinde Göster">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <span>Klasörde Göster</span>
                </button>
                <button class="agent-file-btn agent-file-btn--open" data-action="open-file" data-path="${encodeURIComponent(targetPath)}" title="Kraga IDE Editöründe Aç">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <span>Editörde Aç</span>
                </button>
                ${previewBtnHtml}
                <button class="agent-file-btn agent-file-btn--copy" data-action="copy-path" data-path="${encodeURIComponent(targetPath)}" title="Tam Dosya Yolunu Kopyala">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  <span>Yolu Kopyala</span>
                </button>
              </div>
            </div>
          `;
          const cardWrap = document.createElement('div');
          cardWrap.innerHTML = cardHtml.trim();
          if (cardWrap.firstElementChild) {
            parentContainer.appendChild(cardWrap.firstElementChild);
          }
        }

        resultOutput = wroteToDisk
          ? `Dosya başarıyla diske kaydedildi ve editörde açıldı: ${targetPath} (${fileContent.length} karakter).`
          : `Dosya editörde sekme olarak açıldı: ${relPath}`;
      } else if (toolName === 'replace_file_content' || toolName === 'edit_file') {
        const relPath = toolArgs.filePath || toolArgs.path || toolArgs.TargetFile || toolArgs.targetFile || '';
        const targetContent = toolArgs.oldString ?? toolArgs.old_string ?? toolArgs.targetContent ?? toolArgs.TargetContent ?? '';
        const replacementContent = toolArgs.newString ?? toolArgs.new_string ?? toolArgs.replacementContent ?? toolArgs.ReplacementContent ?? '';
        const targetPath = this.resolveWorkspacePath(relPath);

        let existingContent = '';
        try {
          existingContent = await window.kragaAPI.fs.readFile(targetPath);
        } catch (readErr) {
          throw new Error(`Hedef dosya okunamadı: ${targetPath}`);
        }

        if (!targetContent) throw new Error('oldString boş olamaz.');
        if (!existingContent.includes(targetContent)) {
          throw new Error('Değiştirilecek metin dosyada bulunamadı! Önce read_file ile güncel içeriği gör; boşluk ve girinti birebir aynı olmalı.');
        }
        const occurrences = existingContent.split(targetContent).length - 1;
        const replaceAll = toolArgs.replaceAll === true || toolArgs.replace_all === true;
        if (occurrences > 1 && !replaceAll) {
          throw new Error(`oldString dosyada ${occurrences} kez geçiyor. Benzersiz olması için çevresindeki satırlardan bağlam ekle veya replaceAll:true ver.`);
        }

        const newContent = replaceAll
          ? existingContent.split(targetContent).join(replacementContent)
          : existingContent.replace(targetContent, () => replacementContent);
        await window.kragaAPI.fs.writeFile(targetPath, newContent);
        this.auxiliaryPane?.trackFileChange(targetPath, 'modified');

        // Antigravity & Cursor Review Takibi
        const diffStats = computeDiffStats(existingContent, newContent);
        const fileName = relPath.split(/[/\\]/).pop() || relPath;
        this.currentTurnChanges.set(targetPath, {
          filePath: targetPath,
          fileName,
          originalContent: existingContent,
          newContent,
          additions: diffStats.additions,
          deletions: diffStats.deletions,
        });

        if (this.onOpenFile) {
          try { await this.onOpenFile(targetPath); } catch {}
        }
        if (this.onRefreshExplorer) {
          try { await this.onRefreshExplorer(); } catch {}
        }

        resultOutput = `Dosya başarıyla güncellendi (${replaceAll ? occurrences + ' değişiklik' : '1 değişiklik'}): ${targetPath}`;
      } else if (toolName === 'read_spreadsheet') {
        const relPath = toolArgs.filePath || toolArgs.path || spreadsheetWorkspace.getCurrentFilePath() || 'tablo.xlsx';
        const targetPath = this.resolveWorkspacePath(relPath);
        const readRes = await readSpreadsheetFile(targetPath, toolArgs.sheetName, toolArgs.range, toolArgs.maxRows);
        if (!readRes.success) {
          isSuccess = false;
          resultOutput = `Elektronik tablo okunamadı: ${readRes.error}`;
        } else {
          resultOutput = JSON.stringify(
            {
              filePath: relPath,
              sheetNames: readRes.sheetNames,
              activeSheet: readRes.activeSheet,
              totalRows: readRes.totalRows,
              totalCols: readRes.totalCols,
              headers: readRes.headers,
              markdownPreview: readRes.markdownTable,
            },
            null,
            2
          );
        }
      } else if (toolName === 'create_spreadsheet') {
        const relPath = toolArgs.filePath || toolArgs.path || 'yeni_tablo.xlsx';
        const targetPath = this.resolveWorkspacePath(relPath);
        const createRes = await createSpreadsheetFile(targetPath, toolArgs.sheets);
        if (!createRes.success) {
          isSuccess = false;
          resultOutput = `Elektronik tablo oluşturulamadı: ${createRes.error}`;
        } else {
          resultOutput = JSON.stringify(
            {
              success: true,
              filePath: relPath,
              sheets: createRes.sheets,
              totalRows: createRes.totalRows,
              message: `Elektronik tablo (${relPath}) başarıyla oluşturuldu ve IDE editöründe açıldı.`,
            },
            null,
            2
          );

          if (this.onOpenFile) {
            try {
              await this.onOpenFile(targetPath);
            } catch {}
          }
          if (this.onRefreshExplorer) {
            try {
              await this.onRefreshExplorer();
            } catch {}
          }

          const fileName = relPath.split(/[/\\]/).pop() || relPath;
          const cardHtml = `
            <div class="agent-file-action-card">
              <div class="agent-file-action-header">
                <div class="agent-file-action-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h10M7 16h10"/><path d="M12 3v18"/></svg>
                  <span>${fileName}</span>
                </div>
                <span class="agent-file-action-badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">Excel Tablosu Oluşturuldu</span>
              </div>
              <div class="agent-file-action-path" data-action="reveal-file" data-path="${encodeURIComponent(targetPath)}" title="Dosya yöneticisinde göster">${targetPath}</div>
              <div class="agent-file-action-buttons">
                <button class="agent-file-btn agent-file-btn--open" data-action="open-file" data-path="${encodeURIComponent(targetPath)}" title="Canvas Tablo Editöründe Aç">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <span>Tabloda Aç</span>
                </button>
                <button class="agent-file-btn agent-file-btn--reveal" data-action="reveal-file" data-path="${encodeURIComponent(targetPath)}">
                  <span>Klasörde Göster</span>
                </button>
                <button class="agent-file-btn agent-file-btn--copy" data-action="copy-path" data-path="${encodeURIComponent(targetPath)}">
                  <span>Yolu Kopyala</span>
                </button>
              </div>
            </div>
          `;
          const cardWrap = document.createElement('div');
          cardWrap.innerHTML = cardHtml.trim();
          if (cardWrap.firstElementChild) {
            parentContainer?.appendChild(cardWrap.firstElementChild);
          }
        }
      } else if (toolName === 'edit_spreadsheet') {
        const relPath = toolArgs.filePath || toolArgs.path || spreadsheetWorkspace.getCurrentFilePath() || 'tablo.xlsx';
        const targetPath = this.resolveWorkspacePath(relPath);
        const editRes = await editSpreadsheetFile(targetPath, toolArgs.sheetName, toolArgs.operations);
        if (!editRes.success) {
          isSuccess = false;
          resultOutput = `Elektronik tablo düzenlenemedi: ${editRes.error}`;
        } else {
          resultOutput = JSON.stringify(
            {
              success: true,
              filePath: relPath,
              sheetName: editRes.sheetName,
              operationsApplied: editRes.operationsApplied,
              modifiedCells: editRes.modifiedCells,
              message: `${editRes.operationsApplied} işlem uygulandı ve ${editRes.modifiedCells.length} hücre güncellendi.`,
            },
            null,
            2
          );

          const openPathNorm = (spreadsheetWorkspace.getCurrentFilePath() || '').replace(/\\/g, '/').toLowerCase();
          const targetPathNorm = targetPath.replace(/\\/g, '/').toLowerCase();
          if (openPathNorm === targetPathNorm || !openPathNorm) {
            try {
              await spreadsheetWorkspace.reloadFromDisk(editRes.modifiedCells);
            } catch (reloadErr) {
              console.warn('[AgentPanel] Tablo canlı yenileme hatası:', reloadErr);
            }
          }

          const fileName = relPath.split(/[/\\]/).pop() || relPath;
          const cardHtml = `
            <div class="agent-file-action-card">
              <div class="agent-file-action-header">
                <div class="agent-file-action-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                  <span>${fileName} (${editRes.sheetName})</span>
                </div>
                <span class="agent-file-action-badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399;">${editRes.modifiedCells.length} Hücre Canlı Güncellendi</span>
              </div>
              <div class="agent-file-action-path">${editRes.modifiedCells.slice(0, 10).join(', ')}${editRes.modifiedCells.length > 10 ? '...' : ''} hücreleri güncellendi</div>
              <div class="agent-file-action-buttons">
                <button class="agent-file-btn agent-file-btn--open" data-action="open-file" data-path="${encodeURIComponent(targetPath)}" title="Canvas Tablo Editöründe Aç">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  <span>Tabloyu Göster</span>
                </button>
              </div>
            </div>
          `;
          const cardWrap = document.createElement('div');
          cardWrap.innerHTML = cardHtml.trim();
          if (cardWrap.firstElementChild) {
            parentContainer?.appendChild(cardWrap.firstElementChild);
          }
        }
      } else if (toolName === 'grep_search' || toolName === 'search_codebase') {
        const root = this.currentProjectPath;
        if (!root) throw new Error('Önce bir proje klasörü açılmalı.');
        const pattern = toolArgs.pattern || toolArgs.query || toolArgs.Query || '';
        const res = await window.kragaAPI.workspace.grep(root, pattern, { glob: toolArgs.glob || toolArgs.include, ignoreCase: toolArgs.ignoreCase !== false, literal: toolArgs.literal === true, limit: toolArgs.limit });
        if (!res.success) throw new Error(res.error || 'Arama başarısız');
        resultOutput = res.matches.length
          ? res.matches.map((m: any) => `${m.file}:${m.line}: ${m.text}`).join('\n') + (res.truncated ? '\n[... sonuç sınırına ulaşıldı; deseni daralt]' : '') + `\n(${res.filesScanned} dosya tarandı)`
          : `Eşleşme yok (${res.filesScanned} dosya tarandı).`;
      } else if (toolName === 'find_files' || toolName === 'find_by_name' || toolName === 'glob') {
        const root = this.currentProjectPath;
        if (!root) throw new Error('Önce bir proje klasörü açılmalı.');
        const res = await window.kragaAPI.workspace.glob(root, toolArgs.pattern || toolArgs.Pattern || toolArgs.name || '*');
        if (!res.success) throw new Error(res.error || 'Dosya araması başarısız');
        resultOutput = res.files.length ? res.files.join('\n') + (res.truncated ? '\n[... liste kırpıldı]' : '') : 'Eşleşen dosya yok.';
      } else if (toolName === 'web_search' || toolName === 'search_web') {
        const res = await window.kragaAPI.web.search(toolArgs.query || toolArgs.Query || '', toolArgs.limit);
        if (!res.success) throw new Error(res.error || 'Web araması başarısız');
        resultOutput = res.results.map((r: any, i: number) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join('\n\n');
      } else if (toolName === 'web_fetch') {
        const res = await window.kragaAPI.web.fetch(toolArgs.url || toolArgs.Url || '', toolArgs.maxChars);
        if (!res.success) throw new Error(res.error || 'Sayfa getirilemedi');
        resultOutput = res.text || '(boş sayfa)';
      } else if (toolName === 'read_document') {
        const targetPath = this.resolveWorkspacePath(toolArgs.filePath || toolArgs.path || '');
        const res = await window.kragaAPI.docs.read(targetPath, { maxChars: toolArgs.maxChars, range: toolArgs.range });
        if (!res.success) throw new Error(res.error || 'Belge okunamadı');
        resultOutput = `[${String(res.kind).toUpperCase()}${res.pages ? ` · ${res.pages} sayfa` : ''}${res.slides ? ` · ${res.slides} slayt` : ''}]\n\n${res.text}`;
      } else if (toolName === 'create_document' || toolName === 'edit_document') {
        const relPath = toolArgs.filePath || toolArgs.path || '';
        if (!relPath) throw new Error('filePath gerekli.');
        const targetPath = this.resolveWorkspacePath(relPath);
        const res = toolName === 'create_document'
          ? await window.kragaAPI.docs.create(targetPath, { title: toolArgs.title, markdown: toolArgs.markdown, blocks: toolArgs.blocks, slides: toolArgs.slides, author: toolArgs.author })
          : await window.kragaAPI.docs.edit(targetPath, toolArgs.operations);
        if (!res.success) throw new Error(res.error || 'Belge işlemi başarısız');
        this.auxiliaryPane?.trackFileChange(targetPath, toolName === 'create_document' ? 'added' : 'modified');
        if (this.onRefreshExplorer) { try { await this.onRefreshExplorer(); } catch {} }
        const fileName = relPath.split(/[/\\]/).pop() || relPath;
        const badgeText = toolName === 'create_document' ? 'Belge Oluşturuldu' : `${res.replacements} değişiklik uygulandı`;
        const cardWrap = document.createElement('div');
        cardWrap.innerHTML = `
            <div class="agent-file-action-card">
              <div class="agent-file-action-header">
                <div class="agent-file-action-title"><span>${DOMPurify.sanitize(fileName)}</span></div>
                <span class="agent-file-action-badge">${badgeText}</span>
              </div>
              <div class="agent-file-action-path" data-action="reveal-file" data-path="${encodeURIComponent(targetPath)}" title="Dosya yöneticisinde göster">${DOMPurify.sanitize(targetPath)}</div>
              <div class="agent-file-action-buttons">
                <button class="agent-file-btn agent-file-btn--open" data-action="system-open-file" data-path="${encodeURIComponent(targetPath)}"><span>Dosyayı Aç</span></button>
                <button class="agent-file-btn agent-file-btn--reveal" data-action="reveal-file" data-path="${encodeURIComponent(targetPath)}"><span>Klasörde Göster</span></button>
                <button class="agent-file-btn agent-file-btn--copy" data-action="copy-path" data-path="${encodeURIComponent(targetPath)}"><span>Yolu Kopyala</span></button>
              </div>
            </div>`.trim();
        if (cardWrap.firstElementChild) parentContainer?.appendChild(cardWrap.firstElementChild);
        resultOutput = toolName === 'create_document'
          ? `Belge oluşturuldu: ${targetPath}${res.slides ? ` (${res.slides} slayt)` : ''}`
          : `Belge güncellendi: ${targetPath} (${res.applied} işlem, ${res.replacements} metin değişikliği)`;
      } else if (toolName === 'list_dir') {
        const targetPath = this.resolveWorkspacePath(toolArgs.dirPath || toolArgs.path || toolArgs.SearchDirectory || '.');
        const entries = await window.kragaAPI.fs.readDirectory(targetPath);
        resultOutput = JSON.stringify(
          entries.map((e: any) => ({
            name: e.name,
            isDirectory: e.isDirectory,
            size: e.size,
          })),
          null,
          2
        );
      } else if (toolName === 'run_command') {
        const cmd = toolArgs.command || toolArgs.cmd;
        const res = await window.kragaAPI.terminal.runCommand(cmd, this.currentProjectPath || undefined);
        resultOutput = res.stdout || res.stderr || `(Komut tamamlandi, cikis kodu: ${res.exitCode})`;
        if (resultOutput.length > 20000) {
          resultOutput = resultOutput.slice(0, 8000) + `\n\n[... ${resultOutput.length - 16000} karakter atlandı ...]\n\n` + resultOutput.slice(-8000);
        }
        if (res.exitCode && res.stdout && res.stderr) resultOutput += `\n[stderr]\n${String(res.stderr).slice(-3000)}`;
      } else if (toolName === 'spawn_subagent') {
        // Subagent olustur
        const role = toolArgs.role || 'Planlayici';
        const task = toolArgs.task || '';
        const tools = toolArgs.tools;
        const session = await this.subagentManager.spawnSubagent(role, task, tools);
        // Subagent tamamlanana kadar bekle (maks 120sn)
        resultOutput = await new Promise<string>((resolve) => {
          const checkInterval = setInterval(() => {
            const s = this.subagentManager.getSession(session.id);
            if (s && (s.status === 'done' || s.status === 'error' || s.status === 'cancelled')) {
              clearInterval(checkInterval);
              resolve(`[Subagent ${s.role} - ${s.status}]\n${s.result}`);
            }
          }, 500);
          // Timeout
          setTimeout(() => {
            clearInterval(checkInterval);
            const s = this.subagentManager.getSession(session.id);
            resolve(`[Subagent ${role} - hala calisiyor]\nAra sonuc: ${s?.result || 'Henuz sonuc yok'}`);
          }, 120000);
        });
      } else {
        // MCP Arac Cagrisi
        let actualToolName = toolName;
        let mcpArgs = toolArgs;
        let sName = serverName;
        if (toolName === 'mcp_call') {
          // { server, tool, arguments } zarfını aç: MCP sunucusuna yalnızca iç "arguments" gitmeli
          sName = toolArgs.server || sName;
          actualToolName = toolArgs.tool || '';
          mcpArgs = toolArgs.arguments || toolArgs.args || {};
          if (!actualToolName) throw new Error('mcp_call için "tool" alanı gerekli.');
        }
        if (!sName) {
          try {
            const activeTools = MCPSettingsPanel.getInstance().getAllActiveTools();
            const matched = activeTools.find(
              (t) => t.name === toolName || t.name === actualToolName
            );
            if (matched) {
              sName = matched.serverId || matched.serverName;
            }
          } catch {}
        }
        if (!sName) {
          sName = toolName.includes('_') ? toolName.split('_')[0] : 'default';
        }
        const connected: string[] = await window.kragaAPI.mcp.getConnectedServers().catch(() => []);
        if (!connected.includes(sName)) {
          const hint = connected.length ? `Bağlı sunucular: ${connected.join(', ')}` : 'Hiç MCP sunucusu bağlı değil (Ayarlar > MCP).';
          throw new Error(`MCP sunucusu bağlı değil: "${sName}". ${hint}`);
        }
        const res: any = await window.kragaAPI.mcp.callTool(sName, actualToolName, mcpArgs);
        if (typeof res === 'string') {
          resultOutput = res;
        } else if (res && Array.isArray(res.content)) {
          resultOutput = res.content.map((c: any) => (c.type === 'text' ? c.text : `[${c.type || 'veri'}]`)).join('\n');
          if (res.isError) { isSuccess = false; resultOutput = 'MCP aracı hata döndürdü: ' + resultOutput; }
        } else {
          resultOutput = JSON.stringify(res, null, 2);
        }
      }
    } catch (err: any) {
      isSuccess = false;
      resultOutput = `Araç Çalıştırma Hatası: ${err.message || String(err)}`;
    }

    stepTracker.updateResult(resultOutput, isSuccess);
    if (this.currentSessionId === streamSessionId) {
      this.scrollToBottom();
    }

    // Çıktıyı modele geri besle ve döngüyü sürdür
    const OUTPUT_CAP = 24000;
    const safeOutput = resultOutput.length > OUTPUT_CAP
      ? resultOutput.slice(0, OUTPUT_CAP) + `

[... ${resultOutput.length - OUTPUT_CAP} karakter kesildi; daha dar bir istekle (satır aralığı, sayfa aralığı, arama) tekrar dene]`
      : resultOutput;
    sessionMessages.push({
      role: 'user',
      content: `[Araç Sonucu (${toolName})]:\n\`\`\`\n${safeOutput}\n\`\`\``,
    });

    if (this.currentSessionId === streamSessionId) {
      this.messages = sessionMessages;
      this.setStatus('Sonuç Analiz Ediliyor...');
    }

    // Runaway Agent Kalkanı: Eğer kullanıcı bu esnada işlemi durdurduysa yeni tura geçme!
    const activeStream = this.activeStreams.get(streamSessionId);
    if (activeStream?.abortController?.signal.aborted || (this.currentSessionId === streamSessionId && this.currentAbortController?.signal.aborted)) {
      this.finishProcessing('Durduruldu', streamSessionId, false);
      return;
    }

    await this.runToolCallingStreamLoop(systemPrompt, loopDepth + 1, streamSessionId, sessionMessages);
  }

  private cleanDanglingBackticks(text: string): string {
    if (!text) return '';
    // Dangling backtick onarımı: Bir satırda tek sayıda ` varsa veya metin sonunda açık kalmışsa
    const lines = text.split('\n');
    const cleanedLines = lines.map((line) => {
      if (line.includes('```')) return line;
      const count = (line.match(/`/g) || []).length;
      if (count % 2 !== 0) {
        return line + '`';
      }
      return line;
    });
    return cleanedLines.join('\n');
  }

  private escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private renderTurnChangesCard(turnData: TurnReviewData, parentBubble: HTMLElement): void {
    const totalAdditions = turnData.files.reduce((acc, f) => acc + f.additions, 0);
    const totalDeletions = turnData.files.reduce((acc, f) => acc + f.deletions, 0);
    const fileCount = turnData.files.length;

    const cardEl = document.createElement('div');
    cardEl.className = 'turn-changes-card';
    cardEl.innerHTML = `
      <div class="turn-changes-header">
        <div class="turn-changes-left">
          <button class="turn-changes-toggle-btn" title="Dosya Listesini Göster / Gizle">
            <svg class="turn-changes-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <span class="turn-changes-count">${fileCount} ${fileCount === 1 ? 'file' : 'files'} changed</span>
          <span class="turn-changes-stat turn-changes-stat--add">+${totalAdditions}</span>
          <span class="turn-changes-stat turn-changes-stat--del">-${totalDeletions}</span>
        </div>
        <div class="turn-changes-right">
          <button class="turn-changes-review-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="4"/>
              <line x1="1.05" y1="12" x2="7" y2="12"/>
              <line x1="17.05" y1="12" x2="23" y2="12"/>
            </svg>
            <span>Review</span>
          </button>
        </div>
      </div>
      <div class="turn-changes-body">
        <div class="turn-changes-file-list">
          ${turnData.files.map(f => {
            const ext = f.fileName.split('.').pop() || '';
            const iconSvg = getFileIconByExtension(ext, 13);
            const shortPath = f.filePath.replace(/\\/g, '/');
            return `
              <div class="turn-changes-file-row" data-path="${encodeURIComponent(f.filePath)}">
                <span class="turn-changes-file-icon">${iconSvg}</span>
                <span class="turn-changes-file-name">${this.escapeHtml(f.fileName)}</span>
                <span class="turn-changes-file-path">${this.escapeHtml(shortPath)}</span>
                <div class="turn-changes-file-stats">
                  <span class="turn-changes-stat turn-changes-stat--add">+${f.additions}</span>
                  <span class="turn-changes-stat turn-changes-stat--del">-${f.deletions}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    const toggleBtn = cardEl.querySelector('.turn-changes-toggle-btn') as HTMLElement;
    const bodyEl = cardEl.querySelector('.turn-changes-body') as HTMLElement;
    const chevronEl = cardEl.querySelector('.turn-changes-chevron') as HTMLElement;
    const reviewBtn = cardEl.querySelector('.turn-changes-review-btn') as HTMLElement;

    toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = bodyEl.style.display === 'none';
      bodyEl.style.display = isHidden ? 'block' : 'none';
      chevronEl.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
    });

    reviewBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onOpenReview?.(turnData);
    });

    cardEl.querySelectorAll('.turn-changes-file-row').forEach(row => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onOpenReview?.(turnData);
      });
    });

    parentBubble.appendChild(cardEl);
    this.scrollToBottom();
  }

  private sanitizeStreamingText(text: string): string {
    // 1. Plan tespiti: Plan bloğu başladığı andan itibaren chat metninden kesilir (özel canlı widget'a akar)
    const { preamble, isPlan } = this.separateChatAndPlan(text);
    let target = isPlan ? preamble : text;

    // 2. Streaming esnasında kullanıcıya ham JSON veya tool_call sızmasını önle
    const toolCallIdx = target.search(/```(?:tool_call|json)?\s*\{\s*"(?:tool|name)"/i);
    if (toolCallIdx !== -1) {
      target = target.slice(0, toolCallIdx).trim();
    } else {
      const rawToolIdx = target.search(/\{\s*"(?:tool|name)"\s*:\s*"/i);
      if (rawToolIdx !== -1) {
        target = target.slice(0, rawToolIdx).trim();
      }
    }

    // 3. Kapanmamış ters tırnakları (dangling backticks) onar
    return this.cleanDanglingBackticks(target);
  }

  public separateChatAndPlan(text: string): { preamble: string; livePlanRaw: string; isPlan: boolean } {
    if (!text || text.trim().length === 0) {
      return { preamble: '', livePlanRaw: '', isPlan: false };
    }

    // 1. XML etiketi: <implementation_plan> veya <plan>
    const planMatch = text.match(/<(?:implementation_plan|plan)>([\s\S]*?)(?:<\/(?:implementation_plan|plan)>|$)/i);
    if (planMatch && planMatch.index !== undefined) {
      const preamble = text.slice(0, planMatch.index).trim();
      const livePlanRaw = planMatch[1].trim();
      return { preamble, livePlanRaw, isPlan: true };
    }

    // 2. Kod bloğu etiketi: ```implementation_plan veya ```plan
    const fenceMatch = text.match(/`{3,}(?:implementation_plan|plan)\s*\n([\s\S]*?)(?:(?:\n`{3,})|$)/i);
    if (fenceMatch && fenceMatch.index !== undefined) {
      const preamble = text.slice(0, fenceMatch.index).trim();
      const livePlanRaw = fenceMatch[1].trim();
      return { preamble, livePlanRaw, isPlan: true };
    }

    // 3. Plan / Yol Haritası / Aşama Yapısal Tespiti
    const isExplicitPlanMode = this.currentMode === 'plan';

    // Plan belirteçleri:
    // SADECE kullanıcı açıkça Plan modundaysa (isExplicitPlanMode) geniş yapısal eşleşmeleri kullan!
    // Eğer kullanıcı 'Act' (Doğrudan Kodlama) modundaysa, modelin "Adım 1: HTML oluşturuyoruz" veya
    // "Hedef: ..." gibi normal anlatımları KESİNLİKLE plan onay widget'ına dönüştürülmemelidir.
    // Act modunda yalnızca net <implementation_plan> etiketi veya açık '# Implementation Plan' başlığı plan sayılır.
    const hasPlanSignature = isExplicitPlanMode
      ? (
          /(?:^|\n)\s*(?:#{1,4}\s+)?(?:\*{1,2})?(?:Aşama|Faz|Adım|Phase|Step)\s+\d+/i.test(text) ||
          /(?:^|\n)\s*(?:#{1,4}\s+)?(?:\*{1,2})?(?:Implementation\s+Plan|Uygulama\s+Planı|Mimari\s+Plan|Geliştirme\s+Planı|Yol\s+Haritası|Roadmap|Eylem\s+Planı|Proje\s+Planı)/i.test(text) ||
          /(?:Dosya\s+Sorumlulukları|Etkilenen\s+Dosyalar|Değiştirilecek\s+Dosyalar|Dosya\s+Yapısı)/i.test(text) ||
          /(?:Uygulama\s+Sırası|İşlem\s+Adımları|Yapılacaklar\s+Listesi)/i.test(text) ||
          (/(?:Amaç|Hedef)/i.test(text) && /(?:İçerik|Kapsam|Başarı\s+Kriteri)/i.test(text)) ||
          /(?:flowchart\s+TD|graph\s+TD)/i.test(text)
        )
      : /(?:^|\n)\s*#{1,2}\s+(?:Implementation\s+Plan|Uygulama\s+Planı|Mimari\s+Plan)\b/i.test(text);

    if (hasPlanSignature) {
      // Planın başladığı yapısal ayracı tespit et
      const planStartRegex = /(?:^|\n)(?:(?:#{1,4}\s+)?(?:\*{1,2})?(?:Aşama|Faz|Adım|Phase|Step)\s+\d+|(?:#{1,4}\s+)?(?:\*{1,2})?(?:Implementation\s+Plan|Uygulama\s+Planı|Mimari\s+Plan|Geliştirme\s+Planı|Yol\s+Haritası|Roadmap|Eylem\s+Planı|Proje\s+Planı)|#{1,2}\s+[^\n]+|(?:`{3,}(?:[a-zA-Z0-9_-]+)?\s*\n)|(?:Amaç|Hedef|Dosya\s+Sorumlulukları|Uygulama\s+Sırası)(?:\s*:|\n))/i;

      const match = text.match(planStartRegex);
      if (match && match.index !== undefined) {
        let startIdx = match.index;
        if (text[startIdx] === '\n') startIdx += 1;

        const preambleCandidate = text.slice(0, startIdx).trim();
        const planCandidate = text.slice(startIdx).trim();

        if (planCandidate.length > 10 || isExplicitPlanMode) {
          // Preamble sadece kısa bir tek cümlelik selam/giriş olmalı (< 250 karakter)
          // Eğer içinde liste, tablo veya çok satır varsa bu da planın gövdesine aittir.
          if (
            preambleCandidate.length > 250 ||
            preambleCandidate.includes('|') ||
            preambleCandidate.includes('- ') ||
            preambleCandidate.includes('• ') ||
            preambleCandidate.split('\n').length > 3
          ) {
            return {
              preamble: '',
              livePlanRaw: text.trim(),
              isPlan: true,
            };
          }
          return {
            preamble: preambleCandidate,
            livePlanRaw: planCandidate,
            isPlan: true,
          };
        }
      } else if (isExplicitPlanMode) {
        const firstParaMatch = text.match(/^(.+?)(?:\n\n+)([\s\S]*)$/);
        if (
          firstParaMatch &&
          firstParaMatch[1].length < 120 &&
          (firstParaMatch[1].includes(':') || firstParaMatch[1].includes('.')) &&
          !firstParaMatch[1].includes('|') &&
          !firstParaMatch[1].includes('•')
        ) {
          return {
            preamble: firstParaMatch[1].trim(),
            livePlanRaw: firstParaMatch[2].trim(),
            isPlan: true,
          };
        }
        return {
          preamble: '',
          livePlanRaw: text.trim(),
          isPlan: true,
        };
      }
    }

    return { preamble: text, livePlanRaw: '', isPlan: false };
  }

  public cleanPlanMarkdown(raw: string): string {
    let text = (raw || '').trim();

    // 1. XML etiketlerini temizle
    text = text.replace(/^<(?:implementation_plan|plan)>/i, '').replace(/<\/(?:implementation_plan|plan)>$/i, '').trim();

    // 2. Unicode bullet'ları standart markdown bullet listesine çevir (• -> -)
    text = text.replace(/^[ \t]*[•●○][ \t]+/gm, '- ');

    // 3. Dış kod bloğu sarmalayıcısını temizle
    if (/^`{3,}([a-zA-Z0-9_-]+)?\s*\n?/i.test(text)) {
      const startsWithMermaid = /^`{3,}mermaid\s+((?:flowchart|graph|sequenceDiagram)[^\n]*[\s\S]*?)(?=\n\s*(?:---|##|#|\||$))/i.exec(text);
      if (startsWithMermaid) {
        const diagram = startsWithMermaid[1].trim();
        const rest = text.slice(startsWithMermaid[0].length).trim();
        text = `\`\`\`mermaid\n${diagram}\n\`\`\`\n\n${rest}`;
      } else {
        text = text.replace(/^`{3,}([a-zA-Z0-9_-]+)?\s*\n?/i, '');
      }
    }

    // Sondaki tek kalan ``` kaldır
    if (text.endsWith('```') && !text.endsWith('\n```') && text.lastIndexOf('```') === text.length - 3) {
      text = text.slice(0, -3).trim();
    } else if (text.endsWith('\n```')) {
      const openCount = (text.match(/`{3,}/g) || []).length;
      if (openCount % 2 !== 0) {
        text = text.slice(0, text.lastIndexOf('\n```')).trim();
      }
    }

    // 4. Unclosed Mermaid bloğu onarımı
    text = text.replace(
      /(?:`{3,}mermaid\s*\n?|\bmermaid\s+)?((?:flowchart|graph|sequenceDiagram)[^\n]+[\s\S]*?)(?=\n\s*(?:---|##|#|\||$))/gi,
      (match, diagram) => {
        if (match.startsWith('```mermaid') && match.trim().endsWith('```')) {
          return match;
        }
        const cleanDiagram = diagram.replace(/`{3,}/g, '').trim();
        return `\`\`\`mermaid\n${cleanDiagram}\n\`\`\`\n\n`;
      }
    );

    // 5. Başlık standardizasyonu:
    // Eğer ilk satır "# " ile başlamıyorsa ve Aşama/Faz/Adım/Implementation Plan içeriyorsa # ekle
    if (!text.startsWith('#')) {
      text = text.replace(/^((?:(?:\*{1,2})?(?:Aşama|Faz|Adım|Phase|Step)\s+\d+[^\n]*|Implementation\s+Plan|Uygulama\s+Planı|Mimari\s+Plan)[^\n]*)/i, '# $1');
    }

    // 6. Standart alt bölüm başlıklarını H3 yap: Amaç, İçerik, Başarı Kriteri, Dosya Sorumlulukları, Uygulama Sırası
    text = text.replace(
      /^(?:(?:\*{1,2})?(Amaç|Hedef|İçerik|Kapsam|Başarı\s+Kriteri|Dosya\s+Sorumlulukları|Etkilenen\s+Dosyalar|Uygulama\s+Sırası|İşlem\s+Adımları|Yapılacaklar)(?:\*{1,2})?)(?:\s*:)?$/gim,
      '### $1'
    );

    // 7. [NEW], [MODIFY], [DELETE] dosya rozetlerini ve GitHub alertlerini zenginleştir
    text = this.formatFileBadges(text);

    return text.trim();
  }

  public extractPlanData(text: string): ImplementationPlanData | null {
    const { livePlanRaw, isPlan } = this.separateChatAndPlan(text);
    if (!isPlan || !livePlanRaw || livePlanRaw.trim().length === 0) return null;

    const cleanedMd = this.cleanPlanMarkdown(livePlanRaw);
    const titleMatch = cleanedMd.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Implementation Plan';
    const summaryMatch = cleanedMd.match(/^(?:#\s+.+\n+)?([^#\n>].+)/m);
    const summary = summaryMatch ? summaryMatch[1].trim().slice(0, 160) : 'Mimari uygulama ve değişiklik planı hazırlandı.';

    return {
      title,
      summary,
      markdown: cleanedMd,
    };
  }

  public removePlanFromText(text: string): string {
    const { preamble, isPlan } = this.separateChatAndPlan(text);
    if (isPlan) {
      return preamble.trim();
    }
    return text.trim();
  }

  private extractToolCall(text: string): { toolJson: any; rawMatch: string } | null {
    // 1. Markdown kod bloklari icinde ara: ```tool_call ... ``` veya ```json ... ```
    const codeBlockMatch = text.match(/```(?:tool_call|json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (parsed.tool || parsed.name) {
          return { toolJson: parsed, rawMatch: codeBlockMatch[0] };
        }
      } catch {}
    }

    // 2. Ham JSON tespiti ({ "tool": ... } veya { "name": ... })
    const rawIdx = text.search(/\{\s*"(?:tool|name)"\s*:/i);
    if (rawIdx !== -1) {
      let depth = 0;
      let end = -1;
      let inString = false;
      let escape = false;

      for (let i = rawIdx; i < text.length; i++) {
        const c = text[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (c === '\\') {
          escape = true;
          continue;
        }
        if (c === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (c === '{') depth++;
          else if (c === '}') {
            depth--;
            if (depth === 0) {
              end = i + 1;
              break;
            }
          }
        }
      }

      if (end !== -1) {
        const candidate = text.slice(rawIdx, end);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed.tool || parsed.name) {
            return { toolJson: parsed, rawMatch: candidate };
          }
        } catch {}
      }
    }

    return null;
  }

  public resolveWorkspacePath(relPath: string): string {
    const isWin = (this.systemPaths?.platform || 'win32') === 'win32';
    const sep = isWin ? '\\' : '/';
    const desktop = this.systemPaths?.desktop || '';
    const home = this.systemPaths?.home || '';

    // 1. Boş veya kök yol
    if (!relPath || relPath.trim() === '' || relPath.trim() === '.') {
      return this.currentProjectPath || desktop || home || '.';
    }

    let cleanRel = relPath.trim();

    // 2. Linux VPS halüsinasyonu koruması (/root/.../Desktop/dosya veya /root/.../dosya)
    if (cleanRel.includes('/root/') || cleanRel.includes('/home/') || cleanRel.includes('KragaBridge')) {
      const desktopMatch = cleanRel.match(/(?:Desktop|desktop)[/\\](.+)$/);
      if (desktopMatch && desktop) {
        return `${desktop}${sep}${desktopMatch[1].replace(/[/\\]+/g, sep)}`;
      }
      const fileName = cleanRel.split(/[/\\]/).pop();
      if (fileName) {
        const fallbackBase = this.currentProjectPath || desktop || home || '.';
        return `${fallbackBase}${sep}${fileName}`;
      }
    }

    // 3. Masaüstü kısayolları (~/Desktop, ~/desktop, Desktop/, desktop\)
    if (desktop) {
      if (/^~[/\\](?:desktop|Desktop)(?:[/\\](.*))?$/i.test(cleanRel)) {
        const sub = cleanRel.replace(/^~[/\\](?:desktop|Desktop)[/\\]?/i, '');
        return sub ? `${desktop}${sep}${sub.replace(/[/\\]+/g, sep)}` : desktop;
      }
      if (/^(?:desktop)[/\\](.*)$/i.test(cleanRel)) {
        const sub = cleanRel.replace(/^(?:desktop)[/\\]/i, '');
        return `${desktop}${sep}${sub.replace(/[/\\]+/g, sep)}`;
      }
    }

    // 4. Kullanıcı ana dizini kısayolları (~/ veya ~\)
    if (home && /^~[/\\](.*)$/.test(cleanRel)) {
      const sub = cleanRel.replace(/^~[/\\]/, '');
      return `${home}${sep}${sub.replace(/[/\\]+/g, sep)}`;
    }

    // 5. Zaten tam/mutlak yol ise (Windows C:\... veya Unix /...)
    if (cleanRel.includes(':') || cleanRel.startsWith('/') || cleanRel.startsWith('\\')) {
      return isWin ? cleanRel.replace(/\//g, '\\') : cleanRel.replace(/\\/g, '/');
    }

    // 6. Proje yolu veya varsayılan çalışma dizini
    let base = this.currentProjectPath;
    if (!base) {
      try {
        const saved = localStorage.getItem('kraga-ide-settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.defaultWorkspacePath && typeof parsed.defaultWorkspacePath === 'string' && parsed.defaultWorkspacePath.trim()) {
            base = parsed.defaultWorkspacePath.trim();
          }
        }
      } catch {}
    }

    // Açık proje yoksa ve kullanıcı bir dosya oluşturmak istiyorsa (örn: naber.txt), masaüstünü varsayılan yap
    if (!base || base === '.') {
      base = desktop || home || '.';
    }

    const separator = base.includes('\\') || isWin ? '\\' : '/';
    const subPath = cleanRel.replace(/^[\\\/]+/, '').replace(/[/\\]+/g, separator);
    return `${base}${separator}${subPath}`;
  }

  private finishProcessing(status: string, sessionId?: string, playChime: boolean = true): void {
    const targetId = sessionId || this.currentSessionId;
    const activeGroup = this.activeStepGroups.get(targetId);
    if (activeGroup) {
      activeGroup.titleEl.textContent = this.formatGroupTitle(activeGroup.fileCount, activeGroup.cmdCount, false);
      this.activeStepGroups.delete(targetId);
    }
    this.hideAntigravityWorking(targetId);

    try {
      window.dispatchEvent(new CustomEvent('kraga:agent-activity', { detail: { text: 'Hazır' } }));
    } catch {}

    if (this.currentSessionId === targetId) {
      this.isProcessing = false;
      this.currentAbortController = null;
      this.setStatus(status);
      this.toggleSendStopButtons(false);
    }
    
    // Oturumu kaydet
    const targetMsgs = (this.currentSessionId === targetId)
      ? this.messages
      : (this.activeStreams.get(targetId)?.accumulatedMessages || this.chatHistory.getSessionMessages(targetId));

    if (targetId && targetMsgs.length > 0) {
      // Zombi Diriltme Kalkanı: Eğer oturum kullanıcı tarafından silinmişse tekrar kaydetme
      const isCurrent = this.currentSessionId === targetId;
      if (isCurrent || this.chatHistory.loadSession(targetId)) {
        const title = this.chatHistory.generateTitle(targetMsgs);
        this.chatHistory.saveSession(targetId, title, targetMsgs, this.selectedModel);
        // Yanıt tamamlanma bildirimi (Image 3 Referansı: Response completions & Chime)
        // Sadece başarılı ve gerçek bir yanıt üretildiğinde ses çal
        if (playChime && status !== 'Hata' && status !== 'İşlem Başarısız' && status !== 'Durduruldu') {
          notificationManager.notifyResponseCompletion(title).catch(() => {});
        }
      }
    }
    this.updateHistoryCountBadge();
  }

  // ─── İzin Yönetimi (Security & Permission Prompt) ───────────────────────────
  private async requestPermissionInChat(req: PermissionRequest): Promise<boolean> {
    const check = permissionManager.check(req);
    if (check.isBlocked) {
      const bubble = this.createMessageBubble('tool');
      bubble.innerHTML = `
        <div class="permission-blocked-card">
          <div class="permission-blocked-title">
            ${iconAlertTriangle(16, '#ff5555')} Güvenlik Kalkanı: İşlem Engellendi
          </div>
          <div class="permission-blocked-desc">${check.reason || 'Yıkıcı potansiyele sahip komut güvenlik politikası gereği durduruldu.'}</div>
          <pre style="margin: 4px 0 0 0; padding: 6px 10px; background: rgba(0,0,0,0.3); border-radius: 4px;"><code>${DOMPurify.sanitize(req.detail)}</code></pre>
        </div>
      `;
      this.scrollToBottom();
      return false;
    }

    if (check.granted && !check.requiresPrompt) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      // Arka plan guvenlik kalkani: Baska oturumdaysa yabanci oturum on plana kart basamaz
      if (req.targetSessionId && req.targetSessionId !== this.currentSessionId) {
        resolve(false);
        return;
      }

      const card = document.createElement('div');
      card.className = 'chat-bubble tool action-permission-card';
      card.innerHTML = `
        <div class="action-permission-header">
          <div class="action-permission-badge">${iconShield(14, '#00f0ff')} İzin Talebi: ${req.title}</div>
          <span class="action-permission-sub">Ajan bu işlemi yürütmek için açık onayınızı bekliyor</span>
        </div>
        <div class="action-permission-body">
          <pre><code>${DOMPurify.sanitize(req.detail)}</code></pre>
        </div>
        <div class="action-permission-actions">
          <button type="button" class="perm-btn perm-btn--allow">İzin Ver</button>
          <button type="button" class="perm-btn perm-btn--always">Bu Oturumda Hep İzin Ver</button>
          <button type="button" class="perm-btn perm-btn--deny">Reddet</button>
        </div>
      `;

      this.chatFlow.appendChild(card);
      this.scrollToBottom();

      const btnAllow = card.querySelector('.perm-btn--allow') as HTMLButtonElement;
      const btnAlways = card.querySelector('.perm-btn--always') as HTMLButtonElement;
      const btnDeny = card.querySelector('.perm-btn--deny') as HTMLButtonElement;

      let isResolved = false;
      const finishPrompt = (statusText: string, isAllowed: boolean) => {
        if (isResolved) return;
        isResolved = true;
        this.pendingPermissionResolvers.delete(cancelHandler);

        if (btnAllow) btnAllow.disabled = true;
        if (btnAlways) btnAlways.disabled = true;
        if (btnDeny) btnDeny.disabled = true;

        const actionsContainer = card.querySelector('.action-permission-actions');
        if (actionsContainer) {
          actionsContainer.innerHTML = `
            <span class="action-permission-resolved ${isAllowed ? 'resolved--allowed' : 'resolved--denied'}">
              ${isAllowed ? '✓ Onaylandı' : '✕ Reddedildi'}: ${statusText}
            </span>
          `;
        }
        resolve(isAllowed);
      };

      // Oturum degistiginde veya yeni sohbet acildiginda acil sonlandirici
      const cancelHandler = () => finishPrompt('Oturum değişti veya işlem iptal edildi', false);
      this.pendingPermissionResolvers.add(cancelHandler);

      if (this.currentAbortController) {
        this.currentAbortController.signal.addEventListener('abort', () => {
          finishPrompt('İşlem kullanıcı tarafından durduruldu', false);
        }, { once: true });
      }

      btnAllow?.addEventListener('click', () => {
        finishPrompt('Tek seferlik onay verildi', true);
      });

      btnAlways?.addEventListener('click', () => {
        permissionManager.grantSessionBypass(req.type);
        finishPrompt('Bu oturum için muafiyet tanımlandı', true);
      });

      btnDeny?.addEventListener('click', () => {
        finishPrompt('Kullanıcı tarafından reddedildi', false);
      });
    });
  }

  // ─── Implementation Plan Artifact Sistemi (Antigravity & Claude Standards) ──

  public updatePlanArtifactWidget(
    agentBubble: HTMLElement,
    planMarkdown: string,
    isDone: boolean,
    _systemPrompt: ChatMessage,
    _loopDepth: number
  ): void {
    let widget = agentBubble.querySelector('.plan-artifact-widget') as HTMLElement;
    if (!widget) {
      widget = document.createElement('div');
      widget.className = 'plan-artifact-widget plan-artifact-widget--streaming';
      const bubbleEl = agentBubble.querySelector('.agent-bubble') || agentBubble.querySelector('.agent-response-content');
      if (bubbleEl) {
        bubbleEl.after(widget);
      } else {
        agentBubble.appendChild(widget);
      }
    }

    const cleanedMd = this.cleanPlanMarkdown(planMarkdown);
    const titleMatch = cleanedMd.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim().replace(/\*{1,2}/g, '') : 'Implementation Plan';

    const lines = cleanedMd.split('\n').filter(l => l.trim().length > 0).length;
    const hasMermaid = cleanedMd.includes('```mermaid') || cleanedMd.includes('flowchart') || cleanedMd.includes('graph');
    const hasChecklist = cleanedMd.includes('- [ ]') || cleanedMd.includes('- [x]');
    const hasFiles = cleanedMd.includes('[NEW]') || cleanedMd.includes('[MODIFY]') || cleanedMd.includes('[DELETE]') || cleanedMd.includes('file-badge');
    const hasTable = cleanedMd.includes('|');

    // Auxiliary Pane için artifact takibi
    if (isDone) {
      this.auxiliaryPane?.trackArtifact({
        type: 'plan',
        title,
        description: 'Mimari uygulama ve değişiklik planı hazırlandı.',
        data: {
          title,
          summary: 'Mimari uygulama ve değişiklik planı hazırlandı.',
          markdown: cleanedMd,
        },
      });
    }

    const statusPillHtml = isDone
      ? `<span class="plan-status-pill plan-status-pill--ready"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Plan Hazır • Onay Bekliyor</span>`
      : `<span class="plan-status-pill plan-status-pill--streaming"><span class="live-dot-pulse"></span> Canlı Planlanıyor...</span>`;

    // 1. Header
    let header = widget.querySelector('.plan-widget-header') as HTMLElement;
    if (!header) {
      header = document.createElement('div');
      header.className = 'plan-widget-header';
      widget.appendChild(header);
    }

    header.innerHTML = `
      <div class="plan-widget-icon-box">
        ${!isDone ? '<span class="plan-pulse-dot"></span>' : ''}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <div class="plan-widget-titles">
        <div class="plan-widget-tag-row">
          <span class="plan-widget-tag">ARTIFACT • IMPLEMENTATION PLAN</span>
          ${statusPillHtml}
        </div>
        <div class="plan-widget-title">${DOMPurify.sanitize(title)}</div>
        <div class="plan-widget-meta-row">
          <span class="plan-meta-item">${lines} satır</span>
          ${hasFiles ? '<span class="plan-meta-item">• Dosya Yapısı</span>' : ''}
          ${hasTable ? '<span class="plan-meta-item">• Veri & Tablolar</span>' : ''}
          ${hasMermaid ? '<span class="plan-meta-item">• Mimari Şema</span>' : ''}
          ${hasChecklist ? '<span class="plan-meta-item">• Kontrol Listesi</span>' : ''}
        </div>
      </div>
      <div class="plan-widget-header-actions">
        ${!widget.classList.contains('plan-artifact-widget--proceeded') ? `
          <button type="button" class="plan-widget-btn plan-widget-btn--quick-approve" style="background: rgba(0, 240, 255, 0.15); border: 1px solid var(--accent-color, #00f0ff); color: var(--accent-color, #00f0ff); font-weight: 600; padding: 3px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11.5px;" title="Planı hemen onayla ve kodlamayı başlat (0s gecikme)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Hemen Onayla</span>
          </button>
        ` : ''}
        <button class="plan-widget-btn plan-widget-btn--toggle" title="Genişlet / Daralt">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <button class="plan-widget-btn plan-widget-btn--workspace" title="Merkezi Planda İncele">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          <span>İncele</span>
        </button>
      </div>
    `;

    // 2. Body (İçinde canlı yazılan alan)
    let body = widget.querySelector('.plan-widget-body') as HTMLElement;
    if (!body) {
      body = document.createElement('div');
      body.className = 'plan-widget-body';
      widget.appendChild(body);
    }

    let markdownContainer = body.querySelector('.plan-widget-markdown') as HTMLElement;
    if (!markdownContainer) {
      markdownContainer = document.createElement('div');
      markdownContainer.className = 'plan-widget-markdown markdown-body';
      body.appendChild(markdownContainer);
    }

    const renderedHtml = DOMPurify.sanitize(marked.parse(cleanedMd) as string);
    const streamingIndicatorHtml = !isDone
      ? `<div class="plan-streaming-indicator"><span class="live-dot-pulse"></span> Plan adımları ve mimari oluşturuluyor...</div>`
      : '';
    markdownContainer.innerHTML = renderedHtml + streamingIndicatorHtml;

    if (!isDone) {
      body.scrollTop = body.scrollHeight;
      this.scrollToBottom();
    }

    // Header Aksiyonları Event Bağlantıları
    const quickApproveBtn = header.querySelector('.plan-widget-btn--quick-approve');
    quickApproveBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      approveHandler();
    });

    const toggleBtn = header.querySelector('.plan-widget-btn--toggle');
    toggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      widget.classList.toggle('plan-artifact-widget--collapsed');
    });

    const openWorkspaceHandler = () => {
      const planData: ImplementationPlanData = {
        title,
        summary: 'Mimari uygulama ve değişiklik planı hazırlandı.',
        markdown: cleanedMd,
      };
      if (this.onOpenPlanWorkspace) {
        this.onOpenPlanWorkspace(planData, () => approveHandler());
      } else {
        this.showPlanDetailPanel(planData, () => approveHandler());
      }
    };

    const wsBtn = header.querySelector('.plan-widget-btn--workspace');
    wsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      openWorkspaceHandler();
    });

    // 3. Footer: Aksiyon Barı
    let footer = widget.querySelector('.plan-widget-footer') as HTMLElement;
    if (!footer) {
      footer = document.createElement('div');
      footer.className = 'plan-widget-footer';
      widget.appendChild(footer);
    }

    const approveHandler = () => {
      // Devam eden stream varsa anında kes ve Act moduna geç
      if (this.currentAbortController) {
        try { this.currentAbortController.abort(); } catch {}
      }
      this.isProcessing = false;

      footer.remove();
      widget.classList.remove('plan-artifact-widget--ready', 'plan-artifact-widget--streaming');
      widget.classList.add('plan-artifact-widget--proceeded');

      const proceededBadge = document.createElement('div');
      proceededBadge.className = 'plan-proceeded-widget';
      proceededBadge.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-green, #50fa7b)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Plan Onaylandı & Uygulanıyor:</span>
        <strong class="plan-proceeded-title">${DOMPurify.sanitize(title)}</strong>
      `;
      widget.after(proceededBadge);

      this.setMode('act');
      this.messages.push({
        role: 'user',
        content: `[Plan Onaylandı]: "${title}" planı kullanıcı tarafından onaylandı. Şimdi bu planı adım adım uygula. Kod dosyalarını oluştur/değiştir ve gerekli terminal komutlarını çalıştır.`,
      });
      this.isProcessing = true;
      this.setStatus('Plan uygulanıyor...');
      this.toggleSendStopButtons(true);
      const actSystemPrompt = this.buildSystemPrompt();
      this.runToolCallingStreamLoop(actSystemPrompt, 0);
    };

    if (isDone) {
      widget.classList.remove('plan-artifact-widget--streaming');
      widget.classList.add('plan-artifact-widget--ready');

      footer.innerHTML = `
        <div class="plan-footer-actions-left">
          <button class="plan-action-btn plan-action-btn--approve">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Onayla ve Uygula (Act Modu)</span>
          </button>
          <button class="plan-action-btn plan-action-btn--workspace">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            <span>Merkezi Planda İncele</span>
          </button>
        </div>
        <div class="plan-footer-actions-right">
          <button class="plan-action-btn plan-action-btn--editor" title="Monaco Editor'de Düzenle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>Monaco'da Aç</span>
          </button>
          <button class="plan-action-btn plan-action-btn--copy" title="Markdown Olarak Kopyala">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            <span>Kopyala</span>
          </button>
          <button class="plan-action-btn plan-action-btn--reject" title="Planı Reddet">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span>Reddet</span>
          </button>
        </div>
      `;

      // Mermaid diagramlarını render et
      this.renderMermaidDiagrams(markdownContainer);
    } else {
      // 0 Saniye Gecikme Kalkanı: Stream henüz bitmemiş olsa dahi kullanıcı planı görür görmez anında onaylayabilsin!
      footer.innerHTML = `
        <div class="plan-footer-actions-left">
          <button class="plan-action-btn plan-action-btn--approve plan-action-btn--live-approve">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Hemen Onayla & Başlat</span>
          </button>
          <button class="plan-action-btn plan-action-btn--workspace" title="Merkezi Planda İncele">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            <span>Planda İncele</span>
          </button>
          <span style="font-size: 11px; color: var(--text-muted); display: inline-flex; align-items: center; gap: 4px;">
            <span class="live-dot-pulse"></span> Canlı plan akıyor...
          </span>
        </div>
      `;
    }

      footer.querySelector('.plan-action-btn--approve')?.addEventListener('click', approveHandler);
      footer.querySelector('.plan-action-btn--workspace')?.addEventListener('click', openWorkspaceHandler);
      footer.querySelector('.plan-action-btn--editor')?.addEventListener('click', async () => {
        if (this.onOpenSnippet) {
          await this.onOpenSnippet('Implementation_Plan.md', cleanedMd, 'markdown');
        }
      });
      footer.querySelector('.plan-action-btn--copy')?.addEventListener('click', async () => {
        await navigator.clipboard.writeText(cleanedMd);
        const btn = footer.querySelector('.plan-action-btn--copy span');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = 'Kopyalandı!';
          setTimeout(() => { btn.textContent = orig; }, 2000);
        }
      });
      footer.querySelector('.plan-action-btn--reject')?.addEventListener('click', () => {
        footer.remove();
        const rejectedWidget = document.createElement('div');
        rejectedWidget.className = 'plan-proceeded-widget plan-proceeded-widget--rejected';
        rejectedWidget.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--status-red, #ff5555)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>Plan Reddedildi:</span>
          <strong class="plan-proceeded-title">${DOMPurify.sanitize(title)}</strong>
        `;
        widget.after(rejectedWidget);
        this.finishProcessing('Hazır');
      });
  }

  private showPlanDetailPanel(
    planData: ImplementationPlanData,
    onApproveCallback?: () => void
  ): void {
    const existing = document.querySelector('.plan-detail-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'plan-detail-overlay';

    // Markdown icerigini hazirla
    let fullMarkdown = planData.markdown || '';
    if (!fullMarkdown) {
      // Markdown alani yoksa alanlardan zengin Markdown sentezle
      let md = `# ${planData.title || 'Implementation Plan'}\n\n${planData.summary || ''}\n\n`;
      if (planData.steps && planData.steps.length > 0) {
        md += `## Uygulama Adımları\n` + planData.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') + '\n\n';
      }
      if (planData.files && planData.files.length > 0) {
        md += `## Etkilenen Dosyalar\n` + planData.files.map(f => `- \`${f}\``).join('\n') + '\n\n';
      }
      if (planData.risks) {
        md += `> [!WARNING]\n> ${planData.risks}\n\n`;
      }
      fullMarkdown = md;
    }

    // Markdown -> HTML cevir
    let renderedHtml = marked.parse(fullMarkdown) as string;
    // GitHub Alerts formatla (> [!NOTE], > [!IMPORTANT] vb.)
    renderedHtml = this.formatGithubAlerts(renderedHtml);
    // Dosya rozetlerini formatla ([NEW], [MODIFY], [DELETE])
    renderedHtml = this.formatFileBadges(renderedHtml);

    overlay.innerHTML = `
      <div class="plan-detail-panel">
        <div class="plan-detail-header">
          <div class="plan-detail-header-left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div>
              <div class="plan-detail-top-tag">IMPLEMENTATION PLAN</div>
              <span class="plan-detail-header-title">${DOMPurify.sanitize(planData.title || 'Implementation Plan')}</span>
            </div>
          </div>
          <div class="plan-detail-header-actions">
            <button class="plan-btn-editor" id="btnPlanOpenInEditor" title="Sol tarafta Monaco Editor sekmesi olarak aç">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
              <span>Editörde Aç</span>
            </button>
            <button class="plan-detail-close" title="Kapat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div class="plan-detail-body markdown-body" id="planDetailBody">
          ${DOMPurify.sanitize(renderedHtml)}
        </div>

        <div class="plan-detail-footer">
          <button class="plan-btn plan-btn--approve" id="btnModalApprove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            Onayla ve Uygula
          </button>
          <button class="plan-btn plan-btn--reject" id="btnModalClose">Kapat</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const bodyEl = overlay.querySelector('#planDetailBody') as HTMLElement;
    this.diffApply.enhanceCodeBlocks(bodyEl);
    this.renderMermaidDiagrams(bodyEl);

    // Editörde Aç butonu
    const btnOpenEditor = overlay.querySelector('#btnPlanOpenInEditor');
    btnOpenEditor?.addEventListener('click', async () => {
      if (this.onOpenSnippet) {
        await this.onOpenSnippet('Implementation_Plan.md', fullMarkdown, 'markdown');
      }
    });

    // Onayla butonu
    const btnApprove = overlay.querySelector('#btnModalApprove');
    btnApprove?.addEventListener('click', () => {
      overlay.remove();
      if (onApproveCallback) {
        onApproveCallback();
      }
    });

    // Kapat butonları
    overlay.querySelector('.plan-detail-close')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btnModalClose')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  private formatGithubAlerts(html: string): string {
    return html.replace(
      /<blockquote>\s*<p>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*?)<\/blockquote>/gi,
      (_, type, content) => {
        const t = type.toUpperCase();
        const labels: Record<string, string> = {
          NOTE: 'NOTE',
          TIP: 'TIP',
          IMPORTANT: 'IMPORTANT',
          WARNING: 'WARNING',
          CAUTION: 'CAUTION',
        };
        return `<div class="gh-alert gh-alert--${t.toLowerCase()}">
          <div class="gh-alert-title">${labels[t] || t}</div>
          <div class="gh-alert-content"><p>${content}</div>
        </div>`;
      }
    );
  }

  private formatFileBadges(html: string): string {
    return html
      .replace(/\[NEW\]/g, '<span class="file-badge file-badge--new">NEW</span>')
      .replace(/\[MODIFY\]/g, '<span class="file-badge file-badge--modify">MODIFY</span>')
      .replace(/\[DELETE\]/g, '<span class="file-badge file-badge--delete">DELETE</span>');
  }

  private async renderMermaidDiagrams(container: HTMLElement): Promise<void> {
    const codeBlocks = container.querySelectorAll('pre code.language-mermaid');
    let idx = 0;
    for (const block of Array.from(codeBlocks)) {
      const code = block.textContent || '';
      const parent = block.parentElement;
      if (!parent) continue;

      const diagramId = `mermaid-diag-${Date.now()}-${idx++}`;
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-render-wrapper';
      wrapper.id = diagramId;

      try {
        const { svg } = await (await loadMermaid()).render(diagramId + '-svg', code);
        wrapper.innerHTML = svg;
        parent.replaceWith(wrapper);
      } catch {
        // Render hatası olursa ham kodu koru
      }
    }
  }

  private async executeTerminalCommand(cmd: string): Promise<void> {
    const isAllowed = await this.requestPermissionInChat({
      type: 'terminal',
      title: 'Terminal Komutu',
      detail: cmd,
    });

    if (!isAllowed) {
      this.addMessage('tool', `İşlem iptal edildi: \`${cmd}\``);
      return;
    }

    this.addMessage('tool', `Terminal komutu çalıştırılıyor: \`${cmd}\``);
    try {
      const result = await window.kragaAPI.terminal.runCommand(cmd, this.currentProjectPath || undefined);
      const out = result.stdout || result.stderr || `(Çıkış kodu: ${result.exitCode})`;
      this.addMessage('tool', '```\n' + out.trim() + '\n```');
    } catch (err: any) {
      this.addMessage('tool', `Komut hatası: ${err.message}`);
    }
  }

  private async executeGraphifyAnalysis(): Promise<void> {
    if (!this.currentProjectPath) {
      this.addMessage('agent', 'Lütfen önce sol panelden bir proje klasörü açın.');
      return;
    }
    this.addMessage('tool', 'Graphify AST analizi başlatıldı...');
    try {
      const report = await window.kragaAPI.graphify.analyze(this.currentProjectPath);
      let summary = `### Graphify Analiz Raporu\n- **Taranan Dosya Sayısı:** ${report.totalFiles}\n- **Toplam Düğüm:** ${report.nodes.length}\n- **Toplam İlişki (Edge):** ${report.edges.length}\n\n#### Merkez Dosyalar (God Nodes):\n`;
      for (const god of report.godNodes) {
        summary += `- \`${god.name}\` (${god.inDegree} referans)\n`;
      }
      this.addMessage('agent', summary);
    } catch (err: any) {
      this.addMessage('tool', `Graphify hatası: ${err.message}`);
    }
  }

  private addMessage(role: 'user' | 'agent' | 'tool', rawMarkdown: string, attachments?: AttachedFileItem[]): void {
    const bubble = this.createMessageBubble(role);

    let html = '';
    if (attachments && attachments.length > 0) {
      html += `
        <div class="user-attached-files-grid">
          ${attachments.map((f) => `
            <div class="user-attached-file-widget">
              <div class="user-attached-file-icon">
                ${f.isImage && f.dataUrl ? `<img src="${f.dataUrl}" class="attached-img-thumb" alt="${DOMPurify.sanitize(f.name)}" />` : getFileIconByExtension(f.name, 16)}
              </div>
              <div class="user-attached-file-info">
                <span class="user-attached-file-name" title="${DOMPurify.sanitize(f.name)}">${DOMPurify.sanitize(f.name)}</span>
                <span class="user-attached-file-meta">${this.formatFileSize(f.size)}${f.lineCount ? ` • ${f.lineCount} satır` : ''}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (rawMarkdown) {
      html += this.renderMarkdownWithMedia(rawMarkdown);
    }

    bubble.innerHTML = html;
    if (role === 'agent') {
      this.diffApply.enhanceCodeBlocks(bubble);
    }
    this.scrollToBottom();
  }

  private createMessageBubble(role: string, targetSessionId?: string): HTMLElement {
    const welcome = document.getElementById('agentWelcomeScreen');
    if (welcome && (!targetSessionId || targetSessionId === this.currentSessionId)) {
      welcome.remove();
    }
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;
    if (!targetSessionId || targetSessionId === this.currentSessionId) {
      this.chatFlow.appendChild(bubble);
    }
    return bubble;
  }

  private setStatus(statusText: string): void {
    this.statusEl.textContent = statusText;
    const activitySpinner = document.getElementById('agentActivityStatus');
    if (activitySpinner) {
      const isWorking = statusText !== 'Hazır' && statusText !== 'Durduruldu' && statusText !== 'Hata' && statusText !== 'İşlem Başarısız';
      activitySpinner.style.display = isWorking ? 'flex' : 'none';
    }
  }

  private updatePromptEstimator(): void {
    const estimatorEl = document.getElementById('agentPromptEstimatorText');
    if (!estimatorEl) return;

    const text = this.promptInput?.value || '';
    let approxTokens = Math.ceil(text.length / 3.5);

    // Ekli dosyaların tahmini token maliyeti
    for (const f of this.attachedFiles) {
      if (f.content) {
        approxTokens += Math.ceil(f.content.length / 3.5);
      } else if (f.isImage) {
        approxTokens += 1000;
      }
    }

    const model = getModelById(this.selectedModel);
    const mult = model ? model.multiplier : 1.0;

    estimatorEl.textContent = `~${approxTokens.toLocaleString()} tk · ${mult}x`;
    const estimatorContainer = document.getElementById('agentPromptEstimator');
    if (estimatorContainer) {
      estimatorContainer.setAttribute(
        'title',
        `Tahmini Girdi: ~${approxTokens.toLocaleString()} token\nModel Çarpanı: ${mult}x (${model ? model.name : this.selectedModel})`
      );
    }
  }

  private updateScrollBottomBtnState(): void {
    if (!this.scrollBottomBtn) return;
    if (this.isProcessing) {
      this.scrollBottomBtn.classList.add('agent-scroll-bottom-btn--streaming');
      this.scrollBottomBtn.innerHTML = `
        <span class="scroll-live-dot"></span>
        <span>Yanıt Akıyor</span>
        ${iconChevronDown(14)}
      `;
      this.scrollBottomBtn.setAttribute('title', 'Aşağı Kaydır (Yanıt Akıyor)');
    } else {
      this.scrollBottomBtn.classList.remove('agent-scroll-bottom-btn--streaming');
      this.scrollBottomBtn.innerHTML = iconChevronDown(18);
      this.scrollBottomBtn.setAttribute('title', 'Aşağı Kaydır');
    }
  }

  private initInputStatusRow(): void {
    const wsTextEl = document.getElementById('agentWorkspaceStatusText');
    const permStatusEl = document.getElementById('agentPermStatus');
    const permTextEl = document.getElementById('agentPermStatusText');
    const quotaEl = document.getElementById('agentQuotaStatus');
    const quotaDot = document.getElementById('agentQuotaDot');
    const quotaText = document.getElementById('agentQuotaStatusText');

    if (wsTextEl) {
      const folderName = this.currentProjectPath
        ? (this.currentProjectPath.split(/[\\/]/).filter(Boolean).pop() || 'Local')
        : 'Local';
      wsTextEl.textContent = folderName;
    }

    const updatePermUI = (settings: PermissionSettings) => {
      if (!permTextEl) return;
      if (settings.mode === 'auto') {
        permTextEl.textContent = 'YOLO';
        permStatusEl?.setAttribute('title', 'İzin Modu: YOLO (Tam Otonom, sormadan çalıştırır)');
      } else if (settings.mode === 'ask_all') {
        permTextEl.textContent = 'Katı (Strict)';
        permStatusEl?.setAttribute('title', 'İzin Modu: Katı (Tüm işlemlerde onay sorar)');
      } else {
        permTextEl.textContent = 'Dengeli';
        permStatusEl?.setAttribute('title', 'İzin Modu: Dengeli (Terminal ve riskli komutlarda onay sorar)');
      }
    };

    updatePermUI(permissionManager.getSettings());
    permissionManager.onChange(updatePermUI);

    permStatusEl?.addEventListener('click', () => {
      const curMode = permissionManager.getSettings().mode;
      const nextMode: PermissionMode = curMode === 'ask_critical' ? 'auto' : curMode === 'auto' ? 'ask_all' : 'ask_critical';
      permissionManager.setMode(nextMode);
    });

    const updateQuotaUI = () => {
      if (!quotaText || !quotaDot) return;
      const tokenTracker = TokenTracker.getInstance();
      const state = tokenTracker.getState();
      const remPct = tokenTracker.getRemainingPercentage();

      if (!state.isPromoMode && state.tokenLimit === 0 && state.costLimit === 0) {
        quotaText.textContent = 'API Modu';
        quotaDot.className = 'agent-quota-dot';
        quotaEl?.setAttribute('title', 'Özel API Anahtarı Modu');
        return;
      }

      if (tokenTracker.isDepleted() || remPct <= 0) {
        quotaText.textContent = '%0 Bitti';
        quotaDot.className = 'agent-quota-dot agent-quota-dot--depleted';
        quotaEl?.setAttribute('title', 'Kullanım hakkınız tükendi (%0)! Paket yenilemek veya incelemek için tıklayın.');
      } else if (tokenTracker.isCriticalLowBalance() || remPct <= 10) {
        quotaText.textContent = `%${remPct.toFixed(0)} Kalan`;
        quotaDot.className = 'agent-quota-dot agent-quota-dot--critical';
        quotaEl?.setAttribute('title', `%10'dan az kullanım hakkınız kaldı (%${remPct.toFixed(0)})! Tıklayıp detayları görün.`);
      } else if (remPct <= 25) {
        quotaText.textContent = `%${remPct.toFixed(0)} Kalan`;
        quotaDot.className = 'agent-quota-dot agent-quota-dot--warning';
        quotaEl?.setAttribute('title', `Kalan Kullanım Hakkı: %${remPct.toFixed(0)}`);
      } else {
        quotaText.textContent = `%${remPct.toFixed(0)} Bakiye`;
        quotaDot.className = 'agent-quota-dot';
        quotaEl?.setAttribute('title', `Kalan Kullanım Hakkı: %${remPct.toFixed(0)} (Tıklayıp Hesap Merkezini Aç)`);
      }
    };

    updateQuotaUI();
    TokenTracker.getInstance().on('update', updateQuotaUI);

    quotaEl?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('kraga:open-account'));
    });

    this.updatePromptEstimator();
  }

  private initQuickPillsAndPopovers(): void {
    // 1. İzin Hızlı Hapı & Popover'ı
    const btnPermQuick = document.getElementById('btnPermQuickPill');
    const permPopover = document.getElementById('permQuickPopover');
    const permIcon = document.getElementById('permPillIcon');
    const permText = document.getElementById('permPillText');

    const closeAllQuickPopovers = (except?: HTMLElement | null) => {
      if (permPopover && permPopover !== except) permPopover.classList.add('agent-quick-popover--hidden');
      const prjPop = document.getElementById('projectPickerPopover');
      if (prjPop && prjPop !== except) prjPop.classList.add('agent-quick-popover--hidden');
      const toolPop = document.getElementById('toolsPickerPopover');
      if (toolPop && toolPop !== except) toolPop.classList.add('agent-quick-popover--hidden');
    };

    const updatePermUI = (settings: PermissionSettings) => {
      if (settings.mode === 'auto') {
        if (permIcon) permIcon.textContent = '⚡';
        if (permText) permText.textContent = 'Tam Otonom';
      } else if (settings.mode === 'ask_all') {
        if (permIcon) permIcon.textContent = '✋';
        if (permText) permText.textContent = 'Onay iste';
      } else {
        if (permIcon) permIcon.textContent = '>_';
        if (permText) permText.textContent = 'Benim için onayla';
      }
      permPopover?.querySelectorAll('.perm-option-item').forEach((item) => {
        const mode = (item as HTMLElement).dataset.mode;
        if (mode === settings.mode) {
          item.classList.add('perm-option-item--selected');
        } else {
          item.classList.remove('perm-option-item--selected');
        }
      });
    };

    updatePermUI(permissionManager.getSettings());
    permissionManager.onChange(updatePermUI);

    btnPermQuick?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllQuickPopovers(permPopover);
      permPopover?.classList.toggle('agent-quick-popover--hidden');
    });

    permPopover?.querySelectorAll('.perm-option-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = (item as HTMLElement).dataset.mode as PermissionMode;
        if (mode) {
          permissionManager.setMode(mode);
          permPopover?.classList.add('agent-quick-popover--hidden');
        }
      });
    });

    document.getElementById('permLearnMoreLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      notificationManager.showToast({
        title: 'Güvenlik ve İzin Modları',
        message: 'Onay iste: Her işlemde sorar. Benim için onayla: Yalnızca terminal ve riskli komutlarda sorar. Tam Otonom: Bekletmeden çalıştırır.',
        type: 'info',
        durationMs: 6000
      });
      permPopover?.classList.add('agent-quick-popover--hidden');
    });

    // 2. Proje Seç Hapı & Popover'ı
    const btnProjectPicker = document.getElementById('btnProjectPickerPill');
    const projectPopover = document.getElementById('projectPickerPopover');
    const projectSearch = document.getElementById('projectSearchInput') as HTMLInputElement;
    const projectList = document.getElementById('recentProjectsList');
    const projectLabel = document.getElementById('projectPickerLabel');
    const btnNewProject = document.getElementById('btnNewProjectAction');

    const updateProjectPickerLabel = () => {
      if (projectLabel) {
        if (this.currentProjectPath) {
          const folderName = this.currentProjectPath.split(/[\\/]/).filter(Boolean).pop() || 'Proje';
          projectLabel.textContent = folderName;
        } else {
          projectLabel.textContent = 'Proje seç';
        }
      }
    };
    updateProjectPickerLabel();

    const renderRecentProjectsList = (filterText = '') => {
      if (!projectList) return;
      try {
        const raw = localStorage.getItem('kraga-recent-projects');
        let projects: string[] = raw ? JSON.parse(raw) : [];
        if (filterText) {
          const q = filterText.toLowerCase();
          projects = projects.filter(p => p.toLowerCase().includes(q));
        }

        if (projects.length === 0) {
          projectList.innerHTML = '<div class="shelf-empty-hint">Proje bulunamadı</div>';
          return;
        }

        projectList.innerHTML = projects.map(p => {
          const folderName = p.split(/[\\/]/).filter(Boolean).pop() || p;
          const isCurrent = this.currentProjectPath === p;
          return `
            <div class="shelf-project-item ${isCurrent ? 'shelf-project-item--active' : ''}" data-path="${p}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              <div class="shelf-project-info">
                <span class="shelf-project-name">${folderName}</span>
                <span class="shelf-project-path">${p}</span>
              </div>
            </div>
          `;
        }).join('');

        projectList.querySelectorAll('.shelf-project-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const path = (item as HTMLElement).dataset.path;
            if (path) {
              window.dispatchEvent(new CustomEvent('kraga:open-project', { detail: { path } }));
              projectPopover?.classList.add('agent-quick-popover--hidden');
              this.setProjectPath(path);
              updateProjectPickerLabel();
            }
          });
        });
      } catch {
        projectList.innerHTML = '<div class="shelf-empty-hint">Proje bulunamadı</div>';
      }
    };

    btnProjectPicker?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllQuickPopovers(projectPopover);
      const isHidden = projectPopover?.classList.contains('agent-quick-popover--hidden');
      if (isHidden) {
        renderRecentProjectsList(projectSearch?.value.trim() || '');
        projectPopover?.classList.remove('agent-quick-popover--hidden');
        projectSearch?.focus();
      } else {
        projectPopover?.classList.add('agent-quick-popover--hidden');
      }
    });

    projectSearch?.addEventListener('input', () => {
      renderRecentProjectsList(projectSearch.value.trim());
    });

    btnNewProject?.addEventListener('click', (e) => {
      e.stopPropagation();
      projectPopover?.classList.add('agent-quick-popover--hidden');
      window.dispatchEvent(new CustomEvent('kraga:open-folder-dialog'));
    });

    // 3. Eklentiler / Araçlar Hapı & Popover'ı
    const btnToolsPicker = document.getElementById('btnToolsPickerPill');
    const toolsPopover = document.getElementById('toolsPickerPopover');
    const toolSearch = document.getElementById('toolSearchInput') as HTMLInputElement;
    const toolsContainer = document.getElementById('toolsListContainer');
    const btnConnectMcp = document.getElementById('btnConnectMcpAction');

    const toolsData = [
      { id: 'docs', icon: '', name: 'Documents', desc: 'Kod tabanı ve dokümantasyon inceleme', prompt: 'Projedeki dokümantasyonları ve kod yapısını analiz et:\n' },
      { id: 'pdf', icon: '', name: 'PDF', desc: 'PDF doküman analizi ve metin çıkarma', prompt: 'Şu dokümanı incele ve özetle: ' },
      { id: 'spreadsheets', icon: '', name: 'Spreadsheets', desc: 'Tablo, CSV ve veri analizi', prompt: 'Şu tablo/veri setini analiz et: ' },
      { id: 'presentations', icon: '', name: 'Presentations', desc: 'Diyagram, akış ve sunum şablonları', prompt: '/diagram ' },
      { id: 'templates', icon: '', name: 'Template Creator', desc: 'Bileşen ve mimari şablon üretici', prompt: '/plan Yeni bir bileşen mimarisi tasarla: ' },
      { id: 'browser', icon: '', name: 'Browser', desc: 'Web tarayıcısı ve internet araştırması', prompt: '/web ' },
      { id: 'terminal', icon: '', name: 'Terminal', desc: 'Konsol ve kabuk komutları', prompt: '$ ' },
      { id: 'git', icon: '', name: 'Git', desc: 'Sürüm kontrolü ve commit geçmişi', prompt: '$ git status' },
      { id: 'memory', icon: '', name: 'Hafıza', desc: 'Kraga Vault & İkinci Beyin Notları', prompt: '/memory ' },
    ];

    const renderToolsList = (filterText = '') => {
      if (!toolsContainer) return;
      let list = toolsData;
      if (filterText) {
        const q = filterText.toLowerCase();
        list = list.filter(t => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q));
      }

      toolsContainer.innerHTML = list.map(t => `
        <div class="shelf-tool-item" data-prompt="${t.prompt}" title="${t.desc}">
          <span class="shelf-tool-icon">${t.icon || t.name.charAt(0)}</span>
          <div class="shelf-tool-info">
            <span class="shelf-tool-name">${t.name}</span>
            <span class="shelf-tool-desc">${t.desc}</span>
          </div>
        </div>
      `).join('');

      toolsContainer.querySelectorAll('.shelf-tool-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const promptVal = (item as HTMLElement).dataset.prompt;
          if (promptVal) {
            this.promptInput.value = promptVal;
            this.adjustPromptInputHeight();
            this.promptInput.focus();
          }
          toolsPopover?.classList.add('agent-quick-popover--hidden');
        });
      });
    };

    btnToolsPicker?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllQuickPopovers(toolsPopover);
      const isHidden = toolsPopover?.classList.contains('agent-quick-popover--hidden');
      if (isHidden) {
        renderToolsList(toolSearch?.value.trim() || '');
        toolsPopover?.classList.remove('agent-quick-popover--hidden');
        toolSearch?.focus();
      } else {
        toolsPopover?.classList.add('agent-quick-popover--hidden');
      }
    });

    toolSearch?.addEventListener('input', () => {
      renderToolsList(toolSearch.value.trim());
    });

    btnConnectMcp?.addEventListener('click', (e) => {
      e.stopPropagation();
      toolsPopover?.classList.add('agent-quick-popover--hidden');
      window.dispatchEvent(new CustomEvent('kraga:open-settings', { detail: { tab: 'mcp' } }));
    });

    // 4. Mikrofon / Ses Girişi Butonu
    const btnVoice = document.getElementById('btnVoiceInput');
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let recognitionInstance: any = null;
    let isVoiceActive = false;

    if (SpeechRecognition) {
      try {
        recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'tr-TR';

        recognitionInstance.onresult = (event: any) => {
          let text = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            text += event.results[i][0].transcript;
          }
          if (text) {
            this.promptInput.value = (this.promptInput.value ? this.promptInput.value + ' ' : '') + text;
            this.adjustPromptInputHeight();
          }
        };

        recognitionInstance.onend = () => {
          isVoiceActive = false;
          btnVoice?.classList.remove('agent-voice-input-btn--active');
        };

        recognitionInstance.onerror = () => {
          isVoiceActive = false;
          btnVoice?.classList.remove('agent-voice-input-btn--active');
        };
      } catch {}
    }

    btnVoice?.addEventListener('click', () => {
      if (!recognitionInstance) {
        notificationManager.showToast({
          title: 'Sesli Giriş',
          message: 'Mikrofon aktif. Tarayıcı/Electron ortamında sesli dikte başlatılıyor.',
          type: 'info',
          durationMs: 3000
        });
        return;
      }
      if (isVoiceActive) {
        recognitionInstance.stop();
        isVoiceActive = false;
        btnVoice?.classList.remove('agent-voice-input-btn--active');
      } else {
        try {
          recognitionInstance.start();
          isVoiceActive = true;
          btnVoice?.classList.add('agent-voice-input-btn--active');
          notificationManager.showToast({
            title: 'Dinleniyor...',
            message: 'Konuşun, sesiniz yazıya dönüştürülüyor...',
            type: 'info',
            durationMs: 2500
          });
        } catch {
          isVoiceActive = false;
          btnVoice?.classList.remove('agent-voice-input-btn--active');
        }
      }
    });

    // Popover'ları dış tıklamada kapat
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#permPillWrapper') && !target.closest('#projectPickerWrapper') && !target.closest('#toolsPickerWrapper')) {
        closeAllQuickPopovers();
      }
    });
  }

  private initScrollBottomButton(): void {
    const chatContainer = this.chatFlow.parentElement;
    if (!chatContainer) return;

    let btn = chatContainer.querySelector('.agent-scroll-bottom-btn') as HTMLElement;
    if (!btn) {
      btn = document.createElement('button');
      btn.className = 'agent-scroll-bottom-btn';
      btn.title = 'Aşağı Kaydır';
      btn.innerHTML = iconChevronDown(18);
      if (getComputedStyle(chatContainer).position === 'static') {
        chatContainer.style.position = 'relative';
      }
      chatContainer.appendChild(btn);
    }
    this.scrollBottomBtn = btn;

    btn.addEventListener('click', () => {
      this.scrollToBottom(true);
    });

    // Kullanıcı kaydırma (Scroll lock) takibi:
    // Kullanıcı yukarı kaydırdığında (distanceFromBottom > 70px), canlı token akışı gelse bile
    // scrollbar ASLA aşağı zorla çekilmez (isUserScrolledUp = true).
    // Kullanıcı en alta yaklaştığında (distanceFromBottom <= 30px) otomatik takip tekrar aktifleşir.
    this.chatFlow.addEventListener('scroll', () => {
      const distanceFromBottom = this.chatFlow.scrollHeight - this.chatFlow.scrollTop - this.chatFlow.clientHeight;
      if (distanceFromBottom > 70) {
        this.isUserScrolledUp = true;
        if (this.scrollBottomBtn) {
          this.updateScrollBottomBtnState();
          this.scrollBottomBtn.classList.add('visible');
        }
      } else if (distanceFromBottom <= 30) {
        this.isUserScrolledUp = false;
        if (this.scrollBottomBtn) {
          this.scrollBottomBtn.classList.remove('visible');
        }
      }
    }, { passive: true });
  }

  private scrollToBottom(force: boolean = false): void {
    if (!force && this.isUserScrolledUp) {
      return;
    }
    if (force) {
      this.isUserScrolledUp = false;
      if (this.scrollBottomBtn) {
        this.scrollBottomBtn.classList.remove('visible');
      }
      this.chatFlow.scrollTo({
        top: this.chatFlow.scrollHeight,
        behavior: 'smooth',
      });
    } else {
      this.chatFlow.scrollTop = this.chatFlow.scrollHeight;
    }
  }

  private initChatHistory(): void {
    const lastId = this.chatHistory.getActiveSessionId();
    if (lastId) {
      const session = this.chatHistory.loadSession(lastId);
      if (session) {
        this.currentSessionId = session.id;
        this.messages = session.messages || [];
        this.restoreMessagesUI();
      } else {
        this.startNewSession();
      }
    } else {
      this.startNewSession();
    }

    const btnNew = document.getElementById('btnNewChat');
    const btnNewInDrawer = document.getElementById('btnNewChatInDrawer');
    const btnHistory = document.getElementById('btnChatHistory');
    const btnCloseHistory = document.getElementById('btnCloseHistory');
    this.historySidebar = document.getElementById('agentHistorySidebar');
    const searchInput = document.getElementById('chatHistorySearch') as HTMLInputElement;
    const btnClearSearch = document.getElementById('btnClearSearch');
    const btnClearAll = document.getElementById('btnClearAllHistory');

    btnNew?.addEventListener('click', () => this.startNewSession());
    btnNewInDrawer?.addEventListener('click', () => {
      this.toggleHistorySidebar(false);
      this.startNewSession();
    });
    // Cursor & Cline benzeri: Sohbet geçmişi Agent paneli içinde drawer olarak açılır
    btnHistory?.addEventListener('click', () => {
      this.toggleHistorySidebar();
    });
    const btnExpandWorkspace = document.getElementById('btnOpenSessionWorkspaceFromDrawer');
    btnExpandWorkspace?.addEventListener('click', () => {
      this.toggleHistorySidebar(false);
      if (this.onOpenSessionWorkspace) {
        this.onOpenSessionWorkspace();
      }
    });
    btnCloseHistory?.addEventListener('click', () => this.toggleHistorySidebar(false));

    searchInput?.addEventListener('input', () => {
      const val = searchInput.value;
      if (btnClearSearch) {
        btnClearSearch.style.display = val ? 'block' : 'none';
      }
      this.renderHistoryList(val);
    });

    btnClearSearch?.addEventListener('click', () => {
      searchInput.value = '';
      btnClearSearch.style.display = 'none';
      this.renderHistoryList();
      searchInput.focus();
    });

    btnClearAll?.addEventListener('click', () => {
      if (confirm('Tüm sohbet geçmişini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
        this.messages = [];
        this.chatHistory.clearAllSessions();
        this.startNewSession(true);
        this.renderHistoryList();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.historySidebar && this.historySidebar.style.display !== 'none') {
        this.toggleHistorySidebar(false);
      }
    });

    this.updateHistoryCountBadge();
  }

  private updateHistoryCountBadge(): void {
    const badge = document.getElementById('historyCountBadge');
    if (badge) {
      const count = this.chatHistory.listSessions().length;
      badge.textContent = `${count}`;
    }
  }

  public deleteSessionById(id: string): void {
    if (!id) return;
    this.deletedSessionIds.add(id);
    const active = this.activeStreams.get(id);
    if (active) {
      active.abortController.abort();
      this.activeStreams.delete(id);
    }
    this.chatHistory.deleteSession(id);
    if (id === this.currentSessionId) {
      this.messages = [];
      this.startNewSession(true);
    }
    this.renderHistoryList();
    this.updateHistoryCountBadge();
  }

  public startNewSession(skipSave: boolean = false): void {
    // 1. Asılı kalan tüm izin kartı promise'lerini iptal et ve temizle
    this.cancelPendingPermissions();

    // 2. Mevcut oturumu güvenle kaydet (silinmişse veya skipSave ise kaydetme)
    if (!skipSave && this.currentSessionId && this.messages.length > 0 && !this.deletedSessionIds.has(this.currentSessionId)) {
      const title = this.chatHistory.generateTitle(this.messages);
      this.chatHistory.saveSession(this.currentSessionId, title, this.messages, this.selectedModel);
    }
    
    this.currentSessionId = `session-${Date.now()}`;
    this.messages = [];
    this.chatHistory.setActiveSessionId(this.currentSessionId);
    this.isProcessing = false;
    this.currentAbortController = null;
    if (this.btnSend) this.btnSend.disabled = false;
    this.toggleSendStopButtons(false);
    this.setStatus('Hazır');

    // 3. Akıcı ve Animasyonlu Yeni Sohbet Geçişi
    const hasExistingContent = this.chatFlow.children.length > 0 && !this.chatFlow.querySelector('#agentWelcomeScreen');
    if (hasExistingContent) {
      this.chatFlow.classList.add('chat-flow--wiping');
      setTimeout(() => {
        this.clearChat();
        this.chatFlow.classList.remove('chat-flow--wiping');
        this.chatFlow.classList.add('chat-flow--entering');
        setTimeout(() => {
          this.chatFlow.classList.remove('chat-flow--entering');
        }, 360);
      }, 160);
    } else {
      this.clearChat();
      this.chatFlow.classList.add('chat-flow--entering');
      setTimeout(() => {
        this.chatFlow.classList.remove('chat-flow--entering');
      }, 360);
    }

    this.auxiliaryPane?.clearSession();
    this.toggleHistorySidebar(false);
    this.updateHistoryCountBadge();

    setTimeout(() => {
      this.promptInput?.focus();
    }, 200);
  }

  public getChatHistory(): ChatHistoryManager {
    return this.chatHistory;
  }

  public loadSessionById(id: string): void {
    if (!id || id === this.currentSessionId) return;

    // 1. Asılı kalan izin kartlarını iptal et
    this.cancelPendingPermissions();

    // 2. Mevcut oturumu güvenle kaydet
    if (this.currentSessionId && this.messages.length > 0) {
      const title = this.chatHistory.generateTitle(this.messages);
      this.chatHistory.saveSession(this.currentSessionId, title, this.messages, this.selectedModel);
    }
    
    const activeStream = this.activeStreams.get(id);
    const session = this.chatHistory.loadSession(id);
    if (!session && !activeStream) return;
    
    this.currentSessionId = id;
    this.chatHistory.setActiveSessionId(id);

    if (activeStream) {
      this.messages = activeStream.accumulatedMessages;
    } else {
      this.messages = session?.messages || [];
    }

    this.restoreMessagesUI();

    // 2. RE-ATTACH: Hedef oturumun arka planda devam eden canli akisi varsa DOM'a tekrar bagla
    if (activeStream && activeStream.agentBubble) {
      if (!this.chatFlow.contains(activeStream.agentBubble)) {
        this.chatFlow.appendChild(activeStream.agentBubble);
      }
      this.isProcessing = true;
      this.currentAbortController = activeStream.abortController;
      this.toggleSendStopButtons(true);
      this.setStatus('Yanıtlanıyor...');
      this.scrollToBottom(true);
    } else {
      this.isProcessing = false;
      this.currentAbortController = null;
      this.toggleSendStopButtons(false);
      this.setStatus('Hazır');
    }

    this.toggleHistorySidebar(false);
    this.updateHistoryCountBadge();

    setTimeout(() => {
      this.promptInput?.focus();
    }, 60);
  }

  private restoreMessagesUI(): void {
    this.chatFlow.innerHTML = '';
    
    if (!this.messages || this.messages.length === 0) {
      this.clearChat();
      return;
    }

    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      if (msg.role === 'user') {
        this.appendUserBubble(msg.content);
      } else if (msg.role === 'assistant') {
        // Plan onay durumu kontrolü: sonraki mesajda "[Plan Onaylandı]" varsa plan approved
        const nextMsg = this.messages[i + 1];
        const isPlanApproved = nextMsg?.role === 'user' && nextMsg.content?.includes('[Plan Onaylandı]');
        this.appendAssistantBubble(msg.content, isPlanApproved);
      }
    }

    // Token Tracker güncellemesi
    const tokens = Math.round(
      this.messages.reduce((acc, m) => acc + (m.content?.length || 0), 0) / 3.5
    );
    const modelInfo = getModelById(this.selectedModel);
    const limit = modelInfo?.contextLimit || resolveModelContextLimit(this.selectedModel);
    TokenTracker.getInstance().setContextUsage(tokens, limit);

    this.scrollToBottom(true);
  }

  private appendUserBubble(text: string): void {
    const bubble = document.createElement('div');
    bubble.className = 'agent-message agent-message--user chat-bubble user';
    bubble.innerHTML = `<div class="agent-bubble">${DOMPurify.sanitize(text.replace(/\n/g, '<br>'))}</div>`;
    this.chatFlow.appendChild(bubble);
  }

  private appendAssistantBubble(text: string, isPlanApproved = false): void {
    const bubble = document.createElement('div');
    bubble.className = 'agent-message agent-message--assistant chat-bubble agent';

    // Düşünce (<think>...</think>) ayrıştırma
    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
    let thinkHtml = '';
    let mainContent = text;

    if (thinkMatch) {
      const thinkText = thinkMatch[1].trim();
      mainContent = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
      if (thinkText) {
        thinkHtml = `
          <div class="thought-process-accordion thought-process-accordion--collapsed">
            <div class="thought-process-header">
              <span class="thought-process-chevron">▸</span>
              <span class="thought-process-title">Düşünce Süreci (Tamamlandı)</span>
            </div>
            <div class="thought-process-content">${DOMPurify.sanitize(marked.parse(thinkText) as string)}</div>
          </div>
        `;
      }
    }

    // Plan ayrıştırması
    const { preamble, livePlanRaw, isPlan } = this.separateChatAndPlan(mainContent);
    if (isPlan && livePlanRaw) {
      const renderedPreamble = preamble ? this.renderMarkdownWithMedia(preamble) : '';
      bubble.innerHTML = `${thinkHtml}${renderedPreamble ? `<div class="agent-bubble">${renderedPreamble}</div>` : ''}`;
      this.chatFlow.appendChild(bubble);
      if (renderedPreamble) {
        this.diffApply.enhanceCodeBlocks(bubble);
      }
      this.updatePlanArtifactWidget(bubble, livePlanRaw, true, this.buildSystemPrompt(), 0);

      // Plan zaten onaylanmışsa widget'ı approved durumuna geçir
      if (isPlanApproved) {
        const widget = bubble.querySelector('.plan-artifact-widget') as HTMLElement;
        if (widget) {
          const footer = widget.querySelector('.plan-widget-footer');
          if (footer) footer.remove();
          widget.classList.remove('plan-artifact-widget--ready');
          widget.classList.add('plan-artifact-widget--proceeded');
          // Status pill'i güncelle
          const statusPill = widget.querySelector('.plan-status-pill');
          if (statusPill) {
            statusPill.className = 'plan-status-pill plan-status-pill--approved';
            statusPill.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Plan Onaylandı`;
          }
          // "Plan Onaylandı" badge'i ekle
          const cleanedMd = this.cleanPlanMarkdown(livePlanRaw);
          const titleMatch = cleanedMd.match(/^#\s+(.+)$/m);
          const title = titleMatch ? titleMatch[1].trim().replace(/\*{1,2}/g, '') : 'Implementation Plan';
          const proceededBadge = document.createElement('div');
          proceededBadge.className = 'plan-proceeded-widget';
          proceededBadge.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-green, #50fa7b)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Plan Onaylandı & Uygulandı:</span>
            <strong class="plan-proceeded-title">${DOMPurify.sanitize(title)}</strong>
          `;
          widget.after(proceededBadge);
        }
      }
    } else {
      const rendered = this.renderMarkdownWithMedia(mainContent);
      bubble.innerHTML = `${thinkHtml}<div class="agent-bubble">${rendered}</div>`;
      this.chatFlow.appendChild(bubble);
      this.diffApply.enhanceCodeBlocks(bubble);
    }

    // Thought accordion açma/kapama
    const accHeader = bubble.querySelector('.thought-process-header');
    if (accHeader) {
      accHeader.addEventListener('click', () => {
        const acc = accHeader.closest('.thought-process-accordion');
        acc?.classList.toggle('thought-process-accordion--collapsed');
      });
    }
  }

  private toggleHistorySidebar(show?: boolean): void {
    if (!this.historySidebar) return;
    const isVisible = this.historySidebar.style.display !== 'none';
    const shouldShow = show !== undefined ? show : !isVisible;
    this.historySidebar.style.display = shouldShow ? 'flex' : 'none';
    if (shouldShow) {
      this.renderHistoryList();
      const searchInput = document.getElementById('chatHistorySearch') as HTMLInputElement;
      setTimeout(() => searchInput?.focus(), 80);
    }
  }

  private renderHistoryList(filter?: string): void {
    const listEl = document.getElementById('chatHistoryList');
    if (!listEl) return;

    this.updateHistoryCountBadge();
    const grouped = this.chatHistory.getGroupedSessions(filter);

    const totalCount = 
      grouped.pinned.length + 
      grouped.today.length + 
      grouped.yesterday.length + 
      grouped.pastWeek.length + 
      grouped.older.length;

    if (totalCount === 0) {
      listEl.innerHTML = `
        <div class="history-empty-view">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.4;">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>${filter ? 'Aramanızla eşleşen sohbet bulunamadı.' : 'Henüz kaydedilmiş bir sohbet oturumu yok.'}</div>
        </div>
      `;
      return;
    }

    const renderCard = (s: any): string => {
      const isActive = s.id === this.currentSessionId;
      const isPinned = !!s.isPinned;
      const isStreaming = this.activeStreams.has(s.id);
      const date = new Date(s.updatedAt || s.createdAt);
      const timeStr = `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
      const msgCount = s.messageCount || 0;
      const modelName = s.model || 'GPT 5.4 Mini';
      const previewText = s.preview || 'Henüz mesaj yok';

      return `
        <div class="history-session-card ${isActive ? 'history-session-card--active' : ''}" data-id="${s.id}">
          <div class="history-card-main">
            <div class="history-card-title-row">
              <span class="history-card-title" id="title-text-${s.id}">${DOMPurify.sanitize(s.title || 'İsimsiz Sohbet')}</span>
              ${isStreaming ? '<span class="history-meta-pill history-meta-pill--streaming"><span class="streaming-dot"></span> Yanıtlanıyor</span>' : ''}
            </div>
            <div class="history-card-preview">${DOMPurify.sanitize(previewText)}</div>
            <div class="history-card-meta">
              <span class="history-meta-pill history-meta-pill--model">${DOMPurify.sanitize(modelName)}</span>
              <span class="history-meta-pill">${msgCount} mesaj</span>
              <span>${timeStr}</span>
            </div>
          </div>
          <div class="history-card-actions">
            <button class="history-action-btn history-action-btn--pin ${isPinned ? 'active' : ''}" data-id="${s.id}" title="${isPinned ? 'Sabitlemeyi Kaldır' : 'Başa Sabitle'}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="${isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-2l-3-3V5a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v7l-3 3v2z"/></svg>
            </button>
            <button class="history-action-btn history-action-btn--rename" data-id="${s.id}" title="Yeniden Adlandır">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="history-action-btn history-action-btn--export" data-id="${s.id}" title="Markdown Olarak Dışa Aktar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button class="history-action-btn history-action-btn--delete" data-id="${s.id}" title="Sil">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    };

    const renderGroup = (title: string, items: any[]): string => {
      if (!items || items.length === 0) return '';
      return `
        <div class="history-group">
          <div class="history-group-header">
            <span>${title}</span>
            <span>(${items.length})</span>
          </div>
          <div class="history-group-items">
            ${items.map(renderCard).join('')}
          </div>
        </div>
      `;
    };

    let html = '';
    if (grouped.pinned.length > 0) html += renderGroup('Sabitlenenler', grouped.pinned);
    if (grouped.today.length > 0) html += renderGroup('Bugün', grouped.today);
    if (grouped.yesterday.length > 0) html += renderGroup('Dün', grouped.yesterday);
    if (grouped.pastWeek.length > 0) html += renderGroup('Son 7 Gün', grouped.pastWeek);
    if (grouped.older.length > 0) html += renderGroup('Daha Eski', grouped.older);

    listEl.innerHTML = html;

    // Click: Oturum aç
    listEl.querySelectorAll('.history-session-card').forEach((el) => {
      el.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.history-card-actions') || (e.target as HTMLElement).tagName === 'INPUT') {
          return;
        }
        const id = (el as HTMLElement).dataset.id;
        if (id) this.loadSessionById(id);
      });
    });

    // Pin
    listEl.querySelectorAll('.history-action-btn--pin').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (id) {
          this.chatHistory.togglePin(id);
          this.renderHistoryList(filter);
        }
      });
    });

    // Rename
    listEl.querySelectorAll('.history-action-btn--rename').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (!id) return;
        const titleSpan = document.getElementById(`title-text-${id}`);
        if (!titleSpan) return;

        const currentTitle = titleSpan.textContent || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'history-card-title-input';
        input.value = currentTitle;

        titleSpan.replaceWith(input);
        input.focus();
        input.select();

        const saveRename = () => {
          const newTitle = input.value.trim();
          if (newTitle && newTitle !== currentTitle) {
            this.chatHistory.renameSession(id, newTitle);
          }
          this.renderHistoryList(filter);
        };

        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            ke.preventDefault();
            saveRename();
          } else if (ke.key === 'Escape') {
            this.renderHistoryList(filter);
          }
        });
        input.addEventListener('blur', () => saveRename());
      });
    });

    // Export Markdown
    listEl.querySelectorAll('.history-action-btn--export').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (!id) return;
        const md = this.chatHistory.exportSessionMarkdown(id);
        if (!md) return;

        navigator.clipboard.writeText(md).then(() => {
          alert('Sohbet Markdown formatında panoya kopyalandı!');
        });
      });
    });

    // Delete
    listEl.querySelectorAll('.history-action-btn--delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.id;
        if (id && confirm('Bu sohbeti silmek istediğinize emin misiniz?')) {
          const active = this.activeStreams.get(id);
          if (active) {
            active.abortController.abort();
            this.activeStreams.delete(id);
          }
          this.deleteSessionById(id);
          this.renderHistoryList(filter);
        }
      });
    });
  }

  private renderSubagentsStatusInChat(): void {
    const sessions = this.subagentManager.getAllSessions();
    if (sessions.length === 0) {
      this.addMessage('tool', '### Subagent Durumu\nHenuz baslatilmis subagent yok. Modele karmasik bir gorev ver veya direkt `spawn_subagent` araci kullanilabilir.');
      return;
    }

    let md = '### Subagent Durumu\n\n| Rol | Durum | Sure | Gorev |\n|-----|-------|------|-------|\n';
    for (const s of sessions) {
      const status = s.status === 'running' ? 'Calisiyor' : s.status === 'done' ? 'Tamamlandi' : s.status === 'error' ? 'Hata' : 'Durduruldu';
      const elapsed = ((s.elapsedMs || (Date.now() - s.createdAt)) / 1000).toFixed(1);
      const taskPreview = s.task.slice(0, 40) + (s.task.length > 40 ? '...' : '');
      md += `| ${s.role} | ${status} | ${elapsed}s | ${taskPreview} |\n`;
    }
    this.addMessage('tool', md);
  }

  // ─── Antigravity Auxiliary Pane Entegrasyonu ────────────────────────────────
  private initAuxiliaryPane(): void {
    try {
      this.auxiliaryPane = new AuxiliaryPaneManager('agentAuxiliaryPane', this.subagentManager);
      if (this.currentProjectPath) {
        this.auxiliaryPane.setProjectPath(this.currentProjectPath);
      }

      this.auxiliaryPane.onOpenFile = async (path: string) => {
        if (this.onOpenFile) await this.onOpenFile(path);
      };

      this.auxiliaryPane.onOpenArtifact = (artifact: ArtifactItem) => {
        if (artifact.type === 'plan' && artifact.data) {
          this.showPlanDetailPanel(artifact.data);
        } else if (artifact.type === 'script' && artifact.data) {
          const fileName = artifact.title || 'script.ts';
          const ext = fileName.split('.').pop() || 'ts';
          const langMap: Record<string, string> = {
            html: 'html', js: 'javascript', ts: 'typescript', css: 'css', py: 'python', json: 'json', md: 'markdown'
          };
          const lang = langMap[ext.toLowerCase()] || 'plaintext';
          if (this.onLiveScriptStart) {
            this.onLiveScriptStart(fileName, lang, artifact.data);
            this.onLiveScriptFinish?.(artifact.data);
          }
        }
      };

      this.auxiliaryPane.onBadgeUpdate = (count: number) => {
        const badge = document.getElementById('auxTotalBadge');
        if (badge) {
          if (count > 0) {
            badge.textContent = String(count);
            badge.style.display = 'inline-block';
          } else {
            badge.style.display = 'none';
          }
        }
      };
    } catch (e) {
      console.error('AuxiliaryPane baslatilamadi:', e);
    }
  }

  private initViewSwitcher(): void {
    const btnChat = document.getElementById('btnViewChat');
    const btnAux = document.getElementById('btnViewAuxiliary');
    const chatFlow = this.chatFlow;
    const subContainer = document.getElementById('subagentContainer');
    const inputContainer = document.querySelector('.agent-input-container') as HTMLElement;
    const auxPane = document.getElementById('agentAuxiliaryPane');

    const switchView = (view: 'chat' | 'auxiliary') => {
      this.activeView = view;
      if (view === 'chat') {
        btnChat?.classList.add('agent-view-btn--active');
        btnAux?.classList.remove('agent-view-btn--active');
        chatFlow.style.display = 'flex';
        if (auxPane) auxPane.style.display = 'none';
        if (inputContainer) inputContainer.style.display = 'flex';
        this.scrollToBottom();
      } else {
        btnAux?.classList.add('agent-view-btn--active');
        btnChat?.classList.remove('agent-view-btn--active');
        chatFlow.style.display = 'none';
        if (subContainer) subContainer.style.display = 'none';
        if (auxPane) auxPane.style.display = 'flex';
        if (inputContainer) inputContainer.style.display = 'none';
        this.auxiliaryPane?.render();
        this.auxiliaryPane?.refreshGitStatus();
      }
    };

    btnChat?.addEventListener('click', () => switchView('chat'));
    btnAux?.addEventListener('click', () => switchView('auxiliary'));
  }

  public approvePlanAndExecute(planData: ImplementationPlanData): void {
    const title = planData.title || 'Implementation Plan';
    this.setMode('act');
    this.messages.push({
      role: 'user',
      content: `[Plan Onaylandı]: "${title}" planı kullanıcı tarafından onaylandı. Şimdi bu planı adım adım uygula. Dosyaları oluştur/değiştir, komutları çalıştır.`,
    });
    this.isProcessing = true;
    this.setStatus('Plan uygulanıyor...');
    this.toggleSendStopButtons(true);
    const systemPrompt = this.buildSystemPrompt();
    this.runToolCallingStreamLoop(systemPrompt, 0);
  }

  // ─── Ataç Dosya Ekleme & Widget Motoru (Tüm Kod ve Dosya Formatları) ───────
  private initFileAttachment(): void {
    const btnAttach = document.getElementById('btnAttachFile') || document.getElementById('btnAttachMedia');
    const fileInput = document.getElementById('mediaFileInput') as HTMLInputElement;
    const inputCard = document.getElementById('agentInputCard') || this.promptInput.closest('.agent-input-card') as HTMLElement;

    if (btnAttach && fileInput) {
      btnAttach.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', async () => {
        if (!fileInput.files || fileInput.files.length === 0) return;
        const files = Array.from(fileInput.files);
        for (const file of files) {
          await this.addAttachedFile(file);
        }
        fileInput.value = '';
      });
    }

    // Sürükle-Bırak (Drag & Drop) Desteği
    if (inputCard) {
      inputCard.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputCard.classList.add('agent-input-card--dragover');
      });

      inputCard.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputCard.classList.remove('agent-input-card--dragover');
      });

      inputCard.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        inputCard.classList.remove('agent-input-card--dragover');

        const dragFiles = e.dataTransfer?.files;
        if (dragFiles && dragFiles.length > 0) {
          for (const file of Array.from(dragFiles)) {
            await this.addAttachedFile(file);
          }
        }
      });
    }

    // Pano Yapıştırma (Ctrl+V Paste) Desteği
    this.promptInput.addEventListener('paste', async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      let hasFile = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            hasFile = true;
            await this.addAttachedFile(file);
          }
        }
      }
      if (hasFile) {
        this.renderAttachedFilesBar();
      }
    });
  }

  private async addAttachedFile(file: File): Promise<void> {
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return new Promise<void>((resolve) => {
      const reader = new FileReader();

      if (isImage) {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const item: AttachedFileItem = {
            id,
            name: file.name,
            size: file.size,
            type: file.type || 'image',
            extension: ext,
            content: '',
            dataUrl,
            isImage: true,
          };
          this.attachedFiles.push(item);
          this.auxiliaryPane?.trackUpload({
            name: file.name,
            title: `Görsel: ${file.name}`,
            dataUrl,
            size: file.size,
          });
          this.renderAttachedFilesBar();
          resolve();
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = () => {
          const content = (reader.result as string) || '';
          const lineCount = content ? content.split('\n').length : 0;
          const item: AttachedFileItem = {
            id,
            name: file.name,
            size: file.size,
            type: file.type || 'text/plain',
            extension: ext,
            content,
            isImage: false,
            lineCount,
          };
          this.attachedFiles.push(item);
          this.auxiliaryPane?.trackUpload({
            name: file.name,
            title: `Dosya: ${file.name}`,
            size: file.size,
          });
          this.renderAttachedFilesBar();
          resolve();
        };
        reader.onerror = () => {
          console.warn('Dosya okunamadı:', file.name);
          resolve();
        };
        reader.readAsText(file);
      }
    });
  }

  private renderAttachedFilesBar(): void {
    this.updatePromptEstimator();
    const barEl = document.getElementById('agentAttachedFilesBar');
    if (!barEl) return;

    if (this.attachedFiles.length === 0) {
      barEl.style.display = 'none';
      barEl.innerHTML = '';
      return;
    }

    barEl.style.display = 'flex';
    barEl.innerHTML = '';

    for (const item of this.attachedFiles) {
      const chip = document.createElement('div');
      chip.className = 'attached-file-chip';
      chip.title = `${item.name} (${this.formatFileSize(item.size)})`;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'attached-file-icon';
      if (item.isImage && item.dataUrl) {
        iconSpan.innerHTML = `<img src="${item.dataUrl}" class="attached-chip-thumb" alt="${item.name}" />`;
      } else {
        iconSpan.innerHTML = getFileIconByExtension(item.name, 14);
      }
      chip.appendChild(iconSpan);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'attached-file-name';
      nameSpan.textContent = item.name;
      chip.appendChild(nameSpan);

      const metaSpan = document.createElement('span');
      metaSpan.className = 'attached-file-meta';
      metaSpan.textContent = this.formatFileSize(item.size);
      chip.appendChild(metaSpan);

      const btnRemove = document.createElement('button');
      btnRemove.type = 'button';
      btnRemove.className = 'attached-file-remove';
      btnRemove.title = 'Kaldır';
      btnRemove.innerHTML = '✕';
      btnRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        this.attachedFiles = this.attachedFiles.filter((f) => f.id !== item.id);
        this.renderAttachedFilesBar();
      });
      chip.appendChild(btnRemove);

      barEl.appendChild(chip);
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ─── Yukarıdan Kayan Plan / Yükseltme Hap Bildirimi (Floating Plan Banner) ──
  private initFloatingPlanBanner(): void {
    const banner = document.getElementById('agentFloatingPlanBanner');
    const ringProgress = document.getElementById('planBannerRingProgress') as SVGElement | null;
    const ringWrap = document.getElementById('planBannerRingWrap');
    const planNameEl = document.getElementById('planBannerPlanName');
    const pctEl = document.getElementById('planBannerPct');
    const upgradeBtn = document.getElementById('planBannerUpgradeBtn');
    const closeBtn = document.getElementById('planBannerCloseBtn');

    if (!banner) return;

    // Oturum bazında kapatılma durumunu kontrol et
    const isDismissed = sessionStorage.getItem('kraga-floating-plan-banner-dismissed') === 'true';
    if (isDismissed) {
      banner.classList.add('agent-floating-plan-banner--hidden');
    }

    const CIRCUMFERENCE = 47.12; // 2 * PI * 7.5
    let lastKnownPromoMode = TokenTracker.getInstance().getState().isPromoMode;

    const updateBannerUI = () => {
      const tokenTracker = TokenTracker.getInstance();
      const state = tokenTracker.getState();
      const remPct = Math.max(0, Math.min(100, tokenTracker.getRemainingPercentage()));

      // Yeni promo etkinleştirildiyse banner'ı tekrar görünür yap
      if (!lastKnownPromoMode && state.isPromoMode) {
        sessionStorage.removeItem('kraga-floating-plan-banner-dismissed');
        banner.classList.remove('agent-floating-plan-banner--hidden');
      }
      lastKnownPromoMode = state.isPromoMode;

      // Plan İsmi
      let planDisplayName = 'Free plan';
      if (!state.isPromoMode && state.costLimit <= 0 && state.tokenLimit <= 0) {
        planDisplayName = 'Free plan';
      } else if (state.costLimit > 0) {
        const costVal = state.costLimit % 1 === 0 ? state.costLimit.toFixed(0) : state.costLimit.toFixed(2);
        planDisplayName = `$${costVal} Plan`;
      } else if (state.tokenLimit > 0) {
        const m = state.tokenLimit / 1_000_000;
        planDisplayName = m >= 1 ? `${m.toFixed(0)}M Token` : `${(state.tokenLimit / 1_000).toFixed(0)}K Token`;
      } else if (state.isPromoMode) {
        planDisplayName = 'Promo Plan';
      }

      if (planNameEl) {
        planNameEl.textContent = planDisplayName;
      }

      // Kalan Yüzde
      const formattedPct = `%${Math.round(remPct)}`;
      if (pctEl) {
        pctEl.textContent = formattedPct;
      }

      const balanceFormatted = tokenTracker.getFormattedBalance();
      const tooltipMsg = `${planDisplayName} • Kalan: ${balanceFormatted} (${formattedPct})`;
      banner.setAttribute('title', tooltipMsg);
      ringWrap?.setAttribute('title', tooltipMsg);

      // SVG Halka İlerlemesi & Renkleri
      const offset = CIRCUMFERENCE * (1 - remPct / 100);
      if (ringProgress) {
        ringProgress.style.strokeDashoffset = String(offset);

        ringProgress.classList.remove('ring-progress--emerald', 'ring-progress--amber', 'ring-progress--red');
        pctEl?.classList.remove('plan-banner-pct--emerald', 'plan-banner-pct--amber', 'plan-banner-pct--red');

        if (remPct > 40) {
          ringProgress.classList.add('ring-progress--emerald');
          pctEl?.classList.add('plan-banner-pct--emerald');
        } else if (remPct >= 15) {
          ringProgress.classList.add('ring-progress--amber');
          pctEl?.classList.add('plan-banner-pct--amber');
        } else {
          ringProgress.classList.add('ring-progress--red');
          pctEl?.classList.add('plan-banner-pct--red');
        }
      }

      // Kritik seviye (%10 ve altı veya tüketilmiş) durumunda zorunlu görünür kıl
      if (remPct <= 10 || tokenTracker.isDepleted()) {
        sessionStorage.removeItem('kraga-floating-plan-banner-dismissed');
        banner.classList.remove('agent-floating-plan-banner--hidden');
      }
    };

    updateBannerUI();
    TokenTracker.getInstance().on('update', updateBannerUI);

    // Upgrade bağlantısı tıklaması: Web sitesi satın alma / fiyatlandırma sayfasına yönlendir
    upgradeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const targetUrl = 'https://ai.kraga.org/#pricing';
      if ((window as any).kragaAPI?.app?.openExternal) {
        (window as any).kragaAPI.app.openExternal(targetUrl);
      } else {
        window.open(targetUrl, '_blank');
      }

      // Satın alınan kodu hemen yapıştırabilmesi için Hesap Merkezini de aç
      window.dispatchEvent(new CustomEvent('kraga:open-account'));

      notificationManager.showToast({
        title: 'Kraga Yükseltme & Paketler',
        message: 'Resmi paket satın alma sayfası açıldı. Kodunuzu doğrudan Hesap Merkezinde tanımlayabilirsiniz.',
        type: 'info',
        durationMs: 4000,
      });
    });

    // Kapatma butonu tıklaması
    closeBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      banner.classList.add('agent-floating-plan-banner--hidden');
      sessionStorage.setItem('kraga-floating-plan-banner-dismissed', 'true');
    });
  }
}
