import { describe, expect, it } from 'vitest';
import { actor, makeDb, sale, TODAY } from '../test/fixtures';
import { deriveOrg } from './derive';
import * as M from './mutations';
import type { OrgData } from './types';

const unwrap = (r: M.Result): OrgData => {
  if (!r.ok) throw new Error(r.error);
  return r.db;
};

const input = (o: Partial<M.SaleInput> = {}): M.SaleInput => ({
  productId: 'p1',
  qty: 1,
  customer: '',
  date: TODAY,
  files: [],
  ...o,
});

describe('recordSale', () => {
  it('splits a sale across lots FIFO and marks exhausted lots sold out', () => {
    const db = makeDb();
    const next = unwrap(M.recordSale(db, deriveOrg(db, TODAY), input({ qty: 7, customer: '  Loja  ' }), actor));
    const rows = next.sales;
    expect(rows.map((s) => [s.lotId, s.qty])).toEqual([
      ['A', 5],
      ['B', 2],
    ]);
    expect(rows.every((s) => s.price === 100 && s.customer === 'Loja' && s.soldBy === 'Tester')).toBe(true);
    expect(next.lots.find((l) => l.id === 'A')!.status).toBe('esgotado');
    expect(next.lots.find((l) => l.id === 'B')!.status).toBe('recebido');
  });

  it('attaches files only to the first split row', () => {
    const db = makeDb();
    const file = { id: 'f', name: 'r.pdf', type: 'application/pdf', size: 1, path: 'o/f', addedAt: '', addedBy: '' };
    const next = unwrap(M.recordSale(db, deriveOrg(db, TODAY), input({ qty: 6, files: [file] }), actor));
    expect(next.sales[0]!.files).toHaveLength(1);
    expect(next.sales[1]!.files).toHaveLength(0);
  });

  it('rejects quantities above available stock', () => {
    const db = makeDb();
    const r = M.recordSale(db, deriveOrg(db, TODAY), input({ qty: 16 }), actor);
    expect(r).toEqual({ ok: false, error: 'Stock insuficiente: 15 disponíveis' });
  });

  it('records services without a lot', () => {
    const db = makeDb();
    const next = unwrap(M.recordSale(db, deriveOrg(db, TODAY), input({ productId: 'p2', qty: 3 }), actor));
    expect(next.sales).toEqual([expect.objectContaining({ productId: 'p2', lotId: null, qty: 3, price: 30 })]);
  });

  it('voiding a sale returns units to stock and reopens the lot', () => {
    const db = makeDb();
    const sold = unwrap(M.recordSale(db, deriveOrg(db, TODAY), input({ qty: 5 }), actor));
    expect(sold.lots[0]!.status).toBe('esgotado');
    const voided = M.voidSale(sold, sold.sales[0]!.id);
    expect(voided.sales).toHaveLength(0);
    expect(voided.lots[0]!.status).toBe('recebido');
  });
});

describe('lots', () => {
  const lotInput: M.LotInput = {
    productId: 'p1',
    qty: 10,
    usd: 2,
    fx: 64,
    freight: 300,
    customs: 0,
    other: 20,
    supplier: ' ',
    status: 'encomendado',
  };

  it('computes cost lines and totals', () => {
    expect(M.lotCosts(lotInput)).toEqual([
      { label: 'Fornecedor', value: 1280 },
      { label: 'Frete', value: 300 },
      { label: 'Outros', value: 20 },
    ]);
    expect(M.lotTotals(lotInput)).toEqual({ total: 1600, unit: 160 });
  });

  it('creates a lot with the next sequential code', () => {
    const r = M.createLot(makeDb(), lotInput, TODAY);
    const db = unwrap(r);
    const created = db.lots.at(-1)!;
    expect(created).toMatchObject({ code: 'P1-L3', status: 'encomendado', supplier: '—', arrivalDate: null, orderDate: TODAY });
  });

  it('never reuses an existing lot code', () => {
    const db = makeDb({ lots: [...makeDb().lots, { ...makeDb().lots[0]!, id: 'Z', code: 'P1-L9' }] });
    expect(M.nextLotCode(db, db.products[0]!)).toBe('P1-L10');
  });

  it('refuses lots for services', () => {
    expect(M.createLot(makeDb(), { ...lotInput, productId: 'p2' }, TODAY)).toMatchObject({ ok: false });
  });

  it('only edits lots that have not been received', () => {
    const db = makeDb();
    expect(M.updateLot(db, 'A', lotInput, TODAY)).toEqual({ ok: false, error: 'Lotes recebidos não podem ser editados' });
    const withOrder = unwrap(M.createLot(db, lotInput, TODAY));
    const id = withOrder.lots.at(-1)!.id;
    const edited = unwrap(M.updateLot(withOrder, id, { ...lotInput, qty: 20, status: 'recebido' }, TODAY));
    expect(edited.lots.at(-1)).toMatchObject({ qty: 20, status: 'recebido', arrivalDate: TODAY });
  });

  it('round-trips a lot back into form input', () => {
    const db = unwrap(M.createLot(makeDb(), lotInput, TODAY));
    expect(M.lotToInput(db.lots.at(-1)!, 64)).toMatchObject({
      qty: 10,
      usd: 2,
      freight: 300,
      other: 20,
      customs: 0,
      supplier: '',
    });
  });

  it('advances lot status and stamps arrival', () => {
    const db = M.advanceLot(makeDb(), 'B', 'recebido', TODAY);
    expect(db.lots[1]!.arrivalDate).toBe(TODAY);
  });
});

