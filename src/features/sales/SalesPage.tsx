import { DataTable } from '../../components/DataTable';
import { StatCard, StatGrid } from '../../components/ui/Display';
import { COLORS } from '../../domain/constants';
import { fmt, pctRound } from '../../domain/format';
import { useEntrance } from '../../hooks/useEntrance';
import { useWide } from '../../hooks/useMediaQuery';
import { useOrgData } from '../../hooks/useOrg';
import { useUi } from '../../store/uiStore';
import { useExport } from '../filters/useExport';
import { SALE_COLUMNS, saleRows } from './saleRows';

export function SalesPage() {
  const { db, derived, analytics: a } = useOrgData();
  const openModal = useUi((s) => s.openModal);
  const doExport = useExport();
  const wide = useWide();
  const e = useEntrance(`${a.from}|${a.to}|${a.sales.length}`);
  const cur = db.settings.currency;
  const gp = a.rev - a.cogs;
  const gpColor = gp >= 0 ? COLORS.green : COLORS.red;

  const rows = saleRows(
    a.sales.toSorted((x, y) => y.date.localeCompare(x.date)),
    derived,
    (saleId) => openModal({ kind: 'saleDetail', saleId }),
  );
  const codes = [...new Set(rows.map((r) => r.f!.lot!))].toSorted();

  return (
    <div className="flex flex-col gap-4">
      <StatGrid>
        <StatCard icon="payments" tint={0} label="Receita" value={`${fmt(a.rev * e)} ${cur}`} />
        <StatCard icon="trending_up" tint={1} label="Lucro bruto" value={`${fmt(gp * e)} ${cur}`} color={gpColor} />
        <StatCard
          icon="percent"
          tint={2}
          label="Margem bruta"
          value={`${Math.round(pctRound(gp, a.rev) * e)}%`}
          color={gpColor}
        />
        <StatCard icon="shopping_bag" tint={3} label="Unidades vendidas" value={fmt(a.units * e)} />
      </StatGrid>
      <DataTable
        columns={SALE_COLUMNS}
        rows={rows}
        filters={[
          { key: 'lot', label: 'Lote', options: codes.map((c) => ({ value: c, label: c === '—' ? 'Sem lote (serviços)' : c })) },
        ]}
        onExport={() => doExport('vendas')}
        minWidth={wide ? 900 : 820}
        searchPlaceholder="Pesquisar cliente, produto ou lote"
        emptyText="Sem vendas para estes filtros."
      />
    </div>
  );
}

export default SalesPage;
