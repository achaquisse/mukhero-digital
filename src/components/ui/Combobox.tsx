import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FieldError } from './Field';
import { Icon } from './Icon';

export interface ComboOption {
  id: string;
  label: string;
  sub?: string;
  icon?: string;
  dot?: string;
  /** Extra text matched by the search but not displayed. */
  keywords?: string;
}

interface ComboboxProps {
  label: string;
  value: string;
  options: ComboOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
  /** Leading adornment for the selected value. */
  leading?: ReactNode;
  error?: string;
  hint?: ReactNode;
  /** Offer to create an option from the query text. */
  onCreate?: (query: string) => void;
}

/** Searchable single-select (ARIA combobox pattern). */
export function Combobox({
  label,
  value,
  options,
  onChange,
  placeholder,
  emptyText = 'Sem resultados',
  leading,
  error,
  hint,
  onCreate,
}: ComboboxProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => `${o.label} ${o.keywords ?? ''}`.toLowerCase().includes(q)) : options;
  const canCreate = !!onCreate && !!q && !options.some((o) => o.label.toLowerCase() === q);
  const count = filtered.length + (canCreate ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const openList = () => {
    setQuery('');
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.id === value),
      ),
    );
    setOpen(true);
  };
  const choose = (optId: string) => {
    onChange(optId);
    setOpen(false);
    setQuery('');
  };
  const commit = (i: number) => {
    if (i < filtered.length) choose(filtered[i]!.id);
    else if (canCreate) {
      onCreate!(query.trim());
      setOpen(false);
      setQuery('');
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openList();
      else setActive((a) => Math.min(count - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      commit(active);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const optionId = (i: number) => `${id}-opt-${i}`;

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <div
          className={`relative z-[3] flex items-center gap-2 rounded-[10px] border bg-white px-2.5 ${
            open ? 'border-brand' : error ? 'border-[#F04438]' : 'border-line'
          }`}
        >
          {leading}
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open && count ? optionId(active) : undefined}
            aria-invalid={!!error}
            autoComplete="off"
            value={open ? query : (selected?.label ?? '')}
            placeholder={placeholder}
            onFocus={() => !open && openList()}
            onClick={() => !open && openList()}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm font-medium text-ink outline-none"
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label={open ? 'Fechar lista' : 'Abrir lista'}
            onClick={() => (open ? setOpen(false) : (inputRef.current?.focus(), openList()))}
            className="grid place-items-center border-0 bg-transparent p-0 text-subtle"
          >
            <Icon name="expand_more" size={19} />
          </button>
        </div>
        {open && (
          <div
            id={listId}
            role="listbox"
            aria-label={label}
            className="absolute left-0 right-0 top-[calc(100%+4px)] z-[4] flex max-h-[260px] flex-col overflow-y-auto rounded-xl border border-card-line bg-white p-1 shadow-[0_14px_36px_rgba(91,76,245,0.16)]"
          >
            {filtered.map((o, i) => (
              <div
                key={o.id}
                id={optionId(i)}
                role="option"
                aria-selected={o.id === value}
                tabIndex={-1}
                onKeyDown={(e) => e.key === 'Enter' && choose(o.id)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(o.id)}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-ink ${i === active ? 'bg-[#F6F5FF]' : ''}`}
              >
                {o.icon && (
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-chip">
                    <Icon name={o.icon} size={16} />
                  </span>
                )}
                {o.dot && <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: o.dot }} />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{o.label}</span>
                  {o.sub && <span className="text-xs text-muted">{o.sub}</span>}
                </span>
                <Icon name="check" size={17} className="text-brand" style={{ opacity: o.id === value ? 1 : 0 }} />
              </div>
            ))}
            {canCreate && (
              <div
                id={optionId(filtered.length)}
                role="option"
                aria-selected={false}
                tabIndex={-1}
                onKeyDown={(e) => e.key === 'Enter' && commit(filtered.length)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => commit(filtered.length)}
                onMouseEnter={() => setActive(filtered.length)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-[9px] text-sm font-medium text-brand ${
                  active === filtered.length ? 'bg-[#F6F5FF]' : ''
                }`}
              >
                <Icon name="add" size={17} />
                Criar «{query.trim()}»
              </div>
            )}
            {!count && <div className="p-2.5 text-[13px] text-muted">{emptyText}</div>}
          </div>
        )}
      </div>
      {hint && !error && <span className="text-xs font-normal text-muted">{hint}</span>}
      <FieldError message={error} />
    </div>
  );
}
