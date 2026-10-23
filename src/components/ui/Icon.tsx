import type { CSSProperties } from 'react';

interface IconProps {
  name: string;
  size?: number;
  filled?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Material Symbols Rounded glyph. Decorative by default (aria-hidden). */
export function Icon({ name, size = 18, filled, className = '', style }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`icon inline-block shrink-0 ${className}`}
      style={{ fontSize: size, fontVariationSettings: filled ? "'FILL' 1" : undefined, ...style }}
    >
      {name}
    </span>
  );
}
