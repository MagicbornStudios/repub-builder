import { create } from 'zustand';
import type { ReaderPlanningCockpitPayload } from './types';

export type ReaderPlanningModalState = {
  open: boolean;
  payload: ReaderPlanningCockpitPayload | null;
  openPlanningCockpit: (payload: ReaderPlanningCockpitPayload) => void;
  closePlanningCockpit: () => void;
};

export const useReaderModalStore = create<ReaderPlanningModalState>((set) => ({
  open: false,
  payload: null,
  openPlanningCockpit: (payload) => set({ open: true, payload }),
  closePlanningCockpit: () => set({ open: false, payload: null }),
}));