describe('products', () => {
  it('adds a product with an initial price entry and default SKU', () => {
    const db = M.addProduct(makeDb(), { name: ' Rádio ', sku: '', typeId: 't1', price: 4000, minStock: 2, margin: 30 }, actor);
    expect(db.products.at(-1)).toMatchObject({
      name: 'Rádio',
      sku: 'RÁD-01',
      price: 4000,
      priceHistory: [{ price: 4000, by: 'Tester' }],
    });
  });

  it('appends to the price history', () => {
    const db = M.setPrice(makeDb(), 'p1', 120, actor);
    expect(db.products[0]!.priceHistory.map((h) => h.price)).toEqual([100, 120]);
  });

  it('cannot remove a product that has movements', () => {
    expect(M.removeProduct(makeDb(), 'p1')).toEqual({ ok: false, error: 'Produto com movimentos não pode ser removido' });
    expect(unwrap(M.removeProduct(makeDb(), 'p2')).products).toHaveLength(1);
  });

  it('detects SKU collisions case-insensitively', () => {
    const taken = M.skuTakenIn(makeDb());
    expect(taken('p1-01')).toBe(true);
    expect(taken('NEW-01')).toBe(false);
    expect(M.skuTakenIn(makeDb(), 'p1')('P1-01')).toBe(false);
  });
});

describe('types & categories', () => {
  it('rejects duplicate names ignoring case', () => {
    expect(M.addType(makeDb(), 'geral')).toMatchObject({ ok: false });
    expect(M.addCategory(makeDb(), ' RENDA ')).toMatchObject({ ok: false });
    const r = M.addCategory(makeDb(), 'Marketing', '#000');
    expect(r.ok && r.db.cats.at(-1)).toMatchObject({ name: 'Marketing', color: '#000' });
  });
});

describe('team', () => {
  it('validates invites', () => {
    const db = makeDb({ invites: [{ id: 'i', email: 'pending@x.co', role: 'Vendas' }] });
    expect(M.inviteError(db, 'ANA@x.co')).toBe('Esta pessoa já é membro da organização');
    expect(M.inviteError(db, 'pending@x.co')).toBe('Já existe um convite pendente para este email');
    expect(unwrap(M.invite(db, ' New@X.co ', 'Stock')).invites.at(-1)).toMatchObject({ email: 'new@x.co', role: 'Stock' });
  });

  it('keeps at least one admin', () => {
    const db = makeDb();
    expect(M.setMemberRole(db, 'u-ana', 'Leitura')).toMatchObject({ ok: false });
    expect(M.removeMember(db, 'u-ana')).toMatchObject({ ok: false });
    expect(unwrap(M.setMemberRole(db, 'u-rui', 'Admin')).members[1]!.role).toBe('Admin');
    expect(unwrap(M.removeMember(db, 'u-rui')).members).toHaveLength(1);
  });

  it('approves join requests as read-only members', () => {
    const db = makeDb({ joinReqs: [{ id: 'j', userId: 'u-h', name: 'Hélio Mabunda', email: 'h@x.co' }] });
    const next = M.approveJoin(db, db.joinReqs[0]!);
    expect(next.joinReqs).toHaveLength(0);
    expect(next.members.at(-1)).toEqual({
      userId: 'u-h',
      name: 'Hélio Mabunda',
      email: 'h@x.co',
      initials: 'HM',
      role: 'Leitura',
    });
  });
});

describe('attachments', () => {
  it('adds and removes files on sales and expenses', () => {
    const file = { id: 'f1', name: 'a.png', type: 'image/png', size: 1, path: 'o/f1', addedAt: '', addedBy: '' };
    let db = makeDb({
      sales: [sale({ id: 's', productId: 'p1' })],
      expenses: [{ id: 'e', date: TODAY, amount: 1, catId: 'c1', note: '' }],
    });
    db = M.addAttachments(db, { kind: 'sale', id: 's' }, [file]);
    db = M.addAttachments(db, { kind: 'expense', id: 'e' }, [file]);
    expect(db.sales[0]!.files).toHaveLength(1);
    expect(db.expenses[0]!.files).toHaveLength(1);
    db = M.removeAttachment(db, { kind: 'sale', id: 's' }, 'f1');
    expect(db.sales[0]!.files).toHaveLength(0);
  });
});
