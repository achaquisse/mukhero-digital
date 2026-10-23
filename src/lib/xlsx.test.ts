import { describe, expect, it } from 'vitest';
import { buildXlsx, columnName, crc32, sheetXml } from './xlsx';

describe('xlsx writer', () => {
  it('computes standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('names columns like Excel', () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ', 'AAA']);
  });

  it('writes numbers as values and escapes strings', () => {
    const xml = sheetXml([
      ['Nome', 'Valor'],
      ['<A & B>', 1500],
      [null, ''],
    ]);
    expect(xml).toContain('<c r="B2"><v>1500</v></c>');
    expect(xml).toContain('<t>&lt;A &amp; B&gt;</t>');
    expect(xml).toContain('<row r="3"></row>');
  });

  it('produces a zip with the spreadsheet MIME type', async () => {
    const blob = buildXlsx([{ name: 'Vendas', rows: [['a', 1]] }]);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]); // "PK\3\4"
  });
});
