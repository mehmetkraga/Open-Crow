/**
 * Kraga IDE - İzin ve Yürütme Güvenlik Yöneticisi (PermissionManager)
 * Cursor-style detaylı çalışma izinleri ve güvenlik denetimi.
 */

export type PermissionMode = 'ask_all' | 'ask_critical' | 'auto';

export type PermissionActionType = 'terminal' | 'file_write' | 'file_delete' | 'mcp';

export interface PermissionSettings {
  mode: PermissionMode;
  allowTerminalAutoRun: boolean;
  allowFileWrite: boolean;
  confirmFileDelete: boolean;
  allowMCPAutoRun: boolean;
  blockDangerousCommands: boolean;
}

export interface PermissionRequest {
  type: PermissionActionType;
  title: string;
  detail: string;
  isDangerous?: boolean;
  targetSessionId?: string;
}

export interface PermissionCheckResult {
  granted: boolean;
  requiresPrompt: boolean;
  reason?: string;
  isBlocked?: boolean;
}

const STORAGE_KEY = 'kraga_permissions_settings';

const DEFAULT_SETTINGS: PermissionSettings = {
  mode: 'ask_critical', // Varsayılan: Dengeli & Güvenli (Terminalde onay sorar, kod yazma akıcıdır)
  allowTerminalAutoRun: false,
  allowFileWrite: true,
  confirmFileDelete: true,
  allowMCPAutoRun: true,
  blockDangerousCommands: true,
};

// Potansiyel yıkıcı terminal komut kalıpları
const DANGEROUS_PATTERNS = [
  /\brm\s+-[rf]{1,3}\s+[/~]/i,
  /\bdel\s+\/[fqsb]{1,4}\s+[c-z]:\\/i,
  /\bdel\s+\/s\s+\/q/i,
  /\bformat\s+[c-z]:/i,
  /\bdiskpart\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\bdrop\s+(database|schema)\b/i,
  /\bshutdown\s+[\/-]/i,
  /\bchmod\s+-R\s+777\s+\//i,
];

export class PermissionManager {
  private static instance: PermissionManager;
  private settings: PermissionSettings;
  private sessionBypasses: Set<PermissionActionType> = new Set();
  private listeners: Set<(settings: PermissionSettings) => void> = new Set();

  private constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): PermissionManager {
    if (!PermissionManager.instance) {
      PermissionManager.instance = new PermissionManager();
    }
    return PermissionManager.instance;
  }

  private loadSettings(): PermissionSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('[PermissionManager] Ayarlar okunamadı:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      this.notifyListeners();
    } catch (e) {
      console.error('[PermissionManager] Ayarlar kaydedilemedi:', e);
    }
  }

  public getSettings(): PermissionSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<PermissionSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
  }

  public setMode(mode: PermissionMode): void {
    this.settings.mode = mode;
    if (mode === 'auto') {
      // 1. Tam Otonom (YOLO / Auto-Approve): Tüm işlemler otomatik, sorma
      this.settings.allowTerminalAutoRun = true;
      this.settings.allowFileWrite = true;
      this.settings.allowMCPAutoRun = true;
      this.settings.confirmFileDelete = false;
    } else if (mode === 'ask_all') {
      // 2. Her İşlemde Sor (Strict): Tüm dosya ve terminal komutlarında onay zorunlu
      this.settings.allowTerminalAutoRun = false;
      this.settings.allowFileWrite = false;
      this.settings.allowMCPAutoRun = false;
      this.settings.confirmFileDelete = true;
    } else {
      // 3. Dengeli (Varsayılan): Kod yazma/okuma akıcı ve otomatik, terminal ve dosya silmede onay sor
      this.settings.allowTerminalAutoRun = false;
      this.settings.allowFileWrite = true;
      this.settings.confirmFileDelete = true;
      this.settings.allowMCPAutoRun = true;
    }
    this.saveSettings();
  }

  /**
   * Terminal komutunun tehlikeli olup olmadığını denetler
   */
  public isDangerousCommand(command: string): boolean {
    const trimmed = command.trim();
    return DANGEROUS_PATTERNS.some((pattern) => pattern.test(trimmed));
  }

  /**
   * Belirtilen eylem için izin durumunu denetler
   */
  public check(req: PermissionRequest): PermissionCheckResult {
    // 1. Tehlikeli komut kuralı denetimi
    if (req.type === 'terminal' && this.isDangerousCommand(req.detail)) {
      if (this.settings.blockDangerousCommands) {
        return {
          granted: false,
          requiresPrompt: false,
          isBlocked: true,
          reason: 'Güvenlik Protokolü: Yıkıcı potansiyele sahip sistem komutu engellendi.',
        };
      }
      // Engelleme kapalı olsa dahi kritik kabul edilip sorulmalı
      return { granted: false, requiresPrompt: true, reason: 'Kritik sistem komutu onayı' };
    }

    // 2. Bu oturumda daha önce 'Hep İzin Ver' seçilmiş mi?
    if (this.sessionBypasses.has(req.type)) {
      return { granted: true, requiresPrompt: false };
    }

    // 3. Mod kontrolü
    if (this.settings.mode === 'auto') {
      // Tam Otonom / Asla Sorma Modu
      return { granted: true, requiresPrompt: false };
    }

    if (this.settings.mode === 'ask_all') {
      // Her Zaman Sor (Paranoid)
      return { granted: false, requiresPrompt: true, reason: 'Her zaman onay zorunlu' };
    }

    // 4. 'ask_critical' modunda granüler anahtarlar
    switch (req.type) {
      case 'terminal':
        if (!this.settings.allowTerminalAutoRun || req.isDangerous) {
          return { granted: false, requiresPrompt: true, reason: 'Terminal çalıştırma onayı' };
        }
        return { granted: true, requiresPrompt: false };

      case 'file_write':
        if (!this.settings.allowFileWrite) {
          return { granted: false, requiresPrompt: true, reason: 'Dosya yazma onayı' };
        }
        return { granted: true, requiresPrompt: false };

      case 'file_delete':
        if (this.settings.confirmFileDelete) {
          return { granted: false, requiresPrompt: true, reason: 'Dosya silme onayı' };
        }
        return { granted: true, requiresPrompt: false };

      case 'mcp':
        if (!this.settings.allowMCPAutoRun) {
          return { granted: false, requiresPrompt: true, reason: 'MCP araç çağrısı onayı' };
        }
        return { granted: true, requiresPrompt: false };

      default:
        return { granted: true, requiresPrompt: false };
    }
  }

  /**
   * Oturum boyunca belirli bir eylem tipine onay ver
   */
  public grantSessionBypass(type: PermissionActionType): void {
    this.sessionBypasses.add(type);
  }

  /**
   * Oturum bypass'larını sıfırla
   */
  public clearSessionBypasses(): void {
    this.sessionBypasses.clear();
  }

  /**
   * Aktif oturum bypass'larını dizi olarak döndür
   */
  public getSessionBypasses(): PermissionActionType[] {
    return Array.from(this.sessionBypasses);
  }

  public onChange(listener: (settings: PermissionSettings) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const s = this.getSettings();
    this.listeners.forEach((fn) => fn(s));
  }
}

export const permissionManager = PermissionManager.getInstance();
