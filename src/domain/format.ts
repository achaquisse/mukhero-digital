export const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
export const MONTHS_FULL = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MINUS = '−';

/** Integer with thin-space thousands separators and a typographic minus: 12 500, −300. */
export function fmt(n: number | null | undefined): string {
  const r = Math.round(n || 0);
  const abs = Math.abs(r)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return (r < 0 ? MINUS : '') + abs;
}

/** Signed variant of {@link fmt}: +1 200, −300, 0. */
export function sfmt(n: number): string {
  return (Math.round(n) > 0 ? '+' : '') + fmt(n);
}

/** Compact amount for chart labels: 12 k, 1,2 M. */
export function compact(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? MINUS : '';
  if (a >= 1e6) return sign + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' M';
  if (a >= 1e4) return sign + Math.round(a / 1e3) + ' k';
  return sign + fmt(a);
}

/** Percentage with one decimal and a comma: 12,5% */
export function pct1(part: number, whole: number): string {
  if (!whole) return '—';
  return (Math.round((part / whole) * 1000) / 10).toString().replace('.', ',') + '%';
}

export function pctRound(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Add n months to a YYYY-MM key. */
export function addMonths(key: string, n: number): string {
  let [y, m] = key.split('-').map(Number) as [number, number];
  m += n;
  while (m < 1) {
    m += 12;
    y--;
  }
  while (m > 12) {
    m -= 12;
    y++;
  }
  return `${y}-${pad2(m)}`;
}

/** Add n days to a YYYY-MM-DD date (calendar arithmetic in UTC, so DST never shifts it). */
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date) + n * 864e5).toISOString().slice(0, 10);
}

export const monthShort = (key: string) => MONTHS_SHORT[Number(key.slice(5, 7)) - 1] ?? '';
export const monthFull = (key: string) => `${MONTHS_FULL[Number(key.slice(5, 7)) - 1] ?? ''} ${key.slice(0, 4)}`;
/** "5 Mar" */
export const dayLabel = (d: string) => `${Number(d.slice(8, 10))} ${monthShort(d)}`;
/** "5 Mar 2026" */
export const dayLabelYear = (d: string) => `${dayLabel(d)} ${d.slice(0, 4)}`;
/** "05/03/26" */
export const dateNumeric = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;

/** "5 Mar 2026, 14:07" in local time. */
export function dateTimeLabel(at: Date): string {
  return `${dayLabelYear(toISODate(at))}, ${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
