import { useMemo, useState, type ReactNode } from 'react';
import { fmt, plural } from '../domain/format';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import { SelectMenu } from './ui/Menu';
import { Segmented } from './ui/Segmented';

export interface CellSpec {
  t: string;
  sub?: string;
  icon?: string;
  dot?: string;
  /** Inline progress bar width, e.g. "40%". */
  bar?: string;
  barColor?: string;
  color?: string;
  weight?: number;
  /** Renders the text as a pill with this background. */
  bg?: string;
}
export type Cell = string | CellSpec;

export interface Column {
  label: string;
  align?: 'left' | 'right' | 'center';
  /** CSS grid track, e.g. "minmax(90px,0.8fr)". */
  w?: string;
  /** Sum this column (using the row's sort value) in a totals row. */
  total?: boolean;
  sortable?: boolean;
}

export interface Row {
  id: string;
  cells: Cell[];
  /** Raw values per column used for sorting and totals. */
  sort: Array<string | number>;
  search?: string;
  /** Values matched by {@link TableFilter}s, keyed by filter key. */
  f?: Record<string, string>;
  onClick?: () => void;
  /** Accessible name for a clickable row. */
  label?: string;
}

export interface TableFilter {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

interface DataTableProps {
  columns: Column[];
  rows: Row[];
  title?: string;
  filters?: TableFilter[];
  pageSize?: number;
  paginate?: boolean;
  toolbar?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  minWidth?: number;
  onExport?: () => void;
}

const justify = (a?: Column['align']) => (a === 'right' ? 'flex-end' : a === 'center' ? 'center' : 'flex-start');
const PAGE_SIZES = [10, 25, 50] as const;

export function DataTable({
  columns,
  rows,
  title,
  filters = [],
  pageSize = 10,
  paginate = true,
  toolbar = true,
  searchPlaceholder = 'Pesquisar',
  emptyText = 'Sem registos.',
  minWidth = 640,
  onExport,
}: DataTableProps) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);
  const [fv, setFv] = useState<Record<string, string | null>>({});

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = rows.filter(
      (r) =>
        (!query || (r.search ?? '').toLowerCase().includes(query)) &&
        Object.entries(fv).every(([k, v]) => v == null || r.f?.[k] === v),
    );
    if (sort) {
      const { col, dir } = sort;
      out = out.toSorted((a, b) => {
        const x = a.sort[col];
        const y = b.sort[col];
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'pt');
        return c * dir;
      });
    }
    return out;
  }, [rows, q, fv, sort]);

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const cur = Math.min(page, pages - 1);
  const shown = paginate ? filtered.slice(cur * size, (cur + 1) * size) : filtered;
  const gridCols = columns.map((c) => c.w ?? 'minmax(0,1fr)').join(' ');
  const hasTotals = columns.some((c) => c.total) && total > 0;

  const cycleSort = (i: number) =>
    setSort((s) => (s?.col === i ? (s.dir === -1 ? { col: i, dir: 1 } : null) : { col: i, dir: -1 }));

  const start = Math.max(0, Math.min(cur - 2, pages - 5));
  const pageBtns = Array.from({ length: Math.min(pages, start + 5) - start }, (_, i) => start + i);

  return (
    <section className="card relative flex min-w-0 flex-col" aria-label={title}>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 p-3">
          {title && <h2 className="m-0 px-1 text-[15px] font-semibold">{title}</h2>}
          <label className="flex min-w-[150px] max-w-[300px] flex-[1_1_180px] items-center gap-1.5 rounded-[10px] border border-line bg-white px-2.5 focus-within:border-brand">
            <Icon name="search" size={18} className="text-subtle" />
            <input
              type="search"
              value={q}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              className="min-w-0 flex-1 border-0 bg-transparent py-[9px] text-sm text-ink outline-none"
            />
          </label>
          {filters.map((f) => {
            const v = fv[f.key] ?? null;
            const opt = f.options.find((o) => o.value === v);
            return (
              <SelectMenu<string | null>
                key={f.key}
                label={f.label}
                display={opt ? `${f.label}: ${opt.label}` : f.label}
                value={v}
                active={!!opt}
                options={[{ value: null, label: 'Todos' }, ...f.options]}
                onChange={(nv) => {
                  setFv((s) => ({ ...s, [f.key]: nv }));
                  setPage(0);
                }}
              />
            );
          })}
          <div className="ml-auto flex items-center gap-2.5">
            <span className="whitespace-nowrap text-[13px] text-muted" aria-live="polite">
              {plural(total, 'registo', 'registos')}
            </span>
            {onExport && (
              <Button icon="table_view" iconColor="#15803D" className="py-2!" onClick={onExport}>
                Excel
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div role="table" aria-rowcount={total + 1} className="px-1.5 pb-1.5" style={{ minWidth }}>
          <div role="row" className="mb-0.5 grid rounded-[10px] bg-surface" style={{ gridTemplateColumns: gridCols }}>
            {columns.map((c, i) => {
              const on = sort?.col === i;
              const can = c.sortable !== false;
              return (
                <div
                  key={c.label}
                  role="columnheader"
                  aria-sort={on ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}
                  className="flex min-w-0 px-3.5 py-2.5"
                  style={{ justifyContent: justify(c.align) }}
                >
                  {can ? (
                    <button
                      type="button"
                      onClick={() => cycleSort(i)}
                      className={`inline-flex items-center gap-[3px] whitespace-nowrap border-0 bg-transparent p-0 text-xs font-[550] tracking-[0.01em] ${on ? 'text-brand' : 'text-muted'}`}
                    >
                      {c.label}
                      <Icon
                        name={on && sort.dir > 0 ? 'arrow_upward' : 'arrow_downward'}
                        size={15}
                        style={{ opacity: on ? 1 : 0 }}
                      />
                    </button>
                  ) : (
                    <span className="text-xs font-[550] text-muted">{c.label}</span>
                  )}
                </div>
              );
            })}
          </div>

          {shown.map((r) => (
            <div
              key={r.id}
              role="row"
              tabIndex={r.onClick ? 0 : undefined}
              aria-label={r.onClick ? r.label : undefined}
              onClick={r.onClick}
              onKeyDown={
                r.onClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        r.onClick!();
                      }
                    }
                  : undefined
              }
              className={`grid rounded-[10px] transition-colors hover:bg-[#F6F5FF] ${r.onClick ? 'cursor-pointer' : ''}`}
              style={{ gridTemplateColumns: gridCols }}
            >
              {r.cells.map((cell, i) => (
                <TableCell key={i} cell={cell} col={columns[i]} first={i === 0} />
              ))}
            </div>
          ))}

          {hasTotals && (
            <div role="row" className="mt-1 grid rounded-[10px] bg-surface" style={{ gridTemplateColumns: gridCols }}>
              {columns.map((c, i) => (
                <div
                  key={c.label}
                  role="cell"
                  className="flex whitespace-nowrap px-3.5 py-[11px] text-sm font-semibold"
                  style={{ justifyContent: justify(c.align) }}
                >
                  {i === 0 ? 'Total' : c.total ? fmt(filtered.reduce((a, r) => a + (Number(r.sort[i]) || 0), 0)) : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {total === 0 && <div className="px-4 py-9 text-center text-sm text-muted">{emptyText}</div>}

      {paginate && total > 0 && (
        <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
          <div className="flex items-center gap-2 text-[13px] text-muted">
            Linhas
            <Segmented
              label="Linhas por página"
              size="xs"
              options={PAGE_SIZES.map((n) => [String(n), String(n)] as const)}
              value={String(size)}
              onChange={(v) => {
                setSize(Number(v));
                setPage(0);
              }}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="pr-2 text-[13px] text-muted">
              {cur * size + 1}–{Math.min(total, (cur + 1) * size)} de {total}
            </span>
            <PagerButton label="Página anterior" icon="chevron_left" disabled={cur === 0} onClick={() => setPage(cur - 1)} />
            {pageBtns.map((i) => (
              <button
                key={i}
                type="button"
                aria-current={i === cur ? 'page' : undefined}
                aria-label={`Página ${i + 1}`}
                onClick={() => setPage(i)}
                className={`h-8 min-w-8 rounded-lg border text-[13px] font-[550] ${
                  i === cur ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <PagerButton
              label="Página seguinte"
              icon="chevron_right"
              disabled={cur >= pages - 1}
              onClick={() => setPage(cur + 1)}
            />
          </div>
        </nav>
      )}
    </section>
  );
}

function PagerButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink disabled:opacity-40"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

function TableCell({ cell, col, first }: { cell: Cell; col?: Column; first: boolean }): ReactNode {
  const c: CellSpec = typeof cell === 'string' ? { t: cell } : cell;
  const pill = !!c.bg;
  return (
    <div
      role="cell"
      className="flex min-w-0 items-center gap-2.5 px-3.5 py-[11px]"
      style={{ justifyContent: justify(col?.align) }}
    >
      {c.icon && (
        <span className="grid size-[30px] shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon name={c.icon} size={17} />
        </span>
      )}
      {c.dot && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: c.dot }} />}
      {c.bar != null && (
        <span aria-hidden className="h-1.5 min-w-10 max-w-[120px] flex-1 overflow-hidden rounded-[3px] bg-divider">
          <span className="block h-full rounded-[3px]" style={{ width: c.bar, background: c.barColor ?? '#111418' }} />
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-px" style={{ alignItems: col?.align === 'right' ? 'flex-end' : 'flex-start' }}>
        <span
          className={`max-w-full truncate ${pill ? 'rounded-full px-[9px] py-[3px] text-xs' : 'text-sm'}`}
          style={{ color: c.color ?? '#111418', fontWeight: c.weight ?? (first ? 500 : 400), background: c.bg }}
        >
          {c.t}
        </span>
        {c.sub && <span className="max-w-full truncate text-xs text-muted">{c.sub}</span>}
      </div>
    </div>
  );
}
