import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fileSize } from '../../domain/format';
import { downloadUrl, fileIcon, previewKind } from '../../lib/files';
import { useUi } from '../../store/uiStore';
import { Button, IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';

export function ConfirmDialog() {
  const confirm = useUi((s) => s.confirm);
  const resolve = useUi((s) => s.resolveConfirm);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirm) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        resolve(false);
      }
    };
    // Capture so Escape closes the confirm before an underlying sheet sees it.
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [confirm, resolve]);

  if (!confirm) return null;
  return createPortal(
    <>
      <div
        aria-hidden
        onClick={() => resolve(false)}
        className="fixed inset-0 z-70 bg-[rgba(16,24,40,0.45)] backdrop-blur-[4px]"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-msg"
        className="fixed left-1/2 top-1/2 z-71 box-border flex w-[min(400px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-[18px] bg-white p-[22px] shadow-[0_30px_80px_rgba(16,24,40,0.3)]"
      >
        <div className="flex items-start gap-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger-strong">
            <Icon name="warning" size={22} />
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 id="confirm-title" className="m-0 text-[17px] font-semibold tracking-[-0.01em]">
              {confirm.title}
            </h2>
            <p id="confirm-msg" className="m-0 text-sm leading-normal text-pretty text-muted">
              {confirm.message}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button ref={cancelRef} size="md" className="px-4! py-2.5! text-sm!" onClick={() => resolve(false)}>
            Cancelar
          </Button>
          <Button variant="danger" size="md" className="px-4! py-2.5! text-sm!" onClick={() => resolve(true)}>
            {confirm.confirmLabel}
          </Button>
        </div>
      </div>
    </>,
    document.body,
  );
}

export function Toast() {
  const t = useUi((s) => s.toast);
  const dismiss = useUi((s) => s.dismissToast);
  const [last, setLast] = useState(t);
  if (t && t !== last) setLast(t);

  useEffect(() => {
    if (!t) return;
    const id = setTimeout(dismiss, 2400);
    return () => clearTimeout(id);
  }, [t, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="brand-gradient pointer-events-none fixed left-1/2 top-[max(16px,env(safe-area-inset-top))] z-60 flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm text-white shadow-[0_8px_24px_rgba(16,24,40,0.2)]"
      style={{
        transform: `translate(-50%,${t ? '0' : '-20px'})`,
        opacity: t ? 1 : 0,
        transition: 'all .3s cubic-bezier(.2,.9,.25,1)',
      }}
    >
      <Icon name="check_circle" size={18} className="text-[#4ADE80]" />
      <span className="truncate">{(t ?? last)?.text}</span>
    </div>
  );
}

export function FilePreview() {
  const file = useUi((s) => s.preview);
  const close = useUi((s) => s.closePreview);
  const [state, setState] = useState<{ url: string; text?: string } | null>(null);

  useEffect(() => {
    if (!file) return;
    let url: string | null = null;
    let cancelled = false;
    file
      .getUrl()
      .then((src) => fetch(src))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then(async (b) => {
        url = URL.createObjectURL(b);
        const text = previewKind(file) === 'text' ? (await b.text()).slice(0, 30000) : undefined;
        if (!cancelled) setState({ url, text });
      })
      .catch(() => !cancelled && setState({ url: '' }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      cancelled = true;
      setState(null);
      if (url) URL.revokeObjectURL(url);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [file, close]);

  if (!file) return null;
  const kind = previewKind(file);
  return createPortal(
    <>
      <div aria-hidden onClick={close} className="fixed inset-0 z-50 bg-[rgba(16,24,40,0.6)] backdrop-blur-[6px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Pré-visualização de ${file.name}`}
        className="fixed left-1/2 top-1/2 z-51 flex h-[min(86dvh,760px)] w-[min(900px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_30px_80px_rgba(16,24,40,0.35)]"
      >
        <div className="flex items-center gap-3 px-3.5 py-3">
          <span className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand">
            <Icon name={fileIcon(file)} size={18} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{file.name}</span>
            <span className="text-xs text-muted">
              {fileSize(file.size)} · {file.type || 'ficheiro'}
            </span>
          </div>
          <Button
            variant="primary"
            icon="download"
            disabled={!state?.url}
            onClick={() => state?.url && downloadUrl(state.url, file.name)}
          >
            Descarregar
          </Button>
          <IconButton icon="close" label="Fechar pré-visualização" tone="solid" size={34} onClick={close} />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#F4F3FA]">
          {state?.url && kind === 'img' && (
            <img src={state.url} alt={file.name} className="block max-h-full max-w-full object-contain" />
          )}
          {state?.url && kind === 'pdf' && (
            <object data={state.url} type="application/pdf" aria-label={file.name} className="size-full bg-white">
              <p className="p-6 text-sm text-muted">Não foi possível mostrar o PDF. Descarregue o ficheiro para o abrir.</p>
            </object>
          )}
          {kind === 'text' && state?.text != null && (
            <pre className="m-0 box-border w-full self-stretch whitespace-pre-wrap break-words bg-white px-[18px] py-4 font-mono text-xs leading-[1.55] text-ink">
              {state.text}
            </pre>
          )}
          {(kind === 'other' || state?.url === '') && (
            <div className="flex flex-col items-center gap-2.5 p-6 text-center text-sm text-muted">
              <Icon name={fileIcon(file)} size={40} className="text-brand" />
              Pré-visualização indisponível para este formato.
              <br />
              Descarregue o ficheiro para o abrir.
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
