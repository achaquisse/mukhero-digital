import { MAX_FILE_BYTES } from '../domain/constants';
import { fileSize } from '../domain/format';
import type { Attachment } from '../domain/types';

export function fileIcon(a: Pick<Attachment, 'type' | 'name'>): string {
  if (a.type.startsWith('image/')) return 'image';
  if (a.type === 'application/pdf') return 'picture_as_pdf';
  if (/sheet|excel|csv/.test(a.type) || /\.(csv|xlsx?)$/i.test(a.name)) return 'table_view';
  return 'description';
}

export type PreviewKind = 'img' | 'pdf' | 'text' | 'other';

export function previewKind(a: Pick<Attachment, 'type' | 'name'>): PreviewKind {
  if (a.type.startsWith('image/')) return 'img';
  if (a.type === 'application/pdf') return 'pdf';
  if (/^text\/|csv|json/.test(a.type) || /\.(csv|txt)$/i.test(a.name)) return 'text';
  return 'other';
}

/** Split picked files into accepted and rejected (over the size cap). */
export function validateFiles(list: Iterable<File>): { files: File[]; rejected: string[] } {
  const files: File[] = [];
  const rejected: string[] = [];
  for (const f of list) {
    if (f.size > MAX_FILE_BYTES) rejected.push(`${f.name} excede ${fileSize(MAX_FILE_BYTES)}`);
    else files.push(f);
  }
  return { files, rejected };
}

export function downloadUrl(url: string, name: string) {
  const el = document.createElement('a');
  el.href = url;
  el.download = name;
  el.rel = 'noopener';
  document.body.appendChild(el);
  el.click();
  el.remove();
}
