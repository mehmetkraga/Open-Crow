// src/agent/permissions.ts
// İzin kuralları: "allow", "deny", "ask" listeleri. Değerlendirme sırası: önce deny, sonra ask, sonra allow.
// Kurallar Claude Code'daki biçime benzer: "Bash(npm test)", "Bash(npm run *)", "Read(src/**)", "WebFetch(domain:example.com)".

export type RuleBehavior = 'allow' | 'deny' | 'ask';

export interface PermissionRule {
  behavior: RuleBehavior;
  /** Kanonik araç adı: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, Task, TodoWrite */
  tool: string;
  /** Parantez içindeki kalıp; yoksa araç adının tamamı eşleşir */
  specifier?: string;
}

/** Açık uygulama araç adlarını kanonik izin adlarına çevirir. */
export const CANONICAL_TOOL: Record<string, string> = {
  list_dir: 'Read',
  read_file: 'Read',
  write_file: 'Write',
  edit_file: 'Edit',
  grep: 'Grep',
  glob: 'Glob',
  run_command: 'Bash',
  web_fetch: 'WebFetch',
  web_search: 'WebSearch',
  task: 'Task',
  todo_write: 'TodoWrite',
};

const RULE_PATTERN = /^\s*([A-Za-z]+|\*)\s*(?:\((.*)\))?\s*$/;

/** "Bash(npm test)" gibi bir metni kurala çevirir. Geçersiz metin null döner. */
export function parseRule(text: string, behavior: RuleBehavior): PermissionRule | null {
  const match = RULE_PATTERN.exec(text);
  if (!match) return null;
  const specifier = match[2]?.trim();
  return {
    behavior,
    tool: match[1] === '*' ? '*' : match[1],
    specifier: specifier && specifier.length > 0 ? specifier : undefined,
  };
}

/**
 * Kalıbı regex'e çevirir. Komutlarda '*' her karakter dizisini temsil eder.
 * Yollarda (segmentMode) '*' tek dizin seviyesiyle, '**' alt dizinlerle eşleşir.
 */
export function globToRegExp(pattern: string, segmentMode = false): RegExp {
  const DOUBLE_STAR = '\u0000';
  const escaped = pattern
    .replace(/\*\*/g, DOUBLE_STAR)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, segmentMode ? '[^/]*' : '.*')
    .split(DOUBLE_STAR)
    .join('.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Bir çağrının kurala uyup uymadığını belirler. */
export function ruleMatches(rule: PermissionRule, tool: string, args: Record<string, unknown>): boolean {
  if (rule.tool !== '*' && rule.tool.toLowerCase() !== tool.toLowerCase()) return false;
  if (!rule.specifier) return true;

  switch (tool) {
    case 'Bash': {
      const command = typeof args.command === 'string' ? args.command.trim() : '';
      return globToRegExp(rule.specifier).test(command);
    }
    case 'Read':
    case 'Write':
    case 'Edit':
    case 'Glob':
    case 'Grep': {
      const path = typeof args.path === 'string' ? normalizePath(args.path) : '';
      return globToRegExp(normalizePath(rule.specifier!), true).test(path);
    }
    case 'WebFetch': {
      const url = typeof args.url === 'string' ? args.url : '';
      if (rule.specifier.startsWith('domain:')) {
        const domain = rule.specifier.slice('domain:'.length).toLowerCase();
        const host = hostOf(url);
        return host !== null && (host === domain || host.endsWith(`.${domain}`));
      }
      return globToRegExp(rule.specifier).test(url);
    }
    default:
      return false;
  }
}

/**
 * Kuralları değerlendirir. Sıra: deny, ask, allow. İlk eşleşen davranış sonucu belirler.
 * Hiçbir kural eşleşmezse null döner ve karar çalışma moduna bırakılır.
 */
export function evaluateRules(
  rules: PermissionRule[],
  tool: string,
  args: Record<string, unknown>,
): RuleBehavior | null {
  for (const behavior of ['deny', 'ask', 'allow'] as const) {
    const hit = rules.some((rule) => rule.behavior === behavior && ruleMatches(rule, tool, args));
    if (hit) return behavior;
  }
  return null;
}

/**
 * Proje ayar dosyasından (`.opencrow/settings.json` veya Claude Code uyumlu `permissions` bloğu) kuralları okur.
 * Bozuk girdi sessizce atlanır; geçerli kurallar yine de yüklenir.
 */
export function rulesFromSettings(settings: unknown): PermissionRule[] {
  const permissions = (settings as { permissions?: Record<string, unknown> } | null)?.permissions;
  if (!permissions || typeof permissions !== 'object') return [];

  const rules: PermissionRule[] = [];
  for (const behavior of ['allow', 'deny', 'ask'] as const) {
    const list = permissions[behavior];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (typeof entry !== 'string') continue;
      const rule = parseRule(entry, behavior);
      if (rule) rules.push(rule);
    }
  }
  return rules;
}

/** Kullanıcının "bu kalıbı hep onayla" seçimi için kural metni üretir. */
export function allowRuleFor(tool: string, args: Record<string, unknown>): PermissionRule | null {
  if (tool === 'Bash' && typeof args.command === 'string' && args.command.trim()) {
    return { behavior: 'allow', tool: 'Bash', specifier: args.command.trim() };
  }
  if ((tool === 'Write' || tool === 'Edit') && typeof args.path === 'string') {
    return { behavior: 'allow', tool, specifier: normalizePath(args.path) };
  }
  return null;
}

export function formatRule(rule: PermissionRule): string {
  return rule.specifier ? `${rule.tool}(${rule.specifier})` : rule.tool;
}
