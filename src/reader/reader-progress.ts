export const EPUB_LOCATION_STORAGE_PREFIX = 'epub-location-';
export const EPUB_PROGRESS_STORAGE_PREFIX = 'epub-progress-';

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

  try {
    const raw = window.localStorage.getItem(EPUB_PROGRESS_STORAGE_PREFIX + storageKey);
    if (!raw) return null;

    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return null;
    return clampProgress(parsed);
  } catch {
    return null;
  }
}

export function persistStoredReaderProgress(storageKey: string, progress: number | null) {
  if (typeof window === 'undefined' || progress == null) return;

  try {
    window.localStorage.setItem(EPUB_PROGRESS_STORAGE_PREFIX + storageKey, String(clampProgress(progress)));
  } catch {
    // ignore quota / private mode failures
  }
}
