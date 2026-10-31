// src/main.ts
// Open Crow v2.0 — Ana Orkestrasyon ve Yaşam Döngüsü

import { EditorManager } from './components/Editor';
import { TerminalManager } from './components/Terminal';
import { SidebarManager } from './components/Sidebar';
import { AgentPanelManager } from './components/AgentPanel';
import { ThemeManager } from './components/ThemeManager';
import { ActivityBarManager } from './components/ActivityBar';
import { StatusBarManager } from './components/StatusBar';
import { SplitterManager } from './components/Splitter';
import { SettingsModalManager } from './components/SettingsModal';
import { ModelSelectorManager } from './components/ModelSelector';
import { ContextPopoverManager } from './components/ContextPopover';
import { CommandPaletteManager } from './components/CommandPalette';
import { QuickOpenManager } from './components/QuickOpen';
import { DiffApplyManager } from './components/DiffApply';
import { SkillsHubManager } from './components/SkillsHub';
import { WelcomeTabManager } from './components/WelcomeTab';
import { AppMenuBarManager } from './components/AppMenuBar';
import { ScriptPanelManager } from './components/ScriptPanel';
import { SubagentPanel } from './components/SubagentPanel';
import { LiveScriptWorkspaceManager } from './components/LiveScriptWorkspace';
import { PlanWorkspaceManager } from './components/PlanWorkspace';
import { SessionWorkspaceManager } from './components/SessionWorkspace';
import { PreviewWorkspaceManager } from './components/PreviewWorkspace';
import { ReviewWorkspaceManager, type TurnReviewData } from './components/ReviewWorkspace';
import { previewModal } from './components/PreviewModal';
import { notificationManager } from './core/NotificationManager';
import { GraphifyPanel } from './components/GraphifyPanel';
import { ProblemsPanelManager } from './components/ProblemsPanel';
import { OutputPanelManager } from './components/OutputPanel';
import { VsStandardToolbar } from './components/VsStandardToolbar';
import { VsNavigationBar } from './components/VsNavigationBar';
import { shortcutsModal } from './components/ShortcutsModal';
import * as monaco from 'monaco-editor';
import { TokenTracker } from './core/TokenTracker';
import { fetchAvailableModels } from './core/proxyClient';
import { registerPromoModels, getCheapestModel, resetActiveModels } from './core/ModelCatalog';

