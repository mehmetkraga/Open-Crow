// Kraga IDE — Ajan için çalışma alanı arama araçları (grep / glob) ve web okuma.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-electron', 'build', 'out', '.next', '.nuxt', '.vite', '.turbo', '.cache', 'coverage', '.parcel-cache', '__pycache__', '.venv', 'venv', 'release']);
const BINARY_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.gz', '.7z', '.rar', '.exe', '.dll', '.so', '.dylib', '.bin', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.mp4', '.mov', '.wav', '.docx', '.pptx', '.xlsx', '.xls', '.psd', '.class', '.jar', '.pyc', '.sqlite', '.db']);
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function globToRegExp(glob: string): RegExp {
  let re = '';
  const g = glob.replace(/\\/g, '/');
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = g.indexOf('}', i);
      if (end > i) { re += '(?:' + g.slice(i + 1, end).split(',').map((s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|') + ')'; i = end; } else re += '\\{';
    } else if ('.+^$()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$', 'i');
}

async function* walk(root: string, rel = ''): AsyncGenerator<{ abs: string; rel: string }> {
  let entries;
  try { entries = await fs.readdir(path.join(root, rel), { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(root, rel ? `${rel}/${e.name}` : e.name);
    } else if (e.isFile()) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      yield { abs: path.join(root, r), rel: r };
    }
  }
}

export async function globFiles(root: string, pattern: string, limit = 300): Promise<{ success: boolean; files: string[]; truncated: boolean; error?: string }> {
  try {
    const hasSlash = pattern.includes('/') || pattern.includes('**');
    const re = globToRegExp(hasSlash ? pattern : `**/${pattern}`);
    const files: string[] = [];
    let truncated = false;
    for await (const f of walk(root)) {
      if (re.test(f.rel)) {
        if (files.length >= limit) { truncated = true; break; }
        files.push(f.rel);
      }
    }
    return { success: true, files, truncated };
  } catch (err: any) {
    return { success: false, files: [], truncated: false, error: String(err?.message || err) };
  }
}

export interface GrepMatch { file: string; line: number; text: string }

export async function grepFiles(
  root: string,
  pattern: string,
  opts: { glob?: string; ignoreCase?: boolean; literal?: boolean; limit?: number } = {}
): Promise<{ success: boolean; matches: GrepMatch[]; filesScanned: number; truncated: boolean; error?: string }> {
  try {
    if (!pattern) throw new Error('pattern gerekli');
    const source = opts.literal ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : pattern;
    const re = new RegExp(source, opts.ignoreCase ? 'i' : '');
    const fileRe = opts.glob ? globToRegExp(opts.glob.includes('/') || opts.glob.includes('**') ? opts.glob : `**/${opts.glob}`) : null;
    const limit = Math.min(opts.limit ?? 200, 1000);
    const matches: GrepMatch[] = [];
    let scanned = 0;
    let truncated = false;
    outer: for await (const f of walk(root)) {
      if (BINARY_EXT.has(path.extname(f.rel).toLowerCase())) continue;
      if (fileRe && !fileRe.test(f.rel)) continue;
      let stat;
      try { stat = await fs.stat(f.abs); } catch { continue; }
      if (stat.size > MAX_FILE_BYTES) continue;
      let text: string;
      try { text = await fs.readFile(f.abs, 'utf8'); } catch { continue; }
      if (text.includes('\u0000')) continue;
      scanned++;
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          matches.push({ file: f.rel, line: i + 1, text: lines[i].trim().slice(0, 240) });
          if (matches.length >= limit) { truncated = true; break outer; }
        }
      }
    }
    return { success: true, matches, filesScanned: scanned, truncated };
  } catch (err: any) {
    return { success: false, matches: [], filesScanned: 0, truncated: false, error: String(err?.message || err) };
  }
}

