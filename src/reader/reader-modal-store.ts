import { create } from 'zustand';

/**
 * Host-scoped modal state for the reader workspace. Payload is opaque to the package;
 * the host supplies `renderReaderModal` to interpret it.
 */
export type ReaderModalState = {
  open: boolean;
  payload: unknown | null;
  openReaderModal: (payload: unknown) => void;
  closeReaderModal: () => void;
};

export const useReaderModalStore = create<ReaderModalState>((set) => ({
  open: false,
  payload: null,
  openReaderModal: (payload) => set({ open: true, payload }),
  closeReaderModal: () => set({ open: false, payload: null }),
}));
