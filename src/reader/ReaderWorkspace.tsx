'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  BookOpen,
  Download,
  LibraryBig,
  PanelLeft,
  RotateCcw,
  Search,
  Upload,
} from 'lucide-react';
import EpubViewer from './EpubViewerLazy';
import { ReaderShelfCard } from './ReaderShelfCard';
import { ReaderModalRoot } from './ReaderModalRoot';
import { ReaderWorkspaceSidebar, type ReaderShellNavLink } from './ReaderWorkspaceSidebar';
import { defaultReaderLink } from './default-reader-link';
import { readerChromeClasses as readerChrome } from './reader-chrome-theme';
import {
  applyShelfCatalogFilter,
  collectDistinctGenres,
  partitionShelfBooks,
} from './reader-shelf-catalog';
import { useReaderWorkspaceUiStore } from './reader-workspace-ui-store';
import {
  hasStoredReaderLocation,
  readStoredReaderProgress,
  resolveReaderShelfStatus,
} from './reader-progress';
import { readerAppHref } from './reader-routes';
import {
  getReaderBookStorageKey,
  resolveReaderWorkspaceState,
  type UploadedBookSource,
} from './reader-workspace-state';
import type {
  ReaderBookEntry,
  ReaderWorkspaceAccessState,
  ReaderWorkspaceLibraryRecord,
  ReaderWorkspaceSettingsState,
  ReaderWorkspaceUploadInput,
  ReaderLinkComponent,
} from './types';
import type { ReaderPersistenceAdapter } from './reader-persistence';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';

export type ReaderWorkspaceProps = {
  books: ReaderBookEntry[];
  initialBook?: ReaderBookEntry;
  initialAt?: string;
  initialCfi?: string;
  /** Mounted reader route path (default `/apps/reader`). */
  readerAppPath?: string;
  builtInEpubHref?: (slug: string) => string;
  ReaderLink?: ReaderLinkComponent;
  /**
   * Optional host modal: when set, `ReaderModalRoot` mounts and renders this for the current
   * `readerModalStore` payload. Omit to ship a reader with no in-workspace modal.
   */
  renderReaderModal?: (payload: unknown, onClose: () => void) => ReactNode;
  /** `aria-label` on the dialog shell when `renderReaderModal` is used. */
  readerModalAriaLabel?: string;
  /** Shown at the start of the reader toolbar (optional host chrome). */
  readerToolbarStart?: ReactNode;
  /** Optional links below Library when the host wants global nav in the rail (default: none). */
  readerShellNavLinks?: ReaderShellNavLink[];
  readerPersistenceAdapter?: ReaderPersistenceAdapter | null;
  workspaceAccess?: ReaderWorkspaceAccessState | null;
  workspaceSettings?: ReaderWorkspaceSettingsState | null;
  workspaceLibraryRecords?: ReaderWorkspaceLibraryRecord[];
  onSaveWorkspaceSettings?: (settings: ReaderWorkspaceSettingsState) => Promise<void>;
  onUploadImportedBook?: (input: ReaderWorkspaceUploadInput) => Promise<void>;
};

const DEFAULT_WORKSPACE_SETTINGS: ReaderWorkspaceSettingsState = {
  defaultWorkspaceView: 'library',
  preferPagedReader: true,
  showProgressBadges: true,
};

function slugifyFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function formatUploadedTitle(fileName: string) {
  const baseName = fileName.replace(/\.epub$/i, '').trim();
  const cleaned = baseName.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || 'Uploaded EPUB';
}

function shelfMatches(book: ReaderBookEntry, q: string) {
  if (!q) return true;
  const genreHay = (book.genres ?? []).join(' ');
  const hay =
    `${book.title} ${book.slug} ${book.author ?? ''} ${book.description ?? ''} ${genreHay}`.toLowerCase();
  return hay.includes(q);
}

type ReaderProgressMap = Record<string, number | null>;

function loadProgressMap(books: ReaderBookEntry[]): ReaderProgressMap {
  if (typeof window === 'undefined') return {};

  return books.reduce<ReaderProgressMap>((acc, entry) => {
    const storageKey = getReaderBookStorageKey(entry);
    acc[storageKey] = readStoredReaderProgress(storageKey);
    return acc;
  }, {});
}

