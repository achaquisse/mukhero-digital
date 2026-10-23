import { create } from 'zustand';

export type ModalState =
  | { kind: 'quick' }
  | { kind: 'sale'; productId?: string }
  | { kind: 'expense' }
  | { kind: 'lot'; productId?: string; editId?: string }
  | { kind: 'product' }
  | { kind: 'type' }
  | { kind: 'cat' }
  | { kind: 'invite' }
  | { kind: 'lotDetail'; lotId: string }
  | { kind: 'saleDetail'; saleId: string }
  | { kind: 'expDetail'; expId: string }
  | { kind: 'productDetail'; productId: string };

export type ModalKind = ModalState['kind'];

/** A file to preview: stored attachments resolve a signed URL, drafts an object URL. */
export interface PreviewFile {
  name: string;
  type: string;
  size: number;
  getUrl: () => Promise<string>;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<unknown>;
}

interface UiState {
  modal: ModalState | null;
  /** Increments on every open so forms remount with fresh state. */
  modalSeq: number;
  toast: { id: number; text: string } | null;
  confirm: ConfirmRequest | null;
  preview: PreviewFile | null;
  openModal: (m: ModalState) => void;
  closeModal: () => void;
  showToast: (text: string) => void;
  dismissToast: () => void;
  ask: (c: ConfirmRequest) => void;
  resolveConfirm: (confirmed: boolean) => void;
  openPreview: (f: PreviewFile) => void;
  closePreview: () => void;
}

let toastSeq = 0;

export const useUi = create<UiState>()((set, get) => ({
  modal: null,
  modalSeq: 0,
  toast: null,
  confirm: null,
  preview: null,
  openModal: (modal) => set((s) => ({ modal, modalSeq: s.modalSeq + 1 })),
  closeModal: () => set({ modal: null }),
  showToast: (text) => set({ toast: { id: ++toastSeq, text } }),
  dismissToast: () => set({ toast: null }),
  ask: (confirm) => set({ confirm }),
  resolveConfirm: (confirmed) => {
    const c = get().confirm;
    set({ confirm: null });
    if (confirmed) void c?.onConfirm();
  },
  openPreview: (preview) => set({ preview }),
  closePreview: () => set({ preview: null }),
}));

/** Imperative helpers for non-component code. */
export const toast = (text: string) => useUi.getState().showToast(text);
