// src/core/spreadsheetAgentTools.ts
// Kraga IDE — Otonom AI Elektronik Tablo (Excel / CSV) Motoru ve Araçları
// Agent için yerleşik, zero-dependency SheetJS (xlsx) tabanlı okuma, oluşturma ve canlı düzenleme altyapısı.

import * as XLSX from 'xlsx';

export interface SpreadsheetCellCoord {
  r: number; // 0-indexed row
  c: number; // 0-indexed col
}

export type SpreadsheetOperation =
  | { type: 'set_cell'; cell: string; value: any }
  | { type: 'set_formula'; cell: string; formula: string }
  | { type: 'append_row'; row: any[] }
  | { type: 'append_rows'; rows: any[][] }
  | { type: 'update_range'; startCell: string; rows: any[][] }
  | { type: 'add_sheet'; sheetName: string; headers?: string[]; rows?: any[][] }
  | { type: 'delete_row'; rowIndex: number } // 1-indexed Excel row number
  | { type: 'delete_col'; col: string | number } // 'A' or 0-indexed col
  | { type: 'clear_range'; range: string };

export interface ReadSpreadsheetResult {
  success: boolean;
  filePath: string;
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: any[][];
  totalRows: number;
  totalCols: number;
  markdownTable: string;
  error?: string;
}

export interface CreateSpreadsheetResult {
  success: boolean;
  filePath: string;
  sheets: string[];
  totalRows: number;
  error?: string;
}

export interface EditSpreadsheetResult {
  success: boolean;
  filePath: string;
  sheetName: string;
  modifiedCells: string[];
  operationsApplied: number;
  error?: string;
}

// ----------------- KOORDİNAT VE FORMÜL YARDIMCILARI -----------------

export function colIndexToLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function letterToColIndex(letter: string): number {
  const clean = letter.toUpperCase().trim();
  let col = 0;
  for (let i = 0; i < clean.length; i++) {
    col = col * 26 + (clean.charCodeAt(i) - 64);
  }
  return col - 1;
}

export function coordToA1(r: number, c: number): string {
  return `${colIndexToLetter(c)}${r + 1}`;
}

export function a1ToCoord(a1: string): SpreadsheetCellCoord {
  const match = a1.toUpperCase().trim().match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return { r: 0, c: 0 };
  }
  const colStr = match[1];
  const rowStr = match[2];
  return {
    c: letterToColIndex(colStr),
    r: Math.max(0, parseInt(rowStr, 10) - 1),
  };
}

export function parseRange(rangeStr: string): { start: SpreadsheetCellCoord; end: SpreadsheetCellCoord } {
  const parts = rangeStr.toUpperCase().trim().split(':');
  if (parts.length === 1) {
    const c = a1ToCoord(parts[0]);
    return { start: c, end: c };
  }
  const start = a1ToCoord(parts[0]);
  const end = a1ToCoord(parts[1]);
  return {
    start: {
      r: Math.min(start.r, end.r),
      c: Math.min(start.c, end.c),
    },
    end: {
      r: Math.max(start.r, end.r),
      c: Math.max(start.c, end.c),
    },
  };
}

// ----------------- DOSYA OKUMA VE YAZMA DESTEĞİ -----------------

async function readWorkbookFile(filePath: string): Promise<XLSX.WorkBook> {
  let base64 = '';
  if (typeof window !== 'undefined' && window.kragaAPI?.fs?.readBinaryFile) {
    base64 = await window.kragaAPI.fs.readBinaryFile(filePath);
  } else if (typeof window !== 'undefined' && window.kragaAPI?.fs?.readFile) {
    const text = await window.kragaAPI.fs.readFile(filePath);
    base64 = btoa(unescape(encodeURIComponent(text)));
  } else {
    // Node.js ortamı veya test ortamı
    const fs = await import('fs');
    const buf = fs.readFileSync(filePath);
    base64 = buf.toString('base64');
  }

  return XLSX.read(base64, {
    type: 'base64',
    cellDates: true,
    cellStyles: true,
    cellFormula: true,
  });
}

async function writeWorkbookFile(filePath: string, wb: XLSX.WorkBook): Promise<void> {
  const ext = filePath.split('.').pop()?.toLowerCase() || 'xlsx';
  let bookType: XLSX.BookType = 'xlsx';
  if (ext === 'xls') bookType = 'biff8';
  else if (ext === 'csv') bookType = 'csv';

  const base64Out = XLSX.write(wb, {
    bookType,
    type: 'base64',
  });

  if (typeof window !== 'undefined' && window.kragaAPI?.fs?.writeBinaryFile) {
    await window.kragaAPI.fs.writeBinaryFile(filePath, base64Out);
  } else if (typeof window !== 'undefined' && window.kragaAPI?.fs?.writeFile) {
    const binStr = atob(base64Out);
    await window.kragaAPI.fs.writeFile(filePath, binStr);
  } else {
    const fs = await import('fs');
    const buf = Buffer.from(base64Out, 'base64');
    fs.writeFileSync(filePath, buf);
  }
}

