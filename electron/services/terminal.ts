import { spawn, ChildProcess } from 'node:child_process';
import { BrowserWindow } from 'electron';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// Aktif interaktif terminal oturumları
const sessions = new Map<string, ChildProcess>();

export function getPlatformEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    FORCE_COLOR: '1',
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
  };

  if (process.platform === 'darwin' || process.platform === 'linux') {
    const home = process.env.HOME || '';
    const extraPaths = [
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      home ? `${home}/.cargo/bin` : '',
      home ? `${home}/.local/bin` : '',
      home ? `${home}/.nvm/current/bin` : '',
    ].filter(Boolean);

    const existingPath = env.PATH || '';
    env.PATH = `${extraPaths.join(':')}:${existingPath}`;
  }

  return env;
}

export function getShellExecutable(): { shell: string; args: string[] } {
  if (process.platform === 'win32') {
    return { shell: 'powershell.exe', args: ['-NoLogo'] };
  }
  if (process.platform === 'darwin') {
    return { shell: process.env.SHELL || '/bin/zsh', args: ['-l'] };
  }
  return { shell: process.env.SHELL || '/bin/bash', args: ['-l'] };
}

// Agent için tek seferlik komut koşturma (run_command)
export async function runCommand(
  command: string,
  cwd?: string,
  timeoutMs = 60000
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const shell = isWin
      ? 'powershell.exe'
      : (process.env.SHELL || (isMac ? '/bin/zsh' : '/bin/bash'));
    const args = isWin
      ? ['-NoProfile', '-Command', command]
      : ['-l', '-c', command];

    const child = spawn(shell, args, {
      cwd: cwd || process.cwd(),
      env: getPlatformEnv(),
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try {
          child.kill();
        } catch {}
        resolve({
          stdout,
          stderr: stderr + `\n[Komut zaman aşımına uğradı (${timeoutMs / 1000}s)]`,
          exitCode: 124,
        });
      }
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0,
        });
      }
    });

    child.on('error', (err) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve({
          stdout,
          stderr: err.message,
          exitCode: 1,
        });
      }
    });
  });
}

// xterm.js için etkileşimli terminal oturumu
export function createTerminalSession(
  sessionId: string,
  cwd: string,
  win: BrowserWindow
): boolean {
  if (sessions.has(sessionId)) {
    try {
      sessions.get(sessionId)?.kill();
    } catch {}
    sessions.delete(sessionId);
  }

  const { shell, args } = getShellExecutable();
  const child = spawn(shell, args, {
    cwd: cwd || process.cwd(),
    env: getPlatformEnv(),
  });

  const safeSend = (channel: string, payload: any) => {
    try {
      if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    } catch {
      // Pencere kapatılmış veya yok edilmişse sessizce yut
    }
  };

  child.stdout?.on('data', (chunk) => {
    safeSend('terminal:data', { sessionId, data: chunk.toString() });
  });

  child.stderr?.on('data', (chunk) => {
    safeSend('terminal:data', { sessionId, data: chunk.toString() });
  });

  child.on('exit', (code) => {
    safeSend('terminal:exit', { sessionId, code });
    sessions.delete(sessionId);
  });

  child.on('error', () => {
    sessions.delete(sessionId);
  });

  sessions.set(sessionId, child);
  return true;
}

export function writeToTerminalSession(sessionId: string, data: string): void {
  const child = sessions.get(sessionId);
  if (child && child.stdin && child.stdin.writable) {
    child.stdin.write(data);
  }
}

export function killTerminalSession(sessionId: string): void {
  const child = sessions.get(sessionId);
  if (child) {
    try {
      child.kill();
    } catch {}
    sessions.delete(sessionId);
  }
}

export function killAllTerminalSessions(): void {
  for (const child of sessions.values()) {
    try {
      child.kill();
    } catch {}
  }
  sessions.clear();
}
