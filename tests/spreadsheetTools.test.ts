import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
  colIndexToLetter,
  letterToColIndex,
  coordToA1,
  a1ToCoord,
  parseRange,
  createSpreadsheetFile,
  readSpreadsheetFile,
  editSpreadsheetFile,
} from '../src/core/spreadsheetAgentTools';

describe('Spreadsheet Agent Tools Engine Tests', () => {
  it('should bidirectional convert column letters and indices', () => {
    expect(colIndexToLetter(0)).toBe('A');
    expect(colIndexToLetter(3)).toBe('D');
    expect(colIndexToLetter(25)).toBe('Z');
    expect(colIndexToLetter(26)).toBe('AA');

    expect(letterToColIndex('A')).toBe(0);
    expect(letterToColIndex('D')).toBe(3);
    expect(letterToColIndex('Z')).toBe(25);
    expect(letterToColIndex('AA')).toBe(26);
  });

  it('should bidirectional convert A1 coordinates and {r, c}', () => {
    expect(coordToA1(0, 0)).toBe('A1');
    expect(coordToA1(6, 1)).toBe('B7');
    expect(coordToA1(19, 3)).toBe('D20');

    expect(a1ToCoord('A1')).toEqual({ r: 0, c: 0 });
    expect(a1ToCoord('B7')).toEqual({ r: 6, c: 1 });
    expect(a1ToCoord('D20')).toEqual({ r: 19, c: 3 });
  });

  it('should parse ranges like A1:D7', () => {
    const parsed = parseRange('A1:D7');
    expect(parsed.start).toEqual({ r: 0, c: 0 });
    expect(parsed.end).toEqual({ r: 6, c: 3 });

    const single = parseRange('C5');
    expect(single.start).toEqual({ r: 4, c: 2 });
    expect(single.end).toEqual({ r: 4, c: 2 });
  });

  it('should create a spreadsheet, read it, and apply live edits with formulas', async () => {
    const tmpDir = os.tmpdir();
    const testFile = path.join(tmpDir, `kraga_test_${Date.now()}.xlsx`);

    try {
      // 1. Tabloyu oluştur (Ekran görüntüsündeki gibi: No, İş / Görev Adı, Kategori, Sorumlu)
      const createRes = await createSpreadsheetFile(testFile, [
        {
          name: 'Genel Takip',
          headers: ['No', 'İş / Görev Adı', 'Kategori', 'Sorumlu'],
          rows: [
            [1, 'Web Sitesi Yenileme', 'Yazılım', 'Ahmet Yılmaz'],
            [2, 'Veritabanı Yedekleme', 'Altyapı', 'Mehmet Kaya'],
            [3, 'Mobil Tasarım', 'Tasarım', 'Selin Demir'],
          ],
        },
      ]);

      expect(createRes.success).toBe(true);
      expect(createRes.sheets).toEqual(['Genel Takip']);
      expect(createRes.totalRows).toBe(4);

      // 2. Tabloyu oku
      const readRes = await readSpreadsheetFile(testFile, 'Genel Takip');
      expect(readRes.success).toBe(true);
      expect(readRes.headers).toEqual(['No', 'İş / Görev Adı', 'Kategori', 'Sorumlu']);
      expect(readRes.rows.length).toBe(3);
      expect(readRes.markdownTable).toContain('| No | İş / Görev Adı | Kategori | Sorumlu |');
      expect(readRes.markdownTable).toContain('Web Sitesi Yenileme');

      // 3. Tabloyu düzenle: Yeni satır ekle ve Genel Toplam yaz
      const editRes = await editSpreadsheetFile(testFile, 'Genel Takip', [
        {
          type: 'append_row',
          row: [4, 'Güvenlik Testleri', 'Güvenlik', 'Can Aydın'],
        },
        {
          type: 'set_cell',
          cell: 'B7',
          value: 'Genel Toplam',
        },
        {
          type: 'set_formula',
          cell: 'A7',
          formula: 'COUNT(A2:A6)',
        },
      ]);

      expect(editRes.success).toBe(true);
      expect(editRes.modifiedCells).toContain('B7');
      expect(editRes.modifiedCells).toContain('A7');
      expect(editRes.operationsApplied).toBe(3);

      // 4. Değişiklikleri tekrar oku ve doğrula
      const readAgain = await readSpreadsheetFile(testFile, 'Genel Takip');
      expect(readAgain.rows.length).toBe(6);
      expect(readAgain.rows[3][1]).toBe('Güvenlik Testleri');
      expect(readAgain.rows[5][1]).toBe('Genel Toplam');
    } finally {
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    }
  });
});
