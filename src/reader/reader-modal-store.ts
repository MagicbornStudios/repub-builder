import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ReaderPlanningCockpitPayload } from './types';

export type ReaderPlanningModalState = {
  open: boolean;
  payload: ReaderPlanningCockpitPayload | null;
  openPlanningCockpit: (payload: ReaderPlanningCockpitPayload) => void;
  closePlanningCockpit: () => void;
};

export const useReaderModalStore = create<ReaderPlanningModalState>()(
  immer((set) => ({
    open: false,
    payload: null,
    openPlanningCockpit: (payload) =>
      set((draft) => {
        draft.open = true;
        draft.payload = payload;
      }),
    closePlanningCockpit: () =>
      set((draft) => {
        draft.open = false;
        draft.payload = null;
      }),
  })),
);
