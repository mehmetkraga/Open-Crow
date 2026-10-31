import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { getShellExecutable, getPlatformEnv } from '../electron/services/terminal';

describe('Cross-Platform Configuration & Terminal Tests', () => {
  const originalPlatform = process.platform;
  const originalEnv = { ...process.env };

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('should return powershell for win32 platform', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    const { shell, args } = getShellExecutable();
    expect(shell).toBe('powershell.exe');
    expect(args).toContain('-NoLogo');
  });

  it('should return zsh with login flag for darwin (macOS) platform', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    delete process.env.SHELL;
    const { shell, args } = getShellExecutable();
    expect(shell).toBe('/bin/zsh');
    expect(args).toContain('-l');
  });

  it('should return bash with login flag for linux platform', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    delete process.env.SHELL;
    const { shell, args } = getShellExecutable();
    expect(shell).toBe('/bin/bash');
    expect(args).toContain('-l');
  });

  it('should inject Homebrew and user binary paths on macOS/Linux', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.PATH = '/usr/bin:/bin';
    process.env.HOME = '/Users/testuser';

    const env = getPlatformEnv();
    expect(env.PATH).toContain('/opt/homebrew/bin');
    expect(env.PATH).toContain('/usr/local/bin');
    expect(env.PATH).toContain('/Users/testuser/.cargo/bin');
  });

  it('should have valid electron-builder.json with win, mac and linux targets', () => {
    const builderPath = path.resolve(__dirname, '../electron-builder.json');
    expect(fs.existsSync(builderPath)).toBe(true);

    const builderConfig = JSON.parse(fs.readFileSync(builderPath, 'utf8'));
    expect(builderConfig.appId).toBe('org.kraga.ide');
    expect(builderConfig.productName).toBe('Open Crow');

    // Windows
    expect(builderConfig.win).toBeDefined();
    expect(builderConfig.win.target.some((t: any) => t.target === 'nsis' || t === 'nsis')).toBe(true);

    // macOS
    expect(builderConfig.mac).toBeDefined();
    expect(builderConfig.mac.category).toBe('public.app-category.developer-tools');
    expect(builderConfig.mac.identity).toBeNull();
    expect(builderConfig.dmg).toBeDefined();

    // Linux
    expect(builderConfig.linux).toBeDefined();
    expect(builderConfig.linux.category).toBe('Development');
    const linuxTargets = builderConfig.linux.target.map((t: any) => typeof t === 'string' ? t : t.target);
    expect(linuxTargets).toContain('AppImage');
    expect(linuxTargets).toContain('deb');

    // Publish
    expect(builderConfig.publish).toBeDefined();
    expect(builderConfig.publish.repo).toBe('KRAGA-AI-IDE-RELEASES');
  });
});
