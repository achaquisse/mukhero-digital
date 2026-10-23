import type { Sheet } from '../lib/xlsx';
import type { Analytics } from './analytics';
import { LOT_STATUS } from './constants';
import type { Derived } from './derive';
import { sum } from './derive';
import type { OrgData } from './types';

export type ExportKind = 'resultados' | 'vendas' | 'despesas' | 'lotes' | 'stock' | 'tudo';

export const EXPORT_LABELS: Record<ExportKind, string> = {
  resultados: 'Resultados mensais',
  vendas: 'Vendas',
  despesas: 'Despesas',
  lotes: 'Lotes',
  stock: 'Stock actual',
  tudo: 'Livro completo',
};

const byDate = <T extends { date: string }>(l: T[]) => l.toSorted((x, y) => x.date.localeCompare(y.date));

/** Build workbook sheets for an export. All exports respect the active filters. */
export function buildExport(kind: ExportKind, db: OrgData, d: Derived, a: Analytics): Sheet[] {
  const productName = (id: string) => d.productById[id]?.name ?? 'Produto removido';
  const productType = (id: string) => d.productById[id]?.typeName ?? '—';
  const catName = (id: string) => db.cats.find((c) => c.id === id)?.name ?? 'Sem categoria';

  const builders: Record<Exclude<ExportKind, 'tudo'>, () => Sheet[]> = {
    resultados: () => [
      {
        name: 'Resultados',
        rows: [
          ['Mês', 'Receita', 'Custo mercadoria', 'Lucro bruto', 'Despesas', 'Resultado'],
          ...a.months.map((k) => {
            const o = a.monthTotals(k);
            return [k, o.rev, Math.round(o.cogs), Math.round(o.rev - o.cogs), o.exp, Math.round(o.rev - o.cogs - o.exp)];
          }),
        ],
      },
    ],
    vendas: () => [
      {
        name: 'Vendas',
        rows: [
          ['Data', 'Produto', 'Tipo', 'Lote', 'Quantidade', 'Preço unitário', 'Total', 'Custo mercadoria', 'Lucro', 'Cliente'],
          ...byDate(a.sales).map((s) => {
            const c = d.cogs(s);
            return [
              s.date,
              productName(s.productId),
              productType(s.productId),
              (s.lotId && d.lotById[s.lotId]?.code) || '',
              s.qty,
              s.price,
              s.qty * s.price,
              Math.round(c),
              Math.round(s.qty * s.price - c),
              s.customer,
            ];
          }),
        ],
      },
    ],
    despesas: () => [
      {
        name: 'Despesas',
        rows: [
          ['Data', 'Categoria', 'Valor', 'Nota'],
          ...byDate(a.expenses).map((x) => [x.date, catName(x.catId), x.amount, x.note]),
        ],
      },
      {
        name: 'Por categoria',
        rows: [
          ['Categoria', 'Registos', 'Total'],
          ...db.cats.map((c) => {
            const l = a.expenses.filter((x) => x.catId === c.id);
            return [c.name, l.length, sum(l, (x) => x.amount)];
          }),
        ],
      },
    ],
    lotes: () => [
      {
        name: 'Lotes',
        rows: [
          [
            'Código',
            'Produto',
            'Fornecedor',
            'Estado',
            'Encomenda',
            'Chegada',
            'Quantidade',
            'Vendidos',
            'Perdidos',
            'Restantes',
            'Custo total',
            'Custo unitário',
            'Receita',
            'Lucro',
          ],
          ...a.lots.map((L) => [
            L.code,
            productName(L.productId),
            L.supplier,
            LOT_STATUS[L.status].label,
            L.orderDate,
            L.arrivalDate ?? '',
            L.qty,
            L.sold,
            L.lost,
            L.left,
            Math.round(L.cost),
            Math.round(L.unit),
            L.rev,
            Math.round(L.profit),
          ]),
        ],
      },
    ],
    stock: () => [
      {
        name: 'Stock',
        rows: [
          [
            'Produto',
            'Código',
            'Tipo',
            'Em stock',
            'Em trânsito',
            'Mínimo',
            'Preço',
            'Custo unitário',
            'Lucro bruto unitário',
            'Margem %',
            'Valor a custo',
            'Valor de venda',
          ],
          ...d.products
            .filter((p) => !p.service && a.productMatches(p.id))
            .map((p) => [
              p.name,
              p.sku,
              p.typeName,
              p.onHand,
              p.transit,
              p.minStock,
              p.price,
              Math.round(p.unitCost),
              Math.round(p.gpU),
              Math.round(p.marginP),
              Math.round(p.stockCost),
              p.onHand * p.price,
            ]),
        ],
      },
      {
        name: 'Histórico de preços',
        rows: [
          ['Produto', 'Preço', 'Desde', 'Alterado por'],
          ...d.products.flatMap((p) => p.ph.map((x) => [p.name, x.price, x.from.slice(0, 10), x.by])),
        ],
      },
    ],
  };

  if (kind === 'tudo') return (['resultados', 'vendas', 'despesas', 'lotes', 'stock'] as const).flatMap((k) => builders[k]());
  return builders[kind]();
}

export const exportFilename = (orgName: string, kind: ExportKind, today: string) =>
  `${(orgName || 'org').replace(/\s+/g, '-')}-${kind}-${today}.xlsx`;
