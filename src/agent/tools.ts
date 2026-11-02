// src/agent/tools.ts
// Ajanın kullanabileceği araçlar, onay politikası ve yürütücüsü.

import type { ToolSpec } from './openai';
import { relativeTo, resolveInWorkspace, truncate } from './workspace';

export type ApprovalMode = 'ask' | 'edits' | 'auto';

/** Araçların ihtiyaç duyduğu kısıtlı Electron köprüsü. Testlerde sahte bir uygulama verilir. */
export interface ToolBackend {
  readDirectory(dirPath: string): Promise<{ name: string; path: string; isDirectory: boolean }[]>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<boolean>;
  grep(root: string, pattern: string, opts: { glob?: string; ignoreCase?: boolean; limit?: number }): Promise<{ success: boolean; matches: { file: string; line: number; text: string }[]; truncated: boolean; error?: string }>;
  glob(root: string, pattern: string, limit?: number): Promise<{ success: boolean; files: string[]; truncated: boolean; error?: string }>;
  runCommand(command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  fetchUrl(url: string, maxChars?: number): Promise<{ success: boolean; text?: string; status?: number; error?: string }>;
}

export interface ToolContext {
  root: string;
  backend: ToolBackend;
}

type Args = Record<string, unknown>;

interface ToolDefinition extends ToolSpec {
  /** Araç yazma ya da komut çalıştırma gibi yan etkili mi */
  kind: 'read' | 'write' | 'exec' | 'network';
  run(args: Args, ctx: ToolContext): Promise<string>;
}

const str = (args: Args, key: string): string => {
  const value = args[key];
  if (typeof value !== 'string') throw new Error(`"${key}" metin olmalı.`);
  return value;
};

const optStr = (args: Args, key: string): string | undefined => {
  const value = args[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const optBool = (args: Args, key: string): boolean => args[key] === true;

const optNum = (args: Args, key: string): number | undefined => {
  const value = args[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const MAX_READ_LINES = 2000;

const TOOLS: ToolDefinition[] = [
  {
    name: 'list_dir',
    kind: 'read',
    description: 'Bir klasörün doğrudan içeriğini listeler. Yol boşsa çalışma klasörünün kökünü listeler.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Çalışma klasörüne göre göreli yol' } },
    },
    async run(args, ctx) {
      const target = resolveInWorkspace(ctx.root, optStr(args, 'path') ?? '.');
      const items = await ctx.backend.readDirectory(target);
      const lines = items
        .slice(0, 300)
        .map((item) => `${item.isDirectory ? 'dir ' : 'file'}  ${item.name}`);
      return lines.length ? lines.join('\n') : '(boş klasör)';
    },
  },
  {
    name: 'read_file',
    kind: 'read',
    description: 'Bir dosyayı satır numaralarıyla okur. Büyük dosyalarda start_line ve end_line ile aralık verebilirsin.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        start_line: { type: 'number', description: '1 tabanlı başlangıç satırı' },
        end_line: { type: 'number', description: '1 tabanlı bitiş satırı (dahil)' },
      },
      required: ['path'],
    },
    async run(args, ctx) {
      const file = resolveInWorkspace(ctx.root, str(args, 'path'));
      const lines = (await ctx.backend.readFile(file)).split('\n');
      const start = Math.max(1, optNum(args, 'start_line') ?? 1);
      const end = Math.min(lines.length, optNum(args, 'end_line') ?? Math.min(lines.length, start + MAX_READ_LINES - 1));
      const slice = lines.slice(start - 1, end);
      const numbered = slice.map((line, i) => `${start + i}\t${line}`).join('\n');
      return `${relativeTo(ctx.root, file)} (${lines.length} satır, ${start}-${end} gösteriliyor)\n${numbered}`;
    },
  },
  {
    name: 'write_file',
    kind: 'write',
    description: 'Bir dosyayı tamamen yazar (yoksa oluşturur, varsa üzerine yazar). Mevcut dosyalarda küçük değişiklikler için edit_file tercih edilir.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
    },
    async run(args, ctx) {
      const file = resolveInWorkspace(ctx.root, str(args, 'path'));
      const content = str(args, 'content');
      await ctx.backend.writeFile(file, content);
      return `Yazıldı: ${relativeTo(ctx.root, file)} (${content.split('\n').length} satır)`;
    },
  },
  {
    name: 'edit_file',
    kind: 'write',
    description:
      'Bir dosyada tam olarak eşleşen metni yenisiyle değiştirir. old_string dosyada tek kez geçmelidir; yeterince benzersiz olması için çevresindeki satırları ekle. Birden çok değişiklik için replace_all kullan.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        old_string: { type: 'string', description: 'Değiştirilecek tam metin (boş olamaz)' },
        new_string: { type: 'string' },
        replace_all: { type: 'boolean' },
      },
      required: ['path', 'old_string', 'new_string'],
    },
    async run(args, ctx) {
      const file = resolveInWorkspace(ctx.root, str(args, 'path'));
      const oldString = str(args, 'old_string');
      const newString = str(args, 'new_string');
      if (oldString.length === 0) throw new Error('old_string boş olamaz.');
      if (oldString === newString) throw new Error('old_string ve new_string aynı.');

      const original = await ctx.backend.readFile(file);
      const count = original.split(oldString).length - 1;
      if (count === 0) throw new Error('old_string dosyada bulunamadı. Dosyayı yeniden oku ve metni birebir kopyala.');
      if (count > 1 && !optBool(args, 'replace_all')) {
        throw new Error(`old_string dosyada ${count} kez geçiyor. Daha fazla bağlam ekle ya da replace_all kullan.`);
      }

      const updated = optBool(args, 'replace_all')
        ? original.split(oldString).join(newString)
        : original.replace(oldString, () => newString);
      await ctx.backend.writeFile(file, updated);
      return `Düzenlendi: ${relativeTo(ctx.root, file)} (${optBool(args, 'replace_all') ? count : 1} değişiklik)`;
    },
  },
  {
    name: 'grep',
    kind: 'read',
    description: 'Çalışma klasöründe metin veya düzenli ifade arar. Sonuçta dosya, satır numarası ve satır metni döner.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string' },
        glob: { type: 'string', description: 'Dosya filtresi, örn. "**/*.ts"' },
        ignore_case: { type: 'boolean' },
      },
      required: ['pattern'],
    },
    async run(args, ctx) {
      const result = await ctx.backend.grep(ctx.root, str(args, 'pattern'), {
        glob: optStr(args, 'glob'),
        ignoreCase: optBool(args, 'ignore_case'),
        limit: 100,
      });
      if (!result.success) throw new Error(result.error || 'Arama başarısız.');
      if (result.matches.length === 0) return 'Eşleşme yok.';
      const lines = result.matches.map((m) => `${relativeTo(ctx.root, m.file)}:${m.line}: ${m.text}`);
      return result.truncated ? `${lines.join('\n')}\n… (sonuçlar kırpıldı)` : lines.join('\n');
    },
  },
  {
    name: 'glob',
    kind: 'read',
    description: 'Glob deseniyle dosya yollarını bulur, örn. "src/**/*.tsx".',
    parameters: {
      type: 'object',
      properties: { pattern: { type: 'string' } },
      required: ['pattern'],
    },
    async run(args, ctx) {
      const result = await ctx.backend.glob(ctx.root, str(args, 'pattern'), 200);
      if (!result.success) throw new Error(result.error || 'Glob başarısız.');
      if (result.files.length === 0) return 'Eşleşen dosya yok.';
      const files = result.files.map((f) => relativeTo(ctx.root, f));
      return result.truncated ? `${files.join('\n')}\n… (liste kırpıldı)` : files.join('\n');
    },
  },
  {
    name: 'run_command',
    kind: 'exec',
    description: 'Çalışma klasöründe bir kabuk komutu çalıştırır (Windows için PowerShell/cmd sözdizimi). Çıktı ve çıkış kodu döner.',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command'],
    },
    async run(args, ctx) {
      const result = await ctx.backend.runCommand(str(args, 'command'), ctx.root);
      const parts = [`çıkış kodu: ${result.exitCode}`];
      if (result.stdout.trim()) parts.push(`stdout:\n${truncate(result.stdout.trim(), 8000)}`);
      if (result.stderr.trim()) parts.push(`stderr:\n${truncate(result.stderr.trim(), 4000)}`);
      return parts.join('\n');
    },
  },
  {
    name: 'web_fetch',
    kind: 'network',
    description: 'Bir web sayfasını indirip metin olarak döndürür. Dokümantasyon ve referans için kullan.',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
    async run(args, ctx) {
      const result = await ctx.backend.fetchUrl(str(args, 'url'), 20000);
      if (!result.success) throw new Error(result.error || 'Sayfa alınamadı.');
      return result.text ?? '';
    },
  },
];

