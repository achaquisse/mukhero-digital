import { z } from 'zod';
import { CURRENCIES, ROLES } from './constants';
import type { DraftFile } from './types';

// ── Field helpers ────────────────────────────────────────────────────────
// Number inputs are held as strings in the form so that an empty or partial
// value can be validated with a helpful message (instead of becoming NaN).

interface NumOpts {
  min?: number;
  max?: number;
  int?: boolean;
  /** Reject 0 (and require min > 0). */
  positive?: boolean;
  required?: string;
}

function numberField(o: NumOpts = {}) {
  let n = z.number({ error: 'Indique um número válido' });
  if (o.int) n = n.int('Use um número inteiro');
  if (o.positive) n = n.positive('Tem de ser maior que zero');
  if (o.min != null) n = n.min(o.min, `Mínimo ${o.min}`);
  if (o.max != null) n = n.max(o.max, `Máximo ${o.max}`);
  return z
    .string()
    .trim()
    .refine((v) => !o.required || v !== '', o.required ?? '')
    .transform((v) => (v === '' ? 0 : Number(v.replace(',', '.'))))
    .pipe(n);
}

const isoDate = z.iso.date({ error: 'Data inválida' });

/** A YYYY-MM-DD date that is not after `today`. */
const pastDate = (today: string) => isoDate.refine((d) => d <= today, 'A data não pode ser no futuro');

const requiredText = (msg: string, max = 80) => z.string().trim().min(1, msg).max(max, `Máximo ${max} caracteres`);

const optionalText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`);

const draftFiles = z.custom<DraftFile[]>((v) => Array.isArray(v));

// ── Organisations ────────────────────────────────────────────────────────

export const createOrgSchema = z.object({
  name: requiredText('Indique o nome da organização', 60).refine((v) => !v || v.length >= 2, 'Mínimo 2 caracteres'),
});

export const joinOrgSchema = z.object({
  code: requiredText('Indique o nome ou código de convite', 60),
});

export const orgSettingsSchema = z.object({
  name: requiredText('Indique o nome da organização', 60),
  currency: z.enum(CURRENCIES),
});

// ── Sales ────────────────────────────────────────────────────────────────

export interface SaleContext {
  today: string;
  /** Units available for a product, or null for services (unlimited). */
  available: (productId: string) => number | null;
  priceOf: (productId: string) => number;
}

export const makeSaleSchema = (ctx: SaleContext) =>
  z
    .object({
      productId: z.string().min(1, 'Escolha um produto'),
      qty: z.number({ error: 'Indique a quantidade' }).int('Use um número inteiro').min(1, 'Mínimo 1 unidade'),
      customer: optionalText(120),
      date: pastDate(ctx.today),
      files: draftFiles,
    })
    .superRefine((v, c) => {
      if (!v.productId) return;
      if (!ctx.priceOf(v.productId))
        c.addIssue({ code: 'custom', path: ['productId'], message: 'Defina um preço de venda para este produto' });
      const av = ctx.available(v.productId);
      if (av != null && v.qty > av)
        c.addIssue({
          code: 'custom',
          path: ['qty'],
          message: av ? `Stock insuficiente: ${av} disponíveis` : 'Sem stock disponível',
        });
    });

// ── Expenses ─────────────────────────────────────────────────────────────

export const makeExpenseSchema = (today: string) =>
  z.object({
    amount: numberField({ positive: true, required: 'Indique o valor', max: 1e10 }),
    catId: z.string().min(1, 'Escolha uma categoria'),
    date: pastDate(today),
    note: optionalText(500),
    files: draftFiles,
  });

// ── Lots ─────────────────────────────────────────────────────────────────

export const lotSchema = z.object({
  productId: z.string().min(1, 'Escolha um produto'),
  qty: numberField({ int: true, positive: true, required: 'Indique a quantidade', max: 1e6 }),
  usd: numberField({ min: 0 }),
  fx: numberField({ positive: true, required: 'Indique o câmbio' }),
  freight: numberField({ min: 0 }),
  customs: numberField({ min: 0 }),
  other: numberField({ min: 0 }),
  supplier: optionalText(120),
  status: z.enum(['encomendado', 'transito', 'recebido']),
});

// ── Products ─────────────────────────────────────────────────────────────

export const makeProductSchema = (opts: { skuTaken: (sku: string) => boolean }) =>
  z.object({
    name: requiredText('Indique o nome do produto'),
    sku: optionalText(24).refine((s) => !s || !opts.skuTaken(s), 'Já existe um produto com este código'),
    typeId: z.string().min(1, 'Escolha um tipo'),
    price: numberField({ min: 0, max: 1e10 }),
    minStock: numberField({ int: true, min: 0, max: 1e6 }),
    margin: numberField({ min: 0, max: 1000 }),
  });

export const makeProductEditSchema = (opts: { skuTaken: (sku: string) => boolean }) =>
  makeProductSchema(opts).omit({ price: true });

export const makePriceSchema = (current: number) =>
  z.object({
    price: numberField({ positive: true, required: 'Indique o novo preço', max: 1e10 }).refine(
      (p) => p !== current,
      'O preço é igual ao atual',
    ),
  });

// ── Types & categories ──────────────────────────────────────────────────

export const makeNamedSchema = (opts: { taken: (name: string) => boolean; required: string; duplicate: string }) =>
  z.object({
    name: requiredText(opts.required, 40).refine((n) => !opts.taken(n), opts.duplicate),
    color: z.string().optional(),
  });

// ── Team ─────────────────────────────────────────────────────────────────

export const makeInviteSchema = (inviteError: (email: string) => string | null) =>
  z.object({
    email: z
      .string()
      .trim()
      .min(1, 'Indique um email')
      .pipe(z.email('Formato de email inválido'))
      .superRefine((em, c) => {
        const err = inviteError(em);
        if (err) c.addIssue({ code: 'custom', message: err });
      }),
    role: z.enum(ROLES),
  });
