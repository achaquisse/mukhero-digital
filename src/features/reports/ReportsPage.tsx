import { useState } from 'react';
import { DataTable, type Column, type Row } from '../../components/DataTable';
import { COLORS, NO_CATEGORY, PALETTE } from '../../domain/constants';
import { sum } from '../../domain/derive';
import { compact, fmt, monthFull, monthShort, pct1, sfmt } from '../../domain/format';
import { useEntrance } from '../../hooks/useEntrance';
import { useWide } from '../../hooks/useMediaQuery';
import { useOrgData } from '../../hooks/useOrg';
import { useUi } from '../../store/uiStore';
import { useExport } from '../filters/useExport';

export function ReportsPage() {
  const { db, derived, analytics: a } = useOrgData();
  const openModal = useUi((s) => s.openModal);
  const doExport = useExport();
  const wide = useWide();
  const e = useEntrance(`${a.from}|${a.to}|${a.sales.length}|${a.expenses.length}`);
  const cur = db.settings.currency;
  const minW = wide ? 900 : 820;

  const gp = a.rev - a.cogs;
  const net = gp - a.exp;
  const pc = (x: number) => pct1(x, a.rev);
  const catOf = (id: string) => db.cats.find((c) => c.id === id) ?? NO_CATEGORY;
  const invested = sum(
    a.lots.filter((L) => a.inRange(L.orderDate)),
    (L) => L.cost,
  );

  // Waterfall: revenue → goods → gross profit → expenses → result.
  const lo0 = Math.min(0, net, gp);
  const range = Math.max(a.rev, 1) - lo0;
  const pos = (x: number) => ((x - lo0) / range) * 100;
  const wf = (
    [
      ['Receita', 0, a.rev, 'linear-gradient(180deg,#9B8CFF,#5B4CF5)', a.rev],
      ['Mercadoria', gp, a.rev, '#F9C6C0', -a.cogs],
      ['Lucro bruto', 0, gp, '#7EDDAE', gp],
      ['Despesas', net, gp, '#F9C6C0', -a.exp],
      ['Resultado', 0, net, net >= 0 ? 'linear-gradient(180deg,#4ADE9B,#12B76A)' : '#F04438', net],
    ] as const
  ).map(([label, x, y, color, val], i) => {
    const lo = Math.min(x, y);
    const hi = Math.max(x, y);
    const h = (pos(hi) - pos(lo)) * e;
    const isResult = i === 4;
    return {
      label,
      color,
      bottom: pos(lo),
      h,
      value: isResult ? (val > 0 ? '+' : '') + compact(val) : compact(val),
      vc: isResult ? (val >= 0 ? COLORS.green : COLORS.red) : val < 0 ? COLORS.red : COLORS.ink,
    };
  });

  const byProduct = new Map<string, number>();
  for (const s of a.sales) byProduct.set(s.productId, (byProduct.get(s.productId) ?? 0) + s.qty * s.price);
  const byCat = new Map<string, number>();
  for (const x of a.expenses) byCat.set(x.catId, (byCat.get(x.catId) ?? 0) + x.amount);

  type PlRow = {
    key: string;
    label: string;
    value: string;
    pct: string;
    color?: string;
    lc?: string;
    bold?: boolean;
    sub?: boolean;
    dot?: string;
  };
  const line = (label: string, val: number, o: Partial<PlRow> & { neg?: boolean } = {}): PlRow => ({
    key: o.key ?? label,
    label,
    value: o.value ?? `${o.neg ? '− ' : ''}${fmt(Math.abs(val))}`,
    pct: pc(Math.abs(val)),
    ...o,
  });
  const pl: PlRow[] = [
    line('Receita de vendas', a.rev, { bold: true }),
    ...[...byProduct.entries()]
      .toSorted((x, y) => y[1] - x[1])
      .map(([id, v], i) =>
        line(derived.productById[id]?.name ?? 'Produto removido', v, {
          key: `p${id}`,
          sub: true,
          lc: COLORS.muted,
          color: COLORS.muted,
          dot: PALETTE[i % PALETTE.length],
        }),
      ),
    line('Custo das mercadorias vendidas', a.cogs, { neg: true }),
    line('Lucro bruto', gp, { bold: true, color: gp >= 0 ? COLORS.ink : COLORS.red }),
    line('Despesas operacionais', a.exp, { neg: true }),
    ...[...byCat.entries()]
      .toSorted((x, y) => y[1] - x[1])
      .map(([id, v]) => {
        const c = catOf(id);
        return line(c.name, v, { key: `c${id}`, sub: true, lc: COLORS.muted, color: COLORS.muted, dot: c.color });
      }),
    line('Resultado líquido', net, { bold: true, color: net >= 0 ? COLORS.green : COLORS.red, value: sfmt(net) }),
  ];

  const monthCols: Column[] = [
    { label: 'Mês', w: 'minmax(130px,1.2fr)' },
    { label: 'Receita', align: 'right', w: 'minmax(100px,1fr)', total: true },
    { label: 'Mercadoria', align: 'right', w: 'minmax(100px,1fr)', total: true },
    { label: 'Lucro bruto', align: 'right', w: 'minmax(100px,1fr)', total: true },
    { label: 'Despesas', align: 'right', w: 'minmax(100px,1fr)', total: true },
    { label: 'Resultado', align: 'right', w: 'minmax(100px,1fr)', total: true },
    { label: 'Margem', align: 'right', w: 'minmax(80px,0.7fr)' },
  ];
  const monthRows: Row[] = a.months.toReversed().map((k) => {
    const o = a.monthTotals(k);
    const g = o.rev - o.cogs;
    const r = g - o.exp;
    const mg = o.rev ? Math.round((r / o.rev) * 100) : 0;
    return {
      id: k,
      search: monthFull(k),
      sort: [k, o.rev, Math.round(o.cogs), Math.round(g), o.exp, Math.round(r), mg],
      cells: [
        monthFull(k),
        fmt(o.rev),
        { t: fmt(o.cogs), color: COLORS.muted },
        fmt(g),
        { t: fmt(o.exp), color: COLORS.muted },
        { t: sfmt(r), color: r >= 0 ? COLORS.green : COLORS.red, weight: 600 },
        { t: o.rev ? `${mg}%` : '—', color: COLORS.muted },
      ],
    };
  });

  const roiCols: Column[] = [
    { label: 'Lote', w: 'minmax(90px,0.8fr)' },
    { label: 'Produto', w: 'minmax(160px,1.4fr)' },
    { label: 'Custo', align: 'right', w: 'minmax(100px,0.9fr)', total: true },
    { label: 'Receita', align: 'right', w: 'minmax(100px,0.9fr)', total: true },
    { label: 'Lucro', align: 'right', w: 'minmax(100px,0.9fr)', total: true },
    { label: 'Recuperado', w: 'minmax(180px,1.4fr)' },
  ];
  const roiRows: Row[] = a.lots
    .filter((L) => L.recv && L.cost)
    .map((L) => {
      const p = derived.productById[L.productId];
      const r = L.rev / L.cost;
      return {
        id: L.id,
        label: `Lote ${L.code}`,
        onClick: () => openModal({ kind: 'lotDetail', lotId: L.id }),
        f: { status: L.status },
        search: `${L.code} ${p?.name ?? ''}`,
        sort: [L.code, p?.name ?? '', Math.round(L.cost), L.rev, Math.round(L.profit), r],
        cells: [
          { t: L.code, weight: 600 },
          { t: p?.name ?? 'Produto removido', icon: p?.icon ?? 'help' },
          fmt(L.cost),
          fmt(L.rev),
          { t: sfmt(L.profit), color: L.profit >= 0 ? COLORS.green : COLORS.red, weight: 600 },
          {
            t: `${Math.round(r * 100)}%`,
            bar: `${Math.min(100, r * 100)}%`,
            barColor: r >= 1 ? 'linear-gradient(90deg,#4ADE9B,#12B76A)' : 'linear-gradient(90deg,#FDBA74,#F2994A)',
            color: r >= 1 ? COLORS.green : COLORS.muted,
            weight: 600,
          },
        ],
      };
    });

  const catCols: Column[] = [
    { label: 'Categoria', w: 'minmax(160px,1.4fr)' },
    { label: 'Registos', align: 'right', w: 'minmax(80px,0.6fr)', total: true },
    { label: 'Total', align: 'right', w: 'minmax(110px,0.9fr)', total: true },
    { label: 'Peso', w: 'minmax(180px,1.4fr)' },
  ];
  const catRows: Row[] = db.cats
    .map((c) => {
      const l = a.expenses.filter((x) => x.catId === c.id);
      const t = sum(l, (x) => x.amount);
      const pct = a.exp ? (t / a.exp) * 100 : 0;
      return {
        id: c.id,
        search: c.name,
        sort: [c.name, l.length, t, pct],
        cells: [
          { t: c.name, dot: c.color },
          String(l.length),
          { t: fmt(t), weight: 600 },
          { t: `${Math.round(pct)}%`, bar: `${pct}%`, barColor: c.color, color: COLORS.muted },
        ],
      };
    })
    .filter((r) => (r.sort[1] as number) > 0);

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-[18px] p-[18px]" aria-labelledby="pl-title">
        <div className="flex flex-col gap-[3px]">
          <h2 id="pl-title" className="m-0 text-[15px] font-semibold">
            Demonstração de resultados
          </h2>
          <div className="text-xs text-muted">
            Investido em importações no período: {fmt(invested)} {cur}
          </div>
        </div>
        <div
          className="grid gap-px overflow-hidden rounded-xl bg-[#ECEBF5]"
          style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,190px),1fr))' }}
        >
          {[
            ['Receita', `${fmt(a.rev * e)} ${cur}`, COLORS.ink, `${a.units} unidades · ${a.sales.length} vendas`],
            ['Lucro bruto', `${fmt(gp * e)} ${cur}`, gp >= 0 ? COLORS.ink : COLORS.red, `margem bruta ${pc(gp)}`],
            [
              'Despesas operacionais',
              `${fmt(a.exp * e)} ${cur}`,
              COLORS.ink,
              `${pc(a.exp)} da receita · ${a.expenses.length} registos`,
            ],
            ['Resultado líquido', `${sfmt(net * e)} ${cur}`, net >= 0 ? COLORS.green : COLORS.red, `margem líquida ${pc(net)}`],
          ].map(([label, value, color, sub]) => (
            <div key={label} className="flex min-w-0 flex-col gap-1 bg-surface p-3.5">
              <span className="text-xs text-muted">{label}</span>
              <span className="truncate text-xl font-semibold tracking-[-0.02em]" style={{ color }}>
                {value}
              </span>
              <span className="text-[11px] text-muted">{sub}</span>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-7" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))' }}>
          <div className="flex flex-col gap-2">
            <h3 className="m-0 text-[13px] font-[550] text-muted">Da receita ao resultado</h3>
            <div
              className="box-border flex h-[230px] gap-2.5 border-b border-divider pt-5"
              role="img"
              aria-label="Cascata da receita ao resultado"
            >
              {wf.map((b) => (
                <div key={b.label} className="relative min-w-0 flex-1">
                  <div
                    className="absolute inset-x-[10%] rounded-md transition-[height] duration-400"
                    style={{ bottom: `${b.bottom}%`, height: `${b.h}%`, background: b.color }}
                  />
                  <div
                    className="absolute -inset-x-1.5 whitespace-nowrap text-center text-[11px] font-semibold"
                    style={{ bottom: `calc(${b.bottom + b.h}% + 4px)`, color: b.vc }}
                  >
                    {b.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5" aria-hidden>
              {wf.map((b) => (
                <div key={b.label} className="min-w-0 flex-1 text-center text-[11px] leading-[1.3] text-muted">
                  {b.label}
                </div>
              ))}
            </div>
          </div>

          <div role="table" aria-label="Demonstração de resultados" className="flex flex-col">
            <div
              role="row"
              className="grid grid-cols-[minmax(0,1fr)_auto_58px] gap-3 pb-1.5 text-[11px] uppercase tracking-[0.04em] text-subtle"
            >
              <span role="columnheader">Rubrica</span>
              <span role="columnheader" className="text-right">
                {cur}
              </span>
              <span role="columnheader" className="text-right">
                % rec.
              </span>
            </div>
            {pl.map((r) => (
              <div
                key={r.key}
                role="row"
                className="grid grid-cols-[minmax(0,1fr)_auto_58px] items-center gap-3 border-t"
                style={{
                  padding: r.sub ? '5px 0' : '10px 0',
                  borderTopColor: r.sub ? 'transparent' : r.bold ? '#E4E2F3' : '#F1F2F5',
                  fontSize: r.sub ? 13 : 14,
                  fontWeight: r.bold ? 600 : r.sub ? 400 : 500,
                }}
              >
                <span
                  role="cell"
                  className="flex min-w-0 items-center gap-2"
                  style={{ paddingLeft: r.sub ? 14 : 0, color: r.lc ?? COLORS.ink }}
                >
                  {r.dot && <span aria-hidden className="size-[7px] shrink-0 rounded-full" style={{ background: r.dot }} />}
                  <span className="truncate">{r.label}</span>
                </span>
                <span role="cell" className="whitespace-nowrap text-right" style={{ color: r.color ?? COLORS.ink }}>
                  {r.value}
                </span>
                <span role="cell" className="text-right text-xs font-normal text-muted">
                  {r.pct}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MonthlyChart e={e} />

      <DataTable
        title="Resultados por mês"
        columns={monthCols}
        rows={monthRows}
        onExport={() => doExport('resultados')}
        minWidth={minW}
        pageSize={12}
        searchPlaceholder="Pesquisar mês"
      />
      <DataTable
        title="Rentabilidade por lote"
        columns={roiCols}
        rows={roiRows}
        filters={[
          {
            key: 'status',
            label: 'Estado',
            options: [
              { value: 'recebido', label: 'Em venda' },
              { value: 'esgotado', label: 'Esgotado' },
            ],
          },
        ]}
        onExport={() => doExport('lotes')}
        minWidth={minW}
        searchPlaceholder="Pesquisar lote"
      />
      <DataTable
        title="Despesas por categoria"
        columns={catCols}
        rows={catRows}
        onExport={() => doExport('despesas')}
        minWidth={wide ? 640 : 560}
        paginate={false}
        searchPlaceholder="Pesquisar categoria"
      />
    </div>
  );
}

function MonthlyChart({ e }: { e: number }) {
  const { analytics: a } = useOrgData();
  const [sel, setSel] = useState<number | null>(null);
  const mm = a.months.map((k) => {
    const o = a.monthTotals(k);
    return { k, rev: o.rev, gp: o.rev - o.cogs, net: o.rev - o.cogs - o.exp };
  });
  const mxP = Math.max(1, ...mm.map((x) => Math.max(x.rev, x.gp, x.net)));
  const mxN = Math.max(0, ...mm.map((x) => -Math.min(x.gp, x.net, 0)));
  const total = mxP + mxN;
  const zero = (mxN / total) * 100;
  const bar = (x: number) => {
    const h = (Math.abs(x) / total) * 100 * e;
    return x >= 0 ? { bottom: `${zero}%`, height: `${h}%` } : { bottom: `${zero - h}%`, height: `${h}%` };
  };
  const step = Math.ceil(mm.length / 12);
  const gap = mm.length > 18 ? 3 : 8;
  const idx = sel != null && sel < mm.length ? sel : mm.length - 1;
  const sm = mm[idx] ?? { k: a.to.slice(0, 7), rev: 0, gp: 0, net: 0 };

  return (
    <section className="card flex flex-col gap-3.5 p-[18px]" aria-labelledby="monthly-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h2 id="monthly-title" className="m-0 text-[15px] font-semibold">
            Evolução mensal
          </h2>
          <div className="flex flex-wrap gap-3.5 text-xs text-muted">
            {[
              ['#5B4CF5', 'Receita'],
              ['#A6E9C6', 'Lucro bruto'],
              ['#12B76A', 'Resultado'],
            ].map(([c, l]) => (
              <div key={l} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-[2px]" style={{ background: c }} />
                {l}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-[3px]" aria-live="polite">
          <div className="text-xs text-muted">{monthFull(sm.k)}</div>
          <div className="flex gap-3.5 text-[13px]">
            {(
              [
                ['Receita', fmt(sm.rev), COLORS.ink],
                ['Lucro bruto', fmt(sm.gp), sm.gp >= 0 ? COLORS.ink : COLORS.red],
                ['Resultado', sfmt(sm.net), sm.net >= 0 ? COLORS.green : COLORS.red],
              ] as const
            ).map(([l, v, c]) => (
              <span key={l} className="flex flex-col items-end">
                <span className="text-[11px] text-subtle">{l}</span>
                <span className="font-semibold" style={{ color: c }}>
                  {v}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="relative h-[210px]">
          <div aria-hidden className="absolute inset-x-0 h-px bg-[#D5DAE1]" style={{ bottom: `${zero}%` }} />
          <div className="absolute inset-0 flex" style={{ gap }}>
            {mm.map((x, i) => (
              <button
                key={x.k}
                type="button"
                aria-label={monthFull(x.k)}
                aria-pressed={i === idx}
                onMouseEnter={() => setSel(i)}
                onFocus={() => setSel(i)}
                onClick={() => setSel(i)}
                className="relative min-w-0 flex-1 rounded-md border-0 p-0"
                style={{ background: i === idx ? '#F5F6F8' : 'transparent' }}
              >
                <span
                  className="absolute left-[8%] w-[27%] rounded-[3px] bg-[linear-gradient(180deg,#9B8CFF,#5B4CF5)] transition-[height] duration-400"
                  style={bar(x.rev)}
                />
                <span
                  className="absolute left-[36.5%] w-[27%] rounded-[3px] bg-[#A6E9C6] transition-[height] duration-400"
                  style={bar(x.gp)}
                />
                <span
                  className="absolute left-[65%] w-[27%] rounded-[3px] transition-[height] duration-400"
                  style={{ ...bar(x.net), background: x.net >= 0 ? '#12B76A' : '#F04438' }}
                />
              </button>
            ))}
          </div>
        </div>
        <div aria-hidden className="flex" style={{ gap }}>
          {mm.map((x, i) => (
            <div
              key={x.k}
              className="min-w-0 flex-1 whitespace-nowrap text-center text-[10px]"
              style={{ color: i === idx ? COLORS.ink : COLORS.muted }}
            >
              {i % step === 0 ? monthShort(x.k) + (x.k.slice(5) === '01' || i === 0 ? ` ${x.k.slice(2, 4)}` : '') : ''}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ReportsPage;
