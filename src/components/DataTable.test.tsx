import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type Column, type Row } from './DataTable';

const columns: Column[] = [{ label: 'Produto' }, { label: 'Qtd', align: 'right', total: true }];

const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  cells: [`Item ${i + 1}`, String(i + 1)],
  sort: [`Item ${String(i + 1).padStart(2, '0')}`, i + 1],
  search: `Item ${i + 1}`,
  f: { kind: i % 2 ? 'odd' : 'even' },
}));

const bodyRows = () =>
  screen.getAllByRole('row').filter((r) => within(r).queryAllByRole('cell').length && !within(r).queryByText('Total'));
const firstCell = () => within(bodyRows()[0]!).getAllByRole('cell')[0]!.textContent;

describe('DataTable', () => {
  it('paginates and totals over all filtered rows', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={rows} />);
    expect(bodyRows()).toHaveLength(10);
    expect(screen.getByText('1–10 de 12')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument(); // 1+…+12

    await user.click(screen.getByRole('button', { name: 'Página seguinte' }));
    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page');
  });

  it('searches and reports the count', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={rows} />);
    await user.type(screen.getByRole('searchbox'), 'Item 1');
    expect(screen.getByText('4 registos')).toBeInTheDocument(); // 1, 10, 11, 12
  });

  it('cycles sort descending → ascending → off', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={rows} paginate={false} />);
    const header = screen.getByRole('button', { name: /Qtd/ });
    await user.click(header);
    expect(screen.getByRole('columnheader', { name: /Qtd/ })).toHaveAttribute('aria-sort', 'descending');
    expect(firstCell()).toBe('Item 12');
    await user.click(header);
    expect(firstCell()).toBe('Item 1');
    await user.click(header);
    expect(screen.getByRole('columnheader', { name: /Qtd/ })).not.toHaveAttribute('aria-sort');
  });

  it('filters by a column filter', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        filters={[{ key: 'kind', label: 'Tipo', options: [{ value: 'odd', label: 'Ímpar' }] }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Tipo: Tipo' }));
    await user.click(screen.getByRole('option', { name: 'Ímpar' }));
    expect(screen.getByText('6 registos')).toBeInTheDocument();
  });

  it('activates clickable rows with mouse and keyboard', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn<() => void>();
    render(<DataTable columns={columns} rows={[{ ...rows[0]!, onClick, label: 'Abrir item 1' }]} />);
    const row = screen.getByRole('row', { name: 'Abrir item 1' });
    await user.click(row);
    row.focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state', () => {
    render(<DataTable columns={columns} rows={[]} emptyText="Nada aqui." />);
    expect(screen.getByText('Nada aqui.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument();
  });
});
