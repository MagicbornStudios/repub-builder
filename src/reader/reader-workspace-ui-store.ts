'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { StateStorage } from 'zustand/middleware';
import {
  normalizeShelfCatalogFilter,
  type ShelfCatalogFilter,
} from './reader-shelf-catalog';

const STORE_NAME = 'portfolio-reader-workspace-ui';
const LEGACY_NAV_KEYS = [
  'portfolio:reader-workspace-nav-expanded',
  'reader-workspace-nav-expanded',
] as const;
const LEGACY_SHELF_FILTER_KEY = 'reader-shelf-catalog-filter';

function noopStorage(): StateStorage {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function readLegacyNavExpanded(): boolean | null {
  try {
    for (const key of LEGACY_NAV_KEYS) {
      const v = localStorage.getItem(key);
      if (v === 'false') return false;
      if (v === 'true') return true;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type ReaderWorkspaceUiState = {
  readerNavExpanded: boolean;
  shelfCatalogFilter: ShelfCatalogFilter;
  setReaderNavExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleReaderNavExpanded: () => void;
  setShelfCatalogFilter: (f: ShelfCatalogFilter) => void;
  /** When the manifest genre list changes, drop an invalid genre filter. */
  clampShelfFilterToGenres: (knownGenres: string[]) => void;
};

export const useReaderWorkspaceUiStore = create<ReaderWorkspaceUiState>()(
  persist(
    immer((set) => ({
      readerNavExpanded: true,
      shelfCatalogFilter: 'all' as ShelfCatalogFilter,
      setReaderNavExpanded: (v) =>
        set((draft) => {
          draft.readerNavExpanded =
            typeof v === 'function' ? v(draft.readerNavExpanded) : v;
        }),
      toggleReaderNavExpanded: () =>
        set((draft) => {
          draft.readerNavExpanded = !draft.readerNavExpanded;
        }),
      setShelfCatalogFilter: (f) =>
        set((draft) => {
          draft.shelfCatalogFilter = f;
        }),
      clampShelfFilterToGenres: (knownGenres) =>
        set((draft) => {
          const f = draft.shelfCatalogFilter;
          if (f !== 'all' && !knownGenres.includes(f)) {
            draft.shelfCatalogFilter = 'all';
          }
        }),
    })),
    {
      name: STORE_NAME,
      version: 0,
      partialize: (s) => ({
        readerNavExpanded: s.readerNavExpanded,
        shelfCatalogFilter: s.shelfCatalogFilter,
      }),
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') return noopStorage();
        return {
          getItem: (name) => {
            let raw = localStorage.getItem(name);
            if (!raw) {
              const nav = readLegacyNavExpanded();
              let filterRaw: string | null = null;
              try {
                filterRaw = localStorage.getItem(LEGACY_SHELF_FILTER_KEY);
              } catch {
                /* ignore */
              }
              const readerNavExpanded = nav ?? true;
              const shelfCatalogFilter = normalizeShelfCatalogFilter(filterRaw, []);
              raw = JSON.stringify({
                state: { readerNavExpanded, shelfCatalogFilter },
                version: 0,
              });
              localStorage.setItem(name, raw);
              for (const k of LEGACY_NAV_KEYS) {
                try {
                  localStorage.removeItem(k);
                } catch {
                  /* ignore */
                }
              }
              try {
                localStorage.removeItem(LEGACY_SHELF_FILTER_KEY);
              } catch {
                /* ignore */
              }
            }
            return raw;
          },
          setItem: (name, value) => localStorage.setItem(name, value),
          removeItem: (name) => localStorage.removeItem(name),
        };
      }),
    },
  ),
);
