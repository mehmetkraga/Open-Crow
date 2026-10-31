// Open Crow — Yerleşik ofis belgesi motoru (PDF / DOCX / PPTX)
// Ajanın .pdf, .docx ve .pptx dosyalarını okuyup oluşturup düzenleyebilmesi için ana süreçte çalışır.
// Excel için ayrı motor: src/core/spreadsheetAgentTools.ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

export type DocKind = 'pdf' | 'docx' | 'pptx';

export type DocBlock =
  | { type: 'heading'; level?: number; text: string }
  | { type: 'paragraph'; text: string; bold?: boolean; italic?: boolean }
  | { type: 'bullets'; items: string[] }
  | { type: 'numbered'; items: string[] }
  | { type: 'table'; headers?: string[]; rows: (string | number)[][] }
  | { type: 'code'; text: string }
  | { type: 'pagebreak' };

export interface SlideSpec {
  title: string;
  subtitle?: string;
  bullets?: string[];
  text?: string;
  table?: { headers?: string[]; rows: (string | number)[][] };
  notes?: string;
}

export interface CreateSpec {
  title?: string;
  /** Yapılandırılmış bloklar (docx / pdf) */
  blocks?: DocBlock[];
  /** Serbest markdown (docx / pdf): bloklara çevrilir */
  markdown?: string;
  /** pptx */
  slides?: SlideSpec[];
  author?: string;
}

export type EditOperation =
  | { type: 'replace_text'; find: string; replace: string; all?: boolean }
  | { type: 'append_blocks'; blocks?: DocBlock[]; markdown?: string };

export interface ReadResult {
  success: boolean;
  kind?: DocKind;
  filePath: string;
  text?: string;
  pages?: number;
  slides?: number;
  truncated?: boolean;
  error?: string;
}

export function detectKind(filePath: string): DocKind | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return 'pdf';
  if (ext === '.docx') return 'docx';
  if (ext === '.pptx') return 'pptx';
  return null;
}

// ───────────────────────── Yardımcılar ─────────────────────────

