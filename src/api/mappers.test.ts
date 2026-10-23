import { describe, expect, it } from 'vitest';
import { toOrgData, type OrgRows } from './mappers';

const org = 'org-1';
const rows: OrgRows = {
  org: {
    id: org,
    name: 'Loja',
    color: '#5B4CF5',
    currency: 'MT',
    fx: 64,
    default_margin: 35,
    min_stock: 5,
    join_code: 'ABC',
    created_by: null,
    created_at: '',
  },
  types: [{ id: 't1', org_id: org, name: 'Geral', created_at: '' }],
  cats: [{ id: 'c1', org_id: org, name: 'Renda', color: '#000000', created_at: '' }],
  products: [
    {
      id: 'p1',
      org_id: org,
      name: 'Alarme',
      sku: 'ALM-01',
      type_id: null,
      icon: 'shield',
      min_stock: 2,
      margin: null,
      is_service: false,
      created_at: '',
    },
  ],
  prices: [
    {
      id: 'h2',
      org_id: org,
      product_id: 'p1',
      price: 1600,
      effective_at: '2026-05-01T00:00:00Z',
      set_by: null,
      set_by_name: 'Ana',
    },
    {
      id: 'h1',
      org_id: org,
      product_id: 'p1',
      price: 1500,
      effective_at: '2026-01-01T00:00:00Z',
      set_by: null,
      set_by_name: 'Rui',
    },
  ],
  lots: [
    {
      id: 'L1',
      org_id: org,
      product_id: 'p1',
      code: 'ALM-L1',
      qty: 2,
      lost: 0,
      supplier: 'X',
      status: 'recebido',
      order_date: '2026-01-01',
      arrival_date: '2026-01-10',
      created_at: '',
    },
  ],
  costs: [
    { id: 'k2', org_id: org, lot_id: 'L1', label: 'Frete', value: 100, position: 1 },
    { id: 'k1', org_id: org, lot_id: 'L1', label: 'Fornecedor', value: 900, position: 0 },
  ],
  sales: [
    {
      id: 's1',
      org_id: org,
      product_id: 'p1',
      lot_id: 'L1',
      qty: 2,
      price: 1500,
      customer: '',
      date: '2026-02-01',
      sold_by: null,
      sold_by_name: 'Ana',
      sold_at: '2026-02-01T10:00:00Z',
    },
  ],
  expenses: [
    {
      id: 'e1',
      org_id: org,
      category_id: null,
      amount: 50,
      date: '2026-02-02',
      note: '',
      created_by: null,
      created_by_name: 'Ana',
      created_at: '',
    },
  ],
  attachments: [
    {
      id: 'a1',
      org_id: org,
      sale_id: 's1',
      expense_id: null,
      name: 'r.pdf',
      mime: 'application/pdf',
      size: 10,
      storage_path: `${org}/x-r.pdf`,
      added_by: null,
      added_by_name: 'Ana',
      added_at: '2026-02-01T11:00:00Z',
    },
  ],
  members: [{ user_id: 'u1', role: 'Admin', profiles: { name: 'Ana Sitoe', email: 'ana@x.co' } }],
  invites: [],
  joinRequests: [{ id: 'j1', user_id: 'u2', profiles: { name: 'Hélio', email: 'h@x.co' } }],
};

describe('toOrgData', () => {
  const d = toOrgData(rows);

  it('orders price history and takes the latest as current price', () => {
    expect(d.products[0]!.priceHistory.map((h) => h.price)).toEqual([1500, 1600]);
    expect(d.products[0]!.price).toBe(1600);
    expect(d.products[0]!.typeId).toBe('');
    expect(d.products[0]!.margin).toBeUndefined();
  });

  it('orders cost lines and derives "esgotado" for exhausted received lots', () => {
    expect(d.lots[0]!.costs.map((c) => c.label)).toEqual(['Fornecedor', 'Frete']);
    expect(d.lots[0]!.status).toBe('esgotado');
  });

  it('attaches files to their sale and maps members', () => {
    expect(d.sales[0]!.files).toEqual([expect.objectContaining({ name: 'r.pdf', path: `${org}/x-r.pdf`, addedBy: 'Ana' })]);
    expect(d.expenses[0]!.catId).toBe('');
    expect(d.members[0]).toEqual({ userId: 'u1', name: 'Ana Sitoe', email: 'ana@x.co', initials: 'AS', role: 'Admin' });
    expect(d.joinReqs[0]).toEqual({ id: 'j1', userId: 'u2', name: 'Hélio', email: 'h@x.co' });
  });
});
