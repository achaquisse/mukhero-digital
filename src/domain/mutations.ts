import { PALETTE } from './constants';
import type { Derived } from './derive';
import { allocateFifo, currentPrice } from './derive';
import { initials } from './format';
import { uid } from './id';
import type { Attachment, Cost, Currency, Expense, JoinRequest, Lot, LotStatus, OrgData, Product, Role, Sale } from './types';

export type Result = { ok: true; db: OrgData } | { ok: false; error: string };

export interface Actor {
  id?: string;
  name: string;
  /** ISO datetime */
  now: string;
  /** YYYY-MM-DD */
  today: string;
}

const ok = (db: OrgData): Result => ({ ok: true, db });
const fail = (error: string): Result => ({ ok: false, error });

/** Recompute which received lots are sold out (and which voided sales re-open). */
export function syncLotStatus(db: OrgData): OrgData {
  const sold: Record<string, number> = {};
  for (const s of db.sales) if (s.lotId) sold[s.lotId] = (sold[s.lotId] ?? 0) + s.qty;
  let changed = false;
  const lots = db.lots.map((L) => {
    const left = L.qty - L.lost - (sold[L.id] ?? 0);
    if (L.status === 'recebido' && left <= 0) {
      changed = true;
      return { ...L, status: 'esgotado' as const };
    }
    if (L.status === 'esgotado' && left > 0) {
      changed = true;
      return { ...L, status: 'recebido' as const };
    }
    return L;
  });
  return changed ? { ...db, lots } : db;
}

// ── Sales ────────────────────────────────────────────────────────────────

export interface SaleInput {
  productId: string;
  qty: number;
  customer: string;
  date: string;
  files: Attachment[];
}

export function recordSale(db: OrgData, d: Derived, input: SaleInput, actor: Actor): Result {
  const p = db.products.find((x) => x.id === input.productId);
  if (!p) return fail('Produto não encontrado');
  const price = currentPrice(p);
  if (!price) return fail('O produto não tem preço de venda');
  if (!(input.qty > 0)) return fail('Quantidade inválida');

  const base = {
    date: input.date,
    productId: p.id,
    price,
    customer: input.customer.trim(),
    soldAt: actor.now,
    soldBy: actor.name,
    soldById: actor.id,
  };
  const rows: Sale[] = [];
  if (p.service) {
    rows.push({ ...base, id: uid(), lotId: null, qty: input.qty, files: input.files });
  } else {
    const av = d.avail(p.id);
    if (input.qty > av.total) return fail(`Stock insuficiente: ${av.total} disponíveis`);
    const { slices } = allocateFifo(av, input.qty);
    slices.forEach((sl, i) => rows.push({ ...base, id: uid(), lotId: sl.lotId, qty: sl.qty, files: i === 0 ? input.files : [] }));
  }
  return ok(syncLotStatus({ ...db, sales: [...db.sales, ...rows] }));
}

export function voidSale(db: OrgData, saleId: string): OrgData {
  return syncLotStatus({ ...db, sales: db.sales.filter((s) => s.id !== saleId) });
}

// ── Expenses ─────────────────────────────────────────────────────────────

export interface ExpenseInput {
  amount: number;
  catId: string;
  date: string;
  note: string;
  files: Attachment[];
}

export function addExpense(db: OrgData, input: ExpenseInput, actor: Actor): OrgData {
  const x: Expense = {
    id: uid(),
    ...input,
    note: input.note.trim(),
    createdAt: actor.now,
    createdBy: actor.name,
    createdById: actor.id,
  };
  return { ...db, expenses: [...db.expenses, x] };
}

export const deleteExpense = (db: OrgData, id: string): OrgData => ({
  ...db,
  expenses: db.expenses.filter((x) => x.id !== id),
});

// ── Attachments ──────────────────────────────────────────────────────────

export type AttachTarget = { kind: 'sale' | 'expense'; id: string };

export function addAttachments(db: OrgData, t: AttachTarget, files: Attachment[]): OrgData {
  const add = <T extends { id: string; files?: Attachment[] }>(x: T): T =>
    x.id === t.id ? { ...x, files: [...(x.files ?? []), ...files] } : x;
  return t.kind === 'sale' ? { ...db, sales: db.sales.map(add) } : { ...db, expenses: db.expenses.map(add) };
}

export function removeAttachment(db: OrgData, t: AttachTarget, fileId: string): OrgData {
  const rm = <T extends { id: string; files?: Attachment[] }>(x: T): T =>
    x.id === t.id ? { ...x, files: (x.files ?? []).filter((f) => f.id !== fileId) } : x;
  return t.kind === 'sale' ? { ...db, sales: db.sales.map(rm) } : { ...db, expenses: db.expenses.map(rm) };
}

// ── Lots ─────────────────────────────────────────────────────────────────