const XML_ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
export function decodeXml(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => XML_ENTITIES[m] ?? m)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}
export function encodeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Basit markdown → blok dönüştürücü (başlık, madde, numaralı liste, tablo, kod, paragraf). */
export function markdownToBlocks(md: string): DocBlock[] {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: DocBlock[] = [];
  let i = 0;
  const flushPara: string[] = [];
  const flush = () => {
    if (flushPara.length) {
      blocks.push({ type: 'paragraph', text: flushPara.join(' ').trim() });
      flushPara.length = 0;
    }
  };
  const strip = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/`([^`]+)`/g, '$1');
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', text: code.join('\n') });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); blocks.push({ type: 'heading', level: h[1].length, text: strip(h[2]).trim() }); i++; continue; }
    if (/^\s*---+\s*$/.test(line)) { flush(); blocks.push({ type: 'pagebreak' }); i++; continue; }
    if (/^\s*[-*+]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(strip(lines[i++].replace(/^\s*[-*+]\s+/, '')).trim());
      blocks.push({ type: 'bullets', items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(strip(lines[i++].replace(/^\s*\d+[.)]\s+/, '')).trim());
      blocks.push({ type: 'numbered', items });
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => strip(c).trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length) blocks.push({ type: 'table', headers: rows[0], rows: rows.slice(1) });
      continue;
    }
    if (!line.trim()) { flush(); i++; continue; }
    flushPara.push(strip(line.trim()));
    i++;
  }
  flush();
  return blocks;
}

function resolveBlocks(spec: CreateSpec): DocBlock[] {
  const blocks = [...(spec.blocks || [])];
  if (spec.markdown) blocks.push(...markdownToBlocks(spec.markdown));
  return blocks;
}

async function ensureDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function truncate(text: string, max: number): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max) + `\n\n[... ${text.length - max} karakter daha var; devamı için maxChars artır veya sayfa/slayt aralığı iste]`, truncated: true };
}

// ───────────────────────── OKUMA ─────────────────────────

/** word/document.xml → okunabilir metin (başlık, liste ve tablolar markdown olarak). */
export function docxXmlToText(xml: string): string {
  const body = xml.replace(/<w:sectPr[\s\S]*?<\/w:sectPr>/g, '');
  const out: string[] = [];
  const tokenRe = /<w:tbl>[\s\S]*?<\/w:tbl>|<w:p[ >][\s\S]*?<\/w:p>/g;
  const paraText = (p: string) => {
    const parts: string[] = [];
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p))) {
      if (m[0].startsWith('<w:tab')) parts.push('\t');
      else if (m[0].startsWith('<w:br')) parts.push('\n');
      else parts.push(decodeXml(m[1]));
    }
    return parts.join('');
  };
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(body))) {
    const chunk = m[0];
    if (chunk.startsWith('<w:tbl>')) {
      const rows: string[][] = [];
      for (const tr of chunk.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []) {
        rows.push((tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map((tc) => (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(paraText).join(' ').trim()));
      }
      if (rows.length) {
        out.push('| ' + rows[0].join(' | ') + ' |');
        out.push('|' + rows[0].map(() => ' --- ').join('|') + '|');
        for (const r of rows.slice(1)) out.push('| ' + r.join(' | ') + ' |');
        out.push('');
      }
      continue;
    }
    const text = paraText(chunk);
    const style = /<w:pStyle w:val="([^"]+)"/.exec(chunk)?.[1] || '';
    const heading = /^(?:Heading|Başlık|Baslik)\s?(\d)$/i.exec(style) || (/^Title$/i.test(style) ? ['', '1'] : null);
    if (!text.trim()) { out.push(''); continue; }
    if (heading) out.push('#'.repeat(Math.min(6, Number(heading[1]) || 1)) + ' ' + text.trim());
    else if (/<w:numPr>/.test(chunk)) out.push('- ' + text.trim());
    else out.push(text);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function readDocx(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const doc = zip.file('word/document.xml');
  if (!doc) throw new Error('Geçerli bir .docx değil (word/document.xml yok).');
  return docxXmlToText(await doc.async('string'));
}

export function pptxSlideXmlToText(xml: string): string {
  const paras = xml.match(/<a:p>[\s\S]*?<\/a:p>|<a:p [\s\S]*?<\/a:p>/g) || [];
  return paras
    .map((p) => {
      const runs = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((r) => decodeXml(r[1]));
      return runs.join('');
    })
    .filter((t) => t.trim())
    .join('\n');
}

async function pptxSlideEntries(zip: JSZip): Promise<{ n: number; name: string }[]> {
  return Object.keys(zip.files)
    .map((name) => ({ name, m: /^ppt\/slides\/slide(\d+)\.xml$/.exec(name) }))
    .filter((e) => e.m)
    .map((e) => ({ n: Number(e.m![1]), name: e.name }))
    .sort((a, b) => a.n - b.n);
}

async function readPptx(buf: Buffer, range?: string): Promise<{ text: string; slides: number }> {
  const zip = await JSZip.loadAsync(buf);
  const slides = await pptxSlideEntries(zip);
  if (!slides.length) throw new Error('Geçerli bir .pptx değil (slayt bulunamadı).');
  const wanted = parseRange(range, slides.length);
  const parts: string[] = [];
  for (const s of slides) {
    if (!wanted.has(s.n)) continue;
    const body = pptxSlideXmlToText(await zip.file(s.name)!.async('string'));
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${s.n}.xml`);
    const notes = notesFile ? pptxSlideXmlToText(await notesFile.async('string')).replace(/^\d+$/gm, '').trim() : '';
    parts.push(`### Slayt ${s.n}\n${body || '(metin yok)'}${notes ? `\n\n_Konuşmacı notu:_ ${notes}` : ''}`);
  }
  return { text: parts.join('\n\n'), slides: slides.length };
}

function parseRange(range: string | undefined, max: number): Set<number> {
  const set = new Set<number>();
  if (!range) { for (let i = 1; i <= max; i++) set.add(i); return set; }
  for (const part of String(range).split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.max(1, a); i <= Math.min(max, b); i++) set.add(i);
  }
  return set.size ? set : parseRange(undefined, max);
}

async function readPdf(buf: Buffer, range?: string): Promise<{ text: string; pages: number }> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: true, disableFontFace: true, isEvalSupported: false, verbosity: 0 });
  const pdf = await task.promise;
  try {
    const wanted = parseRange(range, pdf.numPages);
    const parts: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      if (!wanted.has(p)) continue;
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      let line = '';
      const lines: string[] = [];
      for (const item of content.items as any[]) {
        line += item.str;
        if (item.hasEOL) { lines.push(line); line = ''; }
      }
      if (line) lines.push(line);
      parts.push(`### Sayfa ${p}\n${lines.join('\n').trim() || '(metin katmanı yok — taranmış görsel olabilir)'}`);
    }
    return { text: parts.join('\n\n'), pages: pdf.numPages };
  } finally {
    await pdf.destroy();
  }
}

