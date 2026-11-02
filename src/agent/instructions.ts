// src/agent/instructions.ts
// Proje belleği (OPENCROW.md, CLAUDE.md, AGENTS.md), beceriler (SKILL.md) ve slash komut ayrıştırması.

/** Çalışma klasörü kökünden okunan talimat dosyaları. Sırayla eklenir; en fazla MAX_INSTRUCTION_CHARS. */
export const INSTRUCTION_FILES = ['OPENCROW.md', 'CLAUDE.md', 'AGENTS.md'] as const;
export const MAX_INSTRUCTION_CHARS = 20000;

export interface LoadedInstruction {
  file: string;
  content: string;
}

/** Talimat dosyalarını okur. `read` yoksa ya da dosya yoksa o dosya atlanır. */
export async function loadInstructions(read: (relativePath: string) => Promise<string | null>): Promise<LoadedInstruction[]> {
  const loaded: LoadedInstruction[] = [];
  for (const file of INSTRUCTION_FILES) {
    const content = await read(file).catch(() => null);
    if (content && content.trim()) loaded.push({ file, content: content.trim() });
  }
  return loaded;
}

/** Talimatları sistem istemine eklenecek tek bir metne çevirir. */
export function renderInstructions(instructions: LoadedInstruction[]): string {
  if (instructions.length === 0) return '';
  const body = instructions.map((item) => `### ${item.file}\n${item.content}`).join('\n\n');
  const clipped = body.length > MAX_INSTRUCTION_CHARS ? `${body.slice(0, MAX_INSTRUCTION_CHARS)}\n… (talimatlar kırpıldı)` : body;
  return `Proje talimatları (kullanıcı tanımlı, bunlara uy):\n${clipped}`;
}

export interface SkillDefinition {
  name: string;
  description: string;
  body: string;
}

/**
 * SKILL.md biçimini ayrıştırır: başta `---` ile çevrili basit anahtar: değer frontmatter, ardından gövde.
 * Frontmatter yoksa ad ve açıklama için dosya adı ve ilk satır kullanılır.
 */
export function parseSkill(source: string, fallbackName: string): SkillDefinition {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  const meta: Record<string, string> = {};
  let body = source;
  if (match) {
    body = match[2];
    for (const line of match[1].split(/\r?\n/)) {
      const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line.trim());
      if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
    }
  }
  const firstLine = body.split(/\r?\n/).find((line) => line.trim().length > 0)?.replace(/^#+\s*/, '').trim() ?? '';
  return {
    name: meta.name || fallbackName,
    description: meta.description || firstLine,
    body: body.trim(),
  };
}

export interface ParsedCommand {
  name: string;
  args: string;
}

/** "/model gpt-5" → { name: "model", args: "gpt-5" }. Komut değilse null. */
export function parseSlashCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/') || trimmed.length < 2) return null;
  const space = trimmed.search(/\s/);
  const name = (space === -1 ? trimmed.slice(1) : trimmed.slice(1, space)).toLowerCase();
  if (!/^[a-z0-9:_-]+$/.test(name)) return null;
  const args = space === -1 ? '' : trimmed.slice(space + 1).trim();
  return { name, args };
}

export interface CommandInfo {
  name: string;
  description: string;
}

/**
 * Yazılanla eşleşen komutları döndürür. Önek eşleşmeleri önce gelir.
 * Boş sorgu tüm komutları verir.
 */
export function matchCommands<T extends CommandInfo>(query: string, commands: T[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  const prefix = commands.filter((c) => c.name.startsWith(q));
  const contains = commands.filter((c) => !c.name.startsWith(q) && (c.name.includes(q) || c.description.toLowerCase().includes(q)));
  return [...prefix, ...contains];
}
