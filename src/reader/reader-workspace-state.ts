import type { ReaderBookEntry } from './types';

export interface UploadedBookSource {
  buffer: ArrayBuffer;
  fileName: string;
  storageKey: string;
  title: string;
}

type ReaderWorkspaceViewerSource =
  | {
      kind: 'built-in';
      epubUrl: string;
      storageKey: string;
    }
  | {
      kind: 'local';
      epubData: ArrayBuffer;
      storageKey: string;
    };

type ReaderWorkspaceLibraryState = {
  mode: 'library';
  title: 'Reader library';
  kicker: 'Built-in shelf';
  bookSlug: null;
  canDownload: false;
  viewerSource: null;
  localFileName: null;
};

type ReaderWorkspaceBuiltInReadingState = {
  mode: 'built-in-reading';
  title: string;
  kicker: 'Built-in reading' | 'Saved upload';
  bookSlug: string;
  canDownload: true;
  viewerSource: ReaderWorkspaceViewerSource & { kind: 'built-in' };
  localFileName: null;
};

type ReaderWorkspaceLocalReadingState = {
  mode: 'local-reading';
  title: string;
  kicker: 'Local EPUB';
  bookSlug: string | null;
  canDownload: boolean;
  viewerSource: ReaderWorkspaceViewerSource & { kind: 'local' };
  localFileName: string;
};

export type ReaderWorkspaceState =
  | ReaderWorkspaceLibraryState
  | ReaderWorkspaceBuiltInReadingState
  | ReaderWorkspaceLocalReadingState;

export type ResolveReaderWorkspaceOptions = {
  builtInEpubHref?: (slug: string) => string;
};

export function getReaderBookStorageKey(
  book: Pick<ReaderBookEntry, 'slug' | 'sourceKind' | 'recordId'>,
) {
  return book.sourceKind === 'uploaded'
    ? `uploaded-record:${book.recordId ?? book.slug}`
    : book.slug;
}

export function resolveReaderWorkspaceState(
  {
    initialBook,
    uploadedBook,
  }: {
    initialBook?: ReaderBookEntry;
    uploadedBook?: UploadedBookSource | null;
  },
  options?: ResolveReaderWorkspaceOptions,
): ReaderWorkspaceState {
  const builtInEpubHref = options?.builtInEpubHref ?? ((slug: string) => `/books/${slug}/book.epub`);

  if (uploadedBook) {
    return {
      mode: 'local-reading',
      title: uploadedBook.title,
      kicker: 'Local EPUB',
      bookSlug: initialBook?.slug ?? null,
      canDownload: Boolean(initialBook?.hasEpub),
      localFileName: uploadedBook.fileName,
      viewerSource: {
        kind: 'local',
        epubData: uploadedBook.buffer,
        storageKey: uploadedBook.storageKey,
      },
    };
  }

  if (initialBook?.hasEpub) {
    const sourceKind = initialBook.sourceKind === 'uploaded' ? 'uploaded' : 'built-in';
    const epubUrl =
      sourceKind === 'uploaded' && initialBook.remoteEpubUrl
        ? initialBook.remoteEpubUrl
        : builtInEpubHref(initialBook.slug);

    return {
      mode: 'built-in-reading',
      title: initialBook.title,
      kicker: sourceKind === 'uploaded' ? 'Saved upload' : 'Built-in reading',
      bookSlug: initialBook.slug,
      canDownload: true,
      localFileName: null,
      viewerSource: {
        kind: 'built-in',
        epubUrl,
        storageKey: getReaderBookStorageKey(initialBook),
      },
    };
  }

  return {
    mode: 'library',
    title: 'Reader library',
    kicker: 'Built-in shelf',
    bookSlug: null,
    canDownload: false,
    viewerSource: null,
    localFileName: null,
  };
}
