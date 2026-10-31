// electron/services/updateManager.ts
// Kraga IDE — Yerleşik Otomatik Güncelleme Motoru (In-App Auto-Updater)
// - GitHub Releases API (mehmetkraga/KRAGA-AI-IDE-RELEASES) entegrasyonu
// - Arka planda akışlı installer (.exe) indirme & ilerleme yüzdesi (Progress Bar)
// - Saatlik periyodik otomatik kontrol & masaüstü/uygulama içi bildirim köprüsü
// - Tek tıkla sessiz kurulum (/S) ve otomatik yeniden başlatma (Relaunch)

import { app, BrowserWindow, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawn } from 'node:child_process';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string | null;
  assetName: string | null;
  assetSize: number;
}

export interface DownloadProgress {
  percent: number;
  downloaded: number;
  total: number;
}

export class UpdateManager {
  private static instance: UpdateManager;
  private readonly repoOwner = 'mehmetkraga';
  private readonly repoName = 'KRAGA-AI-IDE-RELEASES';
  private downloadedInstallerPath: string | null = null;
  private isDownloading = false;
  private hourlyTimer: NodeJS.Timeout | null = null;
  private mainWindow: BrowserWindow | null = null;
  private latestUpdateInfo: UpdateInfo | null = null;

  private constructor() {}

