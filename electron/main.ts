import { app, BrowserWindow, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openFolderDialog,
  readDirectory,
  readFileContent,
  writeFileContent,
  readBinaryFileContent,
  writeBinaryFileContent,
  deletePath,
  renamePath,
  createDirectory,
} from './services/fileSystem.ts';
import {
  runCommand,
  createTerminalSession,
  writeToTerminalSession,
  killTerminalSession,
  killAllTerminalSessions,
} from './services/terminal.ts';
import { mcpManager } from './services/mcpManager.ts';
import { analyzeProjectGraph } from './services/graphify.ts';
import { updateManager } from './services/updateManager.ts';
import { readDocument, createDocument, editDocument } from './services/officeDocs.ts';
import { grepFiles, globFiles, webFetch, webSearch } from './services/workspaceTools.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, '..');
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

// Beklenmeyen ana süreç hatalarını güvenle yakala (Object has been destroyed uyarısını önle)
process.on('uncaughtException', (error) => {
  console.error('[Main Process Uncaught Exception]', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main Process Unhandled Rejection]', reason);
});

// Windows Toast Bildirimlerinde "electron.app.Open Crow" yerine temiz "Open Crow" görünmesi
app.name = 'Open Crow';
if (process.platform === 'win32') {
  app.setAppUserModelId('org.kraga.ide');
}

// ─── Single Instance Lock (Tekil Örnek Kilidi) ────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Başka bir Open Crow süreci zaten çalışıyor; mükerrer pencereyi anında kapat
  app.quit();
} else {
  app.on('second-instance', () => {
    // Kullanıcı .exe'ye tekrar tıkladığında mevcut açık pencereyi öne getir ve odakla
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    } else if (splashWindow) {
      if (splashWindow.isMinimized()) splashWindow.restore();
      splashWindow.focus();
    }
  });

  // Özel sağlayıcılar (localhost, 127.0.0.1, 8443) için SSL bypass
  app.on('certificate-error', (event, _webContents, url, _error, _certificate, callback) => {
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1' ||
        parsed.port === '8443'
      ) {
        event.preventDefault();
        callback(true);
        return;
      }
    } catch {}
    callback(false);
  });

  app.whenReady().then(createWindow);
}

