import { DataTable, type Column, type Row } from '../../components/DataTable';
import { StatCard, StatGrid } from '../../components/ui/Display';
import { COLORS, LOT_STATUS, LOT_STATUSES } from '../../domain/constants';
import { sum } from '../../domain/derive';
import { dateNumeric, fmt, sfmt } from '../../domain/format';
import { useEntrance } from '../../hooks/useEntrance';
import { useWide } from '../../hooks/useMediaQuery';
import { useOrgData } from '../../hooks/useOrg';
import { useFilters } from '../../store/filtersStore';
import { useUi } from '../../store/uiStore';
import { useExport } from '../filters/useExport';

export function StockPage() {
  const view = useFilters((s) => s.stockView);
  return view === 'lotes' ? <LotsView /> : <ProductsView />;
}

const LOT_COLUMNS: Column[] = [
  { label: 'Lote', w: 'minmax(90px,0.8fr)' },
  { label: 'Produto', w: 'minmax(170px,1.5fr)' },
  { label: 'Fornecedor', w: 'minmax(140px,1.2fr)' },
  { label: 'Estado', w: 'minmax(110px,0.9fr)' },
  { label: 'Encomenda', w: 'minmax(90px,0.8fr)' },
  { label: 'Qtd', align: 'right', w: 'minmax(56px,0.5fr)', total: true },
  { label: 'Vendidos', align: 'right', w: 'minmax(80px,0.7fr)', total: true },
  { label: 'Custo total', align: 'right', w: 'minmax(100px,0.9fr)', total: true },
  { label: 'Custo / un.', align: 'right', w: 'minmax(90px,0.8fr)' },
  { label: 'Receita', align: 'right', w: 'minmax(100px,0.9fr)', total: true },
  { label: 'Lucro', align: 'right', w: 'minmax(100px,0.9fr)', total: true },
];

function LotsView() {
  const { db, derived, analytics: a } = useOrgData();
  const openModal = useUi((s) => s.openModal);
  const doExport = useExport();
  const wide = useWide();
  const cur = db.settings.currency;
  const lots = a.lots;

  const rows: Row[] = [...lots]
    .toSorted((x, y) => y.orderDate.localeCompare(x.orderDate))
    .map((L) => {
      const p = derived.productById[L.productId];
      const st = LOT_STATUS[L.status];
      return {
        id: L.id,
        label: `Lote ${L.code}`,
        onClick: () => openModal({ kind: 'lotDetail', lotId: L.id }),
        f: { status: L.status, supplier: L.supplier },
        search: [L.code, p?.name, L.supplier].join(' '),
        sort: [
          L.code,
          p?.name ?? '',
          L.supplier,
          L.status,
          L.orderDate,
          L.qty,
          L.sold,
          Math.round(L.cost),
          Math.round(L.unit),
          L.rev,
          Math.round(L.profit),
        ],
        cells: [
          { t: L.code, weight: 600 },
          { t: p?.name ?? 'Produto removido', icon: p?.icon ?? 'help' },
          { t: L.supplier, color: COLORS.muted },
          { t: st.label, bg: st.bg, color: st.color, weight: 550 },
          dateNumeric(L.orderDate),
          String(L.qty),
          { t: String(L.sold), sub: L.recv && L.qty ? `${Math.round((L.sold / L.qty) * 100)}%` : '' },
          fmt(L.cost),
          fmt(L.unit),
          fmt(L.rev),
          {
            t: L.recv ? sfmt(L.profit) : '—',
            color: L.recv ? (L.profit >= 0 ? COLORS.green : COLORS.red) : COLORS.muted,
            weight: 600,
          },
        ],
      };
    });
  const suppliers = [...new Set(lots.map((L) => L.supplier))];

  return (
    <div className="flex flex-col gap-4">
      <StatGrid min={170}>
        {LOT_STATUSES.map((st) => {
          const l = lots.filter((L) => L.status === st);
          return (
            <StatCard
              key={st}
              dot={LOT_STATUS[st].dot}
              label={LOT_STATUS[st].label}
              value={String(l.length)}
              sub={`${fmt(sum(l, (L) => L.cost))} ${cur}`}
            />
          );
        })}
      </StatGrid>
      <DataTable
        columns={LOT_COLUMNS}
        rows={rows}
        filters={[
          { key: 'status', label: 'Estado', options: LOT_STATUSES.map((k) => ({ value: k, label: LOT_STATUS[k].label })) },
          { key: 'supplier', label: 'Fornecedor', options: suppliers.map((s) => ({ value: s, label: s })) },
        ]}
        onExport={() => doExport('lotes')}
        minWidth={wide ? 900 : 820}
        searchPlaceholder="Pesquisar lote, produto ou fornecedor"
        emptyText="Ainda sem lotes. Registe a primeira importação."
      />
    </div>
  );
}

