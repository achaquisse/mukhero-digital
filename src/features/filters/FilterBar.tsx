import { useLocation } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { PATHS } from '../../app/paths';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Popover, SelectMenu } from '../../components/ui/Menu';
import { Segmented } from '../../components/ui/Segmented';
import { ALL, DEFAULT_PRESET, RANGE_PRESETS, type RangePreset } from '../../domain/analytics';
import { dayLabelYear } from '../../domain/format';
import { useOrgData } from '../../hooks/useOrg';
import { useFilters, type StockView } from '../../store/filtersStore';
import { useUi, type ModalState } from '../../store/uiStore';
import { useExport } from './useExport';

type FilterKey = 'range' | 'product' | 'type' | 'cat';

const FILTERS_BY_PATH: Record<string, FilterKey[]> = {
  [PATHS.painel]: ['range', 'product', 'type'],
  [PATHS.vendas]: ['range', 'product', 'type'],
  [PATHS.despesas]: ['range', 'cat'],
  [PATHS.relatorios]: ['range', 'product', 'type', 'cat'],
  [PATHS.stock]: ['product', 'type'],
};

const STOCK_VIEWS: ReadonlyArray<readonly [StockView, string]> = [
  ['lotes', 'Por lote'],
  ['produtos', 'Por produto'],
];

const labelOf = (opts: Array<{ value: string; label: string }>, v: string) =>
  opts.find((o) => o.value === v)?.label ?? opts[0]!.label;

export function FilterBar() {
  const { pathname } = useLocation();
  const { db, analytics } = useOrgData();
  const f = useFilters(useShallow((s) => s));
  const openModal = useUi((s) => s.openModal);
  const keys = FILTERS_BY_PATH[pathname];
  if (!keys) return null;

  const has = (k: FilterKey) => keys.includes(k);
  const isStock = pathname === PATHS.stock;

  const action: [string, ModalState] | null =
    pathname === PATHS.stock
      ? f.stockView === 'lotes'
        ? ['Novo lote', { kind: 'lot' }]
        : ['Novo produto', { kind: 'product' }]
      : pathname === PATHS.vendas
        ? ['Nova venda', { kind: 'sale' }]
        : pathname === PATHS.despesas
          ? ['Nova despesa', { kind: 'expense' }]
          : null;

  const showClear =
    (has('range') && f.range.preset !== DEFAULT_PRESET) || f.productId !== ALL || f.typeId !== ALL || f.catId !== ALL;

  const productOpts = [{ value: ALL, label: 'Todos os produtos' }, ...db.products.map((p) => ({ value: p.id, label: p.name }))];
  const typeOpts = [{ value: ALL, label: 'Todos os tipos' }, ...db.types.map((t) => ({ value: t.id, label: t.name }))];
  const catOpts = [{ value: ALL, label: 'Todas as categorias' }, ...db.cats.map((c) => ({ value: c.id, label: c.name }))];

  return (
    <div className="relative flex flex-wrap items-center gap-2" role="toolbar" aria-label="Filtros">
      {isStock && (
        <Segmented
          label="Vista"
          options={STOCK_VIEWS}
          value={f.stockView}
          onChange={f.setStockView}
          className="rounded-[10px]! bg-[#EBEDF1]! p-[3px]!"
        />
      )}

      {has('range') && (
        <SelectMenu<RangePreset>
          label="Período"
          icon="calendar_month"
          display={RANGE_PRESETS.find(([id]) => id === f.range.preset)?.[1] ?? ''}
          value={f.range.preset}
          active={f.range.preset !== DEFAULT_PRESET}
          options={RANGE_PRESETS.map(([value, label]) => ({ value, label }))}
          onChange={(preset) =>
            f.setRange(
              preset === 'custom' ? { preset, from: f.range.from || analytics.from, to: f.range.to || analytics.to } : { preset },
            )
          }
        />
      )}
      {has('product') && (
        <SelectMenu<string>
          label="Produto"
          icon="category"
          display={labelOf(productOpts, f.productId)}
          value={f.productId}
          active={f.productId !== ALL}
          options={productOpts}
          onChange={f.setProduct}
        />
      )}
      {has('type') && (
        <SelectMenu<string>
          label="Tipo"
          icon="label"
          display={labelOf(typeOpts, f.typeId)}
          value={f.typeId}
          active={f.typeId !== ALL}
          options={typeOpts}
          onChange={f.setType}
        />
      )}
      {has('cat') && (
        <SelectMenu<string>
          label="Categoria"
          icon="sell"
          display={labelOf(catOpts, f.catId)}
          value={f.catId}
          active={f.catId !== ALL}
          options={catOpts}
          onChange={f.setCat}
        />
      )}

      {has('range') && f.range.preset === 'custom' && (
        <div className="flex items-center gap-1.5 text-[13px] text-muted">
          <input
            type="date"
            aria-label="Data inicial"
            value={analytics.from}
            max={analytics.to}
            onChange={(e) => e.target.value && f.setRange({ from: e.target.value })}
            className="field px-2! py-1.5! text-[13px]!"
          />
          <span>até</span>
          <input
            type="date"
            aria-label="Data final"
            value={analytics.to}
            min={analytics.from}
            onChange={(e) => e.target.value && f.setRange({ to: e.target.value })}
            className="field px-2! py-1.5! text-[13px]!"
          />
        </div>
      )}

      {showClear && (
        <button type="button" onClick={f.clear} className="border-0 bg-transparent p-1.5 text-[13px] font-medium text-brand">
          Limpar filtros
        </button>
      )}

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        {has('range') && (
          <div className="text-xs text-muted">
            {dayLabelYear(analytics.from)} – {dayLabelYear(analytics.to)}
          </div>
        )}
        {pathname === PATHS.relatorios && <ExportMenu />}
      </div>
      {action && (
        <Button variant="primary" icon="add" onClick={() => openModal(action[1])}>
          {action[0]}
        </Button>
      )}
    </div>
  );
}

function ExportMenu() {
  const { analytics } = useOrgData();
  const doExport = useExport();
  const items = [
    ['resultados', 'Resultados mensais', 'Receita, mercadoria, despesas e resultado', 'summarize'],
    ['vendas', 'Vendas', `${analytics.sales.length} vendas`, 'point_of_sale'],
    ['despesas', 'Despesas', `${analytics.expenses.length} registos + resumo por categoria`, 'receipt_long'],
    ['lotes', 'Lotes', `${analytics.lots.length} lotes com custos e lucro`, 'local_shipping'],
    ['stock', 'Stock atual', 'Quantidades e valorização', 'inventory_2'],
    ['tudo', 'Livro completo', 'Todas as folhas num ficheiro', 'table_view'],
  ] as const;
  return (
    <Popover
      align="right"
      panelClassName="w-[min(320px,calc(100vw-28px))]"
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={toggle}
          className="flex items-center gap-1.5 rounded-[10px] border border-line bg-white px-3 py-[7px] text-[13px] font-medium text-ink hover:bg-hover"
        >
          <Icon name="download" size={18} className="text-success" />
          Exportar Excel
          <Icon name="expand_more" size={17} className="text-subtle" />
        </button>
      )}
    >
      {(close) => (
        <div role="menu" aria-label="Exportar" className="flex flex-col">
          <div className="px-2.5 pb-1 pt-2 text-[11px] text-subtle">Respeita os filtros aplicados</div>
          {items.map(([kind, label, sub, icon]) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                doExport(kind);
              }}
              className="flex items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-ink hover:bg-hover"
            >
              <Icon name={icon} size={19} className="text-success" />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted">{sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
