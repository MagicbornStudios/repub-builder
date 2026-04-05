import { useReaderReadingStore } from './reader-reading-store';

export {
  EPUB_LOCATION_STORAGE_PREFIX,
  EPUB_PROGRESS_STORAGE_PREFIX,
} from './reader-storage-keys';

export type ReaderShelfStatus =
  | { kind: 'new'; label: 'New'; progress: 0 }
  | { kind: 'progress'; label: string; progress: number }
  | { kind: 'done'; label: 'Done'; progress: 1 }
  | { kind: 'coming-soon'; label: 'Coming soon'; progress: null };

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function formatReaderProgressLabel(progress: number) {
  const normalized = clampProgress(progress);

  if (normalized <= 0.01) {
    return { kind: 'new', label: 'New', progress: 0 } as const;
  }

  if (normalized >= 0.995) {
    return { kind: 'done', label: 'Done', progress: 1 } as const;
  }

  return {
    kind: 'progress',
    label: `${Math.round(normalized * 100)}%`,
    progress: normalized,
  } as const;
}

export function resolveReaderShelfStatus(hasEpub: boolean, progress: number | null): ReaderShelfStatus {
  if (!hasEpub) {
    return { kind: 'coming-soon', label: 'Coming soon', progress: null };
  }

  if (progress == null) {
    return { kind: 'new', label: 'New', progress: 0 };
  }

  return formatReaderProgressLabel(progress);
}

export function readStoredReaderProgress(storageKey: string): number | null {
  if (typeof window === 'undefined') return null;
  return useReaderReadingStore.getState().getProgress(storageKey);
}

export function persistStoredReaderProgress(storageKey: string, progress: number | null) {
  if (typeof window === 'undefined') return;
  useReaderReadingStore.getState().setProgress(storageKey, progress);
}

export function readStoredReaderLocation(storageKey: string): string | null {
  if (typeof window === 'undefined') return null;
  return useReaderReadingStore.getState().getLocation(storageKey);
}

export function persistStoredReaderLocation(storageKey: string, location: string) {
  if (typeof window === 'undefined') return;
  useReaderReadingStore.getState().setLocation(storageKey, location);
}

export function hasStoredReaderLocation(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  return useReaderReadingStore.getState().hasLocation(storageKey);
}
