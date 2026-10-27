import type { ModalBody } from './ModalBody';

let loaded: typeof ModalBody | null = null;
let pending: Promise<typeof ModalBody> | null = null;

/** Modal forms (and their zod / react-hook-form deps) live in their own chunk, fetched once the shell is up. */
export function loadModalBody(): Promise<typeof ModalBody> {
  pending ??= import('./ModalBody').then(
    (m) => (loaded = m.ModalBody),
    (e: unknown) => {
      pending = null;
      throw e;
    },
  );
  return pending;
}

export const loadedModalBody = () => loaded;
