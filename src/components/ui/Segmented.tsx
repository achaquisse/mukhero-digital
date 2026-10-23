interface SegmentedProps<T extends string> {
  options: ReadonlyArray<readonly [T, string]>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: 'xs' | 'sm' | 'md';
  stretch?: boolean;
  className?: string;
}

const PAD = { xs: 'px-[9px] py-[5px] text-xs', sm: 'px-3 py-[5px] text-[13px]', md: 'px-4 py-2 text-[13px]' };

/** Pill-style single-choice control (radio group semantics). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'sm',
  stretch,
  className = '',
}: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex gap-0.5 rounded-[9px] bg-chip p-0.5 ${className}`}>
      {options.map(([id, text]) => {
        const on = id === value;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(id)}
            className={`rounded-[7px] border-0 font-[550] transition-colors ${PAD[size]} ${stretch ? 'flex-1' : ''} ${
              on ? 'bg-white text-brand shadow-seg' : 'bg-transparent text-muted hover:text-ink'
            }`}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}

interface ChipsProps<T extends string> {
  options: ReadonlyArray<{ id: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}

/** Wrapping pill chips for picking one of a few items (e.g. product type). */
export function ChipGroup<T extends string>({ options, value, onChange, label }: ChipsProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
              on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:bg-hover'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
