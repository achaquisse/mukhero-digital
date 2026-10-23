import { useEffect, useState } from 'react';
import { useMediaQuery } from './useMediaQuery';

const DURATION = 600;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Eased 0→1 progress that replays whenever `key` changes. Used to count up
 * KPIs and grow chart bars on tab / filter changes. Always 1 when the user
 * prefers reduced motion.
 */
export function useEntrance(key: unknown): number {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)', true);
  const [state, setState] = useState({ key, t: 0 });
  // Restart from 0 as soon as the key changes (render-time reset, no extra effect pass).
  if (state.key !== key) setState({ key, t: 0 });

  useEffect(() => {
    if (reduced) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      setState({ key, t });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, reduced]);

  if (reduced) return 1;
  return easeOutCubic(state.key === key ? state.t : 0);
}