export interface LotInput {
  productId: string;
  qty: number;
  /** Unit price from the supplier, in USD. */
  usd: number;
  fx: number;
  freight: number;
  customs: number;
  other: number;
  supplier: string;
  status: Exclude<LotStatus, 'esgotado'>;
}

export function lotCosts(i: Pick<LotInput, 'usd' | 'qty' | 'fx' | 'freight' | 'customs' | 'other'>): Cost[] {
  const raw: Array<[string, number]> = [
    ['Fornecedor', i.usd * i.qty * i.fx],
    ['Frete', i.freight],
    ['Alfândega', i.customs],
    ['Outros', i.other],
  ];
  return raw.filter(([, v]) => v > 0).map(([label, v]) => ({ label, value: Math.round(v) }));
}

export function lotTotals(i: Pick<LotInput, 'usd' | 'qty' | 'fx' | 'freight' | 'customs' | 'other'>) {
  const total = (i.usd || 0) * (i.qty || 0) * (i.fx || 0) + (i.freight || 0) + (i.customs || 0) + (i.other || 0);
  return { total, unit: i.qty ? total / i.qty : 0 };
}

/** Next free lot code for a product, e.g. ALM-L10 (never reuses an existing code). */
export function nextLotCode(db: OrgData, p: Pick<Product, 'id' | 'sku'>): string {
  const prefix = `${(p.sku || 'LOT').split('-')[0]}-L`;
  const used = db.lots
    .filter((l) => l.code.startsWith(prefix))
    .map((l) => Number(l.code.slice(prefix.length)))
    .filter(Number.isFinite);
  const count = db.lots.filter((l) => l.productId === p.id).length;
  return `${prefix}${Math.max(count, ...used) + 1}`;
}

export function createLot(db: OrgData, input: LotInput, today: string): Result & { lotId?: string } {
  const p = db.products.find((x) => x.id === input.productId);
  if (!p) return fail('Produto não encontrado');
  if (p.service) return fail('Serviços não têm lotes');
  const lot: Lot = {
    id: uid(),
    code: nextLotCode(db, p),
    productId: p.id,
    qty: input.qty,
    lost: 0,
    supplier: input.supplier.trim() || '—',
    status: input.status,
    orderDate: today,
    arrivalDate: input.status === 'recebido' ? today : null,
    costs: lotCosts(input),
  };
  return { ok: true, db: { ...db, lots: [...db.lots, lot] }, lotId: lot.id };
}

export function updateLot(db: OrgData, lotId: string, input: LotInput, today: string): Result {
  const L = db.lots.find((x) => x.id === lotId);
  if (!L) return fail('Lote não encontrado');
  if (L.status === 'recebido' || L.status === 'esgotado') return fail('Lotes recebidos não podem ser editados');
  const updated: Lot = {
    ...L,
    productId: input.productId,
    qty: input.qty,
    supplier: input.supplier.trim() || '—',
    status: input.status,
    arrivalDate: input.status === 'recebido' ? (L.arrivalDate ?? today) : null,
    costs: lotCosts(input),
  };
  return ok({ ...db, lots: db.lots.map((x) => (x.id === lotId ? updated : x)) });
}

export function advanceLot(db: OrgData, lotId: string, to: LotStatus, today: string): OrgData {
  return {
    ...db,
    lots: db.lots.map((x) => (x.id === lotId ? { ...x, status: to, arrivalDate: to === 'recebido' ? today : x.arrivalDate } : x)),
  };
}

/** Recover the form values that produced a lot's cost lines. */
export function lotToInput(L: Lot, fx: number): LotInput {
  const get = (label: string) => L.costs.find((c) => c.label === label)?.value ?? 0;
  const supplierCost = get('Fornecedor');
  return {
    productId: L.productId,
    qty: L.qty,
    fx,
    usd: supplierCost && L.qty && fx ? Math.round((supplierCost / L.qty / fx) * 100) / 100 : 0,
    freight: get('Frete'),
    customs: get('Alfândega'),
    other: get('Outros'),
    supplier: L.supplier === '—' ? '' : L.supplier,
    status: L.status === 'esgotado' ? 'recebido' : L.status,
  };
}

// ── Products ─────────────────────────────────────────────────────────────

export interface ProductInput {
  name: string;
  sku: string;
  typeId: string;
  price: number;
  minStock: number;
  margin: number;
}

export function addProduct(db: OrgData, input: ProductInput, actor: Actor): OrgData {
  const name = input.name.trim();
  const p: Product = {
    id: uid(),
    name,
    sku: input.sku.trim() || `${name.slice(0, 3).toUpperCase()}-01`,
    typeId: input.typeId,
    icon: 'category',
    minStock: input.minStock,
    margin: input.margin,
    price: input.price,
    priceHistory: [{ price: input.price, from: actor.now, by: actor.name }],
  };
  return { ...db, products: [...db.products, p] };
}