// ----------------- READ SPREADSHEET -----------------

export async function readSpreadsheetFile(
  filePath: string,
  sheetName?: string,
  range?: string,
  maxRows: number = 100
): Promise<ReadSpreadsheetResult> {
  try {
    const wb = await readWorkbookFile(filePath);
    const sheetNames = wb.SheetNames || [];
    if (sheetNames.length === 0) {
      return {
        success: false,
        filePath,
        sheetNames: [],
        activeSheet: '',
        headers: [],
        rows: [],
        totalRows: 0,
        totalCols: 0,
        markdownTable: '',
        error: 'Elektronik tabloda çalışma sayfası bulunamadı.',
      };
    }

    const targetSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
    const ws = wb.Sheets[targetSheet];
    if (!ws) {
      return {
        success: false,
        filePath,
        sheetNames,
        activeSheet: targetSheet,
        headers: [],
        rows: [],
        totalRows: 0,
        totalCols: 0,
        markdownTable: '',
        error: `"${targetSheet}" sayfası bulunamadı.`,
      };
    }

    const rawData = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
      raw: false,
    }) as any[][];

    let headers: string[] = [];
    let rows: any[][] = [];

    if (range) {
      const parsed = parseRange(range);
      for (let r = parsed.start.r; r <= parsed.end.r; r++) {
        const rowData: any[] = [];
        for (let c = parsed.start.c; c <= parsed.end.c; c++) {
          rowData.push(rawData[r]?.[c] ?? '');
        }
        if (r === parsed.start.r) {
          headers = rowData.map((v, idx) => String(v || `Sütun ${colIndexToLetter(parsed.start.c + idx)}`));
        } else {
          rows.push(rowData);
        }
      }
    } else {
      if (rawData.length > 0) {
        headers = (rawData[0] || []).map((v, idx) => String(v || `Sütun ${colIndexToLetter(idx)}`));
        rows = rawData.slice(1, maxRows + 1);
      }
    }

    // Markdown Tablo Üretimi
    let markdownTable = '';
    if (headers.length > 0) {
      markdownTable += `| ${headers.join(' | ')} |\n`;
      markdownTable += `| ${headers.map(() => '---').join(' | ')} |\n`;
      const previewRows = rows.slice(0, 30);
      for (const row of previewRows) {
        const safeCells = headers.map((_, i) => String(row[i] ?? '').replace(/\|/g, '\\|'));
        markdownTable += `| ${safeCells.join(' | ')} |\n`;
      }
      if (rows.length > 30) {
        markdownTable += `*... (${rows.length - 30} satır daha var)*\n`;
      }
    }

    return {
      success: true,
      filePath,
      sheetNames,
      activeSheet: targetSheet,
      headers,
      rows,
      totalRows: rawData.length,
      totalCols: headers.length,
      markdownTable,
    };
  } catch (err: any) {
    return {
      success: false,
      filePath,
      sheetNames: [],
      activeSheet: '',
      headers: [],
      rows: [],
      totalRows: 0,
      totalCols: 0,
      markdownTable: '',
      error: err.message || String(err),
    };
  }
}

// ----------------- CREATE SPREADSHEET -----------------

export async function createSpreadsheetFile(
  filePath: string,
  sheets: Array<{ name: string; headers?: string[]; rows?: any[][] }>
): Promise<CreateSpreadsheetResult> {
  try {
    if (!sheets || sheets.length === 0) {
      sheets = [{ name: 'Sayfa1', headers: ['No', 'Başlık', 'Durum'], rows: [] }];
    }

    const wb = XLSX.utils.book_new();
    let totalRows = 0;

    for (const sheetDef of sheets) {
      const name = (sheetDef.name || 'Sayfa1').slice(0, 31); // Excel max 31 char sheet name
      const aoa: any[][] = [];
      if (sheetDef.headers && sheetDef.headers.length > 0) {
        aoa.push(sheetDef.headers);
      }
      if (sheetDef.rows && Array.isArray(sheetDef.rows)) {
        for (const r of sheetDef.rows) {
          aoa.push(Array.isArray(r) ? r : [r]);
        }
      }
      totalRows += aoa.length;
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, name);
    }

    await writeWorkbookFile(filePath, wb);

    return {
      success: true,
      filePath,
      sheets: sheets.map((s) => s.name),
      totalRows,
    };
  } catch (err: any) {
    return {
      success: false,
      filePath,
      sheets: [],
      totalRows: 0,
      error: err.message || String(err),
    };
  }
}

// ----------------- EDIT SPREADSHEET -----------------

