import type { ReactNode } from 'react';
import { Combobox } from '../../components/ui/Combobox';
import { Icon } from '../../components/ui/Icon';
import { fmt } from '../../domain/format';
import { useOrgData } from '../../hooks/useOrg';

export function SubmitButton({ children, disabled }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="brand-gradient rounded-xl border-0 p-[13px] text-[15px] font-[550] text-white hover:brightness-95 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

interface ProductPickerProps {
  value: string;
  onChange: (id: string) => void;
  mode: 'sale' | 'lot';
  error?: string;
  hint?: ReactNode;
}

/** Searchable product picker; lots exclude services and show stock, sales show price. */
export function ProductPicker({ value, onChange, mode, error, hint }: ProductPickerProps) {
  const { db, derived } = useOrgData();
  const cur = db.settings.currency;
  const selected = derived.productById[value];
  const options = derived.products
    .filter((p) => mode === 'sale' || !p.service)
    .map((p) => ({
      id: p.id,
      label: p.name,
      icon: p.icon || 'category',
      keywords: p.sku,
      sub:
        mode === 'lot'
          ? `${p.sku} · ${p.onHand} em stock${p.transit ? ` · +${p.transit} a caminho` : ''}`
          : `${fmt(p.price)} ${cur}${p.service ? ' · serviço' : ` · ${p.onHand} em stock`}`,
    }));
  return (
    <Combobox
      label="Produto"
      value={value}
      options={options}
      onChange={onChange}
      placeholder="Pesquisar produto ou código…"
      emptyText="Nenhum produto encontrado"
      error={error}
      hint={hint}
      leading={
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
          <Icon name={selected?.icon || 'search'} size={16} />
        </span>
      }
    />
  );
}