// ───────────── Web okuma ─────────────

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, (_m, t, inner) => `\n\n${'#'.repeat(Number(t[1]))} ${inner.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|section|article|tr|br|ul|ol|table)>|<br\s*\/?>/gi, '\n')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, t) => `${t.replace(/<[^>]+>/g, '').trim()} (${href})`)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function webFetch(url: string, maxChars = 30000): Promise<{ success: boolean; url: string; status?: number; contentType?: string; text?: string; truncated?: boolean; error?: string }> {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error('Yalnızca http(s) adresleri okunabilir.');
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Yerel adresler okunamaz.');
    const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((r) => r.address);
    if (!ips.length || ips.some(isPrivateIp)) throw new Error('Özel / yerel ağ adreslerine erişim engellendi.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(u, { redirect: 'follow', signal: controller.signal, headers: { 'User-Agent': 'OpenCrow/1.9', Accept: 'text/html,text/plain,application/json;q=0.9,*/*;q=0.5' } });
    } finally { clearTimeout(timer); }
    const finalHost = new URL(res.url).hostname;
    if (finalHost !== host && (finalHost === 'localhost' || isPrivateIp(finalHost))) throw new Error('Yönlendirme yerel ağa gidiyor; engellendi.');
    const contentType = res.headers.get('content-type') || '';
    if (/^(image|video|audio)\//i.test(contentType) || /application\/(zip|octet-stream|pdf)/i.test(contentType)) {
      return { success: false, url, status: res.status, contentType, error: `İçerik türü okunamaz (${contentType}). PDF için dosyayı indirip read_document kullan.` };
    }
    const buf = Buffer.from(await res.arrayBuffer()).subarray(0, 3_000_000);
    let text = buf.toString('utf8');
    if (/html/i.test(contentType) || /^\s*<(!doctype|html)/i.test(text)) text = htmlToText(text);
    const truncated = text.length > maxChars;
    return { success: res.ok, url, status: res.status, contentType, text: truncated ? text.slice(0, maxChars) + '\n\n[... kırpıldı]' : text, truncated, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, url, error: err?.name === 'AbortError' ? 'Zaman aşımı (20 sn).' : String(err?.message || err) };
  }
}

// ───────────── Web arama (DuckDuckGo HTML) ─────────────

export function parseDuckDuckGo(html: string, limit = 8): { title: string; url: string; snippet: string }[] {
  const out: { title: string; url: string; snippet: string }[] = [];
  const strip = (s: string) => htmlToText(s).replace(/\s+/g, ' ').trim();
  const blocks = html.split(/<div class="result results_links/).slice(1);
  for (const b of blocks) {
    const a = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(b);
    if (!a) continue;
    let url = a[1].replace(/&amp;/g, '&');
    const uddg = /[?&]uddg=([^&]+)/.exec(url);
    if (uddg) { try { url = decodeURIComponent(uddg[1]); } catch { /* ham adres */ } }
    if (url.startsWith('//')) url = 'https:' + url;
    const sn = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(b);
    out.push({ title: strip(a[2]), url, snippet: sn ? strip(sn[1]) : '' });
    if (out.length >= limit) break;
  }
  return out;
}

export async function webSearch(query: string, limit = 8): Promise<{ success: boolean; query: string; results: { title: string; url: string; snippet: string }[]; error?: string }> {
  try {
    if (!query || !query.trim()) throw new Error('query gerekli');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let html: string;
    try {
      const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query.trim()), {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'Accept-Language': 'tr,en;q=0.8' },
      });
      html = await res.text();
    } finally { clearTimeout(timer); }
    const results = parseDuckDuckGo(html, Math.min(limit, 15));
    if (!results.length) throw new Error('Sonuç bulunamadı veya arama motoru isteği reddetti.');
    return { success: true, query, results };
  } catch (err: any) {
    return { success: false, query, results: [], error: err?.name === 'AbortError' ? 'Zaman aşımı (15 sn).' : String(err?.message || err) };
  }
}
