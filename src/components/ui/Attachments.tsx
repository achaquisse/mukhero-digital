import { dayLabel, fileSize } from '../../domain/format';
import { useApi } from '../../api/context';
import type { Attachment, DraftFile } from '../../domain/types';
import { downloadUrl, fileIcon } from '../../lib/files';
import { toast, useUi } from '../../store/uiStore';
import { IconButton } from './Button';
import { Icon } from './Icon';

export function DropButton({ label, icon = 'attach_file', onClick }: { label: string; icon?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#CFC9FB] bg-surface-2 p-3.5 text-[13px] font-medium text-brand hover:bg-[#F3F1FF]"
    >
      <Icon name={icon} size={19} />
      {label}
    </button>
  );
}

function FileRow({
  name,
  type,
  meta,
  onPreview,
  onDownload,
  onRemove,
  removeIcon,
}: {
  name: string;
  type: string;
  meta: string;
  onPreview: () => void;
  onDownload?: () => void;
  onRemove: () => void;
  removeIcon: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] bg-surface px-2.5 py-2">
      <button
        type="button"
        onClick={onPreview}
        className="flex min-w-0 flex-1 items-center gap-2.5 border-0 bg-transparent p-0 text-left text-ink"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand">
          <Icon name={fileIcon({ name, type })} size={17} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-[550]">{name}</span>
          <span className="text-[11px] text-muted">{meta}</span>
        </span>
      </button>
      {onDownload && (
        <>
          <IconButton icon="visibility" label={`Pré-visualizar ${name}`} tone="brand" size={30} onClick={onPreview} />
          <IconButton
            icon="download"
            label={`Descarregar ${name}`}
            tone="brand"
            size={30}
            className="text-[#374151]!"
            onClick={onDownload}
          />
        </>
      )}
      <IconButton icon={removeIcon} label={`Remover ${name}`} tone="danger" size={30} onClick={onRemove} />
    </div>
  );
}

/** A file already stored in the backend. */
export function AttachmentRow({
  file,
  fallbackDate,
  onRemove,
}: {
  file: Attachment;
  fallbackDate?: string;
  onRemove: () => void;
}) {
  const api = useApi();
  const openPreview = useUi((s) => s.openPreview);
  const meta = [fileSize(file.size), file.addedBy, dayLabel((file.addedAt || fallbackDate || '').slice(0, 10))]
    .filter(Boolean)
    .join(' · ');
  return (
    <FileRow
      name={file.name}
      type={file.type}
      meta={meta}
      removeIcon="delete"
      onPreview={() => openPreview({ name: file.name, type: file.type, size: file.size, getUrl: () => api.attachmentUrl(file) })}
      onDownload={() =>
        api
          .attachmentUrl(file, { download: true })
          .then((url) => downloadUrl(url, file.name))
          .catch((e: Error) => toast(e.message))
      }
      onRemove={onRemove}
    />
  );
}

/** A file picked in a form, uploaded when the form is saved. */
export function DraftFileRow({ draft, onRemove }: { draft: DraftFile; onRemove: () => void }) {
  const openPreview = useUi((s) => s.openPreview);
  const { file } = draft;
  return (
    <FileRow
      name={file.name}
      type={file.type}
      meta={fileSize(file.size)}
      removeIcon="close"
      onPreview={() =>
        openPreview({ name: file.name, type: file.type, size: file.size, getUrl: async () => URL.createObjectURL(file) })
      }
      onRemove={onRemove}
    />
  );
}