export async function readDocument(filePath: string, opts: { maxChars?: number; range?: string } = {}): Promise<ReadResult> {
  const kind = detectKind(filePath);
  if (!kind) return { success: false, filePath, error: 'Desteklenmeyen uzantı. Desteklenenler: .pdf, .docx, .pptx' };
  try {
    const buf = await fs.readFile(filePath);
    const max = Math.max(1000, Math.min(opts.maxChars ?? 60000, 400000));
    if (kind === 'docx') {
      const t = truncate(await readDocx(buf), max);
      return { success: true, kind, filePath, text: t.text, truncated: t.truncated };
    }
    if (kind === 'pptx') {
      const r = await readPptx(buf, opts.range);
      const t = truncate(r.text, max);
      return { success: true, kind, filePath, text: t.text, slides: r.slides, truncated: t.truncated };
    }
    const r = await readPdf(buf, opts.range);
    const t = truncate(r.text, max);
    return { success: true, kind, filePath, text: t.text, pages: r.pages, truncated: t.truncated };
  } catch (err: any) {
    return { success: false, kind, filePath, error: String(err?.message || err) };
  }
}

// ───────────────────────── OLUŞTURMA ─────────────────────────

async function createDocx(filePath: string, spec: CreateSpec): Promise<void> {
  const docx: any = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, PageBreak, BorderStyle, ShadingType } = docx;
  const headingLevels = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
  const children: any[] = [];
  if (spec.title) children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: spec.title, bold: true })], spacing: { after: 240 } }));
  for (const b of resolveBlocks(spec)) {
    if (b.type === 'heading') {
      children.push(new Paragraph({ heading: headingLevels[Math.min(6, Math.max(1, b.level || 1))], children: [new TextRun({ text: b.text, bold: true })], spacing: { before: 240, after: 120 } }));
    } else if (b.type === 'paragraph') {
      children.push(new Paragraph({ children: [new TextRun({ text: b.text, bold: b.bold, italics: b.italic })], spacing: { after: 120 } }));
    } else if (b.type === 'bullets') {
      for (const item of b.items) children.push(new Paragraph({ text: item, bullet: { level: 0 } }));
    } else if (b.type === 'numbered') {
      b.items.forEach((item, idx) => children.push(new Paragraph({ children: [new TextRun({ text: `${idx + 1}. ${item}` })], indent: { left: 360 } })));
    } else if (b.type === 'code') {
      for (const ln of b.text.split('\n')) children.push(new Paragraph({ children: [new TextRun({ text: ln || ' ', font: 'Consolas', size: 20 })], shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' } }));
    } else if (b.type === 'pagebreak') {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    } else if (b.type === 'table') {
      const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
      const borders = { top: border, bottom: border, left: border, right: border };
      const mkRow = (cells: (string | number)[], head: boolean) =>
        new TableRow({
          tableHeader: head,
          children: cells.map((c) => new TableCell({
            borders,
            shading: head ? { type: ShadingType.CLEAR, fill: 'EDEDED' } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [new TextRun({ text: String(c ?? ''), bold: head })] })],
          })),
        });
      const rows = [] as any[];
      if (b.headers?.length) rows.push(mkRow(b.headers, true));
      for (const r of b.rows || []) rows.push(mkRow(r, false));
      if (rows.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }), new Paragraph({ text: '' }));
    }
  }
  const doc = new Document({
    creator: spec.author || 'Open Crow',
    title: spec.title || path.basename(filePath),
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children }],
  });
  await ensureDir(filePath);
  await fs.writeFile(filePath, await Packer.toBuffer(doc));
}

