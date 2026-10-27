import type { Derived } from './derive';
import { sum } from './derive';
import { addDays, addMonths, dayLabel, dayLabelYear, monthFull, monthShort } from './format';
import type { Expense, OrgData, Sale } from './types';

export type RangePreset = '12m' | 'mes' | '3m' | 'ano' | 'tudo' | 'custom';

export const RANGE_PRESETS: ReadonlyArray<readonly [RangePreset, string]> = [
  ['12m', 'Últimos 12 meses'],
  ['mes', 'Este mês'],
  ['3m', 'Últimos 3 meses'],
  ['ano', 'Este ano'],
  ['tudo', 'Todo o período'],
  ['custom', 'Personalizado'],
];

export const DEFAULT_PRESET: RangePreset = 'mes';

export interface RangeState {
  preset: RangePreset;
  from: string;
  to: string;
}

export interface Filters {
  range: RangeState;
  productId: string;
  typeId: string;
  catId: string;
}

export const ALL = 'all';

export function resolveRange(r: RangeState, firstDate: string, today: string): { from: string; to: string } {
  const month = today.slice(0, 7);
  let from: string;
  let to = today;
  switch (r.preset) {
    case 'mes':
      from = `${month}-01`;
      break;
    case '3m':
      from = `${addMonths(month, -2)}-01`;
      break;
    case 'ano':
      from = `${today.slice(0, 4)}-01-01`;
      break;
    case '12m':
      from = `${addMonths(month, -11)}-01`;
      break;
    case 'custom':
      from = r.from || firstDate;
      to = r.to || today;
      break;
    default:
      from = firstDate;
  }
  return from > to ? { from: to, to: from } : { from, to };
}

export interface Bucket {
  key: string;
  label: string;
  full: string;
}

/** Monday of the ISO week containing `d`. */
const weekStart = (d: string) => {
  const day = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(d, -day);
};

/** Chart buckets: daily up to a month, weekly up to ~4 months, monthly beyond. */
export function buildBuckets(from: string, to: string): { buckets: Bucket[]; bucketOf: (d: string) => string } {
  const span = (Date.parse(to) - Date.parse(from)) / 864e5;
  const buckets: Bucket[] = [];
  if (span <= 31) {
    for (let d = from; d <= to; d = addDays(d, 1))
      buckets.push({ key: d, label: String(Number(d.slice(8, 10))), full: dayLabelYear(d) });
    return { buckets, bucketOf: (d) => d };
  }
  if (span <= 120) {
    for (let d = weekStart(from); d <= to; d = addDays(d, 7))
      buckets.push({ key: d, label: dayLabel(d), full: `Semana de ${dayLabelYear(d)}` });
    return { buckets, bucketOf: weekStart };
  }
  const start = from.slice(0, 7);
  for (let k = start; k <= to.slice(0, 7); k = addMonths(k, 1)) {
    const yearSuffix = k.slice(5) === '01' || k === start ? ` ${k.slice(2, 4)}` : '';
    buckets.push({ key: k, label: monthShort(k) + yearSuffix, full: monthFull(k) });
  }
  return { buckets, bucketOf: (d) => d.slice(0, 7) };
}

export function monthKeys(from: string, to: string): string[] {
  const out: string[] = [];
  for (let k = from.slice(0, 7); k <= to.slice(0, 7); k = addMonths(k, 1)) out.push(k);
  return out;
}

export interface BucketTotals {
  rev: number;
  cogs: number;
  exp: number;
  units: number;
  cats: Record<string, number>;
}

export interface MonthTotals {
  rev: number;
  cogs: number;
  exp: number;
}

export interface Analytics {
  from: string;
  to: string;
  sales: Sale[];
  expenses: Expense[];
  lots: Derived['lots'];
  rev: number;
  cogs: number;
  exp: number;
  units: number;
  buckets: Bucket[];
  bucketTotals: Record<string, BucketTotals>;
  months: string[];
  monthTotals: (key: string) => MonthTotals;
  productMatches: (productId: string) => boolean;
  inRange: (d: string | null | undefined) => boolean;
}

export function computeAnalytics(db: OrgData, d: Derived, f: Filters, today: string): Analytics {
  const allDates = [...db.sales.map((s) => s.date), ...db.expenses.map((x) => x.date)].toSorted();
  const { from, to } = resolveRange(f.range, allDates[0] ?? today, today);
  const inRange = (date: string | null | undefined) => !!date && date >= from && date <= to;
  const productMatches = (pid: string) => {
    const p = d.productById[pid];
    return (f.productId === ALL || pid === f.productId) && (f.typeId === ALL || p?.typeId === f.typeId);
  };

  const sales = db.sales.filter((s) => inRange(s.date) && productMatches(s.productId));
  const expenses = db.expenses.filter((x) => inRange(x.date) && (f.catId === ALL || x.catId === f.catId));
  const lots = d.lots.filter((L) => productMatches(L.productId));

  const { buckets, bucketOf } = buildBuckets(from, to);
  const bucketTotals: Record<string, BucketTotals> = {};
  for (const b of buckets) bucketTotals[b.key] = { rev: 0, cogs: 0, exp: 0, units: 0, cats: {} };
  for (const s of sales) {
    const o = bucketTotals[bucketOf(s.date)];
    if (!o) continue;
    o.rev += s.qty * s.price;
    o.cogs += d.cogs(s);
    o.units += s.qty;
  }
  for (const x of expenses) {
    const o = bucketTotals[bucketOf(x.date)];
    if (!o) continue;
    o.exp += x.amount;
    o.cats[x.catId] = (o.cats[x.catId] ?? 0) + x.amount;
  }

  const byMonth: Record<string, MonthTotals> = {};
  const M = (k: string) => (byMonth[k] ??= { rev: 0, cogs: 0, exp: 0 });
  for (const s of sales) {
    const o = M(s.date.slice(0, 7));
    o.rev += s.qty * s.price;
    o.cogs += d.cogs(s);
  }
  for (const x of expenses) M(x.date.slice(0, 7)).exp += x.amount;

  return {
    from,
    to,
    sales,
    expenses,
    lots,
    rev: sum(sales, (s) => s.qty * s.price),
    cogs: sum(sales, d.cogs),
    exp: sum(expenses, (x) => x.amount),
    units: sum(sales, (s) => s.qty),
    buckets,
    bucketTotals,
    months: monthKeys(from, to),
    monthTotals: (k) => byMonth[k] ?? { rev: 0, cogs: 0, exp: 0 },
    productMatches,
    inRange,
  };
}
