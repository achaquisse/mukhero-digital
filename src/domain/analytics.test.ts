import { describe, expect, it } from 'vitest';
import { makeDb, sale, TODAY } from '../test/fixtures';
import { ALL, buildBuckets, computeAnalytics, resolveRange, type Filters } from './analytics';
import { deriveOrg } from './derive';

const range = (preset: Filters['range']['preset'], from = '', to = '') => ({ preset, from, to });

describe('resolveRange', () => {
  it.each([
    ['mes', '2026-10-01'],
    ['3m', '2026-08-01'],
    ['ano', '2026-01-01'],
    ['12m', '2025-11-01'],
    ['tudo', '2024-02-11'],
  ] as const)('%s starts at %s', (preset, from) => {
    expect(resolveRange(range(preset), '2024-02-11', TODAY)).toEqual({ from, to: TODAY });
  });

  it('swaps an inverted custom range', () => {
    expect(resolveRange(range('custom', '2026-05-01', '2026-03-01'), '2024-01-01', TODAY)).toEqual({
      from: '2026-03-01',
      to: '2026-05-01',
    });
  });
});

describe('buildBuckets', () => {
  it('uses days up to a month', () => {
    const { buckets, bucketOf } = buildBuckets('2026-10-01', '2026-10-22');
    expect(buckets).toHaveLength(22);
    expect(bucketOf('2026-10-05')).toBe('2026-10-05');
  });

  it('uses ISO weeks up to ~4 months', () => {
    const { buckets, bucketOf } = buildBuckets('2026-08-01', '2026-10-22');
    expect(buckets[0]!.key).toBe('2026-07-27'); // Monday before 1 Aug
    expect(bucketOf('2026-10-22')).toBe('2026-10-19');
  });

  it('uses months beyond that, labelling year changes', () => {
    const { buckets } = buildBuckets('2025-11-01', '2026-10-22');
    expect(buckets).toHaveLength(12);
    expect(buckets[0]!.label).toBe('Nov 25');
    expect(buckets[2]!.label).toBe('Jan 26');
    expect(buckets[3]!.label).toBe('Fev');
  });
});

describe('computeAnalytics', () => {
  const db = makeDb({
    sales: [
      sale({ id: '1', productId: 'p1', lotId: 'A', qty: 2, price: 100, date: '2026-10-02' }),
      sale({ id: '2', productId: 'p2', qty: 1, price: 30, date: '2026-10-03' }),
      sale({ id: '3', productId: 'p1', lotId: 'A', qty: 1, price: 100, date: '2025-01-01' }),
    ],
    expenses: [
      { id: 'e1', date: '2026-10-05', amount: 40, catId: 'c1', note: '' },
      { id: 'e2', date: '2026-10-06', amount: 10, catId: 'c2', note: '' },
    ],
  });
  const d = deriveOrg(db, TODAY);
  const base: Filters = { range: range('mes'), productId: ALL, typeId: ALL, catId: ALL };

  it('totals revenue, cost of goods and expenses in range', () => {
    const a = computeAnalytics(db, d, base, TODAY);
    expect(a.sales.map((s) => s.id)).toEqual(['1', '2']);
    expect(a.rev).toBe(230);
    expect(a.cogs).toBe(100); // 2 units of lot A at 50
    expect(a.exp).toBe(50);
    expect(a.units).toBe(3);
    expect(a.bucketTotals['2026-10-02']).toMatchObject({ rev: 200, cogs: 100, units: 2 });
    expect(a.monthTotals('2026-10')).toEqual({ rev: 230, cogs: 100, exp: 50 });
  });

  it('applies product and category filters', () => {
    const a = computeAnalytics(db, d, { ...base, productId: 'p2', catId: 'c2' }, TODAY);
    expect(a.rev).toBe(30);
    expect(a.exp).toBe(10);
    expect(a.lots).toHaveLength(0);
  });
});
