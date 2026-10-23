import { useState } from 'react';
import { useNavigate } from 'react-router';
import { PATHS } from '../../app/paths';
import { DataTable } from '../../components/DataTable';
import { Badge, EmptyNote, IconTile, StatCard, StatGrid } from '../../components/ui/Display';
import { Icon } from '../../components/ui/Icon';
import { Segmented } from '../../components/ui/Segmented';
import { COLORS, LOT_STATUS } from '../../domain/constants';
import { dayLabel, fmt, pctRound, sfmt } from '../../domain/format';
import { useEntrance } from '../../hooks/useEntrance';
import { useWide } from '../../hooks/useMediaQuery';
import { useOrgData } from '../../hooks/useOrg';
import { useFilters, type DashboardMetric } from '../../store/filtersStore';
import { useUi } from '../../store/uiStore';
import { pickCells, RECENT_COLUMN_IDX, RECENT_COLUMNS, saleRows } from '../sales/saleRows';

const METRICS: ReadonlyArray<readonly [DashboardMetric, string]> = [
  ['rev', 'Receita vs custos'],
  ['gp', 'Lucro bruto'],
  ['un', 'Unidades'],
];

export function DashboardPage() {
  const { org, db, derived, analytics: a } = useOrgData();
  const metric = useFilters((s) => s.metric);
  const setMetric = useFilters((s) => s.setMetric);
  const openModal = useUi((s) => s.openModal);
  const navigate = useNavigate();
  const wide = useWide();
  const e = useEntrance(`${a.from}|${a.to}|${a.sales.length}|${metric}`);
  const cur = db.settings.currency;

  const gp = a.rev - a.cogs;
  const net = gp - a.exp;

  const steps = [
    ['Adicionar produtos', db.products.length > 0, () => openModal({ kind: 'product' })],
    ['Registar o primeiro lote', db.lots.length > 0, () => openModal({ kind: 'lot' })],
    ['Registar uma venda', db.sales.length > 0, () => openModal({ kind: 'sale' })],
    ['Convidar a equipa', db.members.length > 1 || db.invites.length > 0, () => navigate(PATHS.definicoes)],
  ] as const;

  // Alerts: low stock + lots on the way.
  const low = derived.products
    .filter((p) => !p.service && a.productMatches(p.id) && p.onHand <= p.minStock)
    .map((p) => ({
      key: p.id,
      icon: p.icon,
      title: p.name,
      sub: `${p.onHand} em stock · mínimo ${p.minStock}${p.transit ? ` · +${p.transit} a caminho` : ''}`,
      tag: p.onHand ? 'Stock baixo' : 'Esgotado',
      bg: '#FEF3F2',
      color: COLORS.red,
      onClick: () => navigate(PATHS.stock),
    }));
  const incoming = a.lots
    .filter((L) => !L.recv)
    .map((L) => {
      const st = LOT_STATUS[L.status];
      return {
        key: L.id,
        icon: 'local_shipping',
        title: `${L.code} · ${derived.productById[L.productId]?.name ?? '—'}`,
        sub: `${L.qty} un. · encomendado ${dayLabel(L.orderDate)}`,
        tag: st.label,
        bg: st.bg,
        color: st.color,
        onClick: () => openModal({ kind: 'lotDetail', lotId: L.id }),
      };
    });
  const alerts = [...low, ...incoming];

  // Top products in range.
  const byProduct = new Map<string, { units: number; rev: number }>();
  for (const s of a.sales) {
    const o = byProduct.get(s.productId) ?? { units: 0, rev: 0 };
    o.units += s.qty;
    o.rev += s.qty * s.price;
    byProduct.set(s.productId, o);
  }
  const top = [...byProduct.entries()]
    .filter(([, o]) => o.rev > 0)
    .toSorted((x, y) => y[1].rev - x[1].rev)
    .slice(0, 5);
  const topMax = Math.max(1, ...top.map(([, o]) => o.rev));

  const recent = saleRows(a.sales.toSorted((x, y) => y.date.localeCompare(x.date)).slice(0, 8), derived, (saleId) =>
    openModal({ kind: 'saleDetail', saleId }),
  ).map((r) => pickCells(r, RECENT_COLUMN_IDX));

  return (
    <div className="flex flex-col gap-4">
      {db.sales.length === 0 && (
        <section className="card flex flex-col gap-3.5 p-5" aria-labelledby="onboarding-title">
          <div className="flex flex-col gap-1">
            <h2 id="onboarding-title" className="m-0 text-base font-semibold">
              Vamos preparar {org.name}
            </h2>
            <div className="text-[13px] text-muted">Quatro passos para começar a vender.</div>
          </div>
          <ol
            className="m-0 grid list-none gap-2 p-0"
            style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))' }}
          >
            {steps.map(([label, done, onClick]) => (
              <li key={label}>
                <button
                  type="button"
                  onClick={onClick}
                  className="flex w-full items-center gap-2.5 rounded-[10px] border border-[#E7E9EE] bg-white p-3 text-left text-ink hover:bg-[#FAFBFC]"
                >
                  <span
                    className="grid size-6 shrink-0 place-items-center rounded-full"
                    style={{ background: done ? '#ECFDF3' : '#F2F4F7', color: done ? COLORS.green : COLORS.ink }}
                  >
                    <Icon name={done ? 'check' : 'arrow_forward'} size={15} />
                  </span>
                  <span className="text-sm" style={{ color: done ? COLORS.muted : COLORS.ink }}>
                    {label}
                    {done && <span className="sr-only"> (concluído)</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <StatGrid min={210}>
        <StatCard
          large
          icon="payments"
          tint={0}
          label="Receita"
          value={fmt(a.rev * e)}
          unit={cur}
          sub={`${a.units} unidades vendidas`}
        />
        <StatCard
          large
          icon="trending_up"
          tint={1}
          label="Lucro bruto"
          value={fmt(gp * e)}
          unit={cur}
          sub={`margem ${pctRound(gp, a.rev)}%`}
        />
        <StatCard
          large
          icon="receipt_long"
          tint={2}
          label="Despesas"
          value={fmt(a.exp * e)}
          unit={cur}
          sub={`${a.expenses.length} registos`}
        />
        <StatCard
          large
          icon="account_balance_wallet"
          tint={3}
          label="Resultado"
          value={sfmt(net * e)}
          unit={cur}
          color={net >= 0 ? COLORS.green : COLORS.red}
          sub="após mercadoria e despesas"
        />
      </StatGrid>

      <TrendChart metric={metric} setMetric={setMetric} e={e} wide={wide} />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))' }}>
        <section className="card flex flex-col gap-3 p-[18px]" aria-labelledby="alerts-title">
          <h2 id="alerts-title" className="m-0 text-[15px] font-semibold">
            Atenção
          </h2>
          {alerts.map((al) => (
            <button
              key={al.key}
              type="button"
              onClick={al.onClick}
              className="flex items-center gap-3 border-0 bg-transparent px-0 py-0.5 text-left text-ink"
            >
              <IconTile icon={al.icon} size={32} colors={[al.bg, al.color]} />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-sm font-medium">{al.title}</span>
                <span className="text-xs text-muted">{al.sub}</span>
              </span>
              <Badge bg={al.bg} color={al.color}>
                {al.tag}
              </Badge>
            </button>
          ))}
          {!alerts.length && <EmptyNote>Sem alertas de stock.</EmptyNote>}
        </section>

        <section className="card flex flex-col gap-3 p-[18px]" aria-labelledby="top-title">
          <h2 id="top-title" className="m-0 text-[15px] font-semibold">
            Produtos que mais vendem
          </h2>
          {top.map(([pid, o]) => (
            <div key={pid} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-2 text-sm">
                <span>
                  {derived.productById[pid]?.name ?? 'Produto removido'} <span className="text-muted">· {o.units} un.</span>
                </span>
                <span className="font-semibold">{fmt(o.rev)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-[3px] bg-divider">
                <div
                  className="h-full rounded-[3px] bg-[linear-gradient(90deg,#9B8CFF,#5B4CF5)]"
                  style={{ width: `${(o.rev / topMax) * 100 * e}%` }}
                />
              </div>
            </div>
          ))}
          {!top.length && <EmptyNote>Sem vendas neste período.</EmptyNote>}
        </section>
      </div>

      <DataTable
        title="Últimas vendas"
        columns={RECENT_COLUMNS}
        rows={recent}
        paginate={false}
        minWidth={wide ? 640 : 560}
        searchPlaceholder="Pesquisar vendas"
      />
    </div>
  );
}

function TrendChart({
  metric,
  setMetric,
  e,
  wide,
}: {
  metric: DashboardMetric;
  setMetric: (m: DashboardMetric) => void;
  e: number;
  wide: boolean;
}) {
  const { db, analytics: a } = useOrgData();
  const cur = db.settings.currency;
  const B = a.buckets;
  const [sel, setSel] = useState<number | null>(null);
  const primary = (k: string) => {
    const o = a.bucketTotals[k]!;
    return metric === 'rev' ? o.rev : metric === 'gp' ? o.rev - o.cogs : o.units;
  };
  const secondary = (k: string) => {
    const o = a.bucketTotals[k]!;
    return metric === 'rev' ? o.cogs + o.exp : 0;
  };
  const max = Math.max(1, ...B.map((b) => Math.max(primary(b.key), secondary(b.key))));
  const idx = sel != null && sel < B.length ? sel : B.length - 1;
  const sb = B[idx];
  const so = sb ? a.bucketTotals[sb.key]! : { rev: 0, cogs: 0, exp: 0, units: 0 };
  const step = Math.ceil(B.length / 14);
  const gap = B.length > 20 ? 2 : 6;
  const metricLabel = METRICS.find(([m]) => m === metric)![1];

  const selValue = metric === 'un' ? `${fmt(so.units)} un.` : `${fmt(sb ? primary(sb.key) : 0)} ${cur}`;
  const selSub =
    metric === 'rev'
      ? `resultado ${sfmt(so.rev - so.cogs - so.exp)} ${cur}`
      : metric === 'gp'
        ? `margem ${pctRound(so.rev - so.cogs, so.rev)}%`
        : `${fmt(so.rev)} ${cur} em receita`;

  return (
    <section className="card flex flex-col gap-4 p-[18px]" aria-label={`Gráfico: ${metricLabel}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Segmented label="Métrica" size="xs" options={METRICS} value={metric} onChange={setMetric} className="self-start" />
          <div className="flex gap-3.5 text-xs text-muted">
            {metric === 'rev' ? (
              <>
                <Legend color={COLORS.brand} label="Receita" />
                <Legend color="#D5DAE1" label="Mercadoria + despesas" />
              </>
            ) : (
              <Legend color={metric === 'gp' ? '#12B76A' : COLORS.brand} label={metric === 'gp' ? 'Lucro bruto' : 'Unidades'} />
            )}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 text-right" aria-live="polite">
          <div className="text-xs text-muted">{sb?.full}</div>
          <div className="text-lg font-semibold tracking-[-0.02em]">{selValue}</div>
          <div className="text-xs text-muted">{selSub}</div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex h-[200px] items-end border-b border-divider" style={{ gap }}>
          {B.map((b, i) => (
            <button
              key={b.key}
              type="button"
              aria-label={b.full}
              aria-pressed={i === idx}
              onMouseEnter={() => setSel(i)}
              onFocus={() => setSel(i)}
              onClick={() => setSel(i)}
              className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 rounded-t-md border-0 p-0"
              style={{ background: i === idx ? '#F5F6F8' : 'transparent' }}
            >
              <span
                className="max-w-[18px] flex-1 rounded-t-[4px] transition-[height] duration-400"
                style={{
                  height: `${(Math.max(0, primary(b.key)) / max) * 100 * e}%`,
                  background:
                    metric === 'gp' ? 'linear-gradient(180deg,#4ADE9B,#12B76A)' : 'linear-gradient(180deg,#9B8CFF,#5B4CF5)',
                }}
              />
              {metric === 'rev' && (
                <span
                  className="max-w-[18px] flex-1 rounded-t-[4px] bg-[#D5DAE1] transition-[height] duration-400"
                  style={{ height: `${(secondary(b.key) / max) * 100 * e}%` }}
                />
              )}
            </button>
          ))}
        </div>
        <div aria-hidden className="flex" style={{ gap }}>
          {B.map((b, i) => (
            <div
              key={b.key}
              className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[10px]"
              style={{ color: i === idx ? COLORS.ink : COLORS.muted }}
            >
              {i % step === 0 ? b.label : ''}
            </div>
          ))}
        </div>
      </div>
      {!wide && <span className="sr-only">Toque numa barra para ver o detalhe.</span>}
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden className="size-2 rounded-[2px]" style={{ background: color }} />
      {label}
    </div>
  );
}

export default DashboardPage;
