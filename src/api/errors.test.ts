import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));
const { toError } = await import('./supabaseApi');

describe('toError', () => {
  it('passes through messages raised by database functions', () => {
    expect(toError({ code: 'P0001', message: 'Stock insuficiente: 3 disponíveis', details: '' }).message).toBe(
      'Stock insuficiente: 3 disponíveis',
    );
  });

  it('translates RLS and constraint errors', () => {
    expect(
      toError({ code: '42501', message: 'new row violates row-level security policy for table "expenses"', details: '' }).message,
    ).toBe('Sem permissão para esta ação');
    expect(
      toError({ code: '23505', message: 'duplicate key value violates unique constraint "product_types_name_key"', details: '' })
        .message,
    ).toBe('Já existe um tipo com este nome');
    expect(
      toError({ code: '23503', message: 'update or delete on table "products" violates foreign key constraint', details: '' })
        .message,
    ).toBe('Produto com movimentos não pode ser removido');
  });
});