function createWindow() {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const iconPath = isWin
    ? path.join(process.env.APP_ROOT!, 'assets/icon.ico')
    : path.join(process.env.APP_ROOT!, 'assets/icon.png');

  // 1. Visual Studio 2026 Tarzı Splash Ekranı
  splashWindow = new BrowserWindow({
    width: 520,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    center: true,
    resizable: false,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const splashFile = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT!, 'splash.html')
    : path.join(RENDERER_DIST, 'splash.html');

  if (fs.existsSync(splashFile)) {
    splashWindow.loadFile(splashFile);
  } else {
    splashWindow.loadFile(path.join(process.env.APP_ROOT!, 'splash.html'));
  }

  // 2. Ana IDE Penceresi (Arka Planda Hazırlanır)
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a14',
    title: 'Open Crow',
    icon: iconPath,
    frame: false, // Özel modern başlık çubuğu için
    thickFrame: isWin, // Windows standart kenar boyutlandırma ve gölgesi için
    titleBarStyle: isMac ? ('hiddenInset' as any) : undefined,
    trafficLightPosition: isMac ? { x: 12, y: 12 } : undefined,
    resizable: true,
    show: false, // Splash gösterilirken gizli başlar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const splashStartTime = Date.now();
  let splashClosed = false;

  const closeSplashAndShowMain = () => {
    if (splashClosed) return;
    splashClosed = true;
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      updateManager.setWindow(mainWindow);
      updateManager.startHourlyChecker();
    }
  };

  // 8 saniyelik emniyet zaman aşımı (did-finish-load takılırsa IDE'nin açılmasını garantiye al)
  const splashSafetyTimer = setTimeout(() => {
    closeSplashAndShowMain();
  }, 8000);

  mainWindow.webContents.once('did-finish-load', () => {
    clearTimeout(splashSafetyTimer);
    const elapsed = Date.now() - splashStartTime;
    const minSplashDuration = 1200; // Otantik Visual Studio deneyimi için min 1.2s
    const remainingTime = Math.max(0, minSplashDuration - elapsed);

    setTimeout(() => {
      closeSplashAndShowMain();
    }, remainingTime);
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  // Dış web bağlantılarını sistemin varsayılan tarayıcısında (Chrome, Edge vb.) aç
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Geliştirici Araçları (F12 ve Ctrl+Shift+I) kısayolu
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12' || (input.control && input.shift && input.key?.toLowerCase() === 'i')) {
        mainWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
    }
  });

  // Pencere boyutu ve kontrolleri
  mainWindow.on('maximize', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents?.isDestroyed()) {
        mainWindow.webContents.send('app:maximize-change', true);
      }
    } catch {}
  });

  mainWindow.on('unmaximize', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents?.isDestroyed()) {
        mainWindow.webContents.send('app:maximize-change', false);
      }
    } catch {}
  });

  mainWindow.on('enter-full-screen', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents?.isDestroyed()) {
        mainWindow.webContents.send('app:maximize-change', true);
      }
    } catch {}
  });

  mainWindow.on('leave-full-screen', () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents?.isDestroyed()) {
        mainWindow.webContents.send('app:maximize-change', mainWindow.isMaximized());
      }
    } catch {}
  });

  mainWindow.on('closed', () => {
    killAllTerminalSessions();
    mainWindow = null;
  });

  ipcMain.on('app:minimize', () => mainWindow?.minimize());
  ipcMain.on('app:maximize', () => {
    if (mainWindow?.isFullScreen()) {
      mainWindow.setFullScreen(false);
    } else if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.on('app:close', () => mainWindow?.close());
  ipcMain.handle('app:isMaximized', () => mainWindow?.isMaximized() ?? false);
}

// IPC Handlers: Harici Link Açıcı
ipcMain.handle('app:openExternal', async (_, url: string) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    await shell.openExternal(url);
    return true;
  }
  return false;
});

// IPC Handlers: Dosya Sistemi
ipcMain.handle('fs:openFolder', async () => {
  if (!mainWindow) return null;
  return await openFolderDialog(mainWindow);
});

ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
  return await readDirectory(dirPath);
});

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  return await readFileContent(filePath);
});

ipcMain.handle('fs:readBinaryFile', async (_, filePath: string) => {
  return await readBinaryFileContent(filePath);
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  return await writeFileContent(filePath, content);
});

ipcMain.handle('fs:writeBinaryFile', async (_, filePath: string, base64Data: string) => {
  return await writeBinaryFileContent(filePath, base64Data);
});

ipcMain.handle('fs:deletePath', async (_, targetPath: string) => {
  return await deletePath(targetPath);
});

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
  return await renamePath(oldPath, newPath);
});

ipcMain.handle('fs:createDirectory', async (_, dirPath: string) => {
  return await createDirectory(dirPath);
});

// Dosya Yöneticisinde Göster (Windows Explorer, macOS Finder, Linux File Manager)
ipcMain.handle('fs:revealInFolder', async (_, targetPath: string) => {
  if (!targetPath) return false;
  try {
    const normalized = path.normalize(targetPath);
    shell.showItemInFolder(normalized);
    return true;
  } catch (err) {
    console.error('[fs:revealInFolder] Hata:', err);
    return false;
  }
});

// Dosyayı veya Klasörü Varsayılan Uygulamayla Aç
ipcMain.handle('fs:openPath', async (_, targetPath: string) => {
  if (!targetPath) return false;
  try {
    const normalized = path.normalize(targetPath);
    const err = await shell.openPath(normalized);
    return !err;
  } catch (err) {
    console.error('[fs:openPath] Hata:', err);
    return false;
  }
});

