import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useWide } from '../../hooks/useMediaQuery';
import { IconButton } from '../ui/Button';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  wideMax?: number;
  children: ReactNode;
}

const FOCUSABLE =
  'button:not([disabled]),[href],input:not([disabled]):not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])';

/** Modal surface: centred dialog on desktop, bottom sheet on mobile. */
export function Sheet({ open, title, onClose, wideMax = 540, children }: SheetProps) {
  const wide = useWide();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus],input:not([type=hidden]):not([type=file]),textarea') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === 'Tab' && panel) {
        const els = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!els.length) return;
        const f = els[0]!;
        const l = els[els.length - 1]!;
        if (e.shiftKey && document.activeElement === f) {
          e.preventDefault();
          l.focus();
        } else if (!e.shiftKey && document.activeElement === l) {
          e.preventDefault();
          f.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const transform = wide
    ? open
      ? 'translate(-50%,-50%) scale(1)'
      : 'translate(-50%,-48%) scale(0.98)'
    : open
      ? 'translate(-50%,0)'
      : 'translate(-50%,105%)';

  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-30 bg-[rgba(16,24,40,0.32)] transition-opacity duration-250"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
        inert={!open}
        className="fixed left-1/2 z-31 box-border flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto border border-[#E7E9EE] bg-white px-5 pb-[22px] pt-[18px] shadow-[0_24px_60px_rgba(16,24,40,0.2)]"
        style={{
          top: wide ? '50%' : 'auto',
          bottom: wide ? 'auto' : 0,
          maxWidth: wide ? wideMax : 640,
          borderRadius: wide ? 16 : '16px 16px 0 0',
          transform,
          opacity: wide ? (open ? 1 : 0) : 1,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform .35s cubic-bezier(.2,.9,.25,1), opacity .25s',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="m-0 text-lg font-semibold tracking-[-0.02em]">
            {title}
          </h2>
          <IconButton icon="close" label="Fechar" tone="solid" onClick={onClose} />
        </div>
        {children}
      </div>
    </>,
    document.body,
  );
}
