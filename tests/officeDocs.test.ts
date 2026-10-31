import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDocument, readDocument, editDocument, markdownToBlocks, blocksToHtml, docxXmlToText } from '../electron/services/officeDocs';

let dir: string;
beforeAll(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kraga-office-')); });
afterAll(async () => { await fs.rm(dir, { recursive: true, force: true }); });

// Elle yazılmış, tek sayfalık, metin katmanlı minimal PDF (Electron gerektirmeden okuma testi için)
function tinyPdf(text: string): Buffer {
  const objs: string[] = [];
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');
  const stream = `BT /F1 18 Tf 20 100 Td (${text}) Tj ET`;
  objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, 'latin1');
}

describe('markdownToBlocks', () => {
  it('başlık, liste, tablo ve kodu ayırır', () => {
    const b = markdownToBlocks('# Başlık\n\nMetin **kalın**\n\n- bir\n- iki\n\n1. a\n2. b\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nx=1\n```');
    expect(b.map((x) => x.type)).toEqual(['heading', 'paragraph', 'bullets', 'numbered', 'table', 'code']);
    expect((b[1] as any).text).toBe('Metin kalın');
    expect((b[4] as any).rows).toEqual([['1', '2']]);
  });
  it('HTML çıktısında kullanıcı metnini kaçırır', () => {
    const html = blocksToHtml({ blocks: [{ type: 'paragraph', text: '<script>x</script>' }] });
    expect(html).not.toContain('<script>x');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('DOCX', () => {
  it('oluşturur, okur, düzenler', async () => {
    const f = path.join(dir, 'rapor.docx');
    const res = await createDocument(f, { title: 'Aylık Rapor', markdown: '# Özet\n\nGelir **arttı**.\n\n- Madde bir\n- Madde iki\n\n| Ay | Tutar |\n|---|---|\n| Ocak | 100 |' });
    expect(res.success).toBe(true);
    const read = await readDocument(f);
    expect(read.success).toBe(true);
    expect(read.text).toContain('Aylık Rapor');
    expect(read.text).toContain('# Özet');
    expect(read.text).toContain('Madde bir');
    expect(read.text).toContain('| Ocak | 100 |');

    const ed = await editDocument(f, [{ type: 'replace_text', find: 'Gelir arttı', replace: 'Gelir ikiye katlandı' }, { type: 'append_blocks', markdown: '## Ek\n\nSon not.' }]);
    expect(ed.success).toBe(true);
    expect(ed.replacements).toBe(1);
    const after = await readDocument(f);
    expect(after.text).toContain('Gelir ikiye katlandı');
    expect(after.text).toContain('Son not.');
  });
  it('olmayan metni sessizce geçmez', async () => {
    const f = path.join(dir, 'rapor2.docx');
    await createDocument(f, { markdown: 'Merhaba dünya' });
    const ed = await editDocument(f, [{ type: 'replace_text', find: 'yokböyle', replace: 'x' }]);
    expect(ed.success).toBe(false);
    expect(ed.error).toContain('bulunamadı');
  });
  it('birden çok koşuya bölünmüş metni bulur', () => {
    const xml = '<w:body><w:p><w:r><w:t>Mer</w:t></w:r><w:r><w:t>haba</w:t></w:r></w:p></w:body>';
    expect(docxXmlToText(xml)).toBe('Merhaba');
  });
});

describe('PPTX', () => {
  it('oluşturur, okur, düzenler', async () => {
    const f = path.join(dir, 'sunum.pptx');
    const res = await createDocument(f, { title: 'Kraga', slides: [
      { title: 'Kraga Sunumu', subtitle: '2026' },
      { title: 'Hedefler', bullets: ['Hız', 'Kalite'], notes: 'Konuşmacı notu burada' },
      { title: 'Rakamlar', table: { headers: ['Ay', 'Satış'], rows: [['Ocak', 10]] } },
    ] });
    expect(res.success).toBe(true);
    expect(res.slides).toBe(3);
    const read = await readDocument(f);
    expect(read.slides).toBe(3);
    expect(read.text).toContain('Kraga Sunumu');
    expect(read.text).toContain('Hız');
    expect(read.text).toContain('Konuşmacı notu burada');

    const only2 = await readDocument(f, { range: '2' });
    expect(only2.text).toContain('Hedefler');
    expect(only2.text).not.toContain('Rakamlar');

    const ed = await editDocument(f, [{ type: 'replace_text', find: 'Hız', replace: 'Performans' }]);
    expect(ed.success).toBe(true);
    expect((await readDocument(f)).text).toContain('Performans');
  });
});

describe('PDF', () => {
  it('metin katmanını okur', async () => {
    const f = path.join(dir, 'a.pdf');
    await fs.writeFile(f, tinyPdf('Merhaba PDF'));
    const r = await readDocument(f);
    expect(r.success).toBe(true);
    expect(r.pages).toBe(1);
    expect(r.text).toContain('Merhaba PDF');
  });
  it('yerinde düzenlemeyi dürüstçe reddeder', async () => {
    const f = path.join(dir, 'b.pdf');
    await fs.writeFile(f, tinyPdf('x'));
    const ed = await editDocument(f, [{ type: 'replace_text', find: 'x', replace: 'y' }]);
    expect(ed.success).toBe(false);
    expect(ed.error).toContain('create_document');
  });
});

describe('Desteklenmeyen uzantı', () => {
  it('hata döner', async () => {
    expect((await readDocument(path.join(dir, 'x.txt'))).success).toBe(false);
    expect((await createDocument(path.join(dir, 'x.txt'), { markdown: 'a' })).success).toBe(false);
  });
});