async function createPptx(filePath: string, spec: CreateSpec): Promise<number> {
  const mod: any = await import('pptxgenjs');
  const PptxGenJS = mod.default || mod;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = spec.author || 'Open Crow';
  pptx.title = spec.title || path.basename(filePath);
  const FONT = 'Calibri';
  const slides: SlideSpec[] = spec.slides?.length ? spec.slides : [{ title: spec.title || 'Sunum' }];
  slides.forEach((s, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    const isCover = idx === 0 && !s.bullets?.length && !s.table && !s.text;
    if (isCover) {
      slide.background = { color: '111111' };
      slide.addText(s.title, { x: 0.8, y: 2.3, w: 11.7, h: 1.4, fontFace: FONT, fontSize: 40, bold: true, color: 'FFFFFF' });
      if (s.subtitle) slide.addText(s.subtitle, { x: 0.8, y: 3.8, w: 11.7, h: 0.8, fontFace: FONT, fontSize: 20, color: 'BFBFBF' });
    } else {
      slide.addText(s.title, { x: 0.7, y: 0.4, w: 11.9, h: 0.9, fontFace: FONT, fontSize: 30, bold: true, color: '111111' });
      slide.addShape(pptx.ShapeType.line, { x: 0.7, y: 1.3, w: 11.9, h: 0, line: { color: 'D4D4D4', width: 1 } });
      let y = 1.55;
      if (s.text) {
        slide.addText(s.text, { x: 0.7, y, w: 11.9, h: 1.2, fontFace: FONT, fontSize: 18, color: '333333', valign: 'top' });
        y += 1.3;
      }
      if (s.bullets?.length) {
        slide.addText(s.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })), { x: 0.7, y, w: 11.9, h: 5.2 - (y - 1.55), fontFace: FONT, fontSize: 20, color: '222222', valign: 'top', paraSpaceAfter: 8 });
      }
      if (s.table?.rows?.length) {
        const head = s.table.headers?.length ? [s.table.headers.map((h) => ({ text: String(h), options: { bold: true, fill: { color: 'EDEDED' }, color: '111111' } }))] : [];
        const body = s.table.rows.map((r) => r.map((c) => ({ text: String(c ?? '') })));
        slide.addTable([...head, ...body] as any, { x: 0.7, y, w: 11.9, fontFace: FONT, fontSize: 14, border: { type: 'solid', color: 'BFBFBF', pt: 0.75 } });
      }
    }
    if (s.notes) slide.addNotes(s.notes);
    slide.addText(String(idx + 1), { x: 12.2, y: 7.0, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 10, color: '8A8A8A', align: 'right' });
  });
  await ensureDir(filePath);
  const data: Buffer = await pptx.write({ outputType: 'nodebuffer' });
  await fs.writeFile(filePath, data);
  return slides.length;
}

