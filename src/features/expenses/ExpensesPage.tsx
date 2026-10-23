import { useState } from 'react';
import { DataTable, type Column, type Row } from '../../components/DataTable';
import { Dot, EmptyNote, StatCard, StatGrid } from '../../components/ui/Display';
import { COLORS, NO_CATEGORY } from '../../domain/constants';
import { sum } from '../../domain/derive';
import { dateNumeric, fmt, plural } from '../../domain/format';
import { useEntrance } from '../../hooks/useEntrance';
import { useWide } from '../../hooks/useMediaQuery';
import { useOrgData } from '../../hooks/useOrg';
import { ALL } from '../../domain/analytics';
import { useFilters } from '../../store/filtersStore';
import { useUi } from '../../store/uiStore';
import { useExport } from '../filters/useExport';

const COLUMNS: Column[] = [
  { label: 'Data', w: 'minmax(90px,0.7fr)' },
  { label: 'Categoria', w: 'minmax(150px,1.1fr)' },
  { label: 'Nota', w: 'minmax(200px,2fr)' },
  { label: 'Valor', align: 'right', w: 'minmax(110px,0.8fr)', total: true },
];

export function ExpensesPage() {
  const { db, analytics: a } = useOrgData();
  const openModal = useUi((s) => s.openModal);
  const catId = useFilters((s) => s.catId);
  const setCat = useFilters((s) => s.setCat);
  const doExport = useExport();
  const wide = useWide();
  const e = useEntrance(`${a.from}|${a.to}|${a.expenses.length}`);
  const cur = db.settings.currency;
  const catOf = (id: string) => db.cats.find((c) => c.id === id) ?? NO_CATEGORY;

  const byCat = new Map<string, number>();
  for (const x of a.expenses) byCat.set(x.catId, (byCat.get(x.catId) ?? 0) + x.amount);
  const entries = [...byCat.entries()].toSorted((x, y) => y[1] - x[1]);
  const pcts = entries.map(([, v]) => (a.exp ? (v / a.exp) * 100 : 0));
  const stops = entries.map(([id], i) => {
    const start = sum(pcts.slice(0, i), (x) => x);
    return `${catOf(id).color} ${start}% ${start + pcts[i]!}%`;
  });

  const rows: Row[] = [...a.expenses]
    .toSorted((x, y) => y.date.localeCompare(x.date))
    .map((x) => {
      const c = catOf(x.catId);
      const n = x.files?.length ?? 0;
      return {
        id: x.id,
        label: `Despesa ${c.name}, ${fmt(x.amount)} ${cur}, ${dateNumeric(x.date)}`,
        onClick: () => openModal({ kind: 'expDetail', expId: x.id }),
        sort: [x.date, c.name, x.note, x.amount],
        search: `${c.name} ${x.note}`,
        cells: [
          dateNumeric(x.date),
          { t: c.name, dot: c.color },
          { t: x.note || '—', color: COLORS.muted, sub: n ? plural(n, 'anexo', 'anexos') : '' },
          { t: fmt(x.amount), weight: 600 },
        ],
      };
    });

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatCard icon="receipt_long" tint={0} label="Total" value={`${fmt(a.exp * e)} ${cur}`} />
        <StatCard
          icon="calendar_month"
          tint={1}
          label="Média mensal"
          value={`${fmt(a.months.length ? a.exp / a.months.length : 0)} ${cur}`}
        />
        <StatCard icon="category" tint={2} label="Maior categoria" value={entries[0] ? catOf(entries[0][0]).name : '—'} />
        <StatCard icon="tag" tint={3} label="Registos" value={String(a.expenses.length)} />
      </StatGrid>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))' }}>
        <section className="card flex flex-col gap-4 p-[18px]" aria-labelledby="exp-cat-title">
          <h2 id="exp-cat-title" className="m-0 text-[15px] font-semibold">
            Por categoria
          </h2>
          <div className="flex flex-wrap items-center gap-6">
            <div
              role="img"
              aria-label={`Total de despesas: ${fmt(a.exp)} ${cur}`}
              className="relative size-[150px] shrink-0 rounded-full"
              style={{
                background: `conic-gradient(${stops.length ? stops.join(', ') : '#EEF0F3 0 100%'})`,
                transform: `rotate(${(1 - e) * -60}deg)`,
              }}
            >
              <div
                className="absolute inset-5 flex flex-col items-center justify-center gap-0.5 rounded-full bg-white"
                style={{ transform: `rotate(${(1 - e) * 60}deg)` }}
              >
                <div className="text-[11px] text-muted">Total</div>
                <div className="text-lg font-semibold tracking-[-0.02em]">{fmt(a.exp * e)}</div>
              </div>
            </div>
            <ul className="m-0 flex min-w-[180px] flex-1 list-none flex-col gap-[9px] p-0">
              {entries.map(([id, v]) => {
                const c = catOf(id);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-pressed={catId === id}
                      onClick={() => setCat(catId === id ? ALL : id)}
                      className="flex w-full items-center gap-2.5 border-0 bg-transparent p-0 text-left text-sm text-ink"
                    >
                      <Dot color={c.color} />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-muted">{a.exp ? Math.round((v / a.exp) * 100) : 0}%</span>
                      <span className="min-w-16 text-right font-semibold">{fmt(v)}</span>
                    </button>
                  </li>
                );
              })}
              {!entries.length && <EmptyNote>Sem despesas neste período.</EmptyNote>}
            </ul>
          </div>
        </section>
        <ExpenseTrend e={e} />
      </div>

      <DataTable
        columns={COLUMNS}
        rows={rows}
        onExport={() => doExport('despesas')}
        minWidth={wide ? 640 : 560}
        searchPlaceholder="Pesquisar nota ou categoria"
        emptyText="Sem despesas para estes filtros."
      />
    </div>
  );
}

