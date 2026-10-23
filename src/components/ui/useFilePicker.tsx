import { useRef } from 'react';
import { FILE_ACCEPT } from '../../domain/constants';
import { validateFiles } from '../../lib/files';
import { toast } from '../../store/uiStore';

/** Returns a hidden file input and a function that opens it. Oversized files are rejected with a toast. */
export function useFilePicker(onFiles: (files: File[]) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      multiple
      accept={FILE_ACCEPT}
      className="hidden"
      data-testid="file-input"
      onChange={(e) => {
        const list = e.target.files;
        if (!list?.length) return;
        const { files, rejected } = validateFiles(Array.from(list));
        e.target.value = '';
        rejected.forEach(toast);
        if (files.length) onFiles(files);
      }}
    />
  );
  return { input, open: () => ref.current?.click() };
}
