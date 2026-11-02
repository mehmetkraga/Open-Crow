// src/agent/workspace.ts
// Çalışma klasörü sınırı: araçların erişebileceği yollar yalnızca seçilen klasörün içindedir.

function toForward(p: string): string {
  return p.replace(/\\/g, '/');
}

function isAbsolute(p: string): boolean {
  return /^[a-zA-Z]:\//.test(p) || p.startsWith('/');
}

/**
 * Göreli ya da mutlak bir yolu çalışma klasörü içinde çözer.
 * `..` ile dışarı çıkmaya çalışan yollar hata verir.
 */
export function resolveInWorkspace(root: string, input: string): string {
  const separator = root.includes('\\') ? '\\' : '/';
  const base = toForward(root).replace(/\/+$/, '');
  const raw = toForward(input.trim());
  const joined = isAbsolute(raw) ? raw : `${base}/${raw}`;

  const absolutePrefix = joined.startsWith('/') ? '/' : '';
  const parts: string[] = [];
  for (const segment of joined.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  const resolved = absolutePrefix + parts.join('/');

  const lowerResolved = resolved.toLowerCase();
  const lowerBase = base.toLowerCase();
  if (lowerResolved !== lowerBase && !lowerResolved.startsWith(`${lowerBase}/`)) {
    throw new Error(`Yol çalışma klasörünün dışında: ${input}`);
  }
  return resolved.replace(/\//g, separator);
}

/** Mutlak yolu çalışma klasörüne göre göreli hâle getirir (görüntüleme için). */
export function relativeTo(root: string, absolute: string): string {
  const base = toForward(root).replace(/\/+$/, '');
  const full = toForward(absolute);
  if (full.toLowerCase().startsWith(`${base.toLowerCase()}/`)) {
    return full.slice(base.length + 1);
  }
  return full;
}

/** Uzun çıktıyı sınırlar; kırpıldığını belirtir. */
export function truncate(text: string, max = 12000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n… (${text.length - max} karakter kırpıldı)`;
}
