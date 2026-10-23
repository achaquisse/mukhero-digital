import { describe, expect, it } from 'vitest';
import { TODAY } from '../test/fixtures';
import {
  createOrgSchema,
  lotSchema,
  makeExpenseSchema,
  makeInviteSchema,
  makeNamedSchema,
  makePriceSchema,
  makeProductSchema,
  makeSaleSchema,
} from './schemas';

const messages = (r: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [i.path.join('.'), i.message]));

describe('sale schema', () => {
  const schema = makeSaleSchema({
    today: TODAY,
    available: (pid) => (pid === 'svc' ? null : pid === 'p1' ? 3 : 0),
    priceOf: (pid) => (pid === 'free' ? 0 : 100),
  });
  const base = { productId: 'p1', qty: 1, customer: '', date: TODAY, files: [] };

  it('accepts a valid sale', () => {
    expect(schema.safeParse(base).success).toBe(true);
    expect(schema.safeParse({ ...base, productId: 'svc', qty: 999 }).success).toBe(true);
  });

  it('caps quantity at available stock', () => {
    expect(messages(schema.safeParse({ ...base, qty: 4 }))).toEqual({ qty: 'Stock insuficiente: 3 disponíveis' });
    expect(messages(schema.safeParse({ ...base, productId: 'p0' }))).toEqual({ qty: 'Sem stock disponível' });
  });

  it('rejects invalid quantity, future dates and products without price', () => {
    expect(messages(schema.safeParse({ ...base, qty: Number.NaN }))).toMatchObject({ qty: 'Indique a quantidade' });
    expect(messages(schema.safeParse({ ...base, qty: 0 }))).toMatchObject({ qty: 'Mínimo 1 unidade' });
    expect(messages(schema.safeParse({ ...base, date: '2999-01-01' }))).toEqual({ date: 'A data não pode ser no futuro' });
    expect(messages(schema.safeParse({ ...base, productId: 'free' }))).toMatchObject({
      productId: 'Defina um preço de venda para este produto',
    });
    expect(messages(schema.safeParse({ ...base, productId: '' }))).toMatchObject({ productId: 'Escolha um produto' });
  });
});

describe('expense schema', () => {
  const schema = makeExpenseSchema(TODAY);
  const base = { amount: '1500', catId: 'c1', date: TODAY, note: '', files: [] };

  it('parses amounts, including comma decimals', () => {
    expect(schema.parse(base).amount).toBe(1500);
    expect(schema.parse({ ...base, amount: '12,5' }).amount).toBe(12.5);
  });

  it('requires a positive amount and a category', () => {
    expect(messages(schema.safeParse({ ...base, amount: '' }))).toEqual({ amount: 'Indique o valor' });
    expect(messages(schema.safeParse({ ...base, amount: 'abc' }))).toEqual({ amount: 'Indique um número válido' });
    expect(messages(schema.safeParse({ ...base, amount: '-3' }))).toEqual({ amount: 'Tem de ser maior que zero' });
    expect(messages(schema.safeParse({ ...base, catId: '' }))).toEqual({ catId: 'Escolha uma categoria' });
  });
});

describe('lot schema', () => {
  const base = {
    productId: 'p1',
    qty: '50',
    usd: '',
    fx: '64',
    freight: '1 200',
    customs: '',
    other: '',
    supplier: '',
    status: 'encomendado',
  };

  it('treats blank optional costs as zero', () => {
    const r = lotSchema.safeParse({ ...base, freight: '1200' });
    expect(r.success && r.data).toMatchObject({ qty: 50, usd: 0, fx: 64, freight: 1200, customs: 0 });
  });

  it('validates required and integer fields', () => {
    expect(messages(lotSchema.safeParse({ ...base, freight: '', qty: '2.5' }))).toEqual({ qty: 'Use um número inteiro' });
    expect(messages(lotSchema.safeParse({ ...base, freight: '', fx: '' }))).toEqual({ fx: 'Indique o câmbio' });
    expect(messages(lotSchema.safeParse({ ...base, freight: '-1' }))).toEqual({ freight: 'Mínimo 0' });
  });
});

describe('product schemas', () => {
  const schema = makeProductSchema({ skuTaken: (s) => s.toUpperCase() === 'ALM-01' });
  const base = { name: 'Alarme', sku: '', typeId: 't1', price: '1500', minStock: '5', margin: '35' };

  it('accepts a valid product', () => {
    expect(schema.parse(base)).toEqual({ name: 'Alarme', sku: '', typeId: 't1', price: 1500, minStock: 5, margin: 35 });
  });

  it('rejects blank names and duplicate codes', () => {
    expect(messages(schema.safeParse({ ...base, name: '  ', sku: 'alm-01' }))).toEqual({
      name: 'Indique o nome do produto',
      sku: 'Já existe um produto com este código',
    });
  });

  it('requires a different, positive price change', () => {
    const price = makePriceSchema(1500);
    expect(messages(price.safeParse({ price: '1500' }))).toEqual({ price: 'O preço é igual ao atual' });
    expect(messages(price.safeParse({ price: '0' }))).toEqual({ price: 'Tem de ser maior que zero' });
    expect(price.parse({ price: '1600' }).price).toBe(1600);
  });
});

describe('small schemas', () => {
  it('validates org names', () => {
    expect(messages(createOrgSchema.safeParse({ name: '' }))).toEqual({ name: 'Indique o nome da organização' });
    expect(messages(createOrgSchema.safeParse({ name: 'A' }))).toEqual({ name: 'Mínimo 2 caracteres' });
  });

  it('flags duplicate type / category names', () => {
    const s = makeNamedSchema({ taken: (n) => n.toLowerCase() === 'renda', required: 'Indique um nome', duplicate: 'Duplicado' });
    expect(messages(s.safeParse({ name: 'RENDA' }))).toEqual({ name: 'Duplicado' });
    expect(messages(s.safeParse({ name: ' ' }))).toEqual({ name: 'Indique um nome' });
  });

  it('validates invite emails', () => {
    const s = makeInviteSchema((em) => (em === 'ana@x.co' ? 'Esta pessoa já é membro da organização' : null));
    expect(messages(s.safeParse({ email: '', role: 'Vendas' }))).toEqual({ email: 'Indique um email' });
    expect(messages(s.safeParse({ email: 'nope', role: 'Vendas' }))).toEqual({ email: 'Formato de email inválido' });
    expect(messages(s.safeParse({ email: 'ana@x.co', role: 'Vendas' }))).toEqual({
      email: 'Esta pessoa já é membro da organização',
    });
    expect(s.safeParse({ email: ' new@x.co ', role: 'Stock' }).success).toBe(true);
  });
});