function ExpenseTrend({ e }: { e: number }) {
  const { db, analytics: a } = useOrgData();
  const [sel, setSel] = useState<number | null>(null);
  const B = a.buckets;
  const max = Math.max(1, ...B.map((b) => a.bucketTotals[b.key]!.exp));
  const step = Math.ceil(B.length / 14);
  const gap = B.length > 20 ? 2 : 6;
  const idx = sel != null && sel < B.length ? sel : B.length - 1;
  const sb = B[idx];
  const color = (id: string) => db.cats.find((c) => c.id === id)?.color ?? NO_CATEGORY.color;

  return (
    <section className="card flex flex-col gap-3.5 p-[18px]" aria-labelledby="exp-trend-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="exp-trend-title" className="m-0 text-[15px] font-semibold">
          Evolução
        </h2>
        <div className="text-xs text-muted" aria-live="polite">
          {sb ? `${sb.full} · ${fmt(a.bucketTotals[sb.key]!.exp)} ${db.settings.currency}` : ''}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex h-[170px] items-end border-b border-divider" style={{ gap }}>
          {B.map((b, i) => {
            const o = a.bucketTotals[b.key]!;
            const segs = Object.entries(o.cats).toSorted((x, y) => y[1] - x[1]);
            return (
              <button
                key={b.key}
                type="button"
                aria-label={`${b.full}: ${fmt(o.exp)}`}
                onMouseEnter={() => setSel(i)}
                onFocus={() => setSel(i)}
                onClick={() => setSel(i)}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end border-0 bg-transparent p-0"
              >
                <span
                  className="flex w-full max-w-[22px] flex-col-reverse overflow-hidden rounded-t-[4px] transition-[height] duration-400"
                  style={{ height: `${(o.exp / max) * 100 * e}%` }}
                >
                  {segs.map(([id, v]) => (
                    <span
                      key={id}
                      className="w-full"
                      style={{ height: `${o.exp ? (v / o.exp) * 100 : 0}%`, background: color(id) }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div aria-hidden className="flex" style={{ gap }}>
          {B.map((b, i) => (
            <div key={b.key} className="min-w-0 flex-1 whitespace-nowrap text-center text-[10px] text-muted">
              {i % step === 0 ? b.label : ''}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ExpensesPage;
