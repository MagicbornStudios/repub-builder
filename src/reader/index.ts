'use client';

export { default as ReaderWorkspace, type ReaderWorkspaceProps } from './ReaderWorkspace';
export type { ReaderShellNavLink } from './ReaderWorkspaceSidebar';
export { default } from './ReaderWorkspace';
export { ReaderModalRoot } from './ReaderModalRoot';
export { ReaderPlanningStrip } from './ReaderPlanningStrip';
export { ReaderShelfCard } from './ReaderShelfCard';
export { ReaderEmptyCover } from './ReaderEmptyCover';
export { default as EpubViewer } from './EpubViewer';
export { default as EpubViewerLazy } from './EpubViewerLazy';
export type { EpubViewerProps } from './EpubViewer';
export { useReaderModalStore } from './reader-modal-store';
export { useReaderWorkspaceUiStore } from './reader-workspace-ui-store';
export {
  EPUB_LOCATION_STORAGE_PREFIX,
  EPUB_PROGRESS_STORAGE_PREFIX,
  formatReaderProgressLabel,
  readStoredReaderProgress,
  readStoredReaderLocation,
  persistStoredReaderLocation,
  hasStoredReaderLocation,
  resolveReaderShelfStatus,
  persistStoredReaderProgress,
  type ReaderShelfStatus,
} from './reader-progress';
export {
  READER_READING_STORE_NAME,
  useReaderReadingStore,
  type ReaderReadingPersisted,
} from './reader-reading-store';
export { readerAppHref } from './reader-routes';
export {
  mergePersistedAnnotations,
  type ReaderPersistedState,
  type ReaderPersistenceAdapter,
  type ReaderPersistenceLoadInput,
  type ReaderPersistenceSaveInput,
} from './reader-persistence';
export {
  getReaderBookStorageKey,
  resolveReaderWorkspaceState,
  type ReaderWorkspaceState,
  type UploadedBookSource,
  type ResolveReaderWorkspaceOptions,
} from './reader-workspace-state';
export {
  PORTFOLIO_ANNOTATIONS_SCHEMA,
  PORTFOLIO_ANNOTATIONS_JSON_PATH,
  type PortfolioAnnotation,
  type PortfolioAnnotationsFile,
  parseAnnotationsFile,
  sha256Hex,
  loadAnnotationsFromIndexedDb,
  saveAnnotationsToIndexedDb,
  annotationsToExportPayload,
  serializeAnnotationsExport,
  embedAnnotationsInEpub,
} from './epub-annotations';
export type {
  ReaderBookEntry,
  ReaderAppSearch,
  ReaderWorkspaceAccessState,
  ReaderWorkspaceLibraryRecord,
  ReaderWorkspaceSettingsState,
  ReaderWorkspaceUploadInput,
  ReaderPlanningCockpitPayload,
  ReaderPlanningQuickLink,
  ReaderLinkProps,
  ReaderLinkComponent,
  ReaderPlanningStripConfig,
} from './types';
export {
  extractPlanningPackFromEpub,
  readerBookPlanningPackId,
  type ExtractedReaderPlanningPack,
} from './planning-pack-from-epub';
export { defaultReaderLink } from './default-reader-link';
export {
  applyShelfCatalogFilter,
  collectDistinctGenres,
  normalizeShelfCatalogFilter,
  partitionShelfBooks,
  READER_SHELF_FILTER_STORAGE_KEY,
  type ShelfCatalogFilter,
} from './reader-shelf-catalog';
export { readerChromeClasses, type ReaderChromeClasses } from './reader-chrome-theme';
