import type { ReactNode } from 'react';
import { TINTS } from '../../domain/constants';
import { Icon } from './Icon';

export function Badge({
  children,
  bg,
  color,
  className = '',
}: {
  children: ReactNode;
  bg: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-[9px] py-[3px] text-xs font-[550] ${className}`}
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span aria-hidden className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
  );
}

export function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="avatar-gradient grid shrink-0 place-items-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}

export function OrgMark({
  name,
  color,
  size = 36,
  radius = 10,
}: {
  name: string;
  color: string;
  size?: number;
  radius?: number;
}) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center font-semibold text-white"
      style={{ width: size, height: size, borderRadius: radius, background: color, fontSize: Math.round(size * 0.42) }}
    >
      {name[0] ?? '?'}
    </span>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="logo-gradient grid shrink-0 place-items-center"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    >
      <Icon name="deployed_code" size={Math.round(size * 0.55)} filled className="text-white" />
    </span>
  );
}

/** Rounded square with a tinted icon. `tint` cycles through the design's four tints. */
export function IconTile({
  icon,
  tint = 0,
  size = 28,
  colors,
}: {
  icon: string;
  tint?: number;
  size?: number;
  colors?: readonly [string, string];
}) {
  const [bg, fg] = colors ?? TINTS[tint % TINTS.length]!;
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), background: bg, color: fg }}
    >
      <Icon name={icon} size={Math.round(size * 0.6)} />
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: string;
  tint?: number;
  color?: string;
  unit?: string;
  sub?: ReactNode;
  dot?: string;
  large?: boolean;
}

export function StatCard({ label, value, icon, tint = 0, color, unit, sub, dot, large }: StatCardProps) {
  return (
    <div className={`card flex min-w-0 flex-col ${large ? 'gap-1.5 px-[18px] py-4' : 'gap-2.5 px-4 py-3.5'}`}>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        {icon && <IconTile icon={icon} tint={tint} />}
        {dot && <Dot color={dot} />}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={`truncate font-semibold tracking-[-0.03em] ${large ? 'text-[26px]' : 'text-[22px]'}`}
          style={color ? { color } : undefined}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-subtle">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function StatGrid({ min = 180, children }: { min?: number; children: ReactNode }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit,minmax(min(100%,${min}px),1fr))` }}>
      {children}
    </div>
  );
}

export function SectionHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider px-4 py-3.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

/** Key/value rows on a lavender panel, as used in detail sheets. */
export function KeyValues({ rows }: { rows: Array<{ label: string; value: ReactNode; color?: string }> }) {
  return (
    <dl className="m-0 flex flex-col rounded-xl bg-surface px-3.5 py-1">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 py-[9px] text-sm">
          <dt className="text-muted">{r.label}</dt>
          <dd className="m-0 text-right font-[550]" style={r.color ? { color: r.color } : undefined}>
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** 3-column metric strip with hairline separators. */
export function MetricStrip({
  items,
  tone = 'surface',
}: {
  items: Array<{ label: string; value: ReactNode; color?: string; sub?: ReactNode }>;
  tone?: 'surface' | 'white';
}) {
  return (
    <div
      className={`grid shrink-0 grid-cols-3 gap-px overflow-hidden rounded-xl ${
        tone === 'white' ? 'border border-divider bg-divider' : 'bg-[#ECEBF5]'
      }`}
    >
      {items.map((s) => (
        <div key={s.label} className={`flex min-w-0 flex-col gap-[3px] p-3 ${tone === 'white' ? 'bg-white' : 'bg-surface'}`}>
          <span className="text-[11px] text-muted">{s.label}</span>
          <span
            className="truncate text-[15px] font-semibold tracking-[-0.02em]"
            style={s.color ? { color: s.color } : undefined}
          >
            {s.value}
          </span>
          {s.sub && <span className="text-[11px] text-muted">{s.sub}</span>}
        </div>
      ))}
    </div>
  );
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function ProgressBar({
  value,
  color = '#5B4CF5',
  height = 6,
  extra,
}: {
  value: number;
  color?: string;
  height?: number;
  extra?: { value: number; color: string };
}) {
  return (
    <div className="flex overflow-hidden rounded-[3px] bg-divider" style={{ height }} role="presentation">
      <div className="h-full rounded-[3px]" style={{ width: `${clamp(value)}%`, background: color }} />
      {extra && <div className="h-full" style={{ width: `${clamp(extra.value)}%`, background: extra.color }} />}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="py-2 text-sm text-muted">{children}</div>;
}