export const TOOL_SPECS: { type: 'function'; function: ToolSpec }[] = TOOLS.map((tool) => ({
  type: 'function',
  function: { name: tool.name, description: tool.description, parameters: tool.parameters },
}));

export function getToolKind(name: string): ToolDefinition['kind'] | null {
  return TOOLS.find((tool) => tool.name === name)?.kind ?? null;
}

/**
 * Bir çağrının onay gerektirip gerektirmediğini mod'a göre belirler.
 * ask: yazma ve komutlar sorulur. edits: yalnızca komutlar sorulur. auto: hiçbir şey sorulmaz.
 */
export function requiresApproval(name: string, mode: ApprovalMode): boolean {
  const kind = getToolKind(name);
  if (kind === 'read' || kind === 'network' || kind === null) return false;
  if (mode === 'auto') return false;
  if (mode === 'edits') return kind === 'exec';
  return true;
}

/** Kullanıcıya gösterilecek kısa özet (kartta ve onayda). */
export function summarizeCall(name: string, args: Args): string {
  const pick = (key: string) => (typeof args[key] === 'string' ? (args[key] as string) : '');
  switch (name) {
    case 'run_command':
      return pick('command');
    case 'grep':
      return pick('pattern');
    case 'glob':
      return pick('pattern');
    case 'web_fetch':
      return pick('url');
    case 'list_dir':
      return pick('path') || '.';
    default:
      return pick('path');
  }
}

export async function executeTool(name: string, args: Args, ctx: ToolContext): Promise<string> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Bilinmeyen araç: ${name}`);
  return tool.run(args, ctx);
}