const STOCK_COLUMNS: Column[] = [
  { label: 'Produto', w: 'minmax(190px,1.8fr)' },
  { label: 'Tipo', w: 'minmax(110px,1fr)' },
  { label: 'Estado', w: 'minmax(100px,0.9fr)' },
  { label: 'Em stock', align: 'right', w: 'minmax(80px,0.7fr)', total: true },
  { label: 'A caminho', align: 'right', w: 'minmax(80px,0.7fr)', total: true },
  { label: 'Mínimo', align: 'right', w: 'minmax(70px,0.6fr)' },
  { label: 'Preço', align: 'right', w: 'minmax(90px,0.8fr)' },
  { label: 'Custo / un.', align: 'right', w: 'minmax(90px,0.8fr)' },
  { label: 'Lucro / un.', align: 'right', w: 'minmax(90px,0.8fr)' },
  { label: 'Margem', align: 'right', w: 'minmax(80px,0.6fr)' },
  { label: 'Valor a custo', align: 'right', w: 'minmax(110px,1fr)', total: true },
  { label: 'Valor de venda', align: 'right', w: 'minmax(110px,1fr)', total: true },
];

const STOCK_STATE = {
  ok: ['OK', '#ECFDF3', COLORS.green],
  low: ['Baixo', '#FFF4E5', COLORS.amber],
  out: ['Esgotado', '#FEF3F2', COLORS.red],
} as const;

function ProductsView() {
  const { db, derived, analytics: a } = useOrgData();
  const openModal = useUi((s) => s.openModal);
  const doExport = useExport();
  const wide = useWide();
  const cur = db.settings.currency;
  const ps = derived.products.filter((p) => !p.service && a.productMatches(p.id));
  const e = useEntrance(ps.length);
  const below = ps.filter((p) => p.onHand <= p.minStock).length;

  const rows: Row[] = ps.map((p) => {
    const state = p.onHand === 0 ? 'out' : p.onHand <= p.minStock ? 'low' : 'ok';
    const [stLabel, stBg, stColor] = STOCK_STATE[state];
    const marginColor = p.marginP >= 25 ? COLORS.green : p.marginP >= 0 ? COLORS.amber : COLORS.red;
    return {
      id: p.id,
      label: `Produto ${p.name}`,
      onClick: () => openModal({ kind: 'productDetail', productId: p.id }),
      f: { type: p.typeId, state },
      search: `${p.name} ${p.sku}`,
      sort: [
        p.name,
        p.typeName,
        state,
        p.onHand,
        p.transit,
        p.minStock,
        p.price,
        Math.round(p.unitCost),
        Math.round(p.gpU),
        p.marginP,
        Math.round(p.stockCost),
        p.onHand * p.price,
      ],
      cells: [
        { t: p.name, icon: p.icon, sub: p.sku },
        { t: p.typeName, color: COLORS.muted },
        { t: stLabel, bg: stBg, color: stColor, weight: 550 },
        { t: String(p.onHand), weight: 600 },
        { t: p.transit ? `+${p.transit}` : '—', color: p.transit ? COLORS.brand : COLORS.muted },
        String(p.minStock),
        fmt(p.price),
        { t: p.hasCost ? fmt(p.unitCost) : '—', color: COLORS.muted },
        { t: p.hasCost ? sfmt(p.gpU) : '—', color: p.gpU >= 0 ? COLORS.green : COLORS.red, weight: 600 },
        p.hasCost
          ? {
              t: `${Math.round(p.marginP)}%`,
              bg: p.marginP >= 25 ? '#ECFDF3' : p.marginP >= 0 ? '#FFF4E5' : '#FEF3F2',
              color: marginColor,
              weight: 600,
            }
          : { t: '—', color: COLORS.muted },
        fmt(p.stockCost),
        fmt(p.onHand * p.price),
      ],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <StatGrid min={190}>
        <StatCard icon="inventory_2" tint={0} label="Unidades em stock" value={fmt(sum(ps, (p) => p.onHand) * e)} />
        <StatCard icon="savings" tint={1} label="Valor a custo" value={`${fmt(sum(ps, (p) => p.stockCost) * e)} ${cur}`} />
        <StatCard icon="sell" tint={2} label="Valor de venda" value={`${fmt(sum(ps, (p) => p.onHand * p.price) * e)} ${cur}`} />
        <StatCard
          icon="warning"
          tint={3}
          label="Abaixo do mínimo"
          value={String(below)}
          color={below ? COLORS.red : COLORS.ink}
        />
      </StatGrid>
      <DataTable
        columns={STOCK_COLUMNS}
        rows={rows}
        filters={[
          {
            key: 'state',
            label: 'Estado',
            options: [
              { value: 'ok', label: 'OK' },
              { value: 'low', label: 'Baixo' },
              { value: 'out', label: 'Esgotado' },
            ],
          },
        ]}
        onExport={() => doExport('stock')}
        minWidth={wide ? 900 : 820}
        searchPlaceholder="Pesquisar produto ou código"
        emptyText="Sem produtos. Adicione o primeiro."
      />
    </div>
  );
}

export default StockPage;
