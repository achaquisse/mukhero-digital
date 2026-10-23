import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderApp';
import { useUi } from '../store/uiStore';
import { DEMO_USER } from '../domain/defaults';

const dialog = () => screen.getByRole('dialog', { hidden: false });

describe('routing & auth', () => {
  it('redirects guests to sign-in and enters the only organisation directly', async () => {
    const { user } = renderApp('/painel', { signedIn: false, orgId: null });
    await user.click(await screen.findByRole('button', { name: 'Continuar com Google' }));
    expect(await screen.findByRole('heading', { name: 'Atenção' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
  });

  it('validates the create-organisation form', async () => {
    const { user, api } = renderApp('/organizacoes', { orgId: null });
    await user.click(await screen.findByRole('button', { name: /Criar organização/ }));
    await user.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByText('Indique o nome da organização')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Nome da organização' }), 'Loja Nova');
    await user.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByText('Vamos preparar Loja Nova')).toBeInTheDocument();
    expect(api.state.orgs.at(-1)).toMatchObject({ name: 'Loja Nova' });
  });
});

describe('sales', () => {
  it('blocks overselling and records a valid FIFO sale', async () => {
    const { user, db } = renderApp('/vendas');
    await user.click(await screen.findByRole('button', { name: 'Nova venda' }));
    const form = within(dialog());
    expect(form.getByRole('heading', { name: 'Nova venda' })).toBeInTheDocument();

    const qty = form.getByRole('textbox', { name: 'Quantidade' });
    await user.clear(qty);
    await user.type(qty, '9999');
    await user.click(form.getByRole('button', { name: 'Registar venda' }));
    expect(await form.findByText(/Stock insuficiente: \d+ disponíveis/)).toBeInTheDocument();
    const before = db().sales.length;

    await user.clear(qty);
    await user.type(qty, '2');
    await user.type(form.getByRole('textbox', { name: 'Cliente' }), 'Oficina Sol');
    await user.click(form.getByRole('button', { name: 'Registar venda' }));

    await waitFor(() => expect(useUi.getState().modal).toBeNull());
    const added = db().sales.slice(before);
    expect(added.reduce((n, s) => n + s.qty, 0)).toBe(2);
    expect(added[0]).toMatchObject({ productId: 'p1', customer: 'Oficina Sol', soldBy: DEMO_USER.name });
    expect(screen.getByRole('status')).toHaveTextContent(/Venda de 3 000 MT registada/);
  });

  it('voids a sale after confirmation', async () => {
    const { user, db } = renderApp('/vendas');
    const first = db().sales.toSorted((a, b) => b.date.localeCompare(a.date))[0]!;
    await user.click((await screen.findAllByRole('row', { name: /^Venda de/ }))[0]!);
    await user.click(within(dialog()).getByRole('button', { name: 'Anular venda' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Anular venda?' });
    await user.click(within(confirm).getByRole('button', { name: 'Anular venda' }));
    expect(db().sales.some((s) => s.id === first.id)).toBe(false);
  });
});

describe('expenses', () => {
  it('validates the amount and creates a category inline', async () => {
    const { user, db } = renderApp('/despesas');
    await user.click(await screen.findByRole('button', { name: 'Nova despesa' }));
    const form = within(dialog());
    await user.click(form.getByRole('button', { name: 'Guardar despesa' }));
    expect(await form.findByText('Indique o valor')).toBeInTheDocument();

    await user.type(form.getByRole('textbox', { name: 'Valor (MT)' }), '-5');
    await user.click(form.getByRole('button', { name: 'Guardar despesa' }));
    expect(await form.findByText('Tem de ser maior que zero')).toBeInTheDocument();

    await user.clear(form.getByRole('textbox', { name: 'Valor (MT)' }));
    await user.type(form.getByRole('textbox', { name: 'Valor (MT)' }), '2500');
    const combo = form.getByRole('combobox', { name: 'Categoria' });
    await user.click(combo);
    await user.type(combo, 'Combustível');
    await user.click(form.getByRole('option', { name: /Criar «Combustível»/ }));
    await user.type(form.getByRole('textbox', { name: 'Nota' }), 'Viagem a Xai-Xai');
    await user.click(form.getByRole('button', { name: 'Guardar despesa' }));

    await waitFor(() => expect(useUi.getState().modal).toBeNull());
    const cat = db().cats.find((c) => c.name === 'Combustível')!;
    expect(db().expenses.at(-1)).toMatchObject({ amount: 2500, catId: cat.id, note: 'Viagem a Xai-Xai' });
  });
});

describe('stock', () => {
  it('creates a lot and shows its computed landed cost', async () => {
    const { user, db } = renderApp('/stock');
    await user.click(await screen.findByRole('button', { name: 'Novo lote' }));
    const form = within(dialog());
    await user.clear(form.getByRole('textbox', { name: 'Quantidade' }));
    await user.type(form.getByRole('textbox', { name: 'Quantidade' }), '10');
    await user.type(form.getByRole('textbox', { name: 'Preço un. (USD)' }), '20');
    await user.type(form.getByRole('textbox', { name: 'Frete' }), '1000');
    expect(form.getByText('13 800 MT')).toBeInTheDocument(); // 10 × 20 × 64 + 1000
    expect(form.getByText('1 380 MT')).toBeInTheDocument();

    await user.click(form.getByRole('button', { name: 'Criar lote' }));
    await waitFor(() => expect(useUi.getState().modal).toBeNull());
    expect(db().lots.at(-1)).toMatchObject({ code: 'ALM-L3', qty: 10, status: 'encomendado' });
  });

  it('rejects a duplicate product code', async () => {
    const { user } = renderApp('/stock');
    await user.click(await screen.findByRole('radio', { name: 'Por produto' }));
    await user.click(screen.getByRole('button', { name: 'Novo produto' }));
    const form = within(dialog());
    await user.type(form.getByRole('textbox', { name: 'Nome' }), 'Alarme premium');
    await user.type(form.getByRole('textbox', { name: 'Código' }), 'alm-01');
    await user.click(form.getByRole('button', { name: 'Adicionar produto' }));
    expect(await form.findByText('Já existe um produto com este código')).toBeInTheDocument();
  });
});

describe('settings', () => {
  it('validates invites against existing members and pending invites', async () => {
    const { user, db } = renderApp('/definicoes');
    await user.click(await screen.findByRole('button', { name: 'Convidar' }));
    const form = within(dialog());
    const email = form.getByRole('textbox', { name: 'Email' });

    await user.type(email, 'not-an-email');
    await user.click(form.getByRole('button', { name: 'Enviar convite' }));
    expect(await form.findByText('Formato de email inválido')).toBeInTheDocument();

    await user.clear(email);
    await user.type(email, 'ana@mukhero-digital.co.mz');
    await user.click(form.getByRole('button', { name: 'Enviar convite' }));
    expect(await form.findByText('Esta pessoa já é membro da organização')).toBeInTheDocument();

    await user.clear(email);
    await user.type(email, 'nova@mukhero-digital.co.mz');
    await user.click(form.getByRole('radio', { name: 'Stock' }));
    await user.click(form.getByRole('button', { name: 'Enviar convite' }));
    await waitFor(() => expect(db().invites.at(-1)).toMatchObject({ email: 'nova@mukhero-digital.co.mz', role: 'Stock' }));
  });

  it('refuses to demote the last admin', async () => {
    const { user, db } = renderApp('/definicoes');
    const roles = await screen.findByRole('radiogroup', { name: `Função de ${DEMO_USER.name}` });
    await user.click(within(roles).getByRole('radio', { name: 'Leitura' }));
    expect(screen.getByRole('status')).toHaveTextContent('A organização precisa de pelo menos um administrador');
    expect(db().members[0]!.role).toBe('Admin');
  });
});