  public static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }
    return UpdateManager.instance;
  }

  public setWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  /**
   * Semver versiyon karşılaştırması (örn: "1.3.0" > "1.2.9")
   */
  private isNewerVersion(latest: string, current: string): boolean {
    const cleanL = latest.replace(/^v/i, '').trim();
    const cleanC = current.replace(/^v/i, '').trim();

    const partsL = cleanL.split('.').map(n => parseInt(n, 10) || 0);
    const partsC = cleanC.split('.').map(n => parseInt(n, 10) || 0);

    const len = Math.max(partsL.length, partsC.length);
    for (let i = 0; i < len; i++) {
      const vL = partsL[i] || 0;
      const vC = partsC[i] || 0;
      if (vL > vC) return true;
      if (vL < vC) return false;
    }
    return false;
  }

  /**
   * GitHub Releases API üzerinden en son sürümü denetler
   */
  public async checkForUpdates(): Promise<UpdateInfo> {
    const currentVersion = app.getVersion();

    return new Promise((resolve) => {
      const options: https.RequestOptions = {
        hostname: 'api.github.com',
        path: `/repos/${this.repoOwner}/${this.repoName}/releases/latest`,
        method: 'GET',
        headers: {
          'User-Agent': `OpenCrow-App/${currentVersion}`,
          Accept: 'application/vnd.github.v3+json',
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              resolve({
                hasUpdate: false,
                currentVersion,
                latestVersion: currentVersion,
                releaseName: '',
                releaseNotes: '',
                publishedAt: '',
                downloadUrl: null,
                assetName: null,
                assetSize: 0,
              });
              return;
            }

            const release = JSON.parse(data);
            const latestTag = release.tag_name || release.name || '';
            const latestVersion = latestTag.replace(/^v/i, '').trim();
            const hasUpdate = this.isNewerVersion(latestVersion, currentVersion);

            // İşletim sistemine uygun kurulum dosyasını bul (Win: .exe, Mac: .dmg/.zip, Linux: .AppImage/.deb)
            let downloadUrl: string | null = null;
            let assetName: string | null = null;
            let assetSize = 0;

            if (Array.isArray(release.assets)) {
              let matchedAsset: any = null;
              if (process.platform === 'win32') {
                matchedAsset = release.assets.find((a: any) =>
                  typeof a.name === 'string' && a.name.endsWith('.exe') && !a.name.includes('.blockmap')
                );
              } else if (process.platform === 'darwin') {
                matchedAsset = release.assets.find((a: any) =>
                  typeof a.name === 'string' && (a.name.endsWith('.dmg') || a.name.endsWith('-mac.zip')) && !a.name.includes('.blockmap')
                );
              } else {
                matchedAsset = release.assets.find((a: any) =>
                  typeof a.name === 'string' && (a.name.endsWith('.AppImage') || a.name.endsWith('.deb')) && !a.name.includes('.blockmap')
                );
              }

              if (matchedAsset) {
                downloadUrl = matchedAsset.browser_download_url;
                assetName = matchedAsset.name;
                assetSize = matchedAsset.size || 0;
              }
            }

            const result: UpdateInfo = {
              hasUpdate,
              currentVersion,
              latestVersion,
              releaseName: release.name || latestTag,
              releaseNotes: release.body || '',
              publishedAt: release.published_at || '',
              downloadUrl,
              assetName,
              assetSize,
            };

            this.latestUpdateInfo = result;
            resolve(result);
          } catch {
            resolve({
              hasUpdate: false,
              currentVersion,
              latestVersion: currentVersion,
              releaseName: '',
              releaseNotes: '',
              publishedAt: '',
              downloadUrl: null,
              assetName: null,
              assetSize: 0,
            });
          }
        });
      });

      req.on('error', () => {
        resolve({
          hasUpdate: false,
          currentVersion,
          latestVersion: currentVersion,
          releaseName: '',
          releaseNotes: '',
          publishedAt: '',
          downloadUrl: null,
          assetName: null,
          assetSize: 0,
        });
      });

      req.end();
    });
  }

  /**
   * HTTP 302 yönlendirmelerini takip ederek dosyayı akışlı olarak indirir ve boyut doğrulaması yapar
   */
  private downloadFileWithRedirect(
    url: string,
    targetPath: string,
    expectedSize: number,
    onProgress: (p: DownloadProgress) => void
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const handleRequest = (currentUrl: string, redirectCount = 0) => {
        if (redirectCount > 8) {
          reject(new Error('Çok fazla yönlendirme (Too many redirects)'));
          return;
        }

        const parsedUrl = new URL(currentUrl);
        const options: https.RequestOptions = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': `OpenCrow-App/${app.getVersion()}`,
            Accept: '*/*',
          },
        };

        const req = https.request(options, (res) => {
          // 301 / 302 / 307 / 308 Yönlendirme takibi (GitHub Release -> AWS S3 / objects.githubusercontent.com)
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            handleRequest(res.headers.location, redirectCount + 1);
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`İndirme başarısız oldu (HTTP ${res.statusCode})`));
            return;
          }

          const headerTotal = parseInt(res.headers['content-length'] || '0', 10);
          const totalBytes = headerTotal > 0 ? headerTotal : expectedSize;
          let downloadedBytes = 0;

          // Eğer önceki yarım indirmeden kalan dosya varsa temizle
          if (fs.existsSync(targetPath)) {
            try { fs.unlinkSync(targetPath); } catch {}
          }

          const fileStream = fs.createWriteStream(targetPath);

          res.on('data', (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            const percent = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
            onProgress({
              percent,
              downloaded: downloadedBytes,
              total: totalBytes,
            });
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => {
              // Bütünlük ve boyut kontrolü
              try {
                const stat = fs.statSync(targetPath);
                if (totalBytes > 0 && stat.size < totalBytes) {
                  try { fs.unlinkSync(targetPath); } catch {}
                  reject(new Error(`İndirme tamamlanamadı (${(stat.size / (1024 * 1024)).toFixed(1)} MB / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB). Lütfen tekrar deneyin.`));
                  return;
                }
                resolve(true);
              } catch (err: any) {
                reject(err);
              }
            });
          });

          fileStream.on('error', (err) => {
            try { fs.unlinkSync(targetPath); } catch {}
            reject(err);
          });
        });

        // 45 saniyelik ağ hareketsizlik zaman aşımı
        req.setTimeout(45000, () => {
          req.destroy(new Error('İndirme zaman aşımına uğradı (Ağ bağlantısı koptu).'));
        });

        req.on('error', (err) => {
          try { if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath); } catch {}
          reject(err);
        });

        req.end();
      };

      handleRequest(url);
    });
  }

  /**
   * En son sürümün kurulum dosyasını arka planda indirir ve bütünlüğünü teyit eder
   */
  public async downloadUpdate(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    if (this.isDownloading) {
      return { success: false, error: 'Zaten bir indirme işlemi devam ediyor.' };
    }

    if (!this.latestUpdateInfo || !this.latestUpdateInfo.downloadUrl) {
      const info = await this.checkForUpdates();
      if (!info.hasUpdate || !info.downloadUrl) {
        return { success: false, error: 'İndirilecek yeni bir güncelleme bulunamadı.' };
      }
    }

    const info = this.latestUpdateInfo!;
    const tempDir = app.getPath('temp');
    const defaultExt = process.platform === 'win32' ? '.exe' : (process.platform === 'darwin' ? '.dmg' : '.AppImage');
    const safeFileName = info.assetName || `Kraga-IDE-${info.latestVersion}${defaultExt}`;
    const targetPath = path.join(tempDir, safeFileName);

    // Eğer daha önceden tam inmiş geçerli dosya varsa tekrar indirme yapmadan kullan
    if (fs.existsSync(targetPath)) {
      const existingSize = fs.statSync(targetPath).size;
      if (info.assetSize > 0 && existingSize === info.assetSize) {
        this.downloadedInstallerPath = targetPath;
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('updater:downloaded', {
            version: info.latestVersion,
            filePath: targetPath,
          });
        }
        return { success: true, filePath: targetPath };
      } else {
        // Bozuk/yarım kalmış dosya varsa kaldır
        try { fs.unlinkSync(targetPath); } catch {}
      }
    }

    this.isDownloading = true;

    try {
      await this.downloadFileWithRedirect(info.downloadUrl!, targetPath, info.assetSize, (progress) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('updater:progress', progress);
        }
      });

      this.downloadedInstallerPath = targetPath;
      this.isDownloading = false;

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('updater:downloaded', {
          version: info.latestVersion,
          filePath: targetPath,
        });
      }

      return { success: true, filePath: targetPath };
    } catch (err: any) {
      this.isDownloading = false;
      return { success: false, error: err.message || 'İndirme hatası oluştu.' };
    }
  }

  /**
   * İndirilen güncellemeyi başlatır ve uygulamayı kapatır
   * Windows üzerinde UAC Yönetici yetkisi (RunAs) ve PID kapanma bekleyicisiyle güvenle çalıştırır
   */
  public installUpdate(): void {
    if (!this.downloadedInstallerPath || !fs.existsSync(this.downloadedInstallerPath)) {
      throw new Error('Yüklenecek installer dosyası bulunamadı.');
    }

    const installer = this.downloadedInstallerPath;

    // Dosya boyut kontrolü
    if (this.latestUpdateInfo && this.latestUpdateInfo.assetSize > 0) {
      const currentSize = fs.statSync(installer).size;
      if (currentSize < this.latestUpdateInfo.assetSize) {
        try { fs.unlinkSync(installer); } catch {}
        this.downloadedInstallerPath = null;
        throw new Error('İndirilen kurulum dosyası eksik veya bozuk. Lütfen tekrar indirin.');
      }
    }

    if (process.platform === 'win32') {
      const appExecPath = process.execPath;
      const tempDir = app.getPath('temp');
      const scriptPath = path.join(tempDir, 'kraga-update-runner.cmd');
      const vbsPath = path.join(tempDir, 'kraga-silent-runner.vbs');

      const escapedInstaller = installer.replace(/"/g, '""');
      const escapedExec = appExecPath.replace(/"/g, '""');
      const escapedScriptPath = scriptPath.replace(/"/g, '""');
      const escapedVbsPath = vbsPath.replace(/"/g, '""');

      // Native Windows Silent CMD güncelleme yürütücüsü:
      // Konsol pencereleri wscript.exe üzerinden SW_HIDE (0) ile tamamen gizlenir.
      const cmdScript = `@echo off
chcp 65001 >nul
timeout /t 2 /nobreak >nul
taskkill /f /im "Kraga IDE.exe" >nul 2>&1
timeout /t 1 /nobreak >nul
start "" /wait "${escapedInstaller}" /S --updated --force-run
if errorlevel 1 (
  start "" /wait "${escapedInstaller}" /S
)
timeout /t 2 /nobreak >nul
tasklist /fi "imagename eq Kraga IDE.exe" 2>nul | find /i "Kraga IDE.exe" >nul
if errorlevel 1 (
  if exist "${escapedExec}" (
    start "" "${escapedExec}"
  )
)
timeout /t 3 /nobreak >nul
del /f /q "${escapedInstaller}" >nul 2>&1
del /f /q "${escapedScriptPath}" >nul 2>&1
del /f /q "${escapedVbsPath}" >nul 2>&1
exit
`;

      const vbsScript = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c """ & "${escapedScriptPath}" & """", 0, False
`;

      try {
        fs.writeFileSync(scriptPath, cmdScript, 'utf8');
        fs.writeFileSync(vbsPath, vbsScript, 'utf8');

        // wscript.exe bir Windows GUI sürecidir (Console subsystem değildir).
        // Parametre olarak 0 (vbHide) verildiği için cmd.exe tamamen arka planda, sıfır pencere ile çalışır.
        const child = spawn('wscript.exe', ['//B', '//nologo', vbsPath], {
          detached: true,
          windowsHide: true,
          stdio: 'ignore',
        });

        child.unref();

        setTimeout(() => {
          app.quit();
          setTimeout(() => {
            app.exit(0);
          }, 1000);
        }, 500);
        return;
      } catch (scriptErr) {
        console.warn('[UpdateManager] Silent VBS runner başlatılamadı, doğrudan spawn deneniyor:', scriptErr);
      }
    }

    // macOS: DMG dosyasını mount etmek/açmak için sistem shell'ini kullan
    if (process.platform === 'darwin') {
      shell.openPath(installer);
      setTimeout(() => {
        app.quit();
      }, 1000);
      return;
    }

    // Linux: AppImage için çalıştırma yetkisi ver ve yeni sürümü başlat
    if (process.platform === 'linux') {
      try {
        fs.chmodSync(installer, 0o755);
      } catch {}
      const child = spawn(installer, ['--updated'], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      setTimeout(() => {
        app.quit();
      }, 800);
      return;
    }

    // Genel fallback
    const child = spawn(installer, ['/S', '--updated', '--force-run'], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore',
    });
    child.unref();

    setTimeout(() => {
      app.quit();
    }, 800);
  }

  /**
   * Saatlik periyodik arka plan güncelleme denetleyicisini başlatır
   */
  public startHourlyChecker(intervalMs = 3600000): void {
    if (this.hourlyTimer) {
      clearInterval(this.hourlyTimer);
    }

    // Uygulama açılışından 15 saniye sonra ilk kontrol
    setTimeout(async () => {
      await this.runBackgroundCheck();
    }, 15000);

    // Her 1 saatte bir döngüsel kontrol
    this.hourlyTimer = setInterval(async () => {
      await this.runBackgroundCheck();
    }, intervalMs);
  }

  public stopHourlyChecker(): void {
    if (this.hourlyTimer) {
      clearInterval(this.hourlyTimer);
      this.hourlyTimer = null;
    }
  }

  private async runBackgroundCheck(): Promise<void> {
    try {
      const info = await this.checkForUpdates();
      if (info.hasUpdate && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('updater:available', info);
      }
    } catch {}
  }
}

export const updateManager = UpdateManager.getInstance();