function hasSavedLocation(storageKey: string) {
  return hasStoredReaderLocation(storageKey);
}

export default function ReaderWorkspace({
  books,
  initialBook,
  initialAt,
  initialCfi,
  readerAppPath = '/apps/reader',
  builtInEpubHref,
  ReaderLink = defaultReaderLink,
  renderReaderModal,
  readerModalAriaLabel,
  readerToolbarStart,
  readerShellNavLinks,
  readerPersistenceAdapter = null,
  workspaceAccess = null,
  workspaceSettings = null,
  workspaceLibraryRecords = [],
  onSaveWorkspaceSettings,
  onUploadImportedBook,
}: ReaderWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedBook, setUploadedBook] = useState<UploadedBookSource | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [progressByBook, setProgressByBook] = useState<ReaderProgressMap>({});
  const [shelfQuery, setShelfQuery] = useState('');
  const [libraryDragActive, setLibraryDragActive] = useState(false);
  const readerNavExpanded = useReaderWorkspaceUiStore((s) => s.readerNavExpanded);
  const toggleReaderNavExpanded = useReaderWorkspaceUiStore((s) => s.toggleReaderNavExpanded);
  const shelfCatalogFilter = useReaderWorkspaceUiStore((s) => s.shelfCatalogFilter);
  const setShelfCatalogFilter = useReaderWorkspaceUiStore((s) => s.setShelfCatalogFilter);
  const clampShelfFilterToGenres = useReaderWorkspaceUiStore((s) => s.clampShelfFilterToGenres);
  const [mobileReaderNavOpen, setMobileReaderNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<ReaderWorkspaceSettingsState>(
    workspaceSettings ?? DEFAULT_WORKSPACE_SETTINGS,
  );
  const [settingsSaveState, setSettingsSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [uploadDraft, setUploadDraft] = useState<{
    title: string;
    author: string;
    description: string;
    visibility: 'private' | 'public';
  }>({
    title: '',
    author: '',
    description: '',
    visibility: 'private',
  });
  const [uploadSaveState, setUploadSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [autoSelectedBook, setAutoSelectedBook] = useState<ReaderBookEntry | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!mobileReaderNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileReaderNavOpen]);

  useEffect(() => {
    setSettingsDraft(workspaceSettings ?? DEFAULT_WORKSPACE_SETTINGS);
  }, [workspaceSettings]);

  useEffect(() => {
    if (!uploadedBook) {
      setUploadPanelOpen(false);
      setUploadSaveState('idle');
      setUploadDraft({
        title: '',
        author: '',
        description: '',
        visibility: 'private',
      });
      return;
    }

    setUploadDraft((current) => ({
      ...current,
      title: current.title || uploadedBook.title,
    }));
  }, [uploadedBook]);

  const catalogGenres = useMemo(() => collectDistinctGenres(books), [books]);

  useEffect(() => {
    clampShelfFilterToGenres(catalogGenres);
  }, [catalogGenres, clampShelfFilterToGenres]);

  useEffect(() => {
    const sync = () => setProgressByBook(loadProgressMap(books));

    sync();
    window.addEventListener('focus', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', sync);
    };
  }, [books]);

  const workspaceOptions = useMemo(
    () => (builtInEpubHref ? { builtInEpubHref } : undefined),
    [builtInEpubHref],
  );

  const selectedInitialBook = uploadedBook ? initialBook : initialBook ?? autoSelectedBook ?? undefined;

  const workspaceState = useMemo(
    () => resolveReaderWorkspaceState({ initialBook: selectedInitialBook, uploadedBook }, workspaceOptions),
    [selectedInitialBook, uploadedBook, workspaceOptions],
  );
  const activeTitle = workspaceState.title;
  const activeKicker = workspaceState.kicker;
  const isLibraryView = workspaceState.mode === 'library';
  const downloadTargetBook = uploadedBook ? initialBook : selectedInitialBook;
  const downloadHref = downloadTargetBook?.hasEpub
    ? downloadTargetBook.sourceKind === 'uploaded'
      ? downloadTargetBook.remoteEpubUrl ?? null
      : builtInEpubHref?.(downloadTargetBook.slug) ?? `/books/${downloadTargetBook.slug}/book.epub`
    : null;
  const downloadName = downloadTargetBook
    ? `${slugifyFileName(downloadTargetBook.title || downloadTargetBook.slug) || 'book'}.epub`
    : null;
  const hasReturnTarget = Boolean(uploadedBook && selectedInitialBook);

  const deeplinkLocation = useMemo(() => {
    const cfi = initialCfi?.trim();
    if (cfi) return cfi;
    const at = initialAt?.trim();
    if (at) return at;
    return undefined;
  }, [initialAt, initialCfi]);

  const viewerSource = workspaceState.viewerSource;

  const builtInSourceBooks = useMemo(
    () => books.filter((entry) => entry.sourceKind !== 'uploaded'),
    [books],
  );
  const uploadedLibraryBooks = useMemo(
    () => books.filter((entry) => entry.sourceKind === 'uploaded'),
    [books],
  );
  const { builtIn: builtInBooks, queued: queuedBooks } = useMemo(
    () => partitionShelfBooks(builtInSourceBooks),
    [builtInSourceBooks],
  );

  const shelfGenreChips = useMemo(
    () => [{ id: 'all' as const, label: 'All' }, ...catalogGenres.map((g) => ({ id: g, label: g }))],
    [catalogGenres],
  );

  const { builtIn: typeBuiltIn, queued: typeQueued } = useMemo(
    () => applyShelfCatalogFilter(builtInBooks, queuedBooks, shelfCatalogFilter),
    [builtInBooks, queuedBooks, shelfCatalogFilter],
  );

  const shelfQ = shelfQuery.trim().toLowerCase();
  const filteredBuiltIn = useMemo(
    () => typeBuiltIn.filter((b) => shelfMatches(b, shelfQ)),
    [typeBuiltIn, shelfQ],
  );
  const filteredQueued = useMemo(
    () => typeQueued.filter((b) => shelfMatches(b, shelfQ)),
    [typeQueued, shelfQ],
  );
  const filteredUploaded = useMemo(
    () => uploadedLibraryBooks.filter((b) => shelfMatches(b, shelfQ)),
    [uploadedLibraryBooks, shelfQ],
  );
  const filteredShelfBooks = useMemo(
    () => [...filteredBuiltIn, ...filteredQueued],
    [filteredBuiltIn, filteredQueued],
  );

  useEffect(() => {
    if (uploadedBook || initialBook || settingsDraft.defaultWorkspaceView !== 'continue-reading') {
      setAutoSelectedBook(null);
      return;
    }

    const candidate =
      books.find((book) => {
        if (!book.hasEpub) return false;
        const storageKey = getReaderBookStorageKey(book);
        const progress = progressByBook[storageKey];
        return hasSavedLocation(storageKey) || (progress != null && progress > 0);
      }) ?? null;

    setAutoSelectedBook((current) => {
      if (
        current?.slug === candidate?.slug &&
        current?.recordId === candidate?.recordId
      ) {
        return current;
      }
      return candidate;
    });
  }, [books, initialBook, progressByBook, settingsDraft.defaultWorkspaceView, uploadedBook]);

  const t = readerChrome;
  const savedUploadCount = workspaceLibraryRecords.filter((record) => record.sourceKind === 'uploaded').length;
  const canSaveSettings = Boolean(workspaceAccess?.canEdit && onSaveWorkspaceSettings);
  const canUploadImportedBook = Boolean(uploadedBook && workspaceAccess?.canUpload && onUploadImportedBook);

  const ingestEpubFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.epub')) {
      setUploadError('Select an `.epub` file.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const buffer = await file.arrayBuffer();
      const storageKey = `uploaded-epub-${slugifyFileName(file.name) || 'book'}`;
      setUploadedBook({
        buffer,
        fileName: file.name,
        storageKey,
        title: formatUploadedTitle(file.name),
      });
    } catch {
      setUploadError('That EPUB could not be opened.');
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await ingestEpubFile(file);
  };

  const onLibraryDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      setLibraryDragActive(true);
    }
  };

  const onLibraryDragLeave = (e: DragEvent) => {
    e.preventDefault();
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) {
      setLibraryDragActive(false);
    }
  };

  const onLibraryDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLibraryDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await ingestEpubFile(file);
  };

  const handleSaveWorkspaceSettings = async () => {
    if (!onSaveWorkspaceSettings) return;

    setSettingsSaveState('saving');
    try {
      await onSaveWorkspaceSettings(settingsDraft);
      setSettingsSaveState('saved');
    } catch {
      setSettingsSaveState('error');
    }
  };

  const handleUploadImportedBook = async () => {
    if (!onUploadImportedBook || !uploadedBook) return;

    setUploadSaveState('saving');
    setUploadFeedback(null);

    try {
      const file = new File([uploadedBook.buffer], uploadedBook.fileName, {
        type: 'application/epub+zip',
      });
      await onUploadImportedBook({
        file,
        title: uploadDraft.title.trim() || uploadedBook.title,
        author: uploadDraft.author.trim() || null,
        description: uploadDraft.description.trim() || null,
        visibility: uploadDraft.visibility,
      });
      setUploadSaveState('saved');
      setUploadPanelOpen(false);
      setUploadFeedback('Saved to the backend library. This local reading session stays open.');
    } catch {
      setUploadSaveState('error');
      setUploadFeedback('That EPUB could not be uploaded right now.');
    }
  };

  const Link = ReaderLink;

  const catalogTotal = builtInBooks.length + uploadedLibraryBooks.length + queuedBooks.length;
  const emptyShelfMessage =
    catalogTotal === 0
      ? 'No books in the catalog yet.'
      : shelfQ || shelfCatalogFilter !== 'all'
        ? 'No books match this filter or search.'
        : 'No books match your search.';

  return (
    <div data-reader-workspace className={`flex h-full min-h-0 flex-col ${t.shell}`}>
      <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
        <ReaderWorkspaceSidebar
          readerAppPath={readerAppPath}
          isLibraryView={isLibraryView}
          activeTitle={activeTitle}
          ReaderLink={ReaderLink}
          expanded={readerNavExpanded}
          onToggleExpanded={toggleReaderNavExpanded}
          extraLinks={readerShellNavLinks}
          showHeaderCollapse
          mobileNavOpen={mobileReaderNavOpen}
          onCloseMobileNav={() => setMobileReaderNavOpen(false)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className={`shrink-0 border-b ${t.headerBar}`}>
            <div className="mx-auto flex max-w-[120rem] flex-wrap items-end justify-between gap-x-3 gap-y-2 px-4 pb-0 pt-2.5 md:px-5">
              <div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-3 gap-y-2">
                <div className="flex min-w-0 items-center gap-2.5 pb-2">
                  <Button
                    type="button"
                    onClick={() => setMobileReaderNavOpen(true)}
                    variant="outline"
                    size="sm"
                    className={`md:hidden shrink-0 rounded-full ${t.pillButton}`}
                    aria-label="Open reader shelf"
                    title="Reader shelf"
                  >
                    <PanelLeft size={15} aria-hidden />
                  </Button>
                  {readerToolbarStart ? (
                    <span className="flex shrink-0 items-center pb-0.5">{readerToolbarStart}</span>
                  ) : null}
                  {!isLibraryView ? (
                    <Link
                      href={readerAppHref(readerAppPath)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${t.pillButton}`}
                    >
                      <ArrowLeft size={15} />
                      Library
                    </Link>
                  ) : null}
                  <div className="min-w-0">
                    <p className="section-kicker">{activeKicker}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      {isLibraryView ? (
                        <LibraryBig size={16} className={`shrink-0 ${t.iconAccent}`} />
                      ) : (
                        <BookOpen size={16} className={`shrink-0 ${t.iconAccent}`} />
                      )}
                      <h1
                        className={`truncate font-display text-[1.8rem] leading-none md:text-[2rem] ${t.title}`}
                      >
                        {activeTitle}
                      </h1>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".epub,application/epub+zip"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  onClick={handleOpenFilePicker}
                  disabled={isUploading}
                  variant="outline"
                  size="sm"
                  className={`rounded-full ${t.pillButton}`}
                >
                  <Upload size={15} aria-hidden />
                  {isUploading ? 'Importing…' : 'Import EPUB'}
                </Button>
                {canSaveSettings ? (
                  <Button
                    type="button"
                    onClick={() => setSettingsOpen((value) => !value)}
                    variant="outline"
                    size="sm"
                    className={`rounded-full ${t.pillButton}`}
                  >
                    {settingsOpen ? 'Close settings' : 'Workspace settings'}
                  </Button>
                ) : null}
                {canUploadImportedBook ? (
                  <Button
                    type="button"
                    onClick={() => setUploadPanelOpen((value) => !value)}
                    variant="outline"
                    size="sm"
                    className={`rounded-full ${t.pillButton}`}
                  >
                    {uploadPanelOpen ? 'Close upload' : 'Upload to library'}
                  </Button>
                ) : null}
                {hasReturnTarget ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setUploadedBook(null);
                      setUploadError(null);
                    }}
                    variant="outline"
                    size="sm"
                    className={`rounded-full ${t.pillButton}`}
                  >
                    <RotateCcw size={15} />
                    Return to Library Book
                  </Button>
                ) : null}
                {!uploadedBook && downloadHref ? (
                  <a
                    href={downloadHref ?? undefined}
                    download={downloadName ?? undefined}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${t.pillButton}`}
                  >
                    <Download size={15} />
                    Download EPUB
                  </a>
                ) : null}
              </div>
            </div>
            {uploadError ? (
              <div className="mx-auto max-w-[120rem] px-4 pb-2 md:px-5">
                <p className="text-sm text-destructive">{uploadError}</p>
              </div>
            ) : null}
            {workspaceState.mode === 'local-reading' && workspaceState.localFileName ? (
              <div className="mx-auto max-w-[120rem] px-4 pb-2 md:px-5">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Reading local file: {workspaceState.localFileName}
                </p>
              </div>
            ) : null}
            {isLibraryView ? (
              <div className="mx-auto max-w-[120rem] px-4 pb-2 md:px-5">
                <p className="text-xs text-muted-foreground">
                  Imported EPUBs stay local in this browser until you explicitly upload them.
                </p>
              </div>
            ) : null}
            {workspaceAccess?.authenticated ? (
              <div className="mx-auto flex max-w-[120rem] items-center gap-2 px-4 pb-2 text-xs text-muted-foreground md:px-5">
                <Badge variant="outline" className="border-border bg-muted/50 text-[0.66rem] uppercase tracking-[0.14em]">
                  Owner workspace
                </Badge>
                <span>
                  {workspaceAccess.autoLoggedIn ? 'Auto-login' : 'Session'} active. {savedUploadCount} saved upload
                  {savedUploadCount === 1 ? '' : 's'} in the backend library.
                </span>
              </div>
            ) : null}
            {settingsOpen && canSaveSettings ? (
              <div className="mx-auto max-w-[120rem] px-4 pb-3 md:px-5">
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="section-kicker">Workspace settings</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        These settings save only for entitled owner sessions. Public readers stay on the local defaults.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleSaveWorkspaceSettings()}
                      disabled={settingsSaveState === 'saving'}
                      variant="outline"
                      size="sm"
                      className={`rounded-full ${t.pillButton}`}
                    >
                      {settingsSaveState === 'saving' ? 'Saving…' : 'Save settings'}
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-foreground">Default workspace view</span>
                      <Select
                        value={settingsDraft.defaultWorkspaceView}
                        onChange={(event) =>
                          setSettingsDraft((current) => ({
                            ...current,
                            defaultWorkspaceView:
                              event.target.value === 'continue-reading' ? 'continue-reading' : 'library',
                          }))
                        }
                      >
                        <option value="library">Library</option>
                        <option value="continue-reading">Continue reading</option>
                      </Select>
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                      <Checkbox
                        checked={settingsDraft.preferPagedReader}
                        onChange={(event) =>
                          setSettingsDraft((current) => ({
                            ...current,
                            preferPagedReader: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        <span className="block font-medium text-foreground">Prefer paged reader</span>
                        <span className="text-muted-foreground">
                          Use the book-like spread layout when the viewport allows it.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                      <Checkbox
                        checked={settingsDraft.showProgressBadges}
                        onChange={(event) =>
                          setSettingsDraft((current) => ({
                            ...current,
                            showProgressBadges: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        <span className="block font-medium text-foreground">Show progress badges</span>
                        <span className="text-muted-foreground">
                          Keep shelf progress and status chips visible in the library.
                        </span>
                      </span>
                    </label>
                  </div>
                  {settingsSaveState === 'saved' ? (
                    <p className="mt-3 text-xs text-emerald-300">Workspace settings saved.</p>
                  ) : null}
                  {settingsSaveState === 'error' ? (
                    <p className="mt-3 text-xs text-destructive">Workspace settings could not be saved.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
            {uploadPanelOpen && uploadedBook && canUploadImportedBook ? (
              <div className="mx-auto max-w-[120rem] px-4 pb-3 md:px-5">
                <div className="rounded-2xl border border-border bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="section-kicker">Explicit upload</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        This creates a backend library record. Importing alone does not upload anything.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => void handleUploadImportedBook()}
                      disabled={uploadSaveState === 'saving'}
                      variant="outline"
                      size="sm"
                      className={`rounded-full ${t.pillButton}`}
                    >
                      {uploadSaveState === 'saving' ? 'Uploading…' : 'Upload EPUB'}
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-foreground">Title</span>
                      <Input
                        value={uploadDraft.title}
                        onChange={(event) =>
                          setUploadDraft((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Uploaded EPUB"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-foreground">Author</span>
                      <Input
                        value={uploadDraft.author}
                        onChange={(event) =>
                          setUploadDraft((current) => ({
                            ...current,
                            author: event.target.value,
                          }))
                        }
                        placeholder="Author"
                      />
                    </label>
                    <label className="space-y-1 text-sm md:col-span-2">
                      <span className="font-medium text-foreground">Description</span>
                      <Textarea
                        value={uploadDraft.description}
                        onChange={(event) =>
                          setUploadDraft((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        rows={3}
                        placeholder="Private workspace upload"
                      />
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-foreground">Visibility</span>
                      <Select
                        value={uploadDraft.visibility}
                        onChange={(event) =>
                          setUploadDraft((current) => ({
                            ...current,
                            visibility: event.target.value === 'public' ? 'public' : 'private',
                          }))
                        }
                      >
                        <option value="private">Private</option>
                        <option value="public">Public</option>
                      </Select>
                    </label>
                  </div>
                </div>
              </div>
            ) : null}
            {uploadFeedback ? (
              <div className="mx-auto max-w-[120rem] px-4 pb-3 md:px-5">
                <p className={`text-xs ${uploadSaveState === 'error' ? 'text-destructive' : 'text-emerald-300'}`}>
                  {uploadFeedback}
                </p>
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 px-3 pb-3 pt-3 md:px-4 md:pb-4">
            <div className={`mx-auto h-full max-w-[120rem] overflow-hidden rounded-[2rem] border ${t.inset}`}>
              {viewerSource ? (
                <EpubViewer
                  key={deeplinkLocation ? `dl:${deeplinkLocation}` : `sk:${viewerSource.storageKey}`}
                  epubUrl={viewerSource.kind === 'built-in' ? viewerSource.epubUrl : undefined}
                  epubData={viewerSource.kind === 'local' ? viewerSource.epubData : undefined}
                  storageKey={viewerSource.storageKey}
                  bookSlug={workspaceState.bookSlug}
                  sourceKind={selectedInitialBook?.sourceKind === 'uploaded' ? 'uploaded' : viewerSource.kind}
                  persistenceAdapter={
                    viewerSource.kind === 'built-in' && selectedInitialBook?.sourceKind !== 'uploaded'
                      ? readerPersistenceAdapter
                      : null
                  }
                  preferPagedReader={settingsDraft.preferPagedReader}
                  initialLocation={deeplinkLocation}
                  className="h-full"
                  layoutMode="reader"
                />
              ) : (
                <div
                  className={`h-full overflow-auto px-5 py-6 transition-shadow md:px-7 md:py-8 ${libraryDragActive ? `ring-2 ring-inset ${t.libraryDragRing}` : ''
                    }`}
                  onDragOver={onLibraryDragOver}
                  onDragLeave={onLibraryDragLeave}
                  onDrop={onLibraryDrop}
                >
                  <div className="mx-auto max-w-[112rem] space-y-6">

                    <section className="space-y-4">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                        <div className="relative">
                          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            className="bg-background pl-9"
                            id="search-input"
                            placeholder="Search the reader shelf"
                            type="text"
                            role="searchbox"
                            value={shelfQuery}
                            onChange={(e) => setShelfQuery(e.target.value)}
                          />
                        </div>
                      </div>

                      <div
                        className="flex flex-wrap gap-2"
                        role="group"
                        aria-label="Filter catalog by genre"
                      >
                        {shelfGenreChips.map((f) => {
                          const active = shelfCatalogFilter === f.id;
                          const isAll = f.id === 'all';
                          return (
                            <Button
                              key={f.id}
                              type="button"
                              onClick={() => setShelfCatalogFilter(f.id)}
                              variant="outline"
                              size="sm"
                              className={`rounded-full text-xs ${isAll ? 'uppercase tracking-[0.14em]' : 'tracking-normal'} ${active ? t.chipActive : t.chip}`}
                              aria-pressed={active}
                            >
                              {f.label}
                            </Button>
                          );
                        })}
                      </div>

                      {filteredShelfBooks.length === 0 && filteredUploaded.length === 0 ? (
                        <Card className={`rounded-2xl border-dashed ${t.emptyState}`}>
                          <CardContent className="px-4 py-8 text-center text-sm">{emptyShelfMessage}</CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-6">
                          {filteredShelfBooks.length > 0 ? (
                            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                              {filteredShelfBooks.map((book) => {
                                const storageKey = getReaderBookStorageKey(book);
                                const storedProgress = progressByBook[storageKey] ?? null;
                                const status = resolveReaderShelfStatus(book.hasEpub, storedProgress);
                                const isActive =
                                  book.hasEpub &&
                                  ((selectedInitialBook?.slug === book.slug &&
                                    selectedInitialBook?.recordId === book.recordId) ||
                                    hasSavedLocation(storageKey));

                                return (
                                  <ReaderShelfCard
                                    key={book.recordId ?? book.slug}
                                    book={book}
                                    status={status}
                                    isActive={isActive}
                                    readerHref={readerAppHref(readerAppPath, {
                                      book: book.slug,
                                    })}
                                    ReaderLink={ReaderLink}
                                    showStatusBadge={settingsDraft.showProgressBadges}
                                  />
                                );
                              })}
                            </div>
                          ) : null}
                          {filteredUploaded.length > 0 ? (
                            <section className="space-y-3">
                              <div className="flex flex-wrap items-end justify-between gap-3">
                                <div>
                                  <p className="section-kicker">Backend library</p>
                                  <h3 className="mt-2 font-display text-[1.7rem] leading-none text-foreground">
                                    Saved uploads
                                  </h3>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Owner-only uploads stored in the backend and reopened from the reader workspace.
                                </p>
                              </div>
                              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredUploaded.map((book) => {
                                  const storageKey = getReaderBookStorageKey(book);
                                  const storedProgress = progressByBook[storageKey] ?? null;
                                  const status = resolveReaderShelfStatus(book.hasEpub, storedProgress);
                                  const isActive = hasSavedLocation(storageKey);

                                  return (
                                    <ReaderShelfCard
                                      key={book.recordId ?? book.slug}
                                      book={book}
                                      status={status}
                                      isActive={isActive}
                                      readerHref={readerAppHref(readerAppPath, {
                                        record: book.recordId ?? book.slug,
                                      })}
                                      ReaderLink={ReaderLink}
                                      showStatusBadge={settingsDraft.showProgressBadges}
                                    />
                                  );
                                })}
                              </div>
                            </section>
                          ) : null}
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {renderReaderModal ? (
        <ReaderModalRoot renderContent={renderReaderModal} ariaLabel={readerModalAriaLabel} />
      ) : null}
    </div>
  );
}
