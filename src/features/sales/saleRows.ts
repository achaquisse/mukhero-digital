import type { Column, Row } from '../../components/DataTable';
import { COLORS } from '../../domain/constants';
import type { Derived } from '../../domain/derive';
import { dateNumeric, fmt, plural, sfmt } from '../../domain/format';
import type { Sale } from '../../domain/types';

export const SALE_COLUMNS: Column[] = [
  { label: 'Data', w: 'minmax(90px,0.8fr)' },
  { label: 'Produto', w: 'minmax(180px,1.7fr)' },
  { label: 'Lote', w: 'minmax(80px,0.7fr)' },
  { label: 'Qtd', align: 'right', w: 'minmax(50px,0.4fr)', total: true },
  { label: 'Preço un.', align: 'right', w: 'minmax(90px,0.8fr)' },
  { label: 'Total', align: 'right', w: 'minmax(100px,0.9fr)', total: true },
  { label: 'Lucro', align: 'right', w: 'minmax(90px,0.8fr)', total: true },
  { label: 'Cliente', w: 'minmax(130px,1.2fr)' },
];

/** Compact column subset for the dashboard's "latest sales" table. */
export const RECENT_COLUMN_IDX = [0, 1, 2, 3, 5, 7];
export const RECENT_COLUMNS: Column[] = RECENT_COLUMN_IDX.map((i) =>
  i === 5 ? { ...SALE_COLUMNS[i]!, total: false } : SALE_COLUMNS[i]!,
);

export function saleRows(list: Sale[], d: Derived, onOpen: (id: string) => void): Row[] {
  return list.map((s) => {
    const p = d.productById[s.productId];
    const L = s.lotId ? d.lotById[s.lotId] : undefined;
    const total = s.qty * s.price;
    const profit = total - d.cogs(s);
    const nFiles = s.files?.length ?? 0;
    const name = p?.name ?? 'Produto removido';
    return {
      id: s.id,
      label: `Venda de ${name}, ${dateNumeric(s.date)}`,
      onClick: () => onOpen(s.id),
      sort: [s.date, name, L?.code ?? '', s.qty, s.price, total, Math.round(profit), s.customer],
      search: [name, L?.code, s.customer].filter(Boolean).join(' '),
      f: { lot: L?.code ?? '—' },
      cells: [
        { t: dateNumeric(s.date) },
        { t: name, icon: p?.icon ?? 'help', sub: p?.typeName ?? '—' },
        { t: L?.code ?? '—', color: COLORS.muted },
        String(s.qty),
        fmt(s.price),
        { t: fmt(total), weight: 600 },
        { t: L ? sfmt(profit) : '—', color: L ? (profit >= 0 ? COLORS.green : COLORS.red) : COLORS.muted },
        {
          t: s.customer || '—',
          color: s.customer ? COLORS.ink : COLORS.muted,
          sub: nFiles ? plural(nFiles, 'anexo', 'anexos') : '',
        },
      ],
    };
  });
}

export const pickCells = (r: Row, idx: number[]): Row => ({
  ...r,
  sort: idx.map((i) => r.sort[i]!),
  cells: idx.map((i) => r.cells[i]!),
});
