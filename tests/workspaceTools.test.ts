import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { globToRegExp, globFiles, grepFiles, htmlToText, parseDuckDuckGo, webFetch } from '../electron/services/workspaceTools';

let dir: string;
beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kraga-ws-'));
  await fs.mkdir(path.join(dir, 'src', 'deep'), { recursive: true });
  await fs.mkdir(path.join(dir, 'node_modules', 'x'), { recursive: true });
  await fs.writeFile(path.join(dir, 'src', 'a.ts'), 'const foo = 1;\nexport function Hello() {}\n');
  await fs.writeFile(path.join(dir, 'src', 'deep', 'b.ts'), 'hello world\n');
  await fs.writeFile(path.join(dir, 'readme.md'), 'Hello readme\n');
  await fs.writeFile(path.join(dir, 'node_modules', 'x', 'c.ts'), 'hello hidden\n');
  await fs.writeFile(path.join(dir, 'img.png'), Buffer.from([0, 1, 2, 0x68, 0x65]));
});
afterAll(async () => { await fs.rm(dir, { recursive: true, force: true }); });

describe('glob', () => {
  it('desenleri doğru çevirir', () => {
    expect(globToRegExp('**/*.ts').test('src/deep/b.ts')).toBe(true);
    expect(globToRegExp('**/*.ts').test('a.ts')).toBe(true);
    expect(globToRegExp('src/*.ts').test('src/deep/b.ts')).toBe(false);
    expect(globToRegExp('*.{md,txt}').test('readme.md')).toBe(true);
  });
  it('node_modules içini taramaz', async () => {
    const r = await globFiles(dir, '*.ts');
    expect(r.files.sort()).toEqual(['src/a.ts', 'src/deep/b.ts']);
  });
});

describe('grep', () => {
  it('büyük/küçük harf duyarsız arar, satır numarası verir, gizli klasörleri atlar', async () => {
    const r = await grepFiles(dir, 'hello', { ignoreCase: true });
    const files = r.matches.map((m) => m.file).sort();
    expect(files).toEqual(['readme.md', 'src/a.ts', 'src/deep/b.ts']);
    expect(r.matches.find((m) => m.file === 'src/a.ts')!.line).toBe(2);
  });
  it('glob filtresi uygular', async () => {
    const r = await grepFiles(dir, 'hello', { ignoreCase: true, glob: '*.md' });
    expect(r.matches.map((m) => m.file)).toEqual(['readme.md']);
  });
  it('geçersiz regex için hata döner', async () => {
    const r = await grepFiles(dir, '(', {});
    expect(r.success).toBe(false);
  });
});

describe('web', () => {
  it('HTML’i okunur metne çevirir', () => {
    const t = htmlToText('<html><head><title>x</title></head><body><script>bad()</script><h2>Başlık</h2><p>Merhaba <a href="https://a.b">bağlantı</a></p><ul><li>bir</li></ul></body></html>');
    expect(t).toContain('## Başlık');
    expect(t).toContain('bağlantı (https://a.b)');
    expect(t).toContain('- bir');
    expect(t).not.toContain('bad()');
  });
  it('DuckDuckGo sonuçlarını ayrıştırır', () => {
    const html = '<div class="result results_links results_links_deep web-result"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fa&amp;rut=1">Örnek <b>Başlık</b></a><a class="result__snippet" href="x">Kısa <b>özet</b></a></div>';
    expect(parseDuckDuckGo(html)).toEqual([{ title: 'Örnek Başlık', url: 'https://example.com/a', snippet: 'Kısa özet' }]);
  });
  it('yerel ve özel ağ adreslerini reddeder', async () => {
    for (const u of ['http://localhost:3000/', 'http://127.0.0.1/', 'http://192.168.1.5/', 'http://169.254.169.254/latest/meta-data/', 'file:///etc/passwd']) {
      const r = await webFetch(u);
      expect(r.success).toBe(false);
    }
  });
});