export async function editSpreadsheetFile(
  filePath: string,
  sheetName?: string,
  operations: SpreadsheetOperation[] = []
): Promise<EditSpreadsheetResult> {
  try {
    const wb = await readWorkbookFile(filePath);
    const sheetNames = wb.SheetNames || [];
    if (sheetNames.length === 0) {
      throw new Error('Dosyada çalışma sayfası bulunamadı.');
    }

    let targetSheet = sheetName && sheetNames.includes(sheetName) ? sheetName : sheetNames[0];
    let ws = wb.Sheets[targetSheet];

    let sheetData: any[][] = ws
      ? (XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }) as any[][])
      : [];

    const modifiedCells: string[] = [];
    let opsApplied = 0;

    for (const op of operations) {
      if (op.type === 'set_cell') {
        const coord = a1ToCoord(op.cell);
        ensureCell(sheetData, coord.r, coord.c);
        sheetData[coord.r][coord.c] = op.value;
        modifiedCells.push(coordToA1(coord.r, coord.c));
        opsApplied++;
      } else if (op.type === 'set_formula') {
        const coord = a1ToCoord(op.cell);
        ensureCell(sheetData, coord.r, coord.c);
        // Formül = ile başlamalı
        const formulaStr = op.formula.startsWith('=') ? op.formula : `=${op.formula}`;
        sheetData[coord.r][coord.c] = formulaStr;
        modifiedCells.push(coordToA1(coord.r, coord.c));
        opsApplied++;
      } else if (op.type === 'append_row') {
        sheetData.push(op.row);
        const newRowIdx = sheetData.length - 1;
        for (let c = 0; c < op.row.length; c++) {
          modifiedCells.push(coordToA1(newRowIdx, c));
        }
        opsApplied++;
      } else if (op.type === 'append_rows') {
        for (const row of op.rows) {
          sheetData.push(row);
          const newRowIdx = sheetData.length - 1;
          for (let c = 0; c < row.length; c++) {
            modifiedCells.push(coordToA1(newRowIdx, c));
          }
        }
        opsApplied++;
      } else if (op.type === 'update_range') {
        const start = a1ToCoord(op.startCell);
        for (let rIdx = 0; rIdx < op.rows.length; rIdx++) {
          const targetR = start.r + rIdx;
          const rowVals = op.rows[rIdx];
          for (let cIdx = 0; cIdx < rowVals.length; cIdx++) {
            const targetC = start.c + cIdx;
            ensureCell(sheetData, targetR, targetC);
            sheetData[targetR][targetC] = rowVals[cIdx];
            modifiedCells.push(coordToA1(targetR, targetC));
          }
        }
        opsApplied++;
      } else if (op.type === 'add_sheet') {
        const newName = (op.sheetName || 'Yeni Sayfa').slice(0, 31);
        if (!wb.SheetNames.includes(newName)) {
          const aoa: any[][] = [];
          if (op.headers) aoa.push(op.headers);
          if (op.rows) aoa.push(...op.rows);
          const newWs = XLSX.utils.aoa_to_sheet(aoa);
          XLSX.utils.book_append_sheet(wb, newWs, newName);
          targetSheet = newName;
          sheetData = aoa;
          opsApplied++;
        }
      } else if (op.type === 'delete_row') {
        const targetR = Math.max(0, op.rowIndex - 1);
        if (targetR < sheetData.length) {
          sheetData.splice(targetR, 1);
          opsApplied++;
        }
      } else if (op.type === 'delete_col') {
        const targetC = typeof op.col === 'number' ? op.col : letterToColIndex(String(op.col));
        for (const row of sheetData) {
          if (Array.isArray(row) && targetC < row.length) {
            row.splice(targetC, 1);
          }
        }
        opsApplied++;
      } else if (op.type === 'clear_range') {
        const range = parseRange(op.range);
        for (let r = range.start.r; r <= range.end.r; r++) {
          for (let c = range.start.c; c <= range.end.c; c++) {
            if (sheetData[r] && sheetData[r][c] !== undefined) {
              sheetData[r][c] = '';
              modifiedCells.push(coordToA1(r, c));
            }
          }
        }
        opsApplied++;
      }
    }

    // Güncellenen sheet verisini workbook'a geri aktar
    const updatedWs = XLSX.utils.aoa_to_sheet(sheetData);

    // Formülleri hücrelere tanıt (f özelliği)
    for (let r = 0; r < sheetData.length; r++) {
      for (let c = 0; c < (sheetData[r] || []).length; c++) {
        const val = sheetData[r][c];
        if (typeof val === 'string' && val.startsWith('=')) {
          const cellRef = coordToA1(r, c);
          if (updatedWs[cellRef]) {
            updatedWs[cellRef].f = val.substring(1);
          }
        }
      }
    }

    wb.Sheets[targetSheet] = updatedWs;
    await writeWorkbookFile(filePath, wb);

    return {
      success: true,
      filePath,
      sheetName: targetSheet,
      modifiedCells,
      operationsApplied: opsApplied,
    };
  } catch (err: any) {
    return {
      success: false,
      filePath,
      sheetName: sheetName || '',
      modifiedCells: [],
      operationsApplied: 0,
      error: err.message || String(err),
    };
  }
}

function ensureCell(data: any[][], r: number, c: number): void {
  while (data.length <= r) {
    data.push([]);
  }
  while (data[r].length <= c) {
    data[r].push('');
  }
}
