// src/components/Editor.ts
// Kraga IDE v2.0 Monaco Editör Yöneticisi (7 Tema, Çoklu Sekme, Status Bar Köprüsü)

import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { iconClose, kragaBirdImg, iconTerminal } from './icons';
import { InlineEditBar } from './InlineEditBar';
import { CodeDiagnosticsEngine } from './CodeDiagnosticsEngine';
import { spreadsheetWorkspace } from './SpreadsheetWorkspace';

// Monaco Web Worker ayarları
(self as any).MonacoEnvironment = {
  getWorker(_: any, label: string) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

export interface EditorTab {
  path: string;
  name: string;
  model: monaco.editor.ITextModel;
  isDirty: boolean;
  isPinned?: boolean;
}

export class EditorManager {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private tabs: EditorTab[] = [];
  private activeTab: EditorTab | null = null;
  private tabsContainer: HTMLElement;
  private editorContainer: HTMLElement;
  private welcomeContainer: HTMLElement | null = null;
  private scriptContainer: HTMLElement | null = null;
  private planContainer: HTMLElement | null = null;
  private sessionContainer: HTMLElement | null = null;
  private liveScriptContainer: HTMLElement | null = null;
  private previewContainer: HTMLElement | null = null;
  private reviewContainer: HTMLElement | null = null;
  private isWelcomeActive: boolean = true;
  private showWelcomeTab: boolean = true;
  private isScriptActive: boolean = false;
  private showScriptTab: boolean = false;
  private isPlanActive: boolean = false;
  private showPlanTab: boolean = false;
  private isSessionActive: boolean = false;
  private showSessionTab: boolean = false;
  private isLiveScriptActive: boolean = false;
  private showLiveScriptTab: boolean = false;
  private isPreviewActive: boolean = false;
  private showPreviewTab: boolean = false;
  private isReviewActive: boolean = false;
  private showReviewTab: boolean = false;
  private reviewTitle: string = 'Değişiklikleri İncele (Review)';
  private previewTitle: string = 'Canlı Önizleme';
  private spreadsheetContainer: HTMLElement | null = null;
  private isSpreadsheetActive: boolean = false;
  private showSpreadsheetTab: boolean = false;
  private spreadsheetFilePath: string = '';
  private liveScriptTitle: string = 'Canlı Kod';
  private isLiveScriptStreaming: boolean = false;
  private planTitle: string = 'Uygulama Planı';
  private emptyStateContainer: HTMLElement | null = null;

  public onCursorChange?: (line: number, col: number) => void;
  public onLanguageChange?: (lang: string) => void;
  public onWelcomeTabStateChange?: (active: boolean) => void;
  public onScriptTabStateChange?: (active: boolean) => void;
  public onPlanTabStateChange?: (active: boolean) => void;
  public onSessionTabStateChange?: (active: boolean) => void;
  public onLiveScriptTabStateChange?: (active: boolean) => void;
  public onPreviewTabStateChange?: (active: boolean) => void;
  public onReviewTabStateChange?: (active: boolean) => void;
  public onLiveScriptTabSelect?: () => void;
  public onLiveScriptTabClose?: () => void;
  public onMarkersChange?: (errors: number, warnings: number) => void;
  public onBreadcrumbsChange?: (crumbs: { name: string; path: string }[]) => void;
  public onSelectionChange?: (stats: string | null) => void;
  public onAiAction?: (action: 'explain' | 'refactor' | 'test' | 'audit' | 'jsdoc', code: string, filePath?: string) => void;
  public onFileContentChange?: (content: string, filePath: string) => void;
  public onBreakpointsChange?: (filePath: string, lines: number[]) => void;
  public onSplitEditorToggle?: () => void;
  public onActiveFileChange?: (tab: EditorTab | null) => void;

  private tabContextMenuEl: HTMLElement | null = null;
  private contextMenuTargetTab: EditorTab | null = null;
  private originalContents = new Map<string, string>();
  private gutterDecorations: string[] = [];

  // Visual Studio Kesme Noktaları (Breakpoints) Deposu
  private breakpoints = new Map<string, Set<number>>();
  private breakpointDecorations = new Map<string, string[]>();

  // Yakınlaştırma (Zoom) Seviyesi
  private currentZoomPercentage: number = 100;
  private baseFontSize: number = 13;

  constructor(
    tabsContainerId: string,
    editorContainerId: string,
    welcomeContainerId?: string,
    scriptContainerId?: string,
    planContainerId?: string,
    sessionContainerId?: string,
    liveScriptContainerId?: string
  ) {
    this.tabsContainer = document.getElementById(tabsContainerId)!;
    this.editorContainer = document.getElementById(editorContainerId)!;
    this.emptyStateContainer = document.getElementById('editorEmptyState');
    if (welcomeContainerId) {
      this.welcomeContainer = document.getElementById(welcomeContainerId);
    }
    if (scriptContainerId) {
      this.scriptContainer = document.getElementById(scriptContainerId);
    }
    if (planContainerId) {
      this.planContainer = document.getElementById(planContainerId);
    }
    if (sessionContainerId) {
      this.sessionContainer = document.getElementById(sessionContainerId);
    }
    if (liveScriptContainerId) {
      this.liveScriptContainer = document.getElementById(liveScriptContainerId);
    }
    this.previewContainer = document.getElementById('previewWorkspaceView');
    this.reviewContainer = document.getElementById('reviewWorkspaceView');
    this.spreadsheetContainer = document.getElementById('spreadsheetWorkspaceView');
    if (this.spreadsheetContainer) {
      spreadsheetWorkspace.init(this.spreadsheetContainer);
      spreadsheetWorkspace.onDirtyChange = () => {
        this.renderTabs();
      };
    }
    this.registerThemes();
    CodeDiagnosticsEngine.getInstance().configureMonacoDefaults();
    this.initEditor();
    this.initTabContextMenu();

    const showWelcomePref = localStorage.getItem('kraga-show-welcome') !== 'false';
    if (showWelcomePref) {
      this.openWelcomeTab();
    } else {
      this.showWelcomeTab = false;
      this.isWelcomeActive = false;
      if (this.welcomeContainer) this.welcomeContainer.style.display = 'none';
      this.editorContainer.style.display = 'block';
    }
  }

  private registerThemes(): void {
    // 1. Kraga Cyberpunk
    monaco.editor.defineTheme('kraga-cyberpunk', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
        { token: 'keyword', foreground: '00f0ff', fontStyle: 'bold' },
        { token: 'identifier', foreground: 'f1f5f9' },
        { token: 'string', foreground: 'ff2d78' },
        { token: 'number', foreground: 'b44dff' },
      ],
      colors: {
        'editor.background': '#07070e',
        'editor.foreground': '#f1f5f9',
        'editor.lineHighlightBackground': '#121226',
        'editorCursor.foreground': '#00f0ff',
        'editorWhitespace.foreground': '#1f1f3a',
        'editorIndentGuide.background': '#1a1a30',
        'editorIndentGuide.activeBackground': '#00f0ff',
      },
    });

    // Kraga Orijinal (Minimalist Siyah & Beyaz)
    monaco.editor.defineTheme('original-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '727484', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ffffff', fontStyle: 'bold' },
        { token: 'identifier', foreground: 'e6e8ee' },
        { token: 'string', foreground: 'd1d5db' },
        { token: 'number', foreground: 'e2e8f0' },
        { token: 'type', foreground: 'f3f4f6' },
      ],
      colors: {
        'editor.background': '#08080a',
        'editor.foreground': '#f8f8f8',
        'editor.lineHighlightBackground': '#14151a',
        'editorCursor.foreground': '#ffffff',
        'editorWhitespace.foreground': '#262732',
        'editorIndentGuide.background': '#1e1f26',
        'editorIndentGuide.activeBackground': '#ffffff',
      },
    });

    // 2. Dracula
    monaco.editor.defineTheme('dracula', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
        { token: 'identifier', foreground: 'f8f8f2' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
      ],
      colors: {
        'editor.background': '#282a36',
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#44475a50',
        'editorCursor.foreground': '#8be9fd',
        'editorWhitespace.foreground': '#44475a',
        'editorIndentGuide.background': '#44475a',
        'editorIndentGuide.activeBackground': '#bd93f9',
      },
    });

    // 3. Emerald Dark
    monaco.editor.defineTheme('emerald-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4b6354', fontStyle: 'italic' },
        { token: 'keyword', foreground: '10b981', fontStyle: 'bold' },
        { token: 'identifier', foreground: 'ecfdf5' },
        { token: 'string', foreground: '34d399' },
        { token: 'number', foreground: 'f43f5e' },
      ],
      colors: {
        'editor.background': '#020805',
        'editor.foreground': '#ecfdf5',
        'editor.lineHighlightBackground': '#061a12',
        'editorCursor.foreground': '#10b981',
        'editorWhitespace.foreground': '#0e2b1f',
        'editorIndentGuide.background': '#0c241a',
        'editorIndentGuide.activeBackground': '#10b981',
      },
    });

    // 4. Midnight Blue
    monaco.editor.defineTheme('midnight-blue', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '475569', fontStyle: 'italic' },
        { token: 'keyword', foreground: '3b82f6', fontStyle: 'bold' },
        { token: 'identifier', foreground: 'f8fafc' },
        { token: 'string', foreground: '38bdf8' },
        { token: 'number', foreground: 'ec4899' },
      ],
      colors: {
        'editor.background': '#030712',
        'editor.foreground': '#f8fafc',
        'editor.lineHighlightBackground': '#0f172a',
        'editorCursor.foreground': '#3b82f6',
        'editorWhitespace.foreground': '#1e293b',
        'editorIndentGuide.background': '#1e293b',
        'editorIndentGuide.activeBackground': '#3b82f6',
      },
    });

    // 5. Sunset Warm
    monaco.editor.defineTheme('sunset-warm', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '785038', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'f97316', fontStyle: 'bold' },
        { token: 'identifier', foreground: 'fff7ed' },
        { token: 'string', foreground: 'fbbf24' },
        { token: 'number', foreground: 'e11d48' },
      ],
      colors: {
        'editor.background': '#0f0502',
        'editor.foreground': '#fff7ed',
        'editor.lineHighlightBackground': '#220b05',
        'editorCursor.foreground': '#f97316',
        'editorWhitespace.foreground': '#33150b',
        'editorIndentGuide.background': '#2d1209',
        'editorIndentGuide.activeBackground': '#f97316',
      },
    });

    // 6. Synthwave
    monaco.editor.defineTheme('synthwave', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b5675', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff2a6d', fontStyle: 'bold' },
        { token: 'identifier', foreground: 'fdf6ff' },
        { token: 'string', foreground: '00f0ff' },
        { token: 'number', foreground: 'fcee0a' },
      ],
      colors: {
        'editor.background': '#0d0413',
        'editor.foreground': '#fdf6ff',
        'editor.lineHighlightBackground': '#200a2e',
        'editorCursor.foreground': '#ff2a6d',
        'editorWhitespace.foreground': '#35114c',
        'editorIndentGuide.background': '#2b0e3e',
        'editorIndentGuide.activeBackground': '#ff2a6d',
      },
    });

    // 7. Minimal Light
    monaco.editor.defineTheme('minimal-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '94a3b8', fontStyle: 'italic' },
        { token: 'keyword', foreground: '0284c7', fontStyle: 'bold' },
        { token: 'identifier', foreground: '0f172a' },
        { token: 'string', foreground: '16a34a' },
        { token: 'number', foreground: 'd97706' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#0f172a',
        'editor.lineHighlightBackground': '#f1f5f9',
        'editorCursor.foreground': '#0284c7',
        'editorWhitespace.foreground': '#e2e8f0',
        'editorIndentGuide.background': '#e2e8f0',
        'editorIndentGuide.activeBackground': '#0284c7',
      },
    });

    // 8. Visual Studio 2022 Dark
    monaco.editor.defineTheme('vs-2022-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '57a64a', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569cd6' },
        { token: 'identifier', foreground: 'd4d4d4' },
        { token: 'string', foreground: 'd69d85' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'type', foreground: '4ec9b0' },
        { token: 'class', foreground: '4ec9b0' },
        { token: 'interface', foreground: 'b8d7a3' },
        { token: 'function', foreground: 'dcdcaa' },
        { token: 'method', foreground: 'dcdcaa' },
        { token: 'preprocessor', foreground: '9b9b9b' },
        { token: 'delimiter', foreground: 'd4d4d4' },
        { token: 'tag', foreground: '569cd6' },
        { token: 'attribute.name', foreground: '9cdcfe' },
        { token: 'attribute.value', foreground: 'ce9178' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#282828',
        'editorCursor.foreground': '#aeafad',
        'editorWhitespace.foreground': '#3e3e3e',
        'editorIndentGuide.background': '#404040',
        'editorIndentGuide.activeBackground': '#707070',
        'editorGutter.background': '#1e1e1e',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#c6c6c6',
        'editorBracketMatch.background': '#0064001a',
        'editorBracketMatch.border': '#888888',
        'editorOverviewRuler.border': '#7f7f7f4d',
        'editorError.foreground': '#f44747',
        'editorWarning.foreground': '#cca700',
        'editorInfo.foreground': '#75beff',
      },
    });
  }

  private initEditor(): void {
    let initialFontSize = 13;
    let initialTabSize = 2;
    let initialWordWrap: 'on' | 'off' = 'on';
    let initialMinimap = true;
    let initialFontFamily = "'JetBrains Mono', Consolas, monospace";
    let initialLigatures = true;
    let initialLineNumbers: 'on' | 'off' | 'relative' = 'on';

    try {
      const saved = localStorage.getItem('kraga-ide-settings');
      if (saved) {
        const p = JSON.parse(saved);
        if (p.fontSize) initialFontSize = p.fontSize;
        if (p.tabSize) initialTabSize = p.tabSize;
        if (p.wordWrap !== undefined) initialWordWrap = p.wordWrap ? 'on' : 'off';
        if (p.minimap !== undefined) initialMinimap = p.minimap;
        if (p.editorFontFamily) initialFontFamily = p.editorFontFamily;
        if (p.fontLigatures !== undefined) initialLigatures = p.fontLigatures;
        if (p.lineNumbers) initialLineNumbers = p.lineNumbers;
      }
    } catch {}

    this.editor = monaco.editor.create(this.editorContainer, {
      theme: 'original-dark',
      automaticLayout: true,
      fontSize: initialFontSize,
      fontFamily: initialFontFamily,
      fontLigatures: initialLigatures,
      tabSize: initialTabSize,
      wordWrap: initialWordWrap,
      minimap: { enabled: initialMinimap },
      lineNumbers: initialLineNumbers,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      cursorStyle: 'line',
      renderLineHighlight: 'all',
      glyphMargin: true,
      lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.On },
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      overviewRulerBorder: true,
      overviewRulerLanes: 3,
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        bracketPairsHorizontal: true,
        indentation: true,
        highlightActiveIndentation: true,
      },
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
      autoSurround: 'languageDefined',
      formatOnPaste: true,
      formatOnType: true,
      mouseWheelZoom: true,
      stickyScroll: { enabled: true },
    });

    // Monaco model tanı (hata ve uyarı) değişikliklerini dinle
    monaco.editor.onDidChangeMarkers(() => {
      const markers = monaco.editor.getModelMarkers({});
      const errors = markers.filter((m) => m.severity === monaco.MarkerSeverity.Error).length;
      const warnings = markers.filter((m) => m.severity === monaco.MarkerSeverity.Warning).length;
      this.onMarkersChange?.(errors, warnings);
    });

    // İmleç pozisyonu değişikliği (Status Bar köprüsü)
    this.editor.onDidChangeCursorPosition((e) => {
      if (this.onCursorChange) {
        this.onCursorChange(e.position.lineNumber, e.position.column);
      }
    });

    // Kaydetme Kısayolu (Ctrl+S / Cmd+S)
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      this.saveActiveFile();
    });

    // Belgeyi Biçimlendir (Shift+Alt+F)
    this.editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      this.formatDocument();
    });

    // Satır İçi AI Düzenleme (Ctrl+K / Cmd+K & Ctrl+I / Cmd+I)
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      if (this.editor) {
        InlineEditBar.getInstance().show(this.editor);
      }
    });
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
      if (this.editor) {
        InlineEditBar.getInstance().show(this.editor);
      }
    });

    // Durum Çubuğu Seçim & Satır Telemetrisi (Selection Stats)
    this.editor.onDidChangeCursorSelection((e) => {
      if (!this.onSelectionChange) return;
      const sel = e.selection;
      if (sel.isEmpty()) {
        this.onSelectionChange(null);
      } else {
        const model = this.editor?.getModel();
        if (!model) {
          this.onSelectionChange(null);
          return;
        }
        const selectedText = model.getValueInRange(sel);
        const charCount = selectedText.length;
        const lineCount = Math.abs(sel.endLineNumber - sel.startLineNumber) + 1;
        const stats = lineCount > 1
          ? `${charCount} karakter (${lineCount} satır) seçildi`
          : `${charCount} karakter seçildi`;
        this.onSelectionChange(stats);
      }
    });

    // Visual Studio Kesme Noktası (Breakpoint) Glyph Margin Dinleyicisi
    this.editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const line = e.target.position?.lineNumber;
        if (line) {
          this.toggleBreakpoint(line);
        }
      }
    });

    // F9 ile Kesme Noktası Ekle / Kaldır
    this.editor.addCommand(monaco.KeyCode.F9, () => {
      this.toggleBreakpoint();
    });

    // Visual Studio: Tanıma Gözat (Alt+F12 - Peek Definition)
    this.editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.F12, () => {
      this.editor?.getAction('editor.action.peekDefinition')?.run();
    });

    // Visual Studio: Tanıma Git (F12 - Go to Definition)
    this.editor.addCommand(monaco.KeyCode.F12, () => {
      this.editor?.getAction('editor.action.revealDefinition')?.run();
    });

    // Visual Studio: Referanslara Gözat (Shift+F12 - Peek References)
    this.editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F12, () => {
      this.editor?.getAction('editor.action.referenceSearch.trigger')?.run();
    });

    // Visual Studio: Hızlı İşlemler & Refaktör (Ctrl+. / Cmd+.)
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Period, () => {
      this.editor?.getAction('editor.action.quickFix')?.run();
    });

    // Monaco Sağ Tık (Context Menu) AI & Visual Studio Eylemleri
    this.registerAiContextMenuActions();
    this.registerCodeActionProvider();

    window.addEventListener('resize', () => this.editor?.layout());
  }

  /**
   * Monaco editörü sağ tık menüsüne Kraga AI yeteneklerini ekler
   */
  private registerAiContextMenuActions(): void {
    if (!this.editor) return;

    // 1. Satır İçi Düzenle (Ctrl+K)
    this.editor.addAction({
      id: 'kraga.ai.inlineEdit',
      label: 'Kraga AI: Satır İçi Düzenle (Ctrl+K)',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
      contextMenuGroupId: '1_kraga_ai',
      contextMenuOrder: 1,
      run: (ed) => {
        InlineEditBar.getInstance().show(ed as monaco.editor.IStandaloneCodeEditor);
      },
    });

    // 2. Seçili Kodu Açıkla
    this.editor.addAction({
      id: 'kraga.ai.explain',
      label: 'Kraga AI: Seçili Kodu Açıkla',
      contextMenuGroupId: '1_kraga_ai',
      contextMenuOrder: 2,
      run: (ed) => {
        const code = this.getSelectedOrCurrentLine(ed);
        if (code) {
          this.onAiAction?.('explain', code, this.activeTab?.path);
        }
      },
    });

    // 3. Kodu Refaktör Et
    this.editor.addAction({
      id: 'kraga.ai.refactor',
      label: 'Kraga AI: Kodu Refaktör Et & Temizle',
      contextMenuGroupId: '1_kraga_ai',
      contextMenuOrder: 3,
      run: (ed) => {
        InlineEditBar.getInstance().show(ed as monaco.editor.IStandaloneCodeEditor, 'Kodu SOLID prensiplerine göre daha temiz, modern ve okunabilir refaktör et.');
      },
    });

    // 4. Birim Test Üret
    this.editor.addAction({
      id: 'kraga.ai.test',
      label: 'Kraga AI: Birim Test Üret (Unit Tests)',
      contextMenuGroupId: '1_kraga_ai',
      contextMenuOrder: 4,
      run: (ed) => {
        const code = this.getSelectedOrCurrentLine(ed);
        if (code) {
          this.onAiAction?.('test', code, this.activeTab?.path);
        }
      },
    });

    // 5. Güvenlik ve Hata Denetimi
    this.editor.addAction({
      id: 'kraga.ai.audit',
      label: 'Kraga AI: Güvenlik & Hata Denetimi',
      contextMenuGroupId: '1_kraga_ai',
      contextMenuOrder: 5,
      run: (ed) => {
        const code = this.getSelectedOrCurrentLine(ed);
        if (code) {
          this.onAiAction?.('audit', code, this.activeTab?.path);
        }
      },
    });

      // 6. JSDoc & Tip Açıklamaları Ekle
      this.editor.addAction({
        id: 'kraga.ai.jsdoc',
        label: 'Kraga AI: JSDoc & Tipleri Ekle',
        contextMenuGroupId: '1_kraga_ai',
        contextMenuOrder: 6,
        run: (ed) => {
          InlineEditBar.getInstance().show(ed as monaco.editor.IStandaloneCodeEditor, 'TypeScript tip tanımlarını ve açıklayıcı JSDoc dokümantasyonunu ekle.');
        },
      });

      // 7. Visual Studio: Tanıma Gözat (Alt+F12)
      this.editor.addAction({
        id: 'vs.peekDefinition',
        label: 'Visual Studio: Tanıma Gözat (Alt+F12)',
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F12],
        contextMenuGroupId: '2_vs_nav',
        contextMenuOrder: 1,
        run: (ed) => {
          ed.getAction('editor.action.peekDefinition')?.run();
        },
      });

      // 8. Visual Studio: Tanıma Git (F12)
      this.editor.addAction({
        id: 'vs.goToDefinition',
        label: 'Visual Studio: Tanıma Git (F12)',
        keybindings: [monaco.KeyCode.F12],
        contextMenuGroupId: '2_vs_nav',
        contextMenuOrder: 2,
        run: (ed) => {
          ed.getAction('editor.action.revealDefinition')?.run();
        },
      });

      // 9. Visual Studio: Referansları Bul (Shift+F12)
      this.editor.addAction({
        id: 'vs.findReferences',
        label: 'Visual Studio: Referansları Bul (Shift+F12)',
        keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
        contextMenuGroupId: '2_vs_nav',
        contextMenuOrder: 3,
        run: (ed) => {
          ed.getAction('editor.action.referenceSearch.trigger')?.run();
        },
      });
    }

    private codeActionProviderRegistered = false;
    private registerCodeActionProvider(): void {
      if (this.codeActionProviderRegistered) return;
      this.codeActionProviderRegistered = true;

      monaco.languages.registerCodeActionProvider('*', {
        provideCodeActions: (model, range, context) => {
          const actions: monaco.languages.CodeAction[] = [];
          const hasMarkers = context.markers && context.markers.length > 0;
          const selectedText = model.getValueInRange(range).trim();

          if (hasMarkers) {
            const firstError = context.markers[0];
            actions.push({
              title: `💡 Kraga AI: Bu Hatayı Düzelt (${firstError.message.slice(0, 45)}...)`,
              kind: 'quickfix',
              isPreferred: true,
              command: {
                id: 'kraga.ai.fixErrorAction',
                title: 'Hata Düzelt',
                arguments: [firstError.message]
              }
            });
          }

          if (selectedText.length > 0) {
            actions.push({
              title: '💡 Kraga AI: Kodu Refaktör Et & Sadeleştir',
              kind: 'refactor',
              command: {
                id: 'kraga.ai.refactorAction',
                title: 'Refaktör Et',
                arguments: [selectedText]
              }
            });
            actions.push({
              title: '💡 Kraga AI: JSDoc & Tipleri Ekle',
              kind: 'quickfix',
              command: {
                id: 'kraga.ai.jsdocAction',
                title: 'JSDoc Ekle',
                arguments: [selectedText]
              }
            });
            actions.push({
              title: '💡 Kraga AI: Birim Test Üret (Unit Test)',
              kind: 'quickfix',
              command: {
                id: 'kraga.ai.testAction',
                title: 'Test Üret',
                arguments: [selectedText]
              }
            });
          }

          return {
            actions,
            dispose: () => {}
          };
        }
      });

      this.editor?.addAction({
        id: 'kraga.ai.fixErrorAction',
        label: 'Kraga AI: Hata Düzelt',
        run: (ed, errorMsg) => {
          InlineEditBar.getInstance().show(ed as monaco.editor.IStandaloneCodeEditor, `Bu hatayı düzelt: ${errorMsg || 'Sözdizimi hatası'}`);
        }
      });
      this.editor?.addAction({
        id: 'kraga.ai.refactorAction',
        label: 'Kraga AI: Refaktör',
        run: (ed) => {
          InlineEditBar.getInstance().show(ed as monaco.editor.IStandaloneCodeEditor, 'Kodu SOLID standartlarına göre temiz, okunabilir ve modern refaktör et.');
        }
      });
      this.editor?.addAction({
        id: 'kraga.ai.jsdocAction',
        label: 'Kraga AI: JSDoc Ekle',
        run: (ed) => {
          InlineEditBar.getInstance().show(ed as monaco.editor.IStandaloneCodeEditor, 'Açıklayıcı JSDoc ve TypeScript tip tanımlamalarını ekle.');
        }
      });
      this.editor?.addAction({
        id: 'kraga.ai.testAction',
        label: 'Kraga AI: Test Üret',
        run: (ed) => {
          const code = this.getSelectedOrCurrentLine(ed as monaco.editor.IStandaloneCodeEditor);
          if (code) {
            this.onAiAction?.('test', code, this.activeTab?.path);
          }
        }
      });
    }

  private getSelectedOrCurrentLine(editor: monaco.editor.ICodeEditor): string {
    const model = editor.getModel();
    if (!model) return '';
    const selection = editor.getSelection();
    if (selection && !selection.isEmpty()) {
      return model.getValueInRange(selection);
    }
    const pos = editor.getPosition();
    if (pos) {
      return model.getLineContent(pos.lineNumber);
    }
    return '';
  }

  public goToNextError(): void {
    if (this.editor) {
      this.editor.getAction('editor.action.marker.next')?.run();
      this.editor.focus();
    }
  }

  /**
   * VS Code Insiders Tarzı Git Gutter Canlı Değişiklik Çizgilerini günceller
   */
  private gitGutterTimer: ReturnType<typeof setTimeout> | null = null;
  public scheduleGitGutter(tab?: EditorTab | null, delayMs: number = 100): void {
    if (this.gitGutterTimer) clearTimeout(this.gitGutterTimer);
    this.gitGutterTimer = setTimeout(() => {
      this.gitGutterTimer = null;
      this.updateGitGutter(tab);
    }, delayMs);
  }

  /**
   * Orijinal disk içeriği ile aktif editör içeriğini satır satır karşılaştırıp
   * Monaco'nun sol kenar boşluğuna (glyph/gutter) VS Code tarzı renkli şeritler ekler.
   */
  public updateGitGutter(tab?: EditorTab | null): void {
    const targetTab = tab || this.activeTab;
    if (!this.editor || !targetTab) return;

    const original = this.originalContents.get(targetTab.path);
    if (original === undefined) {
      this.gutterDecorations = this.editor.deltaDecorations(this.gutterDecorations, []);
      return;
    }

    const currentLines = targetTab.model.getValue().split('\n');
    // Büyük dosyalarda (örn. > 3000 satır) UI thread'ini kilitlememek için koruma
    if (currentLines.length > 3000) {
      this.gutterDecorations = this.editor.deltaDecorations(this.gutterDecorations, []);
      return;
    }

    const originalLines = original.split('\n');
    const origLen = originalLines.length;

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

    for (let i = 0; i < currentLines.length; i++) {
      const lineNum = i + 1;
      const currLine = currentLines[i];

      if (i < origLen) {
        if (currLine !== originalLines[i]) {
          // Değiştirilmiş satır (Modified - Cyan/Blue)
          newDecorations.push({
            range: new monaco.Range(lineNum, 1, lineNum, 1),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: 'git-gutter-modified',
              overviewRuler: {
                color: '#00f0ff',
                position: monaco.editor.OverviewRulerLane.Left,
              },
            },
          });
        }
      } else {
        // Yeni eklenmiş satır (Added - Yeşil)
        newDecorations.push({
          range: new monaco.Range(lineNum, 1, lineNum, 1),
          options: {
            isWholeLine: true,
            linesDecorationsClassName: 'git-gutter-added',
            overviewRuler: {
              color: '#2ea043',
              position: monaco.editor.OverviewRulerLane.Left,
            },
          },
        });
      }
    }

    this.gutterDecorations = this.editor.deltaDecorations(this.gutterDecorations, newDecorations);
  }

  public updateEditorPreferences(prefs: {
    fontSize?: number;
    tabSize?: number;
    wordWrap?: boolean;
    minimap?: boolean;
    editorFontFamily?: string;
    fontLigatures?: boolean;
    lineNumbers?: 'on' | 'off' | 'relative';
  }): void {
    if (!this.editor) return;
    const options: monaco.editor.IEditorOptions = {};
    if (prefs.fontSize !== undefined) options.fontSize = prefs.fontSize;
    if (prefs.tabSize !== undefined) {
      this.editor.getModel()?.updateOptions({ tabSize: prefs.tabSize });
      this.tabs.forEach((t) => t.model.updateOptions({ tabSize: prefs.tabSize }));
    }
    if (prefs.wordWrap !== undefined) options.wordWrap = prefs.wordWrap ? 'on' : 'off';
    if (prefs.minimap !== undefined) options.minimap = { enabled: prefs.minimap };
    if (prefs.editorFontFamily) options.fontFamily = prefs.editorFontFamily;
    if (prefs.fontLigatures !== undefined) options.fontLigatures = prefs.fontLigatures;
    if (prefs.lineNumbers) options.lineNumbers = prefs.lineNumbers;

    this.editor.updateOptions(options);
  }

  public setTheme(themeId: string): void {
    const validThemes = ['kraga-cyberpunk', 'original-dark', 'dracula', 'emerald-dark', 'midnight-blue', 'sunset-warm', 'synthwave', 'minimal-light', 'vs-2022-dark'];
    if (validThemes.includes(themeId)) {
      monaco.editor.setTheme(themeId);
    }
  }

  /**
   * Visual Studio Kırmızı Kesme Noktasını (Breakpoint) satır bazında ekler veya kaldırır
   */
  public toggleBreakpoint(lineNumber?: number): void {
    if (!this.activeTab || !this.editor) return;
    const line = lineNumber || this.editor.getPosition()?.lineNumber || 1;
    const path = this.activeTab.path;
    let fileBps = this.breakpoints.get(path);
    if (!fileBps) {
      fileBps = new Set<number>();
      this.breakpoints.set(path, fileBps);
    }

    if (fileBps.has(line)) {
      fileBps.delete(line);
    } else {
      fileBps.add(line);
    }

    this.renderBreakpoints(this.activeTab);
    this.onBreakpointsChange?.(path, Array.from(fileBps));
  }

  /**
   * Aktif dosya için Visual Studio Kesme Noktalarını Glyph margin'de render eder
   */
  public renderBreakpoints(tab?: EditorTab | null): void {
    const targetTab = tab || this.activeTab;
    if (!this.editor || !targetTab) return;
    const path = targetTab.path;
    const fileBps = this.breakpoints.get(path) || new Set<number>();
    const oldDecs = this.breakpointDecorations.get(path) || [];

    const newDecs: monaco.editor.IModelDeltaDecoration[] = Array.from(fileBps).map((line) => ({
      range: new monaco.Range(line, 1, line, 1),
      options: {
        isWholeLine: false,
        glyphMarginClassName: 'vs-glyph-breakpoint',
        glyphMarginHoverMessage: { value: `**Visual Studio Kesme Noktası** (Satır ${line})` },
      },
    }));

    const updatedDecs = this.editor.deltaDecorations(oldDecs, newDecs);
    this.breakpointDecorations.set(path, updatedDecs);
  }

  public getBreakpoints(filePath: string): number[] {
    return Array.from(this.breakpoints.get(filePath) || []);
  }

  /**
   * Visual Studio Tarzı Yakınlaştırma (Zoom) Seviyesini Günceller (Örn: 100%, 150%, 177%)
   */
  public setZoomLevel(percentage: number): void {
    this.currentZoomPercentage = percentage;
    const newFontSize = Math.round((this.baseFontSize * percentage) / 100);
    this.editor?.updateOptions({ fontSize: newFontSize });
  }

  public getZoomLevel(): number {
    return this.currentZoomPercentage;
  }

  public getActiveTab(): EditorTab | null {
    return this.activeTab;
  }

  public undo(): void {
    this.editor?.trigger('keyboard', 'undo', null);
  }

  public redo(): void {
    this.editor?.trigger('keyboard', 'redo', null);
  }

  public commentSelection(): void {
    this.editor?.getAction('editor.action.commentLine')?.run();
  }

  public uncommentSelection(): void {
    this.editor?.getAction('editor.action.commentLine')?.run();
  }

  public find(): void {
    this.editor?.getAction('actions.find')?.run();
  }

  public replace(): void {
    this.editor?.getAction('editor.action.startFindReplaceAction')?.run();
  }

  public peekDefinition(): void {
    this.editor?.getAction('editor.action.peekDefinition')?.run();
    this.editor?.focus();
  }

  public goToDefinition(): void {
    this.editor?.getAction('editor.action.revealDefinition')?.run();
    this.editor?.focus();
  }

  public peekReferences(): void {
    this.editor?.getAction('editor.action.referenceSearch.trigger')?.run();
    this.editor?.focus();
  }

  public quickFix(): void {
    this.editor?.getAction('editor.action.quickFix')?.run();
    this.editor?.focus();
  }

  public togglePinTab(tab: EditorTab): void {
    tab.isPinned = !tab.isPinned;
    this.tabs.sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
    this.renderTabs();
  }

  public async openFile(filePath: string): Promise<void> {
    try {
      filePath = filePath.replace(/\\/g, '/');
      if (this.showLiveScriptTab) {
        this.closeLiveScriptTab();
      }

      const ext = filePath.split('.').pop()?.toLowerCase() || '';
      const mediaExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'pdf']);
      if (mediaExts.has(ext)) {
        window.dispatchEvent(new CustomEvent('kraga:open-preview', { detail: { filePath } }));
        return;
      }

      const sheetExts = new Set(['xls', 'xlsx', 'csv', 'tsv']);
      if (sheetExts.has(ext)) {
        await this.openSpreadsheetTab(filePath);
        return;
      }

      const binaryExts = new Set(['exe', 'dll', 'bin', 'zip', 'tar', 'gz', '7z', 'iso', 'so', 'dylib', 'wasm']);
      if (binaryExts.has(ext)) {
        const fileName = filePath.split(/[\\/]/).pop() || filePath;
        await this.openSnippet(
          fileName,
          `// [Kraga IDE Güvenlik Kalkanı]\n// Bu dosya ikili (binary) bir formattır (${ext.toUpperCase()}).\n// Bellek performansını ve IDE kararlılığını korumak için Monaco metin editöründe açılmadı.\n// Dosyayı sistemin varsayılan uygulamasında açmak için Gezgin'de sağ tıklayıp "PC'de Aç" diyebilirsiniz.\n// Dosya Yolu: ${filePath}`,
          'javascript'
        );
        return;
      }

      let content = '';
      try {
        content = await window.kragaAPI.fs.readFile(filePath);
      } catch (readErr: any) {
        if (readErr?.message?.includes('FILE_TOO_LARGE')) {
          const fileName = filePath.split(/[\\/]/).pop() || filePath;
          await this.openSnippet(
            fileName,
            `// [Kraga IDE Bellek Koruma Kalkanı]\n// ${readErr.message}\n// Monaco editörünün çökmesini (OOM) önlemek için dosya engellendi.`,
            'javascript'
          );
          return;
        }
        throw readErr;
      }

      const fileName = filePath.split(/[\\/]/).pop() || 'Untitled';
      const lang = this.detectLanguage(filePath);
      const fileUri = monaco.Uri.file(filePath);

      let tab = this.tabs.find((t) => t.path === filePath);
      if (tab) {
        // Model içeriğini dosyanın en güncel haline eşitle
        if (tab.model.getValue() !== content) {
          tab.model.setValue(content);
        }
        tab.isDirty = false;
        this.originalContents.set(filePath, content);
        this.switchTab(tab);
        this.onFileContentChange?.(content, filePath);
        return;
      }

      // Var olan model URI'si varsa onu kullan (Cannot create model hatasını önle)
      let model = monaco.editor.getModel(fileUri);
      if (model) {
        model.setValue(content);
        monaco.editor.setModelLanguage(model, lang);
      } else {
        model = monaco.editor.createModel(content, lang, fileUri);
      }

      CodeDiagnosticsEngine.getInstance().scheduleValidation(model, 250);

      tab = {
        path: filePath,
        name: fileName,
        model,
        isDirty: false,
      };

      this.originalContents.set(filePath, content);

      model.onDidChangeContent(() => {
        if (tab && !tab.isDirty) {
          tab.isDirty = true;
          this.renderTabs();
        }
        if (tab) {
          this.scheduleGitGutter(tab, 250);
          this.onFileContentChange?.(model.getValue(), tab.path);
        }
        CodeDiagnosticsEngine.getInstance().scheduleValidation(model, 250);
      });

      this.tabs.push(tab);
      this.switchTab(tab);
      this.onFileContentChange?.(content, filePath);
    } catch (err) {
      console.error('Dosya açılamadı:', err);
    }
  }

  public async openFileAtLine(filePath: string, line: number, col: number = 1): Promise<void> {
    await this.openFile(filePath);
    if (this.editor) {
      this.editor.revealLineInCenter(line);
      this.editor.setPosition({ lineNumber: line, column: col });
      this.editor.focus();
    }
  }

  public async openSnippet(title: string, code: string, language: string): Promise<void> {
    if (this.showLiveScriptTab) {
      this.closeLiveScriptTab();
    }
    let tab = this.tabs.find((t) => t.path === title || t.name === title);
    if (tab) {
      tab.model.setValue(code);
      this.switchTab(tab);
      return;
    }
    const model = monaco.editor.createModel(code, language, monaco.Uri.file(title));
    CodeDiagnosticsEngine.getInstance().scheduleValidation(model, 250);
    tab = {
      path: title,
      name: title,
      model,
      isDirty: false,
    };
    model.onDidChangeContent(() => {
      if (tab && !tab.isDirty) {
        tab.isDirty = true;
        this.renderTabs();
      }
      CodeDiagnosticsEngine.getInstance().scheduleValidation(model, 250);
    });
    this.tabs.push(tab);
    this.switchTab(tab);
  }

  public showEmptyState(): void {
    this.isWelcomeActive = false;
    this.isScriptActive = false;
    this.isPlanActive = false;
    this.isSessionActive = false;
    this.isLiveScriptActive = false;
    this.isSpreadsheetActive = false;
    this.activeTab = null;
    this.onActiveFileChange?.(null);

    if (this.welcomeContainer) this.welcomeContainer.style.setProperty('display', 'none', 'important');
    if (this.scriptContainer) this.scriptContainer.style.setProperty('display', 'none', 'important');
    if (this.planContainer) this.planContainer.style.setProperty('display', 'none', 'important');
    if (this.sessionContainer) this.sessionContainer.style.setProperty('display', 'none', 'important');
    if (this.liveScriptContainer) this.liveScriptContainer.style.setProperty('display', 'none', 'important');
    if (this.previewContainer) this.previewContainer.style.setProperty('display', 'none', 'important');
    if (this.reviewContainer) this.reviewContainer.style.setProperty('display', 'none', 'important');
    if (this.spreadsheetContainer) this.spreadsheetContainer.style.setProperty('display', 'none', 'important');
    this.editorContainer.style.setProperty('display', 'none', 'important');

    if (!this.emptyStateContainer) {
      this.emptyStateContainer = document.getElementById('editorEmptyState');
    }

    if (this.emptyStateContainer) {
      this.emptyStateContainer.innerHTML = `
        <div class="editor-empty-state-content">
          <div class="editor-empty-state-logo-wrap">
            ${kragaBirdImg(64)}
          </div>
          <div class="editor-empty-state-title">Kraga IDE</div>
          <div class="editor-empty-state-desc">Kodlamaya başlamak için bir dosya açın veya gezginden seçin.</div>
          
          <div class="editor-empty-state-shortcuts">
            <div class="editor-empty-state-row">
              <span>Yeni Dosya Oluştur</span>
              <kbd class="editor-empty-state-key">Ctrl + N</kbd>
            </div>
            <div class="editor-empty-state-row">
              <span>Dosya Aç</span>
              <kbd class="editor-empty-state-key">Ctrl + O</kbd>
            </div>
            <div class="editor-empty-state-row">
              <span>Komut Paleti</span>
              <kbd class="editor-empty-state-key">Ctrl + Shift + P</kbd>
            </div>
            <div class="editor-empty-state-row">
              <span>Ayarlar</span>
              <kbd class="editor-empty-state-key">Ctrl + ,</kbd>
            </div>
          </div>

          <button id="btnOpenWelcomeFromEmpty" class="editor-empty-state-btn">
            ${kragaBirdImg(14)}
            <span>Hoş Geldiniz Ekranını Aç</span>
          </button>
        </div>
      `;

      this.emptyStateContainer.querySelector('#btnOpenWelcomeFromEmpty')?.addEventListener('click', () => {
        this.openWelcomeTab();
      });

      this.emptyStateContainer.style.display = 'flex';
    }
  }

  public hideEmptyState(): void {
    if (!this.emptyStateContainer) {
      this.emptyStateContainer = document.getElementById('editorEmptyState');
    }
    if (this.emptyStateContainer) {
      this.emptyStateContainer.style.display = 'none';
    }
  }

  public openWelcomeTab(): void {
    this.hideEmptyState();
    this.isWelcomeActive = true;
    this.showWelcomeTab = true;
    this.isScriptActive = false;
    this.isPlanActive = false;
    this.isSessionActive = false;
    this.isLiveScriptActive = false;
    this.activeTab = null;
    this.onActiveFileChange?.(null);
    if (this.welcomeContainer) {
      this.welcomeContainer.style.setProperty('display', 'block', 'important');
    }
    if (this.scriptContainer) {
      this.scriptContainer.style.setProperty('display', 'none', 'important');
    }
    if (this.planContainer) {
      this.planContainer.style.setProperty('display', 'none', 'important');
    }
    if (this.sessionContainer) {
      this.sessionContainer.style.setProperty('display', 'none', 'important');
    }
    if (this.liveScriptContainer) {
      this.liveScriptContainer.style.setProperty('display', 'none', 'important');
    }
    if (this.previewContainer) {
      this.previewContainer.style.setProperty('display', 'none', 'important');
    }
    this.editorContainer.style.setProperty('display', 'none', 'important');
    this.renderTabs();
    this.onWelcomeTabStateChange?.(true);
    this.onScriptTabStateChange?.(false);
    this.onPlanTabStateChange?.(false);
    this.onSessionTabStateChange?.(false);
    this.onLiveScriptTabStateChange?.(false);
  }

  public closeWelcomeTab(): void {
    this.showWelcomeTab = false;
    this.isWelcomeActive = false;
    if (this.welcomeContainer) this.welcomeContainer.style.setProperty('display', 'none', 'important');

    if (this.isLiveScriptActive && this.liveScriptContainer) {
      this.hideEmptyState();
      this.liveScriptContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isPlanActive && this.planContainer) {
      this.hideEmptyState();
      this.planContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isSessionActive && this.sessionContainer) {
      this.hideEmptyState();
      this.sessionContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isScriptActive && this.scriptContainer) {
      this.hideEmptyState();
      this.scriptContainer.style.setProperty('display', 'block', 'important');
    } else if (this.tabs.length > 0) {
      this.hideEmptyState();
      this.switchTab(this.tabs[this.tabs.length - 1]);
    } else {
      this.showEmptyState();
    }
    this.renderTabs();
    this.onWelcomeTabStateChange?.(false);
  }

  public openScriptTab(): void {
    this.hideEmptyState();
    this.isScriptActive = true;
    this.showScriptTab = true;
    this.isWelcomeActive = false;
    this.isPlanActive = false;
    this.isSessionActive = false;
    this.isLiveScriptActive = false;
    this.activeTab = null;
    if (this.welcomeContainer) {
      this.welcomeContainer.style.setProperty('display', 'none', 'important');
    }
    if (this.scriptContainer) {
      this.scriptContainer.style.setProperty('display', 'block', 'important');
    }
    if (this.planContainer) {
      this.planContainer.style.setProperty('display', 'none', 'important');
    }
    if (this.sessionContainer) {
      this.sessionContainer.style.setProperty('display', 'none', 'important');
    }
    if (this.liveScriptContainer) {
      this.liveScriptContainer.style.setProperty('display', 'none', 'important');
    }
    if (this.previewContainer) {
      this.previewContainer.style.setProperty('display', 'none', 'important');
    }
    this.editorContainer.style.setProperty('display', 'none', 'important');
    this.onActiveFileChange?.(null);
    this.renderTabs();
    this.onScriptTabStateChange?.(true);
    this.onWelcomeTabStateChange?.(false);
    this.onPlanTabStateChange?.(false);
    this.onSessionTabStateChange?.(false);
    this.onLiveScriptTabStateChange?.(false);
  }

  public closeScriptTab(): void {
    this.showScriptTab = false;
    this.isScriptActive = false;
    if (this.scriptContainer) this.scriptContainer.style.setProperty('display', 'none', 'important');

    if (this.isLiveScriptActive && this.liveScriptContainer) {
      this.hideEmptyState();
      this.liveScriptContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isPlanActive && this.planContainer) {
      this.hideEmptyState();
      this.planContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isSessionActive && this.sessionContainer) {
      this.hideEmptyState();
      this.sessionContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.tabs.length > 0) {
      this.hideEmptyState();
      this.switchTab(this.tabs[this.tabs.length - 1]);
    } else if (this.showWelcomeTab) {
      this.openWelcomeTab();
    } else {
      this.showEmptyState();
    }
    this.renderTabs();
    this.onScriptTabStateChange?.(false);
  }

  public openPlanTab(title: string): void {
    this.hideEmptyState();
    this.planTitle = title;
    this.isPlanActive = true;
    this.showPlanTab = true;
    this.isWelcomeActive = false;
    this.isScriptActive = false;
    this.isSessionActive = false;
    this.isLiveScriptActive = false;
    this.activeTab = null;
    this.onActiveFileChange?.(null);

    if (this.welcomeContainer) this.welcomeContainer.style.setProperty('display', 'none', 'important');
    if (this.scriptContainer) this.scriptContainer.style.setProperty('display', 'none', 'important');
    if (this.sessionContainer) this.sessionContainer.style.setProperty('display', 'none', 'important');
    if (this.liveScriptContainer) this.liveScriptContainer.style.setProperty('display', 'none', 'important');
    if (this.previewContainer) this.previewContainer.style.setProperty('display', 'none', 'important');
    if (this.planContainer) this.planContainer.style.setProperty('display', 'flex', 'important');
    this.editorContainer.style.setProperty('display', 'none', 'important');

    this.renderTabs();
    this.onPlanTabStateChange?.(true);
    this.onWelcomeTabStateChange?.(false);
    this.onScriptTabStateChange?.(false);
    this.onSessionTabStateChange?.(false);
    this.onLiveScriptTabStateChange?.(false);
  }

  public closePlanTab(): void {
    this.showPlanTab = false;
    this.isPlanActive = false;
    if (this.planContainer) this.planContainer.style.setProperty('display', 'none', 'important');

    if (this.isLiveScriptActive && this.liveScriptContainer) {
      this.hideEmptyState();
      this.liveScriptContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isSessionActive && this.sessionContainer) {
      this.hideEmptyState();
      this.sessionContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.tabs.length > 0) {
      this.hideEmptyState();
      this.switchTab(this.tabs[this.tabs.length - 1]);
    } else if (this.showWelcomeTab) {
      this.openWelcomeTab();
    } else {
      this.showEmptyState();
    }
    this.renderTabs();
    this.onPlanTabStateChange?.(false);
  }

  public openSessionTab(): void {
    this.hideEmptyState();
    this.isSessionActive = true;
    this.showSessionTab = true;
    this.isWelcomeActive = false;
    this.isScriptActive = false;
    this.isPlanActive = false;
    this.isLiveScriptActive = false;
    this.activeTab = null;
    this.onActiveFileChange?.(null);

    if (this.welcomeContainer) this.welcomeContainer.style.setProperty('display', 'none', 'important');
    if (this.scriptContainer) this.scriptContainer.style.setProperty('display', 'none', 'important');
    if (this.planContainer) this.planContainer.style.setProperty('display', 'none', 'important');
    if (this.liveScriptContainer) this.liveScriptContainer.style.setProperty('display', 'none', 'important');
    if (this.previewContainer) this.previewContainer.style.setProperty('display', 'none', 'important');
    if (this.sessionContainer) this.sessionContainer.style.setProperty('display', 'flex', 'important');
    this.editorContainer.style.setProperty('display', 'none', 'important');

    this.renderTabs();
    this.onSessionTabStateChange?.(true);
    this.onWelcomeTabStateChange?.(false);
    this.onScriptTabStateChange?.(false);
    this.onPlanTabStateChange?.(false);
    this.onLiveScriptTabStateChange?.(false);
  }

  public closeSessionTab(): void {
    this.showSessionTab = false;
    this.isSessionActive = false;
    if (this.sessionContainer) this.sessionContainer.style.setProperty('display', 'none', 'important');

    if (this.isLiveScriptActive && this.liveScriptContainer) {
      this.hideEmptyState();
      this.liveScriptContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isPlanActive && this.planContainer) {
      this.hideEmptyState();
      this.planContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.tabs.length > 0) {
      this.hideEmptyState();
      this.switchTab(this.tabs[this.tabs.length - 1]);
    } else if (this.showWelcomeTab) {
      this.openWelcomeTab();
    } else {
      this.showEmptyState();
    }
    this.renderTabs();
    this.onSessionTabStateChange?.(false);
  }

  public openLiveScriptTab(title: string, isStreaming: boolean = true): void {
    this.hideEmptyState();
    const cleanTitle = (title || 'Canlı Kod').trim().replace(/[/\\]+$/, '');
    this.liveScriptTitle = cleanTitle || 'Canlı Kod';
    this.isLiveScriptStreaming = isStreaming;
    this.isLiveScriptActive = true;
    this.showLiveScriptTab = true;
    this.isWelcomeActive = false;
    this.isScriptActive = false;
    this.isPlanActive = false;
    this.isSessionActive = false;
    this.activeTab = null;
    this.onActiveFileChange?.(null);

    this.hideEmptyState();
    if (this.welcomeContainer) this.welcomeContainer.style.setProperty('display', 'none', 'important');
    if (this.scriptContainer) this.scriptContainer.style.setProperty('display', 'none', 'important');
    if (this.planContainer) this.planContainer.style.setProperty('display', 'none', 'important');
    if (this.sessionContainer) this.sessionContainer.style.setProperty('display', 'none', 'important');
    if (this.previewContainer) this.previewContainer.style.setProperty('display', 'none', 'important');
    this.editorContainer.style.setProperty('display', 'none', 'important');
    if (this.liveScriptContainer) this.liveScriptContainer.style.setProperty('display', 'flex', 'important');

    this.renderTabs();
    this.onLiveScriptTabStateChange?.(true);
    this.onWelcomeTabStateChange?.(false);
    this.onScriptTabStateChange?.(false);
    this.onPlanTabStateChange?.(false);
    this.onSessionTabStateChange?.(false);
  }

  public updateLiveScriptStreaming(isStreaming: boolean): void {
    this.isLiveScriptStreaming = isStreaming;
    const tabEl = this.tabsContainer.querySelector('.editor-tab--livescript');
    if (tabEl) {
      if (isStreaming) {
        tabEl.classList.add('live-streaming');
      } else {
        tabEl.classList.remove('live-streaming');
      }
    }
  }

  public closeLiveScriptTab(): void {
    this.showLiveScriptTab = false;
    this.isLiveScriptActive = false;
    this.isLiveScriptStreaming = false;
    if (this.liveScriptContainer) this.liveScriptContainer.style.setProperty('display', 'none', 'important');

    this.onLiveScriptTabClose?.();

    if (this.isPlanActive && this.planContainer) {
      this.hideEmptyState();
      this.planContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isSessionActive && this.sessionContainer) {
      this.hideEmptyState();
      this.sessionContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.tabs.length > 0) {
      this.hideEmptyState();
      this.switchTab(this.tabs[this.tabs.length - 1]);
    } else if (this.showWelcomeTab) {
      this.openWelcomeTab();
    } else {
      this.showEmptyState();
    }
    this.renderTabs();
    this.onLiveScriptTabStateChange?.(false);
  }

  public openPreviewTab(title: string = 'Canlı Önizleme'): void {
    this.hideEmptyState();
    this.previewTitle = title;
    this.isPreviewActive = true;
    this.showPreviewTab = true;
    this.isWelcomeActive = false;
    this.isScriptActive = false;
    this.isPlanActive = false;
    this.isSessionActive = false;
    this.isLiveScriptActive = false;
    this.isSpreadsheetActive = false;
    this.activeTab = null;
    this.onActiveFileChange?.(null);

    if (this.welcomeContainer) this.welcomeContainer.style.setProperty('display', 'none', 'important');
    if (this.scriptContainer) this.scriptContainer.style.setProperty('display', 'none', 'important');
    if (this.planContainer) this.planContainer.style.setProperty('display', 'none', 'important');
    if (this.sessionContainer) this.sessionContainer.style.setProperty('display', 'none', 'important');
    if (this.liveScriptContainer) this.liveScriptContainer.style.setProperty('display', 'none', 'important');
    if (this.spreadsheetContainer) this.spreadsheetContainer.style.setProperty('display', 'none', 'important');
    this.editorContainer.style.setProperty('display', 'none', 'important');
    if (this.previewContainer) this.previewContainer.style.setProperty('display', 'flex', 'important');

    this.renderTabs();
    this.onPreviewTabStateChange?.(true);
    this.onWelcomeTabStateChange?.(false);
    this.onScriptTabStateChange?.(false);
    this.onPlanTabStateChange?.(false);
    this.onSessionTabStateChange?.(false);
    this.onLiveScriptTabStateChange?.(false);
  }

  public closePreviewTab(): void {
    this.showPreviewTab = false;
    this.isPreviewActive = false;
    if (this.previewContainer) this.previewContainer.style.setProperty('display', 'none', 'important');

    if (this.isPlanActive && this.planContainer) {
      this.hideEmptyState();
      this.planContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isLiveScriptActive && this.liveScriptContainer) {
      this.hideEmptyState();
      this.liveScriptContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isSessionActive && this.sessionContainer) {
      this.hideEmptyState();
      this.sessionContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.tabs.length > 0) {
      this.hideEmptyState();
      this.switchTab(this.tabs[this.tabs.length - 1]);
    } else if (this.showWelcomeTab) {
      this.openWelcomeTab();
    } else {
      this.showEmptyState();
    }
    this.renderTabs();
    this.onPreviewTabStateChange?.(false);
  }

  public openReviewTab(title: string = 'Değişiklikleri İncele (Review)'): void {
    this.hideEmptyState();
    this.reviewTitle = title;
    this.isReviewActive = true;
    this.showReviewTab = true;
    this.isWelcomeActive = false;
    this.isScriptActive = false;
    this.isPlanActive = false;
    this.isSessionActive = false;
    this.isLiveScriptActive = false;
    this.isPreviewActive = false;
    this.isSpreadsheetActive = false;
    this.activeTab = null;
    this.onActiveFileChange?.(null);

    if (this.welcomeContainer) this.welcomeContainer.style.setProperty('display', 'none', 'important');
    if (this.scriptContainer) this.scriptContainer.style.setProperty('display', 'none', 'important');
    if (this.planContainer) this.planContainer.style.setProperty('display', 'none', 'important');
    if (this.sessionContainer) this.sessionContainer.style.setProperty('display', 'none', 'important');
    if (this.liveScriptContainer) this.liveScriptContainer.style.setProperty('display', 'none', 'important');
    if (this.previewContainer) this.previewContainer.style.setProperty('display', 'none', 'important');
    if (this.spreadsheetContainer) this.spreadsheetContainer.style.setProperty('display', 'none', 'important');
    this.editorContainer.style.setProperty('display', 'none', 'important');
    if (this.reviewContainer) this.reviewContainer.style.setProperty('display', 'flex', 'important');

    this.renderTabs();
    this.onReviewTabStateChange?.(true);
    this.onWelcomeTabStateChange?.(false);
    this.onScriptTabStateChange?.(false);
    this.onPlanTabStateChange?.(false);
    this.onSessionTabStateChange?.(false);
    this.onLiveScriptTabStateChange?.(false);
    this.onPreviewTabStateChange?.(false);
  }

  public closeReviewTab(): void {
    this.showReviewTab = false;
    this.isReviewActive = false;
    if (this.reviewContainer) this.reviewContainer.style.setProperty('display', 'none', 'important');

    if (this.isPlanActive && this.planContainer) {
      this.hideEmptyState();
      this.planContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isLiveScriptActive && this.liveScriptContainer) {
      this.hideEmptyState();
      this.liveScriptContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isSessionActive && this.sessionContainer) {
      this.hideEmptyState();
      this.sessionContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.tabs.length > 0) {
      this.hideEmptyState();
      this.switchTab(this.tabs[this.tabs.length - 1]);
    } else if (this.showWelcomeTab) {
      this.openWelcomeTab();
    } else {
      this.showEmptyState();
    }
    this.renderTabs();
    this.onReviewTabStateChange?.(false);
  }

  public async openSpreadsheetTab(filePath: string): Promise<void> {
    this.hideEmptyState();
    this.spreadsheetFilePath = filePath;
    this.isSpreadsheetActive = true;
    this.showSpreadsheetTab = true;
    this.isWelcomeActive = false;
    this.isScriptActive = false;
    this.isPlanActive = false;
    this.isSessionActive = false;
    this.isLiveScriptActive = false;
    this.isPreviewActive = false;
    this.isReviewActive = false;
    this.activeTab = null;
    this.onActiveFileChange?.(null);

    if (this.welcomeContainer) this.welcomeContainer.style.setProperty('display', 'none', 'important');
    if (this.scriptContainer) this.scriptContainer.style.setProperty('display', 'none', 'important');
    if (this.planContainer) this.planContainer.style.setProperty('display', 'none', 'important');
    if (this.sessionContainer) this.sessionContainer.style.setProperty('display', 'none', 'important');
    if (this.liveScriptContainer) this.liveScriptContainer.style.setProperty('display', 'none', 'important');
    if (this.previewContainer) this.previewContainer.style.setProperty('display', 'none', 'important');
    if (this.reviewContainer) this.reviewContainer.style.setProperty('display', 'none', 'important');
    this.editorContainer.style.setProperty('display', 'none', 'important');
    if (this.spreadsheetContainer) this.spreadsheetContainer.style.setProperty('display', 'flex', 'important');

    this.renderTabs();
    this.updateActiveTabVisuals(null, 'spreadsheet');
    await spreadsheetWorkspace.open(filePath);
  }

  public closeSpreadsheetTab(): void {
    this.showSpreadsheetTab = false;
    this.isSpreadsheetActive = false;
    if (this.spreadsheetContainer) this.spreadsheetContainer.style.setProperty('display', 'none', 'important');

    if (this.isReviewActive && this.reviewContainer) {
      this.hideEmptyState();
      this.reviewContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.isPlanActive && this.planContainer) {
      this.hideEmptyState();
      this.planContainer.style.setProperty('display', 'flex', 'important');
    } else if (this.tabs.length > 0) {
      this.hideEmptyState();
      this.switchTab(this.tabs[this.tabs.length - 1]);
    } else if (this.showWelcomeTab) {
      this.openWelcomeTab();
    } else {
      this.showEmptyState();
    }
    this.renderTabs();
  }

  private updateBreadcrumbs(filePath: string): void {
    if (!this.onBreadcrumbsChange) return;
    const normalized = filePath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    const crumbs = parts.map((part, i) => ({
      name: part,
      path: parts.slice(0, i + 1).join('/'),
    }));
    this.onBreadcrumbsChange(crumbs);
  }

  public updateActiveTabVisuals(activePath: string | null, specialType?: 'welcome' | 'script' | 'plan' | 'session' | 'livescript' | 'preview' | 'review' | 'spreadsheet'): void {
    const tabs = this.tabsContainer.querySelectorAll('.editor-tab');
    tabs.forEach((tabEl) => {
      if (specialType) {
        if (tabEl.classList.contains(`editor-tab--${specialType}`)) {
          tabEl.classList.add('active');
        } else {
          tabEl.classList.remove('active');
        }
      } else {
        const title = tabEl.getAttribute('title');
        if (activePath && title === activePath) {
          tabEl.classList.add('active');
        } else {
          tabEl.classList.remove('active');
        }
      }
    });
  }

  public switchTab(tab: EditorTab): void {
    if (this.activeTab === tab && this.editorContainer.style.display !== 'none' && !this.isWelcomeActive && !this.isReviewActive) {
      return;
    }
    this.hideEmptyState();
    this.isWelcomeActive = false;
    this.isScriptActive = false;
    this.isPlanActive = false;
    this.isSessionActive = false;
    this.isLiveScriptActive = false;
    this.isPreviewActive = false;
    this.isReviewActive = false;
    this.isSpreadsheetActive = false;

    if (this.welcomeContainer) this.welcomeContainer.style.setProperty('display', 'none', 'important');
    if (this.scriptContainer) this.scriptContainer.style.setProperty('display', 'none', 'important');
    if (this.planContainer) this.planContainer.style.setProperty('display', 'none', 'important');
    if (this.sessionContainer) this.sessionContainer.style.setProperty('display', 'none', 'important');
    if (this.liveScriptContainer) this.liveScriptContainer.style.setProperty('display', 'none', 'important');
    if (this.previewContainer) this.previewContainer.style.setProperty('display', 'none', 'important');
    if (this.reviewContainer) this.reviewContainer.style.setProperty('display', 'none', 'important');
    if (this.spreadsheetContainer) this.spreadsheetContainer.style.setProperty('display', 'none', 'important');
    this.editorContainer.style.setProperty('display', 'block', 'important');

    this.activeTab = tab;
    this.onActiveFileChange?.(tab);
    this.editor?.setModel(tab.model);

    // 0-Lag Visual Toggle: renderTabs() ile tüm DOM'u yıkmak yerine sadece .active class'ını güncelle!
    this.updateActiveTabVisuals(tab.path);

    this.editor?.focus();
    // 0-Lag Layout: 4 ardışık layout() fırtınası yerine tek bir RAF!
    requestAnimationFrame(() => {
      this.editor?.layout();
    });

    CodeDiagnosticsEngine.getInstance().scheduleValidation(tab.model, 250);
    this.scheduleGitGutter(tab, 120);
    this.renderBreakpoints(tab);
    this.updateBreadcrumbs(tab.path);
    this.onFileContentChange?.(tab.model.getValue(), tab.path);

    if (this.onLanguageChange) {
      this.onLanguageChange(this.detectLanguage(tab.path));
    }
    this.onWelcomeTabStateChange?.(false);
    this.onScriptTabStateChange?.(false);
    this.onPlanTabStateChange?.(false);
    this.onSessionTabStateChange?.(false);
    this.onLiveScriptTabStateChange?.(false);
    this.onReviewTabStateChange?.(false);
  }

  public closeActiveTab(): void {
    if (this.isWelcomeActive) {
      this.closeWelcomeTab();
    } else if (this.isReviewActive) {
      this.closeReviewTab();
    } else if (this.isLiveScriptActive) {
      this.closeLiveScriptTab();
    } else if (this.isScriptActive) {
      this.closeScriptTab();
    } else if (this.isPlanActive) {
      this.closePlanTab();
    } else if (this.isSessionActive) {
      this.closeSessionTab();
    } else if (this.activeTab) {
      this.closeTab(this.activeTab);
    }
  }

  public closeOtherTabs(tabToKeep: EditorTab): void {
    const toClose = this.tabs.filter(t => t !== tabToKeep);
    for (const t of toClose) {
      this.closeTab(t);
    }
  }

  public closeTabsToTheRight(targetTab: EditorTab): void {
    const idx = this.tabs.indexOf(targetTab);
    if (idx !== -1) {
      const toClose = this.tabs.slice(idx + 1);
      for (const t of toClose) {
        this.closeTab(t);
      }
    }
  }

  public closeAllTabs(): void {
    const all = [...this.tabs];
    for (const t of all) {
      this.closeTab(t);
    }
    this.closeWelcomeTab();
    this.closeScriptTab();
    this.closePlanTab();
    this.closeSessionTab();
  }

  public closeSavedTabs(): void {
    const saved = this.tabs.filter(t => !t.isDirty);
    for (const t of saved) {
      this.closeTab(t);
    }
  }

  public async saveAllFiles(): Promise<void> {
    const dirtyTabs = this.tabs.filter(t => t.isDirty);
    for (const t of dirtyTabs) {
      try {
        const val = t.model.getValue();
        await window.kragaAPI.fs.writeFile(t.path, val);
        t.isDirty = false;
        this.originalContents.set(t.path, val);
        this.updateGitGutter(t);
      } catch (err) {
        console.error('Dosya kaydedilemedi:', t.path, err);
      }
    }
    this.renderTabs();
  }

  public async formatDocument(): Promise<void> {
    if (this.editor) {
      try {
        const action = this.editor.getAction('editor.action.formatDocument');
        if (action) {
          await action.run();
        }
      } catch (err) {
        console.warn('Belge biçimlendirme hatası:', err);
      }
    }
  }

  public closeTab(tabToClose: EditorTab): void {
    if (tabToClose.isDirty) {
      if (!confirm(`"${tabToClose.name}" üzerinde kaydedilmemiş değişiklikler var. Yine de kapatılsın mı?`)) {
        return;
      }
    }

    const idx = this.tabs.indexOf(tabToClose);
    if (idx === -1) return;

    this.originalContents.delete(tabToClose.path);
    if (this.activeTab === tabToClose && this.editor) {
      this.gutterDecorations = this.editor.deltaDecorations(this.gutterDecorations, []);
    }

    tabToClose.model.dispose();
    this.tabs.splice(idx, 1);

    if (this.activeTab === tabToClose) {
      const nextTab = this.tabs[idx] || this.tabs[idx - 1] || null;
      if (nextTab) {
        this.switchTab(nextTab);
      } else {
        this.activeTab = null;
        this.editor?.setModel(null);
        this.onBreadcrumbsChange?.([]);
        if (this.showScriptTab) {
          this.openScriptTab();
        } else if (this.showPlanTab) {
          this.openPlanTab(this.planTitle);
        } else if (this.showSessionTab) {
          this.openSessionTab();
        } else if (this.showWelcomeTab) {
          this.openWelcomeTab();
        } else {
          this.showEmptyState();
        }
      }
    }
    this.renderTabs();
  }

  public async saveActiveFile(): Promise<void> {
    if (!this.activeTab) return;
    const content = this.activeTab.model.getValue();
    try {
      await window.kragaAPI.fs.writeFile(this.activeTab.path, content);
      this.activeTab.isDirty = false;
      this.originalContents.set(this.activeTab.path, content);
      this.updateGitGutter(this.activeTab);
      this.renderTabs();
    } catch (err) {
      console.error('Dosya kaydedilemedi:', err);
    }
  }

  private renderTabs(): void {
    this.tabsContainer.innerHTML = '';

    // 1. Hoş Geldiniz sekmesi
    if (this.showWelcomeTab) {
      const welcomeTabEl = document.createElement('div');
      welcomeTabEl.className = `editor-tab editor-tab--welcome ${this.isWelcomeActive ? 'active' : ''}`;
      welcomeTabEl.innerHTML = `
        <span class="editor-tab__icon">${kragaBirdImg(14)}</span>
        <span class="editor-tab__title">Hoş Geldiniz</span>
        <button class="editor-tab__close-btn" title="Kapat">
          ${iconClose(12)}
        </button>
      `;

      welcomeTabEl.querySelector('.editor-tab__close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeWelcomeTab();
      });

      welcomeTabEl.addEventListener('click', () => {
        this.openWelcomeTab();
      });

      this.tabsContainer.appendChild(welcomeTabEl);
    }

    // 2. Script & Görev Paneli sekmesi
    if (this.showScriptTab) {
      const scriptTabEl = document.createElement('div');
      scriptTabEl.className = `editor-tab editor-tab--script ${this.isScriptActive ? 'active' : ''}`;
      scriptTabEl.innerHTML = `
        <span class="editor-tab__icon">${iconTerminal(14, 'var(--accent-color, #00f0ff)')}</span>
        <span class="editor-tab__title">Scriptler & Görevler</span>
        <button class="editor-tab__close-btn" title="Kapat">
          ${iconClose(12)}
        </button>
      `;

      scriptTabEl.querySelector('.editor-tab__close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeScriptTab();
      });

      scriptTabEl.addEventListener('click', () => {
        this.openScriptTab();
      });

      this.tabsContainer.appendChild(scriptTabEl);
    }

    // 3. Uygulama Planı Çalışma Alanı sekmesi
    if (this.showPlanTab) {
      const planTabEl = document.createElement('div');
      planTabEl.className = `editor-tab editor-tab--plan ${this.isPlanActive ? 'active' : ''}`;
      planTabEl.innerHTML = `
        <span class="editor-tab__icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </span>
        <span class="editor-tab__title">Plan: ${this.planTitle}</span>
        <button class="editor-tab__close-btn" title="Kapat">
          ${iconClose(12)}
        </button>
      `;

      planTabEl.querySelector('.editor-tab__close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePlanTab();
      });

      planTabEl.addEventListener('click', () => {
        this.openPlanTab(this.planTitle);
      });

      this.tabsContainer.appendChild(planTabEl);
    }

    // 4. Sohbet Oturumları & Geçmiş Çalışma Alanı sekmesi
    if (this.showSessionTab) {
      const sessionTabEl = document.createElement('div');
      sessionTabEl.className = `editor-tab editor-tab--session ${this.isSessionActive ? 'active' : ''}`;
      sessionTabEl.innerHTML = `
        <span class="editor-tab__icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </span>
        <span class="editor-tab__title">Oturumlar & Geçmiş</span>
        <button class="editor-tab__close-btn" title="Kapat">
          ${iconClose(12)}
        </button>
      `;

      sessionTabEl.querySelector('.editor-tab__close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeSessionTab();
      });

      sessionTabEl.addEventListener('click', () => {
        this.openSessionTab();
      });

      this.tabsContainer.appendChild(sessionTabEl);
    }

    // 5. Antigravity Canlı Kod / Artifact Sekmesi
    if (this.showLiveScriptTab) {
      const liveTabEl = document.createElement('div');
      liveTabEl.className = `editor-tab editor-tab--livescript live-script-tab ${this.isLiveScriptStreaming ? 'live-streaming' : ''} ${this.isLiveScriptActive ? 'active' : ''}`;
      liveTabEl.innerHTML = `
        <span class="live-tab-pulse-dot"></span>
        <span class="editor-tab__title">⚡ Canlı: ${this.liveScriptTitle}</span>
        <button class="editor-tab__close-btn" title="Kapat">
          ${iconClose(12)}
        </button>
      `;

      liveTabEl.querySelector('.editor-tab__close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeLiveScriptTab();
      });

      liveTabEl.addEventListener('click', () => {
        this.openLiveScriptTab(this.liveScriptTitle, this.isLiveScriptStreaming);
        this.onLiveScriptTabSelect?.();
      });

      this.tabsContainer.appendChild(liveTabEl);
    }

    // 6. Canlı Önizleme Sekmesi (HTML / Web / PDF / Markdown)
    if (this.showPreviewTab) {
      const prevTabEl = document.createElement('div');
      prevTabEl.className = `editor-tab editor-tab--preview ${this.isPreviewActive ? 'active' : ''}`;
      prevTabEl.innerHTML = `
        <span class="editor-tab__icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </span>
        <span class="editor-tab__title">Önizleme: ${this.previewTitle}</span>
        <button class="editor-tab__close-btn" title="Kapat">
          ${iconClose(12)}
        </button>
      `;

      prevTabEl.querySelector('.editor-tab__close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closePreviewTab();
      });

      prevTabEl.addEventListener('click', () => {
        this.openPreviewTab(this.previewTitle);
      });

      this.tabsContainer.appendChild(prevTabEl);
    }

    // 6.5 Değişiklikleri İncele (Review) Sekmesi
    if (this.showReviewTab) {
      const revTabEl = document.createElement('div');
      revTabEl.className = `editor-tab editor-tab--review ${this.isReviewActive ? 'active' : ''}`;
      revTabEl.innerHTML = `
        <span class="editor-tab__icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color, #00f0ff)" stroke-width="2">
            <circle cx="12" cy="12" r="4"/>
            <line x1="1.05" y1="12" x2="7" y2="12"/>
            <line x1="17.05" y1="12" x2="23" y2="12"/>
          </svg>
        </span>
        <span class="editor-tab__title">${this.reviewTitle}</span>
        <button class="editor-tab__close-btn" title="Kapat">
          ${iconClose(12)}
        </button>
      `;

      revTabEl.querySelector('.editor-tab__close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeReviewTab();
      });

      revTabEl.addEventListener('click', () => {
        this.openReviewTab(this.reviewTitle);
      });

      this.tabsContainer.appendChild(revTabEl);
    }

    // 6.6 Excel / Spreadsheet Sekmesi
    if (this.showSpreadsheetTab && this.spreadsheetFilePath) {
      const sheetTabEl = document.createElement('div');
      const sheetFileName = this.spreadsheetFilePath.split(/[\\/]/).pop() || 'Tablo';
      const isDirty = spreadsheetWorkspace.getIsDirty();
      sheetTabEl.className = `editor-tab editor-tab--spreadsheet ${this.isSpreadsheetActive ? 'active' : ''} ${isDirty ? 'dirty' : ''}`;
      sheetTabEl.title = this.spreadsheetFilePath;
      sheetTabEl.innerHTML = `
        <span class="editor-tab__icon" style="color: #107c41; display: inline-flex; align-items: center;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke="#107c41" fill="#107c4122"/>
            <path d="M7 8h10M7 12h10M7 16h10" stroke="#107c41"/>
            <path d="M12 3v18" stroke="#107c41"/>
          </svg>
        </span>
        <span class="editor-tab__title">${sheetFileName}</span>
        ${isDirty ? '<span class="editor-tab__dirty-indicator" title="Kaydedilmemiş değişiklikler">●</span>' : ''}
        <button class="editor-tab__close-btn" title="Kapat">
          ${iconClose(12)}
        </button>
      `;

      sheetTabEl.querySelector('.editor-tab__close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeSpreadsheetTab();
      });

      sheetTabEl.addEventListener('click', () => {
        this.openSpreadsheetTab(this.spreadsheetFilePath);
      });

      this.tabsContainer.appendChild(sheetTabEl);
    }

    // 7. Açık dosyalar (Visual Studio 2022 Formatı)
    for (const tab of this.tabs) {
      const ext = tab.name.split('.').pop()?.toLowerCase() || '';
      let langBadgeHtml = '';
      if (ext === 'cs') {
        langBadgeHtml = '<span class="vs-tab-lang vs-tab-lang--cs" title="C#">C#</span>';
      } else if (ext === 'ts' || ext === 'tsx') {
        langBadgeHtml = '<span class="vs-tab-lang vs-tab-lang--ts" title="TypeScript">TS</span>';
      } else if (ext === 'js' || ext === 'jsx' || ext === 'mjs') {
        langBadgeHtml = '<span class="vs-tab-lang vs-tab-lang--js" title="JavaScript">JS</span>';
      } else if (ext === 'py') {
        langBadgeHtml = '<span class="vs-tab-lang vs-tab-lang--py" title="Python">Py</span>';
      } else if (ext === 'json') {
        langBadgeHtml = '<span class="vs-tab-lang vs-tab-lang--json" title="JSON">{}</span>';
      } else if (ext === 'html') {
        langBadgeHtml = '<span class="vs-tab-lang vs-tab-lang--html" title="HTML">&lt;&gt;</span>';
      } else if (ext === 'css' || ext === 'scss') {
        langBadgeHtml = '<span class="vs-tab-lang vs-tab-lang--css" title="CSS">#</span>';
      } else {
        langBadgeHtml = '<span class="vs-tab-lang vs-tab-lang--file" title="Dosya">📄</span>';
      }

      const dirtyStar = tab.isDirty ? '*' : '';
      const pinClass = tab.isPinned ? 'vs-tab--pinned' : '';

      const isTabHtml = ext === 'html' || ext === 'htm';
      const previewTabBtnHtml = isTabHtml ? `
        <button class="editor-tab__preview-btn" title="Canlı Önizleme Penceresinde Aç">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      ` : '';

      const tabEl = document.createElement('div');
      tabEl.className = `editor-tab ${pinClass} ${!this.isWelcomeActive && this.activeTab === tab ? 'active' : ''}`;
      tabEl.title = tab.path;
      tabEl.innerHTML = `
        ${langBadgeHtml}
        <span class="editor-tab__title">${tab.name}${dirtyStar}</span>
        ${tab.isDirty ? '<span class="editor-tab__dirty-dot"></span>' : ''}
        ${previewTabBtnHtml}
        <button class="editor-tab__pin-btn ${tab.isPinned ? 'active' : ''}" title="${tab.isPinned ? 'Sabitlemeyi Kaldır' : 'Sekmeyi Sabitle'}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="${tab.isPinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-2l-2-4V5a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2v6l-2 4v2z"/></svg>
        </button>
        <button class="editor-tab__close-btn" title="Kapat">
          ${iconClose(12)}
        </button>
      `;

      // Sol tıkla sekmeye geç
      tabEl.addEventListener('click', () => {
        this.switchTab(tab);
      });

      // HTML Hızlı Önizleme butonu
      tabEl.querySelector('.editor-tab__preview-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('kraga:open-preview', {
          detail: {
            filePath: tab.path,
            content: tab.model.getValue(),
            title: tab.name
          }
        }));
      });

      // Pin butonuna tıkla
      tabEl.querySelector('.editor-tab__pin-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePinTab(tab);
      });

      // Fare tekerleği (orta tuş) ile sekmeyi kapat
      tabEl.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          this.closeTab(tab);
        }
      });

      // Sağ tıkla zengin sekme menüsü aç
      tabEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showTabContextMenu(e, tab);
      });

      tabEl.querySelector('.editor-tab__close-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab);
      });

      this.tabsContainer.appendChild(tabEl);
    }

    // 7. Sekme Çubuğu Sağ Aksiyonları (Canlı Önizleme, Bölünmüş Ekran & Açık Belgeler Listesi)
    const rightActionsEl = document.createElement('div');
    rightActionsEl.className = 'vs-tabs-right-actions';

    const isHtmlOrWeb = this.activeTab && /\.(html?|svg|md|markdown)$/i.test(this.activeTab.path);
    const previewBtnClass = isHtmlOrWeb ? 'vs-tab-right-btn vs-tab-right-btn--preview-active' : 'vs-tab-right-btn';
    const previewBtnTitle = isHtmlOrWeb 
      ? `Canlı Önizleme Penceresi Aç (${this.activeTab?.name})` 
      : 'Canlı Önizleme (Tarayıcı / Pop-up)';

    rightActionsEl.innerHTML = `
      <button class="${previewBtnClass}" id="vsBtnLivePreviewTab" title="${previewBtnTitle}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"/>
        </svg>
        ${isHtmlOrWeb ? '<span class="vs-tab-preview-label">Önizle</span>' : ''}
      </button>
      <button class="vs-tab-right-btn" id="vsBtnSplitEditorTab" title="Editörü Böl (Yatay/Dikey)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
      </button>
      <button class="vs-tab-right-btn" id="vsBtnTabOverflow" title="Açık Dosyaları Listele">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    `;

    rightActionsEl.querySelector('#vsBtnLivePreviewTab')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.activeTab) {
        window.dispatchEvent(new CustomEvent('kraga:open-preview', {
          detail: {
            filePath: this.activeTab.path,
            content: this.activeTab.model.getValue(),
            title: this.activeTab.name
          }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('kraga:open-preview', {
          detail: { title: 'Canlı Önizleme' }
        }));
      }
    });

    rightActionsEl.querySelector('#vsBtnSplitEditorTab')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSplitEditorToggle?.();
    });

    rightActionsEl.querySelector('#vsBtnTabOverflow')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showTabOverflowMenu(e as MouseEvent);
    });

    this.tabsContainer.appendChild(rightActionsEl);
  }

  private showTabOverflowMenu(e: MouseEvent): void {
    if (this.tabs.length === 0) return;
    const menuEl = document.createElement('div');
    menuEl.className = 'vs-tab-overflow-menu';
    menuEl.style.top = `${e.clientY + 10}px`;
    menuEl.style.right = '20px';

    menuEl.innerHTML = `
      <div class="vs-overflow-header">Açık Belgeler (${this.tabs.length})</div>
      <div class="vs-overflow-list">
        ${this.tabs.map(t => `
          <div class="vs-overflow-item ${t === this.activeTab ? 'active' : ''}" data-path="${t.path}">
            <span class="vs-overflow-name">${t.name}${t.isDirty ? '*' : ''}</span>
            <span class="vs-overflow-path">${t.path}</span>
          </div>
        `).join('')}
      </div>
    `;

    document.body.appendChild(menuEl);

    const closeMenu = (ev: MouseEvent) => {
      if (!menuEl.contains(ev.target as Node)) {
        menuEl.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);

    menuEl.querySelectorAll('.vs-overflow-item').forEach(item => {
      item.addEventListener('click', () => {
        const path = (item as HTMLElement).dataset.path;
        const target = this.tabs.find(t => t.path === path);
        if (target) {
          this.switchTab(target);
          menuEl.remove();
        }
      });
    });
  }

  private initTabContextMenu(): void {
    this.tabContextMenuEl = document.createElement('div');
    this.tabContextMenuEl.className = 'tab-context-menu tab-context-menu--hidden';
    this.tabContextMenuEl.innerHTML = `
      <div class="tab-context-menu__item" data-action="toggle-pin"><span>Sabitle / Sabitlemeyi Kaldır</span><span class="context-shortcut">📌</span></div>
      <div class="tab-context-menu__separator"></div>
      <div class="tab-context-menu__item" data-action="close"><span>Kapat</span><span class="context-shortcut">Ctrl+W</span></div>
      <div class="tab-context-menu__item" data-action="close-others"><span>Diğerlerini Kapat</span></div>
      <div class="tab-context-menu__item" data-action="close-right"><span>Sağdakileri Kapat</span></div>
      <div class="tab-context-menu__item" data-action="close-saved"><span>Kaydedilenleri Kapat</span></div>
      <div class="tab-context-menu__item" data-action="close-all"><span>Tümünü Kapat</span></div>
      <div class="tab-context-menu__separator"></div>
      <div class="tab-context-menu__item" data-action="copy-path"><span>Dosya Yolunu Kopyala</span></div>
      <div class="tab-context-menu__item" data-action="reveal-explorer"><span>Dosya Gezgininde Göster</span></div>
    `;
    document.body.appendChild(this.tabContextMenuEl);

    document.addEventListener('click', () => this.hideTabContextMenu());

    this.tabContextMenuEl.querySelectorAll('.tab-context-menu__item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (e.currentTarget as HTMLElement).dataset.action;
        if (this.contextMenuTargetTab) {
          const target = this.contextMenuTargetTab;
          this.hideTabContextMenu();
          switch (action) {
            case 'toggle-pin':
              this.togglePinTab(target);
              break;
            case 'close':
              this.closeTab(target);
              break;
            case 'close-others':
              this.closeOtherTabs(target);
              break;
            case 'close-right':
              this.closeTabsToTheRight(target);
              break;
            case 'close-saved':
              this.closeSavedTabs();
              break;
            case 'close-all':
              this.closeAllTabs();
              break;
            case 'copy-path':
              navigator.clipboard.writeText(target.path);
              break;
            case 'reveal-explorer':
              await window.kragaAPI.fs.revealInFolder?.(target.path);
              break;
          }
        }
      });
    });
  }

  private showTabContextMenu(e: MouseEvent, tab: EditorTab): void {
    if (!this.tabContextMenuEl) return;
    this.contextMenuTargetTab = tab;
    this.tabContextMenuEl.style.top = `${e.clientY}px`;
    this.tabContextMenuEl.style.left = `${e.clientX}px`;
    this.tabContextMenuEl.classList.remove('tab-context-menu--hidden');
  }

  private hideTabContextMenu(): void {
    if (this.tabContextMenuEl) {
      this.tabContextMenuEl.classList.add('tab-context-menu--hidden');
      this.contextMenuTargetTab = null;
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs':
        return 'javascript';
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'css':
      case 'scss':
        return 'css';
      case 'py':
        return 'python';
      case 'md':
        return 'markdown';
      case 'sql':
        return 'sql';
      case 'yml':
      case 'yaml':
        return 'yaml';
      default:
        return 'plaintext';
    }
  }

  public getActiveFile(): EditorTab | null {
    return this.activeTab;
  }

  public getOpenFiles(): { path: string; name: string }[] {
    return this.tabs.map(t => ({ path: t.path, name: t.name }));
  }

  private layoutRafId: number | null = null;
  public layout(): void {
    if (this.layoutRafId !== null) cancelAnimationFrame(this.layoutRafId);
    this.layoutRafId = requestAnimationFrame(() => {
      this.layoutRafId = null;
      this.editor?.layout();
    });
  }
}
