'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { StateStorage } from 'zustand/middleware';
import {
  EPUB_LOCATION_STORAGE_PREFIX,
  EPUB_PROGRESS_STORAGE_PREFIX,
} from './reader-storage-keys';

export const READER_READING_STORE_NAME = 'portfolio-reader-epub-reading';

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function noopStorage(): StateStorage {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

function migrateLegacyLooseKeys(): {
  progressByKey: Record<string, number>;
  locationByKey: Record<string, string>;
} {
  const progressByKey: Record<string, number> = {};
  const locationByKey: Record<string, string> = {};
  if (typeof window === 'undefined') {
    return { progressByKey, locationByKey };
  }
  const keysToRemove: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(EPUB_PROGRESS_STORAGE_PREFIX)) {
        const sk = k.slice(EPUB_PROGRESS_STORAGE_PREFIX.length);
        const raw = localStorage.getItem(k);
        if (raw == null) continue;
        const parsed = Number.parseFloat(raw);
        if (Number.isFinite(parsed)) {
          progressByKey[sk] = clampProgress(parsed);
        }
        keysToRemove.push(k);
      } else if (k.startsWith(EPUB_LOCATION_STORAGE_PREFIX)) {
        const sk = k.slice(EPUB_LOCATION_STORAGE_PREFIX.length);
        const raw = localStorage.getItem(k);
        if (raw != null && raw !== '') {
          locationByKey[sk] = raw;
        }
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    /* ignore quota / private mode */
  }
  return { progressByKey, locationByKey };
}

export type ReaderReadingPersisted = {
  progressByKey: Record<string, number>;
  locationByKey: Record<string, string>;
};

type ReaderReadingState = ReaderReadingPersisted & {
  getProgress: (storageKey: string) => number | null;
  setProgress: (storageKey: string, progress: number | null) => void;
  getLocation: (storageKey: string) => string | null;
  setLocation: (storageKey: string, location: string) => void;
  hasLocation: (storageKey: string) => boolean;
};

export const useReaderReadingStore = create<ReaderReadingState>()(
  persist(
    immer((set, get) => ({
      progressByKey: {},
      locationByKey: {},
      getProgress: (storageKey) => {
        const v = get().progressByKey[storageKey];
        if (v === undefined) return null;
        return clampProgress(v);
      },
      setProgress: (storageKey, progress) =>
        set((draft) => {
          if (progress == null) {
            delete draft.progressByKey[storageKey];
            return;
          }
          draft.progressByKey[storageKey] = clampProgress(progress);
        }),
      getLocation: (storageKey) => get().locationByKey[storageKey] ?? null,
      setLocation: (storageKey, location) =>
        set((draft) => {
          draft.locationByKey[storageKey] = location;
        }),
      hasLocation: (storageKey) => Boolean(get().locationByKey[storageKey]),
    })),
    {
      name: READER_READING_STORE_NAME,
      version: 0,
      partialize: (s) => ({
        progressByKey: s.progressByKey,
        locationByKey: s.locationByKey,
      }),
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') return noopStorage();
        return {
          getItem: (name) => {
            let raw = localStorage.getItem(name);
            if (!raw) {
              const migrated = migrateLegacyLooseKeys();
              if (
                Object.keys(migrated.progressByKey).length > 0 ||
                Object.keys(migrated.locationByKey).length > 0
              ) {
                raw = JSON.stringify({
                  state: {
                    progressByKey: migrated.progressByKey,
                    locationByKey: migrated.locationByKey,
                  },
                  version: 0,
                });
                localStorage.setItem(name, raw);
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

/** Other tabs / windows: persist writes one JSON blob; rehydrate when it changes. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === READER_READING_STORE_NAME) {
      void useReaderReadingStore.persist.rehydrate();
    }
  });
}
