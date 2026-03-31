import type { PortfolioAnnotation } from './epub-annotations';

export type ReaderPersistedState = {
  location: string | null;
  progress: number | null;
  annotations: PortfolioAnnotation[];
};

export type ReaderPersistenceLoadInput = {
  storageKey: string;
  contentHash: string;
};

export type ReaderPersistenceSaveInput = ReaderPersistenceLoadInput & {
  bookSlug: string | null;
  sourceKind: 'built-in' | 'uploaded';
  location: string | null;
  progress: number | null;
  annotations: PortfolioAnnotation[];
};

export type ReaderPersistenceAdapter = {
  loadState: (input: ReaderPersistenceLoadInput) => Promise<ReaderPersistedState | null>;
  saveState: (input: ReaderPersistenceSaveInput) => Promise<void>;
};

function annotationTime(value: PortfolioAnnotation) {
  const ts = Date.parse(value.updatedAt || value.createdAt || '');
  return Number.isFinite(ts) ? ts : 0;
}

export function mergePersistedAnnotations(
  localAnnotations: PortfolioAnnotation[],
  remoteAnnotations: PortfolioAnnotation[],
) {
  const merged = new Map<string, PortfolioAnnotation>();

  for (const annotation of [...remoteAnnotations, ...localAnnotations]) {
    const existing = merged.get(annotation.id);
    if (!existing || annotationTime(annotation) >= annotationTime(existing)) {
      merged.set(annotation.id, annotation);
    }
  }

  return Array.from(merged.values()).sort((a, b) => annotationTime(a) - annotationTime(b));
}
