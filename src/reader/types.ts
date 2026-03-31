import type { AnchorHTMLAttributes, ComponentType } from 'react';

/** Minimal book row for the reader shell (matches portfolio `BookEntry` subset). */
export type ReaderBookEntry = {
  slug: string;
  recordId?: string | null;
  title: string;
  author?: string;
  description?: string;
  coverImage?: string;
  remoteEpubUrl?: string | null;
  sourceKind?: 'built-in' | 'uploaded';
  visibility?: 'private' | 'public';
  /** Display labels (from `book.json` to manifest). */
  genres?: string[];
  hasEpub: boolean;
};

export type ReaderWorkspaceAccessState = {
  authenticated: boolean;
  autoLoggedIn: boolean;
  isOwner: boolean;
  canPersist: boolean;
  canEdit: boolean;
  canUpload: boolean;
  uploadRequiresExplicitAction: boolean;
  localImportMode: 'local-only';
  storageMode: 'local-only' | 'hybrid';
};

export type ReaderWorkspaceSettingsState = {
  defaultWorkspaceView: 'library' | 'continue-reading';
  preferPagedReader: boolean;
  showProgressBadges: boolean;
};

export type ReaderWorkspaceLibraryRecord = {
  id: string;
  title: string;
  author?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  epubUrl?: string | null;
  sourceKind: 'built-in' | 'uploaded';
  sourceFileName?: string | null;
  visibility: 'private' | 'public';
  updatedAt?: string | null;
};

export type ReaderWorkspaceUploadInput = {
  file: File;
  title: string;
  author?: string | null;
  description?: string | null;
  visibility: 'private' | 'public';
};

export type ReaderAppSearch = {
  book?: string;
  record?: string;
  at?: string;
  cfi?: string;
};

export type ReaderLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

export type ReaderLinkComponent = ComponentType<ReaderLinkProps>;

export type ReaderPlanningQuickLink = {
  href: string;
  label: string;
};

/**
 * Neutral planning payload passed from the reader package to a host-supplied
 * cockpit surface. The reader should not depend on a host-specific modal schema.
 */
export type ReaderPlanningCockpitPayload = {
  readingTargetId: string;
  surfaceLabel?: string;
  quickLinks?: ReaderPlanningQuickLink[];
};

export type ReaderPlanningStripConfig = {
  /** Optional quick links (e.g. apps routes). Omit or leave empty to hide the expandable link row. */
  planningLinks?: ReaderPlanningQuickLink[];
  cockpitPayload: ReaderPlanningCockpitPayload;
};
