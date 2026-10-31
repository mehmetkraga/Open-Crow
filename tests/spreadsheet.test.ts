import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';

describe('Spreadsheet & Excel Processing Engine Tests', () => {
  // Koordinat dönüştürme fonksiyonları
  function colIndexToLetter(colIndex: number): string {
    let temp = colIndex;
    let letter = '';
    while (temp >= 0) {
      letter = String.fromCharCode((temp % 26) + 65) + letter;
      temp = Math.floor(temp / 26) - 1;
    }
    return letter;
  }

  function coordToA1(r: number, c: number): string {
    return `${colIndexToLetter(c)}${r + 1}`;
  }

  it('should accurately convert column indices to Excel column letters', () => {
    expect(colIndexToLetter(0)).toBe('A');
    expect(colIndexToLetter(1)).toBe('B');
    expect(colIndexToLetter(25)).toBe('Z');
    expect(colIndexToLetter(26)).toBe('AA');
    expect(colIndexToLetter(27)).toBe('AB');
    expect(colIndexToLetter(51)).toBe('AZ');
    expect(colIndexToLetter(52)).toBe('BA');
  });

  it('should accurately convert row & col indices to A1 coordinates', () => {
    expect(coordToA1(0, 0)).toBe('A1');
    expect(coordToA1(0, 1)).toBe('B1');
    expect(coordToA1(1, 2)).toBe('C2');
    expect(coordToA1(9, 0)).toBe('A10');
    expect(coordToA1(99, 25)).toBe('Z100');
  });

  it('should create, encode and decode a multi-sheet Excel workbook without data loss', () => {
    // 1. Yeni çalışma kitabı oluştur
    const wb = XLSX.utils.book_new();

    // 2. 11-A ve 11-B sınıfları için öğrenci listesi verisi
    const class11A = [
      ['No', 'Adı Soyadı', 'Fotoğraf', 'Durum'],
      [101, 'Ahmet Yılmaz', 'ahmet.jpg', 'Aktif'],
      [102, 'Ayşe Kaya', 'ayse.jpg', 'Aktif'],
      [103, 'Mehmet Demir', 'mehmet.jpg', 'Mezun'],
    ];

    const class11B = [
      ['No', 'Adı Soyadı', 'Fotoğraf', 'Durum'],
      [201, 'Canan Çelik', 'canan.jpg', 'Aktif'],
      [202, 'Burak Öztürk', 'burak.jpg', 'Aktif'],
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(class11A);
    const ws2 = XLSX.utils.aoa_to_sheet(class11B);

    XLSX.utils.book_append_sheet(wb, ws1, '11-A');
    XLSX.utils.book_append_sheet(wb, ws2, '11-B');

    // 3. İkili Base64 kodla
    const base64Out = XLSX.write(wb, {
      bookType: 'xlsx',
      type: 'base64',
    });

    expect(typeof base64Out).toBe('string');
    expect(base64Out.length).toBeGreaterThan(100);

    // 4. Base64'ten geri oku
    const parsedWb = XLSX.read(base64Out, { type: 'base64' });

    expect(parsedWb.SheetNames).toEqual(['11-A', '11-B']);

    // 5. Veri bütünlüğünü doğrula
    const parsed11A = XLSX.utils.sheet_to_json(parsedWb.Sheets['11-A'], { header: 1 });
    expect(parsed11A[0]).toEqual(['No', 'Adı Soyadı', 'Fotoğraf', 'Durum']);
    expect(parsed11A[1]).toEqual([101, 'Ahmet Yılmaz', 'ahmet.jpg', 'Aktif']);
    expect(parsed11A[2]).toEqual([102, 'Ayşe Kaya', 'ayse.jpg', 'Aktif']);

    const parsed11B = XLSX.utils.sheet_to_json(parsedWb.Sheets['11-B'], { header: 1 });
    expect(parsed11B[1]).toEqual([201, 'Canan Çelik', 'canan.jpg', 'Aktif']);
  });

  it('should export spreadsheet data to valid CSV format', () => {
    const data = [
      ['Sıra', 'Öğrenci', 'Not'],
      [1, 'Ali', 95],
      [2, 'Zeynep', 100],
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);

    expect(csv).toContain('Sıra,Öğrenci,Not');
    expect(csv).toContain('1,Ali,95');
    expect(csv).toContain('2,Zeynep,100');
  });
});
