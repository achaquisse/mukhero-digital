import { initials } from '../domain/format';
import { syncLotStatus } from '../domain/mutations';
import type { Attachment, Org, OrgData, Role } from '../domain/types';
import type { Tables } from '../lib/database.types';

type WithProfile<T> = T & { profiles: { name: string; email: string } | null };

export interface OrgRows {
  org: Tables<'orgs'>;
  types: Tables<'product_types'>[];
  cats: Tables<'expense_categories'>[];
  products: Tables<'products'>[];
  prices: Tables<'price_history'>[];
  lots: Tables<'lots'>[];
  costs: Tables<'lot_costs'>[];
  sales: Tables<'sales'>[];
  expenses: Tables<'expenses'>[];
  attachments: Tables<'attachments'>[];
  members: WithProfile<Pick<Tables<'memberships'>, 'user_id' | 'role'>>[];
  invites: Pick<Tables<'invites'>, 'id' | 'email' | 'role'>[];
  joinRequests: WithProfile<Pick<Tables<'join_requests'>, 'id' | 'user_id'>>[];
}

const groupBy = <T, K extends string>(list: T[], key: (x: T) => K | null) => {
  const out = new Map<K, T[]>();
  for (const x of list) {
    const k = key(x);
    if (k == null) continue;
    const arr = out.get(k);
    if (arr) arr.push(x);
    else out.set(k, [x]);
  }
  return out;
};

export const toAttachment = (a: Tables<'attachments'>): Attachment => ({
  id: a.id,
  name: a.name,
  type: a.mime,
  size: a.size,
  path: a.storage_path,
  addedAt: a.added_at,
  addedBy: a.added_by_name,
});

export const toOrg = (o: Pick<Tables<'orgs'>, 'id' | 'name' | 'color' | 'join_code'>, role: Role): Org => ({
  id: o.id,
  name: o.name,
  color: o.color,
  role,
  joinCode: o.join_code,
});

/** Assemble the client-side org model from table rows. */
export function toOrgData(r: OrgRows): OrgData {
  const prices = groupBy(
    r.prices.toSorted((a, b) => a.effective_at.localeCompare(b.effective_at) || a.id.localeCompare(b.id)),
    (p) => p.product_id,
  );
  const costs = groupBy(
    r.costs.toSorted((a, b) => a.position - b.position),
    (c) => c.lot_id,
  );
  const saleFiles = groupBy(r.attachments, (a) => a.sale_id);
  const expenseFiles = groupBy(r.attachments, (a) => a.expense_id);

  const db: OrgData = {
    settings: {
      currency: r.org.currency,
      fx: Number(r.org.fx),
      margin: Number(r.org.default_margin),
      minStock: r.org.min_stock,
    },
    types: r.types.map((t) => ({ id: t.id, name: t.name })),
    cats: r.cats.map((c) => ({ id: c.id, name: c.name, color: c.color })),
    products: r.products.map((p) => {
      const history = (prices.get(p.id) ?? []).map((h) => ({ price: Number(h.price), from: h.effective_at, by: h.set_by_name }));
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        typeId: p.type_id ?? '',
        icon: p.icon,
        minStock: p.min_stock,
        margin: p.margin == null ? undefined : Number(p.margin),
        service: p.is_service,
        price: history.at(-1)?.price ?? 0,
        priceHistory: history,
      };
    }),
    lots: r.lots.map((l) => ({
      id: l.id,
      code: l.code,
      productId: l.product_id,
      qty: l.qty,
      lost: l.lost,
      supplier: l.supplier,
      status: l.status,
      orderDate: l.order_date,
      arrivalDate: l.arrival_date,
      costs: (costs.get(l.id) ?? []).map((c) => ({ label: c.label, value: Number(c.value) })),
    })),
    sales: r.sales.map((s) => ({
      id: s.id,
      date: s.date,
      productId: s.product_id,
      lotId: s.lot_id,
      qty: s.qty,
      price: Number(s.price),
      customer: s.customer,
      soldBy: s.sold_by_name,
      soldAt: s.sold_at,
      files: (saleFiles.get(s.id) ?? []).map(toAttachment),
    })),
    expenses: r.expenses.map((x) => ({
      id: x.id,
      date: x.date,
      amount: Number(x.amount),
      catId: x.category_id ?? '',
      note: x.note,
      createdAt: x.created_at,
      createdBy: x.created_by_name,
      files: (expenseFiles.get(x.id) ?? []).map(toAttachment),
    })),
    members: r.members.map((m) => {
      const name = m.profiles?.name ?? '';
      return { userId: m.user_id, name, email: m.profiles?.email ?? '', initials: initials(name || '?'), role: m.role };
    }),
    joinReqs: r.joinRequests.map((j) => ({
      id: j.id,
      userId: j.user_id,
      name: j.profiles?.name ?? '',
      email: j.profiles?.email ?? '',
    })),
    invites: r.invites.map((i) => ({ id: i.id, email: i.email, role: i.role })),
  };
  // "esgotado" is derived from stock, not stored.
  return syncLotStatus(db);
}
