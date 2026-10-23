import type { Lot, OrgData, Product, Sale } from '../domain/types';

export const TODAY = '2026-10-22';

export const actor = { name: 'Tester', now: '2026-10-22T10:00:00.000Z', today: TODAY };

export function product(p: Partial<Product> & Pick<Product, 'id'>): Product {
  return {
    name: p.id,
    sku: `${p.id.toUpperCase()}-01`,
    typeId: 't1',
    icon: 'category',
    minStock: 2,
    price: 100,
    priceHistory: [],
    ...p,
  };
}

export function lot(l: Partial<Lot> & Pick<Lot, 'id' | 'productId'>): Lot {
  return {
    code: `${l.id}-code`,
    qty: 10,
    lost: 0,
    supplier: 'Supplier',
    status: 'recebido',
    orderDate: '2026-01-01',
    arrivalDate: '2026-02-01',
    costs: [{ label: 'Fornecedor', value: 500 }],
    ...l,
  };
}

export function sale(s: Partial<Sale> & Pick<Sale, 'id' | 'productId'>): Sale {
  return { date: '2026-03-01', lotId: null, qty: 1, price: 100, customer: '', ...s };
}

/** Two lots of product p1 (5 + 10 units, unit cost 50 and 60) and a service p2. */
export function makeDb(over: Partial<OrgData> = {}): OrgData {
  return {
    settings: { currency: 'MT', fx: 64, margin: 35, minStock: 5 },
    types: [{ id: 't1', name: 'Geral' }],
    cats: [
      { id: 'c1', name: 'Renda', color: '#5B4CF5' },
      { id: 'c2', name: 'Transporte', color: '#F2994A' },
    ],
    products: [
      product({ id: 'p1', name: 'Alarme', price: 100, priceHistory: [{ price: 100, from: '2026-01-01', by: 'x' }] }),
      product({ id: 'p2', name: 'Licença', service: true, price: 30, priceHistory: [{ price: 30, from: '', by: '' }] }),
    ],
    lots: [
      lot({ id: 'A', productId: 'p1', qty: 5, arrivalDate: '2026-02-01', costs: [{ label: 'Fornecedor', value: 250 }] }),
      lot({
        id: 'B',
        productId: 'p1',
        qty: 10,
        arrivalDate: '2026-03-01',
        orderDate: '2026-02-10',
        costs: [{ label: 'Fornecedor', value: 600 }],
      }),
    ],
    sales: [],
    expenses: [],
    members: [
      { userId: 'u-ana', name: 'Ana', email: 'ana@x.co', initials: 'AN', role: 'Admin' },
      { userId: 'u-rui', name: 'Rui', email: 'rui@x.co', initials: 'RU', role: 'Vendas' },
    ],
    joinReqs: [],
    invites: [],
    ...over,
  };
}
