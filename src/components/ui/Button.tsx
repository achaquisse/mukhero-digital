import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'link';
type Size = 'sm' | 'md' | 'lg' | 'block';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconColor?: string;
  children?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'brand-gradient text-white border-0 font-[550] hover:brightness-95',
  secondary: 'bg-white text-ink border border-line font-medium hover:bg-hover',
  ghost: 'bg-transparent text-ink border-0 hover:bg-hover',
  danger: 'bg-danger-strong text-white border-0 font-[550] hover:bg-danger',
  'danger-outline': 'bg-white text-danger border border-danger-line font-[550] hover:bg-danger-soft',
  link: 'bg-transparent text-brand border-0 font-[550] p-0! hover:text-brand-dark',
};

const SIZES: Record<Size, string> = {
  sm: 'text-[13px] rounded-[10px] px-3 py-[7px] gap-1.5',
  md: 'text-sm rounded-[10px] px-3.5 py-2 gap-1.5',
  lg: 'text-[15px] rounded-xl px-4 py-[13px] gap-2',
  block: 'text-sm rounded-xl px-3 py-[11px] gap-2 w-full justify-center',
};

export function Button({
  variant = 'secondary',
  size = 'sm',
  icon,
  iconColor,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 19 : 17} style={iconColor ? { color: iconColor } : undefined} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  tone?: 'neutral' | 'danger' | 'brand' | 'solid';
  size?: number;
}

/** Square icon-only button. `label` is required for accessibility. */
export function IconButton({ icon, label, tone = 'neutral', size = 32, className = '', ...rest }: IconButtonProps) {
  const tones = {
    neutral: 'bg-transparent text-subtle hover:bg-hover hover:text-ink',
    danger: 'bg-transparent text-subtle hover:bg-danger-soft hover:text-danger',
    brand: 'bg-white text-brand hover:bg-brand-soft',
    solid: 'bg-chip text-ink hover:bg-line',
  } as const;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid shrink-0 place-items-center rounded-lg border-0 transition-colors ${tones[tone]} ${className}`}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.56)} />
    </button>
  );
}
