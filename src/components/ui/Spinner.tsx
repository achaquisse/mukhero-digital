export function Spinner({ label = 'A carregar…' }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-[50vh] place-items-center">
      <span className="flex items-center gap-3 text-sm text-muted">
        <span aria-hidden className="size-5 animate-spin-fast rounded-full border-2 border-line border-t-brand" />
        {label}
      </span>
    </div>
  );
}