function openExternalUrl(url: string): void {
  if ((window as any).kragaAPI?.app?.openExternal) {
    (window as any).kragaAPI.app.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Platform sınıfını <body> elementine ekle (özellikle macOS trafiği ve CSS stilleri için)
  window.kragaAPI?.system?.getPaths?.().then((paths: any) => {
    if (paths?.platform) {
      document.body.classList.add(`platform-${paths.platform}`);
    }
  }).catch(() => {});

  // 1. Pencere Kontrolleri (Window Controls)
  const btnMin = document.getElementById('btnMinimize');
  const btnMax = document.getElementById('btnMaximize');
  const btnClose = document.getElementById('btnClose');

  btnMin?.addEventListener('click', () => window.kragaAPI.app.minimize());
  btnMax?.addEventListener('click', () => window.kragaAPI.app.maximize());
  btnClose?.addEventListener('click', () => window.kragaAPI.app.close());

  const updateMaxIcon = (isMax: boolean) => {
    if (btnMax) {
      btnMax.innerHTML = isMax
        ? `<svg width="10" height="10" viewBox="0 0 10 10"><path fill="none" stroke="currentColor" stroke-width="1" d="M2.5,2.5 L2.5,0.5 L9.5,0.5 L9.5,7.5 L7.5,7.5 M0.5,2.5 L7.5,2.5 L7.5,9.5 L0.5,9.5 Z"/></svg>`
        : `<svg width="10" height="10" viewBox="0 0 10 10"><rect width="9" height="9" x="0.5" y="0.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>`;
    }
  };

  if (window.kragaAPI?.app?.onMaximizeChange) {
    window.kragaAPI.app.onMaximizeChange(updateMaxIcon);
    window.kragaAPI.app.isMaximized?.().then(updateMaxIcon);
  }

  // 2. Alt Durum Çubuğu (Status Bar)
  const statusBarContainer = document.getElementById('statusBarFooter')!;
  const statusBar = new StatusBarManager(statusBarContainer);

  // 3. Editör, Terminal, Script ve Teşhis Yöneticileri
  const editorManager = new EditorManager('tabsBar', 'monacoEditorContainer', 'welcomeView', 'scriptView', 'planWorkspaceView', 'sessionWorkspaceView', 'liveScriptWorkspace');
  const terminalManager = new TerminalManager('xtermContainer');

  // VS Code Insiders: Sorunlar & Teşhis Paneli (Problems & Diagnostics)
  const problemsPanel = new ProblemsPanelManager('problemsListContainer', 'problemsCountBadge');
  problemsPanel.onSelectProblem = (filePath, line, col) => {
    editorManager.openFileAtLine(filePath, line, col);
  };

  monaco.editor.onDidChangeMarkers(() => {
    const markers = monaco.editor.getModelMarkers({});
    problemsPanel.updateMarkers(markers);
  });

  // Visual Studio 2022 Çok Kanallı Çıktı Konsolu (Multi-Channel Output Console)
  const outputContainerEl = document.getElementById('outputContainer') || document.createElement('div');
  const outputPanel = new OutputPanelManager(outputContainerEl);

  // VS Code Insiders: Zen Modu (Saf Odaklanma Modu)
  const toggleZenMode = () => {
    document.body.classList.toggle('zen-mode');
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  };
  document.getElementById('zenModeExitBtn')?.addEventListener('click', toggleZenMode);

  const scriptViewEl = document.getElementById('scriptView')!;
  const scriptPanel = new ScriptPanelManager(scriptViewEl);
  scriptPanel.onRunCommand = (command) => {
    const bottomPanel = document.getElementById('bottomPanel');
    if (bottomPanel) bottomPanel.style.display = 'flex';
    const termTabBtn = document.querySelector('[data-target="terminalTab"]') as HTMLElement;
    termTabBtn?.click();
    terminalManager.runCommand(command);
  };

  // Visual Studio 2022 Standart Düzenleme ve Debug Araç Çubuğu (Standard Toolbar)
  const vsToolbar = new VsStandardToolbar('vsToolbarContainer', {
    onNavigateBack: () => editorManager.layout(),
    onNavigateForward: () => editorManager.layout(),
    onNewFile: () => (document.getElementById('btnSidebarNewFile') as HTMLButtonElement)?.click(),
    onOpenFile: () => (document.getElementById('btnOpenFolder') as HTMLButtonElement)?.click(),
    onSave: () => editorManager.saveActiveFile(),
    onSaveAll: () => editorManager.saveAllFiles(),
    onUndo: () => editorManager.undo(),
    onRedo: () => editorManager.redo(),
    onStartDebug: (config, target) => {
      const bottomPanel = document.getElementById('bottomPanel');
      if (bottomPanel) bottomPanel.style.display = 'flex';
      const termTabBtn = document.querySelector('[data-target="terminalTab"]') as HTMLElement;
      termTabBtn?.click();
      terminalManager.runCommand(`echo [Visual Studio 2022 Runner] Başlatılıyor: ${target} (${config})...`);
    },
    onCommentSelection: () => editorManager.commentSelection(),
    onUncommentSelection: () => editorManager.uncommentSelection(),
    onFormatDocument: () => editorManager.formatDocument(),
    onFind: () => editorManager.find(),
    onReplace: () => editorManager.replace(),
    onToggleBreakpoint: () => editorManager.toggleBreakpoint(),
    onSplitEditor: () => editorManager.layout(),
    onPeekDefinition: () => editorManager.peekDefinition(),
    onQuickFix: () => editorManager.quickFix(),
    onLivePreview: () => {
      const active = editorManager.getActiveFile() || editorManager.getActiveTab();
      if (active && active.path) {
        previewModal.open({
          filePath: active.path,
          title: active.name || active.path.split(/[/\\]/).pop(),
        });
      } else {
        previewModal.open({
          title: 'Canlı Önizleme',
        });
      }
    },
  });

  // Visual Studio 2022 Sınıf ve Üye Gezinti Çubuğu (Class & Member Navigation Bar)
  const vsNavBar = new VsNavigationBar('vsNavBarContainer');
  vsNavBar.setVisible(false);
  vsNavBar.onNavigateToLine = (line) => {
    const active = editorManager.getActiveFile();
    if (active) {
      editorManager.openFileAtLine(active.path, line);
    }
  };

  let navBarUpdateTimer: any = null;
  const scheduleNavBarUpdate = (code: string, path: string, delay = 250) => {
    if (navBarUpdateTimer) clearTimeout(navBarUpdateTimer);
    navBarUpdateTimer = setTimeout(() => {
      navBarUpdateTimer = null;
      vsNavBar.updateFileSymbols(code, path);
    }, delay);
  };

  // Aktif dosya değiştiğinde VS Navigation Bar sembollerini ve Error List aktif belgesini yenile
  editorManager.onActiveFileChange = (tab) => {
    if (problemsPanel) {
      problemsPanel.setActiveDocument(tab ? tab.path : null);
    }
    if (tab) {
      scheduleNavBarUpdate(tab.model.getValue(), tab.path, 60);
    } else {
      vsNavBar.setVisible(false);
    }
    editorManager.layout();
  };

  // Global Canlı Önizleme Event Köprüsü (Sekmeler, Butonlar ve Agent Araçları için)
  window.addEventListener('kraga:open-preview', (e: any) => {
    const detail = e.detail || {};
    previewModal.open({
      filePath: detail.filePath,
      fileContent: detail.content,
      title: detail.title || 'Canlı Önizleme',
    });
  });

  // Editör cursor, language, markers ve sembol değişikliklerini köprüle
  editorManager.onCursorChange = (line, col) => {
    statusBar.setCursorPosition(line, col);
    vsNavBar.onCursorChange(line);
  };
  editorManager.onFileContentChange = (content, filePath) => {
    scheduleNavBarUpdate(content, filePath, 300);
  };
  editorManager.onSplitEditorToggle = () => {
    editorManager.layout();
  };
  statusBar.onZoomChange = (percentage) => {
    editorManager.setZoomLevel(percentage);
  };
  editorManager.onLanguageChange = (lang) => {
    statusBar.setLanguage(lang);
  };
  editorManager.onMarkersChange = (errors, warnings) => {
    statusBar.setErrors(errors, warnings);
    const markers = monaco.editor.getModelMarkers({});
    problemsPanel.updateMarkers(markers);
  };
  editorManager.onSelectionChange = (stats) => {
    statusBar.setSelectionStats(stats);
  };
  statusBar.onErrorClick = () => {
    const bottomPanel = document.getElementById('bottomPanel');
    if (bottomPanel) bottomPanel.style.display = 'flex';
    const probBtn = document.querySelector('[data-target="problemsTab"]') as HTMLElement;
    probBtn?.click();
    editorManager.goToNextError();
  };

  // Gezinme Yolu (Breadcrumbs Bar) Köprüsü
  const breadcrumbsEl = document.getElementById('editorBreadcrumbs');
  editorManager.onBreadcrumbsChange = (crumbs) => {
    if (!breadcrumbsEl) return;
    if (!crumbs || crumbs.length === 0) {
      breadcrumbsEl.style.display = 'none';
      breadcrumbsEl.innerHTML = '';
      return;
    }
    breadcrumbsEl.style.display = 'flex';
    breadcrumbsEl.innerHTML = crumbs.map((c, i) => {
      const isLast = i === crumbs.length - 1;
      return `
        <span class="breadcrumb-crumb ${isLast ? 'active' : ''}" data-path="${c.path || ''}">
          ${c.name}
        </span>
        ${!isLast ? '<span class="breadcrumb-sep">›</span>' : ''}
      `;
    }).join('');

    const active = editorManager.getActiveFile();
    if (active) {
      sidebarManager.setActiveFile(active.path);
    }
  };

  // 4. Diff & Apply Yöneticisi (Agent kod blokları için)
  const diffApply = new DiffApplyManager();
  diffApply.onGetOpenFiles = () => editorManager.getOpenFiles();
  diffApply.onGetWorkspacePath = () => sidebarManager.getCurrentPath() || '';
  diffApply.onApplyToFile = async (filePath, code) => {
    await window.kragaAPI.fs.writeFile(filePath, code);
    await editorManager.openFile(filePath);
  };
  diffApply.onCreateFile = async (filePath, code) => {
    await window.kragaAPI.fs.writeFile(filePath, code);
    const targetFolder = sidebarManager.getCurrentPath();
    if (targetFolder) {
      await sidebarManager.loadFolder(targetFolder);
    }
    await editorManager.openFile(filePath);
  };
  diffApply.onOpenInEditor = async (code, language) => {
    const l = (language || '').toLowerCase();
    const ext = l === 'typescript' || l === 'ts' ? 'ts' : l === 'javascript' || l === 'js' ? 'js' : l === 'html' ? 'html' : l === 'css' ? 'css' : l === 'python' || l === 'py' ? 'py' : l === 'json' ? 'json' : 'txt';
    const snippetTitle = `Agent_Kod_${Date.now().toString().slice(-4)}.${ext}`;
    await editorManager.openSnippet(snippetTitle, code, language || 'plaintext');
  };

  // 5. Yetenekler & Ayarlar Modalı
  const skillsHub = new SkillsHubManager();

  const settingsModal = new SettingsModalManager(skillsHub, (newTheme) => {
    themeManager.applyTheme(newTheme);
  });
  settingsModal.onEditorSettingsChange = (prefs) => {
    editorManager.updateEditorPreferences(prefs);
  };
  settingsModal.onAppearanceChange = (app) => {
    settingsModal.applyChatFont(app.chatFont as any);
    settingsModal.applyMotion(app.motion);
  };

  // Global Modal Açma Olayları (Ajan Hata Kartı, Bildirimler ve Kısayollar İçin)
  window.addEventListener('kraga:open-settings', (e: any) => {
    const tab = e.detail?.tab || 'general';
    settingsModal.open(tab);
  });

  const smartMemory = settingsModal.getSmartMemory();

  // 6. Komut Paleti & Hızlı Dosya Arama
  const commandPalette = new CommandPaletteManager();
  const quickOpen = new QuickOpenManager();
  quickOpen.onFileSelect = (path) => {
    editorManager.openFile(path);
  };

  // 7. Agent Paneli
  const agentManager = new AgentPanelManager(
    'agentChatFlow',
    'agentPromptInput',
    'btnSendPrompt',
    'agentStatus',
    diffApply,
    smartMemory,
    skillsHub
  );

  // 8. Claude Tarzı Model Seçici
  const modelMount = document.getElementById('agentModelMount')!;
  const modelSelector = new ModelSelectorManager(modelMount);
  modelSelector.hasActiveMessages = () => agentManager.hasMessages();
  modelSelector.onModelChange = (modelId) => {
    agentManager.setModel(modelId);
  };
  modelSelector.onEffortChange = (effort) => {
    agentManager.setEffort(effort);
  };
  modelSelector.onThinkingChange = (thinking) => {
    agentManager.setThinking(thinking);
  };

  // Başlangıç model, efor ve düşünme durumu senkronizasyonu
  agentManager.setModel(modelSelector.getSelectedModel());
  agentManager.setEffort(modelSelector.getSelectedEffort());
  agentManager.setThinking(modelSelector.isThinkingEnabled());

  // 7b. Subagent Paneli
  void new SubagentPanel(agentManager.getSubagentManager());

  // 9. Gezgin / Çoklu Görünümlü Kenar Çubuğu
  const sidebarManager = new SidebarManager(
    'sidebarContainer',
    (filePath, line, col) => {
      if (line !== undefined) {
        editorManager.openFileAtLine(filePath, line, col || 1);
      } else {
        editorManager.openFile(filePath);
      }
      quickOpen.addRecentFile(filePath);
    },
    async (folderPath) => {
      agentManager.setProjectPath(folderPath);
      graphifyPanel.setProjectPath(folderPath);
      if (outputPanel) {
        outputPanel.append('general', `Proje klasörü yüklendi: ${folderPath}`, 'success');
        outputPanel.append('git', `Git deposu bağlandı: ${folderPath}`, 'info');
      }
      await terminalManager.startSession(folderPath);
      statusBar.setBranch('main');
      welcomeTab.addRecentProject(folderPath);
      scriptPanel.setProjectPath(folderPath);
      const folderName = folderPath.split(/[\\/]/).filter(Boolean).pop() || 'Başlat';
      vsToolbar.setProjectName(folderName);
    }
  );

  // 9b. Agent Kod Paneli ve Editör Senkronizasyonu (Visual Studio / Cursor Tarzı)
  agentManager.onOpenFile = async (filePath) => {
    try { liveScriptWorkspace.close(); } catch {}
    try { editorManager.closeLiveScriptTab(); } catch {}
    await editorManager.openFile(filePath);
  };
  agentManager.onOpenSnippet = async (title, code, lang) => {
    try { liveScriptWorkspace.close(); } catch {}
    try { editorManager.closeLiveScriptTab(); } catch {}
    await editorManager.openSnippet(title, code, lang);
  };
  agentManager.onRefreshExplorer = async () => {
    const current = sidebarManager.getCurrentPath();
    if (current) {
      await sidebarManager.loadFolder(current);
    }
  };

  // 9b-1. Monaco Sağ Tık AI Eylemlerini Agent Paneline Bağla
  editorManager.onAiAction = (action, code, filePath) => {
    let prompt = '';
    const fileHint = filePath ? `Dosya: ${filePath}\n\n` : '';
    if (action === 'explain') {
      prompt = `${fileHint}Şu kod parçasının mantığını, akışını ve ne yaptığını adım adım detaylı açıkla:\n\`\`\`\n${code}\n\`\`\``;
    } else if (action === 'test') {
      prompt = `${fileHint}Şu kod parçası için kapsamlı birim testler (Unit Tests) ve uç durum (edge-case) senaryoları üret:\n\`\`\`\n${code}\n\`\`\``;
    } else if (action === 'audit') {
      prompt = `${fileHint}Şu kod parçasını güvenlik açıkları (OWASP, injection, bellek/kaynak sızıntısı) ve olası mantık hataları açısından derinlemesine denetle:\n\`\`\`\n${code}\n\`\`\``;
    }

    if (prompt) {
      agentManager.injectPromptAndSend(prompt);
    }
  };

  // 9b-2. Varsayılan Çalışma Alanı (Default Workspace) Senkronizasyonu
  const initialDefaultWs = settingsModal.getDefaultWorkspacePath();
  if (initialDefaultWs && !sidebarManager.getCurrentPath()) {
    sidebarManager.loadFolder(initialDefaultWs).then(() => {
      agentManager.setProjectPath(initialDefaultWs);
      terminalManager.startSession(initialDefaultWs).catch(() => {});
      scriptPanel.setProjectPath(initialDefaultWs);
    }).catch((err) => {
      console.warn('[Startup] Varsayılan çalışma alanı açılamadı:', err);
    });
  } else if (initialDefaultWs) {
    agentManager.setProjectPath(initialDefaultWs);
  }

  settingsModal.onDefaultWorkspaceChange = (newWs) => {
    if (newWs && !sidebarManager.getCurrentPath()) {
      sidebarManager.loadFolder(newWs).then(() => {
        agentManager.setProjectPath(newWs);
        terminalManager.startSession(newWs).catch(() => {});
        scriptPanel.setProjectPath(newWs);
      }).catch(() => {});
    }
  };

  // Hızlı Proje Seçici Olayları (Shelf Popover)
  window.addEventListener('kraga:open-project', async (e: any) => {
    if (e.detail?.path) {
      await sidebarManager.loadFolder(e.detail.path);
      welcomeTab.addRecentProject(e.detail.path);
    }
  });

  window.addEventListener('kraga:open-folder-dialog', async () => {
    const folder = await window.kragaAPI.fs.openFolder();
    if (folder) {
      await sidebarManager.loadFolder(folder);
      welcomeTab.addRecentProject(folder);
    }
  });

  // 9c. Antigravity & Claude Tarzı Canlı Script ve Kod Çalışma Alanı (Live Artifact Workspace)
  const liveScriptWorkspace = new LiveScriptWorkspaceManager('liveScriptWorkspace');

  editorManager.onLiveScriptTabClose = () => {
    liveScriptWorkspace.close();
  };

  editorManager.onLiveScriptTabSelect = () => {
    liveScriptWorkspace.layout();
  };

  window.addEventListener('kraga:close-live-script', () => {
    liveScriptWorkspace.close();
    editorManager.closeLiveScriptTab();
  });

  agentManager.onLiveScriptStart = async (fileName, language, initialCode) => {
    const cleanName = (fileName || '').trim().replace(/[/\\]+$/, '');
    if (!cleanName || cleanName.endsWith('/') || cleanName.endsWith('\\')) return;

    // Ayrı ve kafa karıştıran hayalet "● ⚡ Canlı:" sekmesi açmak yerine, doğrudan gerçek dosyayı Monaco'da aç
    try { editorManager.closeLiveScriptTab(); } catch {}
    try { liveScriptWorkspace.close(); } catch {}

    await editorManager.openSnippet(cleanName, initialCode, language);
  };

  agentManager.onLiveScriptChunk = (code) => {
    const active = editorManager.getActiveTab();
    if (active && active.model) {
      const currentVal = active.model.getValue();
      if (currentVal !== code) {
        active.model.setValue(code);
      }
    }
  };

  agentManager.onLiveScriptFinish = async (finalCode) => {
    const active = editorManager.getActiveTab();
    if (active && active.model && finalCode) {
      active.model.setValue(finalCode);
    }
  };

  liveScriptWorkspace.onStateChange = (isOpen) => {
    if (!isOpen) {
      editorManager.closeLiveScriptTab();
    }
  };

  // 9d. Antigravity Uygulama Planı Çalışma Alanı (Plan Workspace Panel)
  const planWorkspace = new PlanWorkspaceManager('planWorkspaceView');

  agentManager.onOpenPlanWorkspace = (planData, onApproveCallback) => {
    editorManager.openPlanTab(planData.title || 'Uygulama Planı');
    planWorkspace.openPlan({
      planData,
      onApprove: () => {
        if (onApproveCallback) {
          onApproveCallback();
        } else {
          agentManager.approvePlanAndExecute(planData);
        }
        planWorkspace.setApproved();
      },
      onOpenInEditor: async (title, markdown) => {
        await editorManager.openSnippet(`${title}.md`, markdown, 'markdown');
      },
      onClose: () => {
        editorManager.closePlanTab();
      },
    });
  };

  planWorkspace.onStateChange = (isOpen) => {
    if (!isOpen) {
      editorManager.closePlanTab();
    }
  };

  editorManager.onPlanTabStateChange = (active) => {
    if (active) {
      planWorkspace.show();
    } else {
      planWorkspace.hide();
    }
  };

  // 9e. Antigravity Sohbet Oturumları ve Geçmiş Çalışma Alanı (Session Workspace Panel)
  const sessionWorkspace = new SessionWorkspaceManager('sessionWorkspaceView', agentManager.getChatHistory());

  const openSessionWorkspaceHandler = () => {
    editorManager.openSessionTab();
    sessionWorkspace.open({
      onSelectSession: (id) => {
        agentManager.loadSessionById(id);
        editorManager.closeSessionTab();
      },
      onDeleteSession: (id) => {
        agentManager.deleteSessionById(id);
      },
      onNewSession: () => {
        agentManager.startNewSession();
        editorManager.closeSessionTab();
      },
      onClose: () => {
        editorManager.closeSessionTab();
      },
    });
  };

  agentManager.onOpenSessionWorkspace = openSessionWorkspaceHandler;

  sessionWorkspace.onStateChange = (isOpen) => {
    if (!isOpen) {
      editorManager.closeSessionTab();
    }
  };

  editorManager.onSessionTabStateChange = (active) => {
    if (active) {
      openSessionWorkspaceHandler();
    } else {
      sessionWorkspace.close();
    }
  };

  // 9f. Antigravity Canlı Önizleme Çalışma Alanı (Preview Workspace Panel)
  const previewWorkspace = new PreviewWorkspaceManager('previewWorkspaceView');

  const openPreviewHandler = (filePath?: string, fileContent?: string, title?: string) => {
    const cleanTitle = title || (filePath ? filePath.split(/[/\\]/).pop() : 'Canlı Önizleme');
    editorManager.openPreviewTab(cleanTitle);
    previewWorkspace.openPreview({
      filePath,
      fileContent,
      title: cleanTitle,
      onClose: () => {
        editorManager.closePreviewTab();
      },
    });
  };

  previewWorkspace.onStateChange = (isOpen) => {
    if (!isOpen) {
      editorManager.closePreviewTab();
    }
  };

  editorManager.onPreviewTabStateChange = (active) => {
    if (active) {
      previewWorkspace.show();
    } else {
      previewWorkspace.hide();
    }
  };

  agentManager.onOpenPreview = (filePath, content, title) => {
    previewModal.open({ filePath, fileContent: content, title });
  };

  // 9g. Antigravity & Cursor "Agent Edits Review & Commit" Çalışma Alanı
  const reviewWorkspace = new ReviewWorkspaceManager('reviewWorkspaceView');

  agentManager.onOpenReview = (turnData: TurnReviewData) => {
    editorManager.openReviewTab('Değişiklikleri İncele (Review)');
    reviewWorkspace.openReview(turnData);
  };

  reviewWorkspace.onClose = () => {
    editorManager.closeReviewTab();
  };

  editorManager.onReviewTabStateChange = (active) => {
    if (active) {
      reviewWorkspace.show();
    } else {
      reviewWorkspace.hide();
    }
  };

  reviewWorkspace.onCommit = async (commitMessage: string) => {
    try {
      const curFolder = sidebarManager.getCurrentPath() || undefined;
      outputPanel.append('git', `Commit yapılıyor: "${commitMessage}"...`, 'info');

      // Git add -A ve commit
      const resAdd = await window.kragaAPI.terminal.runCommand('git add -A', curFolder);
      if (resAdd.stderr && !resAdd.stdout) {
        console.warn('git add uyarısı:', resAdd.stderr);
      }

      const safeMsg = commitMessage.replace(/"/g, '\\"');
      const resCommit = await window.kragaAPI.terminal.runCommand(`git commit -m "${safeMsg}"`, curFolder);

      outputPanel.append('git', resCommit.stdout || resCommit.stderr || 'Commit tamamlandı.', 'success');
      const curWs = sidebarManager.getCurrentPath();
      if (curWs) sidebarManager.loadFolder(curWs).catch(() => {});
      notificationManager.notifyResponseCompletion(`Git Commit Yapıldı: ${commitMessage}`).catch(() => {});
      editorManager.closeReviewTab();
    } catch (err: any) {
      outputPanel.append('git', `Commit hatası: ${err.message || String(err)}`, 'error');
      alert(`Git commit başarısız: ${err.message || String(err)}`);
    }
  };

  reviewWorkspace.onAcceptAll = async () => {
    editorManager.closeReviewTab();
    const curWs = sidebarManager.getCurrentPath();
    if (curWs) sidebarManager.loadFolder(curWs).catch(() => {});
  };

  reviewWorkspace.onRevertAll = async (files) => {
    if (!confirm(`${files.length} dosyadaki değişiklikler geri alınacak. Emin misiniz?`)) return;
    try {
      for (const file of files) {
        if (file.originalContent) {
          await window.kragaAPI.fs.writeFile(file.filePath, file.originalContent);
        } else {
          await window.kragaAPI.fs.writeFile(file.filePath, '');
        }
      }
      editorManager.closeReviewTab();
      const curWs = sidebarManager.getCurrentPath();
      if (curWs) sidebarManager.loadFolder(curWs).catch(() => {});
      alert('Tüm değişiklikler başarıyla geri alındı.');
    } catch (err: any) {
      alert(`Geri alma hatası: ${err.message || String(err)}`);
    }
  };

  // 9h. Graphify İnteraktif Kod Bilgi Grafı (Cytoscape Ağacı)
  const graphifyPanel = new GraphifyPanel('graphifyReportView', async (targetFile) => {
    await editorManager.openFile(targetFile);
  });

  quickOpen.setFileProvider(async () => {
    const current = sidebarManager.getCurrentPath();
    if (!current) return [];
    try {
      const flatList: string[] = [];
      const traverse = (items: any[]) => {
        for (const item of items) {
          if (!item.isDirectory) {
            flatList.push(item.path);
          } else if (item.children) {
            traverse(item.children);
          }
        }
      };
      const items = await window.kragaAPI.fs.readDirectory(current);
      traverse(items);
      return flatList;
    } catch {
      return [];
    }
  });

  // 10. Hoş Geldiniz (Welcome) Sekmesi Yöneticisi
  const welcomeViewEl = document.getElementById('welcomeView')!;
  const welcomeActions = {
    // 1. Yeni Dosya Oluştur
    onNewFile: async () => {
      const fileName = prompt('Yeni dosya adı (Örnek: index.ts, app.py, style.css):', 'untitled.ts');
      if (!fileName || !fileName.trim()) return;
      const cleanName = fileName.trim();
      const currentFolder = sidebarManager.getCurrentPath();
      let targetPath: string;
      if (currentFolder) {
        const sep = currentFolder.includes('/') ? '/' : '\\';
        targetPath = `${currentFolder}${sep}${cleanName}`;
      } else {
        targetPath = cleanName;
      }
      await window.kragaAPI.fs.writeFile(targetPath, '');
      if (currentFolder) {
        await sidebarManager.loadFolder(currentFolder);
      }
      await editorManager.openFile(targetPath);
    },

    // 2. Proje Klasörü Aç
    onOpenFolder: async () => {
      const folder = await window.kragaAPI.fs.openFolder();
      if (folder) {
        await sidebarManager.loadFolder(folder);
        welcomeTab.addRecentProject(folder);
      }
    },

    // 3. Git Reposu Klonla
    onCloneGit: async () => {
      const repoUrl = prompt('Klonlanacak Git Deposu URL\'si (Örnek: https://github.com/kullanici/proje.git):');
      if (!repoUrl || !repoUrl.trim()) return;
      const cleanUrl = repoUrl.trim();

      // Deponun indirileceği hedef dizini seçtir
      const parentDir = await window.kragaAPI.fs.openFolder();
      if (!parentDir) return;

      // Klonlanacak klasör adını regex ile ayıkla
      const repoMatch = cleanUrl.match(/\/([^\/]+?)(\.git)?$/);
      const repoName = repoMatch ? repoMatch[1].replace(/\.git$/, '') : 'cloned-repo';
      const sep = parentDir.includes('/') ? '/' : '\\';
      const destPath = `${parentDir}${sep}${repoName}`;

      // Terminal panelini görünür yap ve oturum başlat
      const bottomPanel = document.getElementById('bottomPanel');
      if (bottomPanel) {
        bottomPanel.style.display = 'flex';
      }
      const termTabBtn = document.querySelector('[data-target="terminalTab"]') as HTMLElement;
      termTabBtn?.click();

      await terminalManager.startSession(parentDir);
      terminalManager.write(`git clone ${cleanUrl}\r\n`);
      terminalManager.fit();

      // Arka planda klonlama işlemini runCommand ile takip et ve klasörü otomatik aç
      try {
        const result = await window.kragaAPI.terminal.runCommand(`git clone ${cleanUrl}`, parentDir);
        if (result.exitCode === 0) {
          await sidebarManager.loadFolder(destPath);
          welcomeTab.addRecentProject(destPath);
        } else if (result.stderr) {
          console.warn('[Git Clone] Hata/Uyarı:', result.stderr);
        }
      } catch (err) {
        console.warn('[Git Clone] Hata:', err);
      }
    },

    // 4. Open Crow Agent ile Başla
    onStartAgent: (promptHint?: string) => {
      const input = document.getElementById('agentPromptInput') as HTMLTextAreaElement;
      if (input) {
        input.value = promptHint || 'Bana bu projeyi incele ve mimarisini açıkla.';
        input.focus();
      }
      const agentPanel = document.getElementById('agentPanel');
      if (agentPanel) {
        agentPanel.style.transition = 'box-shadow 0.3s ease';
        agentPanel.style.boxShadow = 'inset 0 0 15px rgba(0, 240, 255, 0.4)';
        setTimeout(() => { agentPanel.style.boxShadow = ''; }, 1000);
      }
    },

    // 5. Graphify AST Analizi
    onScanGraphify: async () => {
      let projectPath = sidebarManager.getCurrentPath();
      if (!projectPath) {
        const pickFolder = confirm('Graphify analizi için bir proje klasörü açılmalıdır. Şimdi bir klasör seçmek ister misiniz?');
        if (pickFolder) {
          const folder = await window.kragaAPI.fs.openFolder();
          if (folder) {
            await sidebarManager.loadFolder(folder);
            welcomeTab.addRecentProject(folder);
            projectPath = folder;
          } else {
            return;
          }
        } else {
          return;
        }
      }

      const bottomPanel = document.getElementById('bottomPanel');
      if (bottomPanel) {
        bottomPanel.style.display = 'flex';
      }
      const graphTabBtn = document.querySelector('[data-target="graphifyTab"]') as HTMLElement;
      graphTabBtn?.click();
      document.getElementById('btnGraphifyScan')?.click();
    },

    // 6. Son Projeyi Aç
    onOpenRecent: async (folderPath: string) => {
      await sidebarManager.loadFolder(folderPath);
      welcomeTab.addRecentProject(folderPath);
    },

    // 7. Script & Görev Panelini Aç
    onOpenScripts: () => {
      editorManager.openScriptTab();
    },

    // 8. Hoş Geldiniz Sekmesini Kapat
    onClose: () => {
      editorManager.closeWelcomeTab();
    }
  };

  const welcomeTab = new WelcomeTabManager(welcomeViewEl, welcomeActions);
  welcomeTab.render();

  // Monaco ve Düzenleme Yardımcıları
  const handleUndo = () => {
    const activeEditor = (editorManager as any).editor;
    if (activeEditor && typeof activeEditor.trigger === 'function') {
      activeEditor.trigger('keyboard', 'undo', null);
    } else {
      document.execCommand('undo');
    }
  };

  const handleRedo = () => {
    const activeEditor = (editorManager as any).editor;
    if (activeEditor && typeof activeEditor.trigger === 'function') {
      activeEditor.trigger('keyboard', 'redo', null);
    } else {
      document.execCommand('redo');
    }
  };

  const handleFind = () => {
    const activeEditor = (editorManager as any).editor;
    if (activeEditor && typeof activeEditor.getAction === 'function') {
      activeEditor.getAction('actions.find')?.run();
    }
  };

  const handleCut = () => document.execCommand('cut');
  const handleCopy = () => document.execCommand('copy');
  const handlePaste = () => {
    navigator.clipboard?.readText().then(text => {
      const activeEditor = (editorManager as any).editor;
      if (activeEditor && typeof activeEditor.trigger === 'function') {
        activeEditor.trigger('keyboard', 'type', { text });
      } else {
        document.execCommand('paste');
      }
    }).catch(() => {
      document.execCommand('paste');
    });
  };

  // 11. Masaüstü Uygulama Menüsü (File, Edit, View...)
  const appMenuBarMount = document.getElementById('appMenuBarMount')!;
  const appMenuBar = new AppMenuBarManager(appMenuBarMount);
  appMenuBar.registerMenus([
    {
      id: 'file',
      label: 'Dosya',
      items: [
        { label: 'Yeni Dosya...', shortcut: 'Ctrl+N', action: () => welcomeActions.onNewFile() },
        { label: 'Klasör Aç...', shortcut: 'Ctrl+O', action: () => welcomeActions.onOpenFolder() },
        { label: 'Git Reposu Klonla...', shortcut: 'Ctrl+Shift+G', action: () => welcomeActions.onCloneGit() },
        { separator: true, label: '' },
        { label: 'Dosyayı Kaydet', shortcut: 'Ctrl+S', action: () => editorManager.saveActiveFile() },
        { label: 'Tümünü Kaydet', shortcut: 'Ctrl+Alt+S', action: () => editorManager.saveAllFiles() },
        { label: 'Sekmeyi Kapat', shortcut: 'Ctrl+W', action: () => editorManager.closeActiveTab() },
        { separator: true, label: '' },
        { label: 'Ayarlar ve Tercihler', shortcut: 'Ctrl+,', action: () => settingsModal.open('api') },
        { separator: true, label: '' },
        { label: 'Pencereyi Kapat', shortcut: 'Alt+F4', action: () => window.kragaAPI.app.close() }
      ]
    },
    {
      id: 'edit',
      label: 'Düzen',
      items: [
        { label: 'Geri Al', shortcut: 'Ctrl+Z', action: () => handleUndo() },
        { label: 'Yinele', shortcut: 'Ctrl+Y', action: () => handleRedo() },
        { separator: true, label: '' },
        { label: 'Kes', shortcut: 'Ctrl+X', action: () => handleCut() },
        { label: 'Kopyala', shortcut: 'Ctrl+C', action: () => handleCopy() },
        { label: 'Yapıştır', shortcut: 'Ctrl+V', action: () => handlePaste() },
        { separator: true, label: '' },
        { label: 'Bul ve Değiştir', shortcut: 'Ctrl+F', action: () => handleFind() },
        { label: 'Belgeyi Biçimlendir', shortcut: 'Shift+Alt+F', action: () => editorManager.formatDocument() }
      ]
    },
    {
      id: 'view',
      label: 'Görünüm',
      items: [
        { label: 'Komut Paleti...', shortcut: 'Ctrl+Shift+P', action: () => commandPalette.open() },
        { label: 'Hızlı Dosya Aç...', shortcut: 'Ctrl+P', action: () => quickOpen.open() },
        { separator: true, label: '' },
        { label: 'Dosya Gezgini', shortcut: 'Ctrl+Shift+E', action: () => activityBar.setActivePanel('explorer') },
        { label: 'Projede Arama', shortcut: 'Ctrl+Shift+F', action: () => activityBar.setActivePanel('search') },
        { label: 'Kaynak Kontrolü', shortcut: 'Ctrl+Shift+G', action: () => activityBar.setActivePanel('sourceControl') },
        { label: 'Eklentiler & MCP Hub', shortcut: 'Ctrl+Shift+X', action: () => activityBar.setActivePanel('extensions') },
        { separator: true, label: '' },
        { label: 'Terminali Göster/Gizle', shortcut: 'Ctrl+`', action: () => document.getElementById('btnToggleTerminal')?.click() },
        { label: 'Sorunlar & Teşhis Paneli', shortcut: 'Ctrl+Shift+M', action: () => {
          const bottomPanel = document.getElementById('bottomPanel');
          if (bottomPanel) bottomPanel.style.display = 'flex';
          const probBtn = document.querySelector('[data-target="problemsTab"]') as HTMLElement;
          probBtn?.click();
        }},
        { label: 'Zen Modu (Saf Odaklanma)', shortcut: 'F10', action: () => toggleZenMode() },
        { label: 'Agent Panelini Göster/Gizle', action: () => {
          const agentP = document.getElementById('agentPanel');
          if (agentP) agentP.style.display = agentP.style.display === 'none' ? 'flex' : 'none';
        }},
        { label: 'Tam Ekran', shortcut: 'F11', action: () => window.kragaAPI.app.maximize() }
      ]
    },
    {
      id: 'terminal',
      label: 'Terminal',
      items: [
        { label: 'Yeni Terminal Oturumu', shortcut: 'Ctrl+Shift+`', action: () => terminalManager.createTerminalSession() },
        { label: 'Terminali Katla / Aç', action: () => document.getElementById('btnToggleTerminal')?.click() },
        { separator: true, label: '' },
        { label: 'Script & Görev Paneli (Tasks)', action: () => editorManager.openScriptTab() }
      ]
    },
    {
      id: 'agent',
      label: 'Agent',
      items: [
        { label: 'Yeni Sohbet Başlat', shortcut: 'Ctrl+Shift+N', action: () => {
          (agentManager as any).startNewSession?.() || document.getElementById('btnNewChat')?.click();
        }},
        { label: 'Sohbet Geçmişi', shortcut: 'Ctrl+H', action: () => {
          (agentManager as any).toggleHistorySidebar?.() || document.getElementById('btnChatHistory')?.click();
        }},
        { separator: true, label: '' },
        { label: 'Act Modu (Doğrudan Kod Yaz)', action: () => {
          const actBtn = document.querySelector('[data-mode="act"]') as HTMLElement;
          actBtn?.click();
        }},
        { label: 'Plan Modu (Adım Adım Tasarım)', action: () => {
          const planBtn = document.querySelector('[data-mode="plan"]') as HTMLElement;
          planBtn?.click();
        }},
        { separator: true, label: '' },
        { label: 'Bağlamı Özetle (/compact)', action: () => {
          (agentManager as any).compactConversation?.(true);
        }},
        { label: 'Token ve Maliyet Kullanımı', action: () => settingsModal.open('usage') }
      ]
    },
    {
      id: 'help',
      label: 'Yardım',
      items: [
        { label: 'Hoş Geldiniz Ekranı', action: () => editorManager.openWelcomeTab() },
        { label: 'Klavye Kısayolları Rehberi', shortcut: 'Ctrl+K Ctrl+S', action: () => shortcutsModal.open() },
        { label: 'Komut Paleti...', shortcut: 'Ctrl+Shift+P', action: () => commandPalette.open() },
        { separator: true, label: '' },
        { label: 'Graphify Bilgi Grafiği Analizi', action: () => document.getElementById('btnGraphifyScan')?.click() },
        { label: 'Script & Görev Paneli (Tasks)', action: () => editorManager.openScriptTab() },
        { separator: true, label: '' },
        { label: 'GitHub Sürümleri & İndirmeler', action: () => openExternalUrl('https://github.com/mehmetkraga/KRAGA-AI-IDE-RELEASES') },
        { label: 'Sorun & Hata Bildir (GitHub Issues)', action: () => openExternalUrl('https://github.com/mehmetkraga/KRAGA-AI-IDE/issues') },
        { separator: true, label: '' },
        { label: 'Güncellemeleri Denetle...', action: () => settingsModal.open('updates') },
        { label: 'Open Crow Hakkında', shortcut: 'F1', action: () => settingsModal.open('about') }
      ]
    }
  ]);

  // 12. Başlık Çubuğu Merkez Hızlı Arama Butonu (Ctrl+P)
  const searchPill = document.getElementById('titlebarCenterSearch');
  searchPill?.addEventListener('click', () => {
    quickOpen.open();
  });

  // Global Klavye Kısayolları
  window.addEventListener('keydown', async (e) => {
    // F1: Open Crow Hakkında
    if (e.key === 'F1') {
      e.preventDefault();
      settingsModal.open('about');
      return;
    }

    // Ctrl+Shift+? / Ctrl+? : Klavye Kısayolları
    if ((e.ctrlKey || e.metaKey) && (e.key === '?' || (e.shiftKey && e.key === '/'))) {
      e.preventDefault();
      shortcutsModal.open();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
      e.preventDefault();
      const fileName = prompt('Yeni dosya adı:', 'untitled.ts');
      if (fileName) {
        let fullPath = fileName;
        const targetFolder = sidebarManager.getCurrentPath();
        if (targetFolder && !fileName.includes(':') && !fileName.startsWith('/') && !fileName.startsWith('\\')) {
          const sep = targetFolder.includes('/') ? '/' : '\\';
          fullPath = `${targetFolder}${sep}${fileName}`;
        }
        await window.kragaAPI.fs.writeFile(fullPath, '');
        if (targetFolder) await sidebarManager.loadFolder(targetFolder);
        await editorManager.openFile(fullPath);
      }
    }
  });

  // 13. Activity Bar (Sol Dikey İkon Şeridi)
  const activityBarContainer = (document.getElementById('activityBar') || document.getElementById('activityBarContainer')) as HTMLElement;
  const activityBar = new ActivityBarManager(activityBarContainer);
  activityBar.onPanelChange = (panelId, isSamePanel) => {
    const sidebarEl = document.getElementById('sidebarContainer');
    if (!sidebarEl) return;

    if (panelId === 'settings') {
      settingsModal.open('api');
    } else {
      const isCurrentlyVisible = sidebarEl.style.display !== 'none';
      if (isSamePanel && isCurrentlyVisible) {
        sidebarEl.style.display = 'none';
      } else {
        sidebarEl.style.display = 'flex';
        sidebarManager.switchView(panelId as any);
      }
      editorManager.layout();
    }
  };

  // 14. Sürüklenebilir Panel Ayırıcıları (Splitters)
  const splitterManager = new SplitterManager();
  const sidebarEl = document.getElementById('sidebarContainer')!;
  const centerEl = document.getElementById('centerPanel')!;
  const agentEl = document.getElementById('agentPanel')!;
  const editorViewportEl = document.getElementById('editorViewport') || document.getElementById('monacoEditorContainer')!;
  const bottomEl = document.getElementById('bottomPanel')!;

  const splitterSidebarEl = document.getElementById('splitterSidebar')!;
  splitterManager.createSplitter({
    direction: 'horizontal',
    element: splitterSidebarEl,
    prevPanel: sidebarEl,
    nextPanel: centerEl,
    minSize: 180,
    storageKey: 'kraga-splitter-sidebar',
    onResize: () => editorManager.layout()
  });

  const splitterAgentEl = document.getElementById('splitterAgent')!;
  splitterManager.createSplitter({
    direction: 'horizontal',
    element: splitterAgentEl,
    prevPanel: centerEl,
    nextPanel: agentEl,
    minSize: 260,
    storageKey: 'kraga-splitter-agent',
    onResize: () => editorManager.layout()
  });

  const splitterBottomEl = document.getElementById('splitterBottom')!;
  splitterManager.createSplitter({
    direction: 'vertical',
    element: splitterBottomEl,
    prevPanel: editorViewportEl,
    nextPanel: bottomEl,
    minSize: 120,
    storageKey: 'kraga-splitter-bottom',
    onResize: () => {
      terminalManager.fit();
      editorManager.layout();
    }
  });

  splitterManager.restoreAll();

  // Pencere boyut değişimi (Fluid Window Resize) Dinleyicisi
  window.addEventListener('resize', () => {
    editorManager.layout();
    terminalManager.fit();
  });

  // 15. Tema Yöneticisi & Senkronizasyon
  const themeManager = new ThemeManager('brandLogoImg', 'themeSelector');
  themeManager.onThemeChange = (themeId) => {
    editorManager.setTheme(themeId);
    terminalManager.setTheme(themeId);
  };
  editorManager.setTheme(themeManager.getCurrentTheme().id);
  terminalManager.setTheme(themeManager.getCurrentTheme().id);

  // 16. Topbar Bakiye & Telemetri Çipleri
  const tokenTracker = TokenTracker.getInstance();
  const balanceValEl = document.getElementById('topbarBalanceVal');
  const tokenValEl = document.getElementById('topbarTokenVal');
  const balanceIconEl = document.getElementById('topbarBalanceIcon');
  const balanceChip = document.getElementById('topbarBalanceChip');

  balanceChip?.addEventListener('click', () => {
    settingsModal.open('usage');
  });

  // Model Bağlam Çubuğu (Agent Paneli Başlığı İçi)
  const agentContextBarEl = document.getElementById('agentContextBar');
  const agentContextFillEl = document.getElementById('agentContextFill');
  const agentContextTextEl = document.getElementById('agentContextText');
  if (agentContextBarEl) {
    new ContextPopoverManager(agentContextBarEl);
  }

  const tokenChipEl = document.getElementById('topbarTokenChip');

  const updateTelemetry = (state: ReturnType<typeof tokenTracker.getState>) => {
    if (balanceValEl) balanceValEl.textContent = tokenTracker.getFormattedBalance();
    if (tokenValEl) tokenValEl.textContent = tokenTracker.getFormattedTokens();

    if (tokenChipEl) {
      const isEst = tokenTracker.isEstimated();
      tokenChipEl.title = isEst
        ? `Kullanılan Token: ~${state.totalTokensUsed.toLocaleString()} (Tahmini - Harici Sağlayıcı)`
        : `Kullanılan Token: ${state.totalTokensUsed.toLocaleString()} (Sağlayıcı Bildirimi)`;
    }

    // Dolar simgesi: Sadece dolarlı promo kodlarda ($ costLimit > 0) aktif et
    if (balanceIconEl) {
      if (tokenTracker.isDollarPromo()) {
        balanceIconEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
      } else {
        balanceIconEl.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
      }
    }

    const ctxPct = tokenTracker.getContextPercentage();
    if (agentContextFillEl) agentContextFillEl.style.width = `${ctxPct.toFixed(0)}%`;
    if (agentContextTextEl) agentContextTextEl.textContent = `${ctxPct.toFixed(0)}% / ${Math.round(state.currentContextLimit / 1000)}K`;
  };

  tokenTracker.on('update', (state) => {
    updateTelemetry(state);
  });
  updateTelemetry(tokenTracker.getState());

  // Kendi API adresi tanımlıysa model listesini çek; kullanıcı zaten bir model seçmişse ezme
  const syncProviderModels = async () => {
    let configured = false;
    try {
      const saved = localStorage.getItem('kraga-ide-settings');
      const parsed = saved ? JSON.parse(saved) : null;
      configured = parsed?.mode === 'custom' && Boolean(parsed.baseUrl);
    } catch {}
    if (!configured) {
      resetActiveModels();
      return;
    }

    try {
      const fetched = await fetchAvailableModels();
      if (fetched && fetched.length > 0) {
        const registered = registerPromoModels(fetched);
        const effectiveModel = modelSelector.getSelectedModel() || localStorage.getItem('kraga:model');
        if (!effectiveModel) {
          const cheapest = getCheapestModel(registered);
          if (cheapest) {
            modelSelector.setModel(cheapest.id);
            agentManager.setModel(cheapest.id);
          }
        }
      }
    } catch (err) {
      console.warn('[main] Modeller otomatik senkronize edilemedi:', err);
    }
  };

  window.addEventListener('kraga:settings-changed', () => {
    syncProviderModels();
  });

  setTimeout(() => {
    syncProviderModels();
  }, 1200);

  // 17. Komut Paleti Aksiyon Bağlantıları
  commandPalette.updateAction('settings.open', () => settingsModal.open('api'));
  commandPalette.updateAction('file.openFolder', async () => {
    const folder = await window.kragaAPI.fs.openFolder();
    if (folder) {
      await sidebarManager.loadFolder(folder);
      welcomeTab.addRecentProject(folder);
    }
  });
  commandPalette.updateAction('terminal.new', () => terminalManager.createTerminalSession());
  commandPalette.updateAction('theme.change', () => settingsModal.open('general'));
  commandPalette.updateAction('view.toggleSidebar', () => {
    const sb = document.getElementById('sidebarContainer');
    if (sb) {
      sb.style.display = sb.style.display === 'none' ? 'flex' : 'none';
      editorManager.layout();
    }
  });
  commandPalette.updateAction('view.toggleTerminal', () => {
    const bp = document.getElementById('bottomPanel');
    if (bp) bp.style.display = bp.style.display === 'none' ? 'flex' : 'none';
  });
  commandPalette.updateAction('graphify.scan', () => {
    document.getElementById('btnGraphifyScan')?.click();
  });
  commandPalette.registerCommand({
    id: 'tasks.openScripts',
    label: 'Script & Görev Panelini Aç',
    category: 'Görevler',
    action: () => editorManager.openScriptTab(),
  });
  commandPalette.registerCommand({
    id: 'view.toggleZenMode',
    label: 'Görünüm: Zen Modunu Aç / Kapat (Saf Odaklanma)',
    category: 'Görünüm',
    keybinding: 'F10',
    action: () => toggleZenMode(),
  });
  commandPalette.registerCommand({
    id: 'workbench.actions.view.problems',
    label: 'Görünüm: Sorunlar & Teşhis Paneli (Problems)',
    category: 'Görünüm',
    keybinding: 'Ctrl+Shift+M',
    action: () => {
      const bottomPanel = document.getElementById('bottomPanel');
      if (bottomPanel) bottomPanel.style.display = 'flex';
      const probBtn = document.querySelector('[data-target="problemsTab"]') as HTMLElement;
      probBtn?.click();
    },
  });
  commandPalette.registerCommand({
    id: 'workbench.actions.view.output',
    label: 'Görünüm: Çıktı Konsolunu Aç (Output)',
    category: 'Görünüm',
    keybinding: 'Ctrl+Shift+U',
    action: () => {
      const bottomPanel = document.getElementById('bottomPanel');
      if (bottomPanel) bottomPanel.style.display = 'flex';
      const outputBtn = document.querySelector('[data-target="outputTab"]') as HTMLElement;
      outputBtn?.click();
    },
  });

  // 18. Alt Panel Sekmeleri (Terminal, Çıktı, Sorunlar & Graphify)
  const bottomTabs = document.querySelectorAll('.bottom-tab');
  bottomTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      bottomTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const targetId = tab.getAttribute('data-target');
      document.querySelectorAll('.tab-content').forEach((content) => {
        content.classList.remove('active');
      });
      if (targetId) {
        document.getElementById(targetId)?.classList.add('active');
        if (targetId === 'terminalTab') {
          terminalManager.fit();
        } else if (targetId === 'outputTab') {
          outputPanel?.scrollToBottom();
        } else if (targetId === 'graphifyTab') {
          const currentPath = sidebarManager.getCurrentPath();
          graphifyPanel.setProjectPath(currentPath || null);
          graphifyPanel.loadAndRender(currentPath || undefined);
          setTimeout(() => graphifyPanel.resize(), 50);
        }
      }
    });
  });

  // 19. Graphify Tarama Butonu
  const btnGraphify = document.getElementById('btnGraphifyScan');
  btnGraphify?.addEventListener('click', async () => {
    const projectPath = sidebarManager.getCurrentPath();
    if (!projectPath) {
      alert('Lütfen önce bir proje klasörü açın.');
      return;
    }

    const bottomPanel = document.getElementById('bottomPanel');
    if (bottomPanel && bottomPanel.style.display === 'none') {
      bottomPanel.style.display = 'flex';
    }

    const graphTabBtn = document.querySelector('[data-target="graphifyTab"]') as HTMLElement;
    graphTabBtn?.click();

    await graphifyPanel.loadAndRender(projectPath);
  });

  // Terminal toggle butonu
  document.getElementById('btnToggleTerminal')?.addEventListener('click', () => {
    const bottomPanel = document.getElementById('bottomPanel');
    if (bottomPanel) {
      const isHidden = bottomPanel.style.display === 'none';
      bottomPanel.style.display = isHidden ? 'flex' : 'none';
      if (isHidden) terminalManager.fit();
    }
  });

  // 20. Global Klavye Kısayolları (Ctrl+`, Ctrl+B, Ctrl+O, Ctrl+,, Ctrl+Shift+F, Ctrl+S, F10, Ctrl+K Z)
  let ctrlKChordPending = false;
  let ctrlKChordTimeout: any = null;

  window.addEventListener('keydown', (e) => {
    // Esc: Zen modundan çık (eğer açıksa)
    if (e.key === 'Escape' && document.body.classList.contains('zen-mode')) {
      e.preventDefault();
      toggleZenMode();
      return;
    }

    // F10: Zen Modunu aç / kapat
    if (e.key === 'F10') {
      e.preventDefault();
      toggleZenMode();
      return;
    }

    // F11: Pencereyi Büyüt / Geri Boyutlandır (Sağ üstteki buton ile birebir senkronize)
    if (e.key === 'F11') {
      e.preventDefault();
      window.kragaAPI.app.maximize();
      return;
    }

    // Ctrl+K Z Chordi: Zen modu
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !e.shiftKey && !e.altKey) {
      ctrlKChordPending = true;
      clearTimeout(ctrlKChordTimeout);
      ctrlKChordTimeout = setTimeout(() => {
        ctrlKChordPending = false;
      }, 1500);
    } else if (ctrlKChordPending && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      ctrlKChordPending = false;
      clearTimeout(ctrlKChordTimeout);
      toggleZenMode();
      return;
    } else if (e.key !== 'Control' && e.key !== 'Meta') {
      ctrlKChordPending = false;
    }

    // Ctrl+Shift+M: Sorunlar & Teşhis Paneli
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      const bottomPanel = document.getElementById('bottomPanel');
      if (bottomPanel) bottomPanel.style.display = 'flex';
      const probBtn = document.querySelector('[data-target="problemsTab"]') as HTMLElement;
      probBtn?.click();
      return;
    }

    // Ctrl+Shift+V: Canlı Önizleme (Web / HTML / Markdown / PDF)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      const activeTab = editorManager.getActiveTab();
      if (activeTab) {
        const content = activeTab.model.getValue();
        openPreviewHandler(activeTab.path, content, activeTab.name);
      } else {
        openPreviewHandler(undefined, undefined, 'Canlı Önizleme');
      }
      return;
    }

    // Ctrl+` veya Ctrl+~: Terminal aç/kapa veya Yeni Terminal
    if ((e.ctrlKey || e.metaKey) && (e.key === '`' || e.key === '~' || e.code === 'Backquote')) {
      e.preventDefault();
      if (e.shiftKey) {
        terminalManager.createTerminalSession();
      } else {
        const bottomPanel = document.getElementById('bottomPanel');
        if (bottomPanel) {
          const isHidden = bottomPanel.style.display === 'none';
          bottomPanel.style.display = isHidden ? 'flex' : 'none';
          if (isHidden) terminalManager.fit();
        }
      }
      return;
    }

    // Ctrl+B: Kenar çubuğunu aç/kapa
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !e.shiftKey) {
      e.preventDefault();
      const sb = document.getElementById('sidebarContainer');
      if (sb) {
        sb.style.display = sb.style.display === 'none' ? 'flex' : 'none';
        editorManager.layout();
      }
      return;
    }

    // Ctrl+O: Klasör Aç
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('btnOpenFolder')?.click();
      return;
    }

    // Ctrl+,: Ayarlar
    if ((e.ctrlKey || e.metaKey) && e.key === ',' && !e.shiftKey) {
      e.preventDefault();
      settingsModal.open('api');
      return;
    }

    // Ctrl+Shift+F: Arama Paneli
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      activityBar.setActivePanel('search');
      return;
    }

    // Ctrl+S: Dosya Kaydet
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      editorManager.saveActiveFile();
      return;
    }

    // Ctrl+Alt+S: Tüm Dosyaları Kaydet
    if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      editorManager.saveAllFiles();
      return;
    }

    // Ctrl+W: Sekmeyi Kapat
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w' && !e.shiftKey) {
      e.preventDefault();
      editorManager.closeActiveTab();
      return;
    }

    // Shift+Alt+F: Belgeyi Biçimlendir
    if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      editorManager.formatDocument();
      return;
    }
  });
});
