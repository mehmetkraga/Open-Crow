import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { dialog, BrowserWindow } from 'electron';

export interface FileItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  children?: FileItem[];
}

const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  '.vite',
  '.turbo',
  '.next',
  '.nuxt',
  'build',
  'out',
  '.cache',
  '.parcel-cache',
  'coverage',
  '.DS_Store',
  'Thumbs.db',
]);

export async function openFolderDialog(win: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    title: 'Open Crow — Proje Klasörü Seç',
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
}

export async function readDirectory(dirPath: string, depth = 0, maxDepth = 4): Promise<FileItem[]> {
  if (depth > maxDepth) return [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items: FileItem[] = [];

    // Önce klasörleri, sonra dosyaları sıralayalım
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() === b.isDirectory()) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory() ? -1 : 1;
    });

    for (const entry of sorted) {
      if (IGNORED_NAMES.has(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      const isDir = entry.isDirectory();

      const item: FileItem = {
        name: entry.name,
        path: fullPath,
        isDirectory: isDir,
      };

      if (isDir && depth < maxDepth) {
        item.children = await readDirectory(fullPath, depth + 1, maxDepth);
      }

      items.push(item);
    }
    return items;
  } catch (error) {
    console.error(`readDirectory hatası (${dirPath}):`, error);
    return [];
  }
}

const MAX_SAFE_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

function isProtectedSystemPath(targetPath: string): boolean {
  const normalized = path.normalize(targetPath);
  const lower = normalized.toLowerCase();

  // Kök dizinler
  if (normalized === '/' || normalized === '\\') return true;
  const rootPattern = /^[a-z]:\\?$/i;
  if (rootPattern.test(lower)) return true;

  // Kullanıcı ana dizini (Home) doğrudan silinemez
  const homeDir = path.normalize(os.homedir()).toLowerCase();
  if (lower === homeDir || lower === `${homeDir}\\` || lower === `${homeDir}/`) return true;

  if (process.platform === 'win32') {
    const winDir = (process.env.WINDIR || 'c:\\windows').toLowerCase();
    const progFiles = (process.env.PROGRAMFILES || 'c:\\program files').toLowerCase();
    const progFilesX86 = (process.env['PROGRAMFILES(X86)'] || 'c:\\program files (x86)').toLowerCase();

    const protectedExact = new Set([
      winDir,
      path.join(winDir, 'system32'),
      progFiles,
      progFilesX86,
      'c:\\', 'd:\\', 'e:\\', 'f:\\',
    ]);

    if (protectedExact.has(lower)) return true;
    if (lower.startsWith(winDir + path.sep)) return true;
  } else {
    // macOS ve Linux kritik sistem yolları
    const unixProtected = new Set([
      '/bin',
      '/sbin',
      '/usr',
      '/usr/bin',
      '/usr/sbin',
      '/usr/lib',
      '/etc',
      '/var',
      '/boot',
      '/dev',
      '/proc',
      '/sys',
      '/root',
      '/System',
      '/Library',
      '/Applications',
    ]);
    if (unixProtected.has(normalized)) return true;
    for (const p of unixProtected) {
      if (normalized.startsWith(p + '/')) return true;
    }
  }

  return false;
}

export async function readFileContent(filePath: string): Promise<string> {
  const normalized = path.normalize(filePath);
  const stat = await fs.stat(normalized);
  if (stat.size > MAX_SAFE_FILE_SIZE_BYTES) {
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(1);
    throw new Error(`FILE_TOO_LARGE: Dosya boyutu (${sizeMb} MB) güvenli düzenleme sınırını (20 MB) aşıyor. Bellek çökmesini önlemek için açılamaz.`);
  }
  return await fs.readFile(normalized, 'utf8');
}

export async function readBinaryFileContent(filePath: string): Promise<string> {
  const normalized = path.normalize(filePath);
  const stat = await fs.stat(normalized);
  if (stat.size > MAX_SAFE_FILE_SIZE_BYTES * 2) {
    const sizeMb = (stat.size / (1024 * 1024)).toFixed(1);
    throw new Error(`FILE_TOO_LARGE: Dosya boyutu (${sizeMb} MB) güvenli ikili sınırını (40 MB) aşıyor.`);
  }
  const buffer = await fs.readFile(normalized);
  return buffer.toString('base64');
}

export async function writeFileContent(filePath: string, content: string): Promise<boolean> {
  const normalized = path.normalize(filePath);
  await fs.mkdir(path.dirname(normalized), { recursive: true });
  await fs.writeFile(normalized, content, 'utf8');
  return true;
}

export async function writeBinaryFileContent(filePath: string, base64Data: string): Promise<boolean> {
  const normalized = path.normalize(filePath);
  await fs.mkdir(path.dirname(normalized), { recursive: true });
  const buffer = Buffer.from(base64Data, 'base64');
  await fs.writeFile(normalized, buffer);
  return true;
}

export async function deletePath(targetPath: string): Promise<boolean> {
  const normalized = path.normalize(targetPath);
  if (isProtectedSystemPath(normalized)) {
    throw new Error(`SYSTEM_PATH_PROTECTED: Kritik sistem dizini veya kök sürücü silinemez: ${targetPath}`);
  }
  // Node 16+ standartı: fs.rm recursive ve force hem dosya hem klasör için güvenle çalışır, stat yarışını önler
  await fs.rm(normalized, { recursive: true, force: true });
  return true;
}

export async function renamePath(oldPath: string, newPath: string): Promise<boolean> {
  const normOld = path.normalize(oldPath);
  const normNew = path.normalize(newPath);
  try {
    await fs.rename(normOld, normNew);
  } catch (err: any) {
    // Cross-device / farklı partition (EXDEV) durumunda kopyala ve sil fallback'i
    if (err?.code === 'EXDEV') {
      await fs.cp(normOld, normNew, { recursive: true });
      await fs.rm(normOld, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
  return true;
}

export async function createDirectory(dirPath: string): Promise<boolean> {
  const normalized = path.normalize(dirPath);
  await fs.mkdir(normalized, { recursive: true });
  return true;
}
