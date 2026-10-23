import { describe, expect, it } from 'vitest';
import * as data from '../data/bestsound-data';
import { TODAY } from '../test/fixtures';
import { deriveOrg } from './derive';
import { seedBestSound, seedCasaLumi } from './seed';

describe('seedBestSound', () => {
  const db = seedBestSound(data, TODAY);
  const d = deriveOrg(db, TODAY);

  it('imports every spreadsheet lot plus two open orders', () => {
    expect(db.lots).toHaveLength(data.LOTS.length + 2);
    expect(db.lots.filter((l) => l.status === 'transito' || l.status === 'encomendado').map((l) => l.code)).toEqual([
      'ALM-L9',
      'GPS-L5',
    ]);
  });

  it('keeps referential integrity', () => {
    const products = new Set(db.products.map((p) => p.id));
    const lots = new Set(db.lots.map((l) => l.id));
    const cats = new Set(db.cats.map((c) => c.id));
    expect(db.sales.every((s) => products.has(s.productId) && (s.lotId === null || lots.has(s.lotId)))).toBe(true);
    expect(db.expenses.every((x) => cats.has(x.catId) && x.amount > 0)).toBe(true);
  });

  it('never oversells a lot', () => {
    for (const L of d.lots) expect(L.sold + L.lost).toBeLessThanOrEqual(L.qty);
  });

  it('turns GPS licence renewals into service sales', () => {
    expect(db.sales.filter((s) => s.productId === 'p4').length).toBeGreaterThan(5);
  });

  it('derives current prices from the latest sale', () => {
    expect(d.productById.p1!.price).toBe(1500);
    expect(d.productById.p2!.price).toBe(2500);
  });
});

describe('seedCasaLumi', () => {
  it('is deterministic and never dates records in the future', () => {
    const a = seedCasaLumi(TODAY);
    const b = seedCasaLumi(TODAY);
    expect(a.sales.map((s) => [s.date, s.qty])).toEqual(b.sales.map((s) => [s.date, s.qty]));
    expect([...a.sales, ...a.expenses].every((r) => r.date <= TODAY)).toBe(true);
    for (const L of deriveOrg(a, TODAY).lots) expect(L.left).toBeGreaterThanOrEqual(0);
  });
});