// Yerel Sistem Dizinleri (Desktop, Home, Downloads, Temp)
ipcMain.handle('system:getPaths', async () => {
  return {
    desktop: app.getPath('desktop'),
    home: app.getPath('home'),
    downloads: app.getPath('downloads'),
    temp: app.getPath('temp'),
    platform: process.platform,
    arch: process.arch,
  };
});

// IPC Handlers: Terminal
ipcMain.handle('terminal:runCommand', async (_, command: string, cwd?: string) => {
  return await runCommand(command, cwd);
});

ipcMain.handle('terminal:createSession', async (_, sessionId: string, cwd: string) => {
  if (!mainWindow) return false;
  return createTerminalSession(sessionId, cwd, mainWindow);
});

ipcMain.handle('terminal:writeSession', async (_, sessionId: string, data: string) => {
  writeToTerminalSession(sessionId, data);
});

ipcMain.handle('terminal:killSession', async (_, sessionId: string) => {
  killTerminalSession(sessionId);
});

// IPC Handlers: MCP
ipcMain.handle('mcp:loadConfig', async (_, configPath: string) => {
  return await mcpManager.loadConfig(configPath);
});

ipcMain.handle('mcp:getTools', async () => {
  return mcpManager.getTools();
});

ipcMain.handle('mcp:callTool', async (_, serverName: string, toolName: string, args: Record<string, unknown>) => {
  return await mcpManager.callTool(serverName, toolName, args);
});

ipcMain.handle('mcp:connectServer', async (_, name: string, config: { command?: string; args?: string[]; env?: Record<string, string>; url?: string; headers?: Record<string, string> }) => {
  return await mcpManager.connectServer(name, config);
});

ipcMain.handle('mcp:disconnectServer', async (_, name: string) => {
  await mcpManager.disconnectServer(name);
  return true;
});

ipcMain.handle('mcp:disconnectAll', async () => {
  await mcpManager.disconnectAll();
  return true;
});

ipcMain.handle('mcp:getConnectedServers', async () => {
  return mcpManager.getConnectedServerNames();
});

ipcMain.handle('mcp:getLastError', async (_, name: string) => mcpManager.getLastError(name));

ipcMain.handle('mcp:refreshTools', async () => {
  return await mcpManager.refreshTools();
});

// IPC Handlers: Ofis belgeleri (PDF / DOCX / PPTX) ve çalışma alanı araçları
ipcMain.handle('docs:read', async (_, filePath: string, opts?: { maxChars?: number; range?: string }) => readDocument(filePath, opts));
ipcMain.handle('docs:create', async (_, filePath: string, spec: any) => createDocument(filePath, spec));
ipcMain.handle('docs:edit', async (_, filePath: string, operations: any[]) => editDocument(filePath, operations));
ipcMain.handle('ws:grep', async (_, root: string, pattern: string, opts?: any) => grepFiles(root, pattern, opts));
ipcMain.handle('ws:glob', async (_, root: string, pattern: string, limit?: number) => globFiles(root, pattern, limit));
ipcMain.handle('web:fetch', async (_, url: string, maxChars?: number) => webFetch(url, maxChars));
ipcMain.handle('web:search', async (_, query: string, limit?: number) => webSearch(query, limit));

// IPC Handlers: Graphify
ipcMain.handle('graphify:analyze', async (_, projectPath: string) => {
  return await analyzeProjectGraph(projectPath);
});

// IPC Handlers: Auto-Updater
ipcMain.handle('updater:check', async () => {
  return await updateManager.checkForUpdates();
});

ipcMain.handle('updater:download', async () => {
  return await updateManager.downloadUpdate();
});

ipcMain.handle('updater:install', async () => {
  updateManager.installUpdate();
  return true;
});

ipcMain.handle('updater:getVersion', () => {
  return app.getVersion();
});

app.on('before-quit', () => {
  killAllTerminalSessions();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
