import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

interface PopoverProps {
  trigger: (p: { open: boolean; toggle: () => void; id: string }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
  panelClassName?: string;
}

/** Click-to-open panel. Closes on outside click and Escape. */
export function Popover({ trigger, children, align = 'left', className = '', panelClassName = '' }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    el.style.translate = '';
    const r = el.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const margin = 12;
    let dx = 0;
    if (r.right > vw - margin) dx = vw - margin - r.right;
    if (r.left + dx < margin) dx = margin - r.left;
    if (dx) el.style.translate = `${dx}px 0`;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={`relative ${open ? 'z-30' : 'z-[1]'} ${className}`}>
      {trigger({ open, toggle: () => setOpen((o) => !o), id })}
      {open && (
        <div
          ref={panelRef}
          id={id}
          className={`absolute top-[calc(100%+6px)] flex max-w-[calc(100vw-24px)] flex-col rounded-xl border border-[#E7E9EE] bg-white p-1 shadow-pop ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export interface SelectOption<T extends string | null> {
  value: T;
  label: string;
}

interface SelectMenuProps<T extends string | null> {
  label: string;
  /** Text shown on the button. */
  display: string;
  icon?: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (v: T) => void;
  active?: boolean;
}

/** Filter-style dropdown (button + listbox with check marks). */
export function SelectMenu<T extends string | null>({
  label,
  display,
  icon,
  value,
  options,
  onChange,
  active,
}: SelectMenuProps<T>) {
  return (
    <Popover
      panelClassName="min-w-[210px] max-h-80 overflow-y-auto"
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-label={`${label}: ${display}`}
          onClick={toggle}
          className={`flex items-center gap-[7px] whitespace-nowrap rounded-[10px] border px-2.5 py-[7px] text-[13px] font-medium text-ink ${
            active ? 'border-brand bg-brand-tint' : 'border-line bg-white'
          }`}
        >
          {icon && <Icon name={icon} size={17} className="text-muted" />}
          {display}
          <Icon name="expand_more" size={17} className="text-subtle" />
        </button>
      )}
    >
      {(close) => (
        <div role="listbox" aria-label={label} className="flex flex-col">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={String(o.value)}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(o.value);
                  close();
                }}
                className="flex items-center justify-between gap-3 whitespace-nowrap rounded-lg border-0 bg-transparent px-2.5 py-[9px] text-left text-sm text-ink hover:bg-hover"
              >
                {o.label}
                <Icon name="check" size={17} className="text-brand" style={{ opacity: selected ? 1 : 0 }} />
              </button>
            );
          })}
        </div>
      )}
    </Popover>
  );
}