export const skuTakenIn = (db: OrgData, exceptId?: string) => (sku: string) =>
  db.products.some((p) => p.id !== exceptId && p.sku.toLowerCase() === sku.trim().toLowerCase());

export type ProductEdit = Omit<ProductInput, 'price'>;

export function updateProduct(db: OrgData, id: string, e: ProductEdit): OrgData {
  return {
    ...db,
    products: db.products.map((x) =>
      x.id === id
        ? {
            ...x,
            name: e.name.trim(),
            sku: e.sku.trim() || x.sku,
            typeId: e.typeId,
            minStock: e.minStock,
            margin: e.margin,
          }
        : x,
    ),
  };
}

export function setPrice(db: OrgData, productId: string, price: number, actor: Actor): OrgData {
  return {
    ...db,
    products: db.products.map((p) => {
      if (p.id !== productId) return p;
      const ph = p.priceHistory.length ? p.priceHistory : [{ price: p.price || 0, from: '', by: '' }];
      return { ...p, price, priceHistory: [...ph, { price, from: actor.now, by: actor.name }] };
    }),
  };
}

export function removeProduct(db: OrgData, id: string): Result {
  if (db.sales.some((s) => s.productId === id) || db.lots.some((l) => l.productId === id))
    return fail('Produto com movimentos não pode ser removido');
  return ok({ ...db, products: db.products.filter((p) => p.id !== id) });
}

// ── Types & categories ──────────────────────────────────────────────────

export const nameTaken = (list: ReadonlyArray<{ name: string }>, name: string) =>
  list.some((x) => x.name.toLowerCase() === name.trim().toLowerCase());

export function addType(db: OrgData, name: string): Result {
  if (nameTaken(db.types, name)) return fail('Já existe um tipo com este nome');
  return ok({ ...db, types: [...db.types, { id: uid(), name: name.trim() }] });
}

export const removeType = (db: OrgData, id: string): OrgData => ({
  ...db,
  types: db.types.filter((t) => t.id !== id),
});

export function addCategory(db: OrgData, name: string, color?: string): Result & { id?: string } {
  if (nameTaken(db.cats, name)) return fail('Já existe uma categoria com este nome');
  const id = uid();
  const cat = { id, name: name.trim(), color: color ?? PALETTE[db.cats.length % PALETTE.length]! };
  return { ok: true, db: { ...db, cats: [...db.cats, cat] }, id };
}

export const removeCategory = (db: OrgData, id: string): OrgData => ({
  ...db,
  cats: db.cats.filter((c) => c.id !== id),
});

// ── Team ─────────────────────────────────────────────────────────────────

export function inviteError(db: OrgData, email: string): string | null {
  const em = email.trim().toLowerCase();
  if (db.members.some((m) => m.email.toLowerCase() === em)) return 'Esta pessoa já é membro da organização';
  if (db.invites.some((i) => i.email.toLowerCase() === em)) return 'Já existe um convite pendente para este email';
  return null;
}

export function invite(db: OrgData, email: string, role: Role): Result {
  const err = inviteError(db, email);
  if (err) return fail(err);
  return ok({ ...db, invites: [...db.invites, { id: uid(), email: email.trim().toLowerCase(), role }] });
}

export const cancelInvite = (db: OrgData, id: string): OrgData => ({
  ...db,
  invites: db.invites.filter((i) => i.id !== id),
});

export const approveJoin = (db: OrgData, r: JoinRequest): OrgData => ({
  ...db,
  joinReqs: db.joinReqs.filter((x) => x.id !== r.id),
  members: [...db.members, { userId: r.userId, name: r.name, email: r.email, initials: initials(r.name), role: 'Leitura' }],
});

export const denyJoin = (db: OrgData, id: string): OrgData => ({
  ...db,
  joinReqs: db.joinReqs.filter((x) => x.id !== id),
});

const adminCount = (db: OrgData) => db.members.filter((m) => m.role === 'Admin').length;

export function setMemberRole(db: OrgData, userId: string, role: Role): Result {
  const m = db.members.find((x) => x.userId === userId);
  if (!m) return fail('Membro não encontrado');
  if (m.role === 'Admin' && role !== 'Admin' && adminCount(db) <= 1)
    return fail('A organização precisa de pelo menos um administrador');
  return ok({ ...db, members: db.members.map((x) => (x.userId === userId ? { ...x, role } : x)) });
}

export function removeMember(db: OrgData, userId: string): Result {
  const m = db.members.find((x) => x.userId === userId);
  if (!m) return fail('Membro não encontrado');
  if (m.role === 'Admin' && adminCount(db) <= 1) return fail('A organização precisa de pelo menos um administrador');
  return ok({ ...db, members: db.members.filter((x) => x.userId !== userId) });
}

export const setCurrency = (db: OrgData, currency: Currency): OrgData => ({
  ...db,
  settings: { ...db.settings, currency },
});