export function blocksToHtml(spec: CreateSpec): string {
  const esc = (s: string) => encodeXml(String(s ?? ''));
  const body: string[] = [];
  if (spec.title) body.push(`<h1 class="doc-title">${esc(spec.title)}</h1>`);
  for (const b of resolveBlocks(spec)) {
    if (b.type === 'heading') { const l = Math.min(6, Math.max(1, b.level || 1)); body.push(`<h${l}>${esc(b.text)}</h${l}>`); }
    else if (b.type === 'paragraph') body.push(`<p>${b.bold ? '<b>' : ''}${b.italic ? '<i>' : ''}${esc(b.text)}${b.italic ? '</i>' : ''}${b.bold ? '</b>' : ''}</p>`);
    else if (b.type === 'bullets') body.push('<ul>' + b.items.map((i) => `<li>${esc(i)}</li>`).join('') + '</ul>');
    else if (b.type === 'numbered') body.push('<ol>' + b.items.map((i) => `<li>${esc(i)}</li>`).join('') + '</ol>');
    else if (b.type === 'code') body.push(`<pre>${esc(b.text)}</pre>`);
    else if (b.type === 'pagebreak') body.push('<div style="page-break-after:always"></div>');
    else if (b.type === 'table') {
      const head = b.headers?.length ? '<thead><tr>' + b.headers.map((h) => `<th>${esc(String(h))}</th>`).join('') + '</tr></thead>' : '';
      body.push(`<table>${head}<tbody>` + (b.rows || []).map((r) => '<tr>' + r.map((c) => `<td>${esc(String(c ?? ''))}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 18mm 16mm; }
    body { font: 11pt/1.55 "Segoe UI", Calibri, Arial, sans-serif; color: #1b1b1b; }
    h1,h2,h3,h4 { line-height: 1.25; margin: 1.1em 0 .4em; } h1.doc-title { font-size: 24pt; margin-top: 0; }
    h1 { font-size: 18pt; } h2 { font-size: 14.5pt; } h3 { font-size: 12.5pt; }
    p { margin: .4em 0; } ul,ol { margin: .4em 0 .6em 1.3em; }
    table { border-collapse: collapse; width: 100%; margin: .6em 0; font-size: 10pt; }
    th,td { border: 1px solid #bdbdbd; padding: 5px 8px; text-align: left; vertical-align: top; } th { background: #efefef; }
    pre { background: #f3f3f3; border: 1px solid #ddd; padding: 8px 10px; font: 9.5pt Consolas, monospace; white-space: pre-wrap; }
  </style></head><body>${body.join('\n')}</body></html>`;
}

async function createPdf(filePath: string, spec: CreateSpec): Promise<void> {
  const { BrowserWindow } = await import('electron');
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(blocksToHtml(spec)));
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { marginType: 'default' } });
    await ensureDir(filePath);
    await fs.writeFile(filePath, pdf);
  } finally {
    win.destroy();
  }
}

export async function createDocument(filePath: string, spec: CreateSpec): Promise<{ success: boolean; filePath: string; kind?: DocKind; slides?: number; error?: string }> {
  const kind = detectKind(filePath);
  if (!kind) return { success: false, filePath, error: 'Desteklenmeyen uzantı. Desteklenenler: .pdf, .docx, .pptx' };
  try {
    if (kind === 'docx') {
      if (!resolveBlocks(spec).length && !spec.title) throw new Error('İçerik boş: blocks veya markdown ver.');
      await createDocx(filePath, spec);
      return { success: true, filePath, kind };
    }
    if (kind === 'pptx') {
      const count = await createPptx(filePath, spec);
      return { success: true, filePath, kind, slides: count };
    }
    if (!resolveBlocks(spec).length && !spec.title) throw new Error('İçerik boş: blocks veya markdown ver.');
    await createPdf(filePath, spec);
    return { success: true, filePath, kind };
  } catch (err: any) {
    return { success: false, filePath, kind, error: String(err?.message || err) };
  }
}

// ───────────────────────── DÜZENLEME ─────────────────────────

/** Bir paragrafın (w:p / a:p) tüm metin parçalarını birleştirip eşleşme varsa ilk parçaya yazar, diğerlerini boşaltır. */
function replaceInParagraphs(xml: string, paraRe: RegExp, textRe: RegExp, find: string, replace: string, all: boolean, budget: { left: number }): { xml: string; count: number } {
  let count = 0;
  const out = xml.replace(paraRe, (para) => {
    if (budget.left <= 0) return para;
    const texts = [...para.matchAll(textRe)];
    if (!texts.length) return para;
    const joined = texts.map((t) => decodeXml(t[2])).join('');
    if (!joined.includes(find)) return para;
    let replaced: string;
    if (all) {
      const n = joined.split(find).length - 1;
      replaced = joined.split(find).join(replace);
      count += n;
      budget.left -= n;
    } else {
      replaced = joined.replace(find, () => replace);
      count += 1;
      budget.left -= 1;
    }
    let idx = 0;
    return para.replace(textRe, (_full, open: string) => {
      const piece = idx === 0 ? encodeXml(replaced) : '';
      const close = open.startsWith('<w:') ? '</w:t>' : '</a:t>';
      const openFixed = open.startsWith('<w:') ? '<w:t xml:space="preserve">' : '<a:t>';
      idx++;
      return openFixed + piece + close;
    });
  });
  return { xml: out, count };
}

function blocksToWordXml(blocks: DocBlock[]): string {
  const run = (text: string, rpr = '') => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${encodeXml(text)}</w:t></w:r>`;
  const para = (inner: string, ppr = '') => `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${inner}</w:p>`;
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === 'heading') {
      const size = [0, 36, 30, 26, 24, 22, 22][Math.min(6, Math.max(1, b.level || 1))];
      out.push(para(run(b.text, `<w:b/><w:sz w:val="${size}"/>`), '<w:spacing w:before="240" w:after="120"/>'));
    } else if (b.type === 'paragraph') out.push(para(run(b.text, `${b.bold ? '<w:b/>' : ''}${b.italic ? '<w:i/>' : ''}`)));
    else if (b.type === 'bullets') b.items.forEach((i) => out.push(para(run('• ' + i), '<w:ind w:left="360"/>')));
    else if (b.type === 'numbered') b.items.forEach((i, n) => out.push(para(run(`${n + 1}. ${i}`), '<w:ind w:left="360"/>')));
    else if (b.type === 'code') b.text.split('\n').forEach((l) => out.push(para(run(l || ' ', '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/>'))));
    else if (b.type === 'pagebreak') out.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    else if (b.type === 'table') {
      const rows = [...(b.headers?.length ? [b.headers] : []), ...(b.rows || [])];
      const border = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`).join('') + '</w:tblBorders>';
      out.push(`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${border}</w:tblPr>` + rows.map((r, ri) => `<w:tr>${r.map((c) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${para(run(String(c ?? ''), ri === 0 && b.headers?.length ? '<w:b/>' : ''))}</w:tc>`).join('')}</w:tr>`).join('') + '</w:tbl>' + para(''));
    }
  }
  return out.join('');
}

export async function editDocument(filePath: string, operations: EditOperation[]): Promise<{ success: boolean; filePath: string; applied: number; replacements: number; error?: string }> {
  const kind = detectKind(filePath);
  if (!kind) return { success: false, filePath, applied: 0, replacements: 0, error: 'Desteklenmeyen uzantı.' };
  if (kind === 'pdf') {
    return { success: false, filePath, applied: 0, replacements: 0, error: 'PDF yerinde düzenlenemez. Önce read_document ile içeriği oku, değiştirip create_document ile yeni bir PDF üret.' };
  }
  if (!Array.isArray(operations) || !operations.length) return { success: false, filePath, applied: 0, replacements: 0, error: 'operations boş.' };
  try {
    const zip = await JSZip.loadAsync(await fs.readFile(filePath));
    let applied = 0;
    let replacements = 0;
    const targets = kind === 'docx'
      ? ['word/document.xml', ...Object.keys(zip.files).filter((n) => /^word\/(header|footer)\d*\.xml$/.test(n))]
      : Object.keys(zip.files).filter((n) => /^ppt\/(slides\/slide|notesSlides\/notesSlide)\d+\.xml$/.test(n));
    for (const op of operations) {
      if (op.type === 'replace_text') {
        if (!op.find) throw new Error('replace_text için find gerekli.');
        const budget = { left: op.all === false ? 1 : Number.POSITIVE_INFINITY };
        let opCount = 0;
        for (const name of targets) {
          const file = zip.file(name);
          if (!file) continue;
          const xml = await file.async('string');
          const res = kind === 'docx'
            ? replaceInParagraphs(xml, /<w:p[ >][\s\S]*?<\/w:p>/g, /(<w:t(?:\s[^>]*)?>)([\s\S]*?)<\/w:t>/g, op.find, op.replace ?? '', op.all !== false, budget)
            : replaceInParagraphs(xml, /<a:p>[\s\S]*?<\/a:p>/g, /(<a:t>)([\s\S]*?)<\/a:t>/g, op.find, op.replace ?? '', op.all !== false, budget);
          if (res.count) { zip.file(name, res.xml); opCount += res.count; }
        }
        if (!opCount) throw new Error(`Metin bulunamadı: "${op.find}"`);
        replacements += opCount;
        applied++;
      } else if (op.type === 'append_blocks') {
        if (kind !== 'docx') throw new Error('append_blocks yalnızca .docx için desteklenir.');
        const blocks = [...(op.blocks || []), ...(op.markdown ? markdownToBlocks(op.markdown) : [])];
        if (!blocks.length) throw new Error('append_blocks için blocks veya markdown ver.');
        const file = zip.file('word/document.xml')!;
        let xml = await file.async('string');
        const add = blocksToWordXml(blocks);
        xml = /<w:sectPr[\s\S]*<\/w:sectPr>\s*<\/w:body>/.test(xml)
          ? xml.replace(/(<w:sectPr(?:(?!<w:sectPr)[\s\S])*<\/w:sectPr>\s*<\/w:body>)/, add + '$1')
          : xml.replace('</w:body>', add + '</w:body>');
        zip.file('word/document.xml', xml);
        applied++;
      } else {
        throw new Error(`Bilinmeyen işlem: ${(op as any).type}`);
      }
    }
    const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await fs.writeFile(filePath, out);
    return { success: true, filePath, applied, replacements };
  } catch (err: any) {
    return { success: false, filePath, applied: 0, replacements: 0, error: String(err?.message || err) };
  }
}
