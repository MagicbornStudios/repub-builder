'use client';

import React, { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Highlighter,
  LoaderCircle,
  Menu,
  StickyNote,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ReactReader, ReactReaderStyle } from 'react-reader';
import {
  annotationsToExportPayload,
  embedAnnotationsInEpub,
  loadEmbeddedAnnotationsFromEpub,
  loadAnnotationsFromIndexedDb,
  parseAnnotationsFile,
  saveAnnotationsToIndexedDb,
  serializeAnnotationsExport,
  sha256Hex,
  type PortfolioAnnotation,
} from './epub-annotations';
import {
  readStoredReaderProgress,
  persistStoredReaderProgress,
  readStoredReaderLocation,
  persistStoredReaderLocation,
  hasStoredReaderLocation,
} from './reader-progress';
import {
  mergePersistedAnnotations,
  type ReaderPersistenceAdapter,
} from './reader-persistence';
import { unknownErrorMessage } from '../utils/unknown-error';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
const READER_HEADER_H = 52;
const READER_SPREAD_MIN_WIDTH = 1050;
const LOCATION_GENERATION_CHARS = 1200;
const TOC_PANEL_TRANSITION = {
  duration: 0.24,
  ease: [0.22, 1, 0.36, 1] as const,
};

const EPUB_HIGHLIGHT_STYLES: Record<string, string> = {
  fill: 'rgba(213, 176, 131, 0.38)',
  'mix-blend-mode': 'multiply',
};

interface ReaderNavItem {
  label: string;
  href: string;
  subitems?: ReaderNavItem[];
}

interface ReaderLocation {
  start?: {
    href?: string;
    cfi?: string;
    displayed?: {
      page: number;
      total: number;
    };
  };
}

interface EpubAnnotationsApi {
  highlight: (
    cfiRange: string,
    data: Record<string, unknown>,
    cb?: () => void,
    className?: string,
    styles?: Record<string, string>
  ) => unknown;
  remove: (cfiRange: string, type: string) => void;
}

interface ReaderRendition {
  annotations?: EpubAnnotationsApi;
  book: {
    ready: Promise<void>;
    loaded: {
      navigation: Promise<{
        toc: ReaderNavItem[];
      }>;
    };
    locations: {
      generate: (chars: number) => Promise<Array<string>>;
      length: () => number;
      percentageFromCfi: (cfi: string) => number;
      cfiFromPercentage: (percentage: number) => string;
    };
  };
  flow: (mode: string) => void;
  spread: (mode: string, min?: number) => void;
  themes: {
    register: (name: string, rules: Record<string, Record<string, string>>) => void;
    select: (name: string) => void;
    fontSize: (value: string) => void;
  };
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  off: (event: string, listener: (...args: unknown[]) => void) => void;
  prev: () => Promise<void>;
  next: () => Promise<void>;
}

export interface EpubViewerProps {
  epubUrl?: string;
  epubData?: ArrayBuffer | null;
  title?: string;
  /** Key for persisting location (e.g. book slug). If set, location is saved via reader reading store. */
  storageKey?: string;
  /**
   * When set, opens here first instead of restoring persisted location (EPUB internal `href` path or CFI string).
   */
  initialLocation?: string | number;
  className?: string;
  layoutMode?: 'compact' | 'reader';
  bookSlug?: string | null;
  sourceKind?: 'built-in' | 'uploaded' | 'local';
  /** Highlights and notes (reader layout only by default). */
  annotationsEnabled?: boolean;
  /** Fires when EPUB bytes are ready (fetched URL or `epubData`). */
  onEpubLoaded?: (info: { buffer: ArrayBuffer; storageKey?: string }) => void;
  persistenceAdapter?: ReaderPersistenceAdapter | null;
  preferPagedReader?: boolean;
}

const READER_THEME_RULES = {
  'html, body': {
    background: '#f6efe3',
    color: '#22160f',
    margin: '0',
    padding: '0',
  },
  body: {
    'font-family': '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
    'font-size': '0.84rem',
    'line-height': '1.46',
    padding: '0',
  },
  p: {
    margin: '0 0 0.58rem',
  },
  'h1, h2, h3, h4': {
    color: '#1d120d',
    'font-family': '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
    'font-weight': '700',
    'letter-spacing': '-0.02em',
    'line-height': '1.12',
    margin: '0 0 0.9rem',
  },
  h1: {
    'font-size': '2rem',
  },
  h2: {
    'font-size': '1.9rem',
  },
  a: {
    color: '#7b4f27',
    'text-decoration': 'none',
  },
  img: {
    'border-radius': '1rem',
    'box-shadow': '0 24px 50px rgba(43, 27, 16, 0.2)',
    display: 'block',
    margin: '0.6rem auto',
    'max-width': '100%',
  },
  '.reader-page': {
    'box-sizing': 'border-box',
    display: 'flex',
    'flex-direction': 'column',
    'min-height': '100%',
    padding: '0.88rem 1.18rem 0.78rem',
  },
  '.reader-page__header': {
    margin: '0 0 0.4rem',
  },
  '.reader-page__running-head': {
    color: '#836142',
    'font-family': 'var(--font-sans)',
    'font-size': '0.62rem',
    'font-weight': '700',
    'letter-spacing': '0.2em',
    margin: '0',
    'text-transform': 'uppercase',
  },
  '.reader-page__chapter': {
    color: '#836142',
    'font-family': 'var(--font-sans)',
    'font-size': '0.68rem',
    'font-weight': '700',
    'letter-spacing': '0.22em',
    margin: '0 0 0.38rem',
    'text-transform': 'uppercase',
  },
  '.reader-page__title': {
    color: '#1b120d',
    'font-size': '1.3rem',
    'line-height': '1.02',
    margin: '0',
  },
  '.reader-page__figure': {
    margin: '0.24rem 0 0.56rem',
    'page-break-inside': 'avoid',
    'break-inside': 'avoid',
  },
  '.reader-page__figure-frame': {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    'min-height': '7.6rem',
    height: '7.6rem',
    padding: '0.42rem',
    'box-sizing': 'border-box',
    overflow: 'hidden',
    border: '1px solid rgba(102, 69, 36, 0.12)',
    'border-radius': '0.7rem',
    background:
      'linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(232, 219, 198, 0.62)), #efe1cb',
    'box-shadow': '0 12px 24px rgba(32, 18, 8, 0.12)',
  },
  '.reader-page__figure img': {
    'border-radius': '0.58rem',
    'box-shadow': 'none',
    margin: '0 auto',
    height: '100%',
    'object-fit': 'cover',
    'object-position': 'center',
    width: '100%',
  },
  '.reader-page__figure--placeholder .reader-page__figure-frame': {
    'border-style': 'dashed',
  },
  '.reader-page__placeholder': {
    display: 'flex',
    'align-items': 'center',
    'justify-content': 'center',
    'min-height': '6.8rem',
    width: '100%',
    'border-radius': '0.58rem',
    background:
      'radial-gradient(circle at top, rgba(140, 102, 67, 0.14), transparent 58%), linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(216, 196, 166, 0.34))',
    color: '#8b6a4a',
    'font-family': 'var(--font-sans)',
    'font-size': '0.62rem',
    'font-weight': '700',
    'letter-spacing': '0.16em',
    'text-align': 'center',
    'text-transform': 'uppercase',
  },
  '.reader-page__body': {
    flex: '1 1 auto',
  },
  '.reader-page__body p': {
    margin: '0 0 0.58rem',
    'line-height': '1.46',
  },
  '.reader-page__footer': {
    'border-top': '1px solid rgba(94, 67, 41, 0.16)',
    'margin-top': 'auto',
    'padding-top': '0.45rem',
    'text-align': 'center',
  },
  '.reader-page__folio': {
    color: '#836142',
    'font-family': 'var(--font-sans)',
    'font-size': '0.68rem',
    'letter-spacing': '0.18em',
  },
  '.h1, nav h1, h1.h1': {
    color: '#1d120d',
    'font-size': '2.1rem',
    'line-height': '1.08',
    margin: '0 0 1.2rem',
  },
  'nav, nav[epub\\:type~="toc"]': {
    background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(245,236,221,0.95))',
    border: '1px solid rgba(102, 69, 36, 0.18)',
    'border-radius': '1.6rem',
    'box-shadow': '0 18px 40px rgba(43, 27, 16, 0.08)',
    padding: '2.25rem 2.4rem',
  },
  'nav ol': {
    margin: '1.35rem 0 0',
    padding: '0 0 0 1.4rem',
  },
  'nav li': {
    'border-bottom': '1px solid rgba(102, 69, 36, 0.12)',
    margin: '0',
    padding: '0.55rem 0',
  },
  'nav li:last-child': {
    'border-bottom': 'none',
  },
  'nav a, nav a:visited': {
    color: '#2a1710',
    'font-size': '1rem',
    'font-weight': '600',
  },
};

function createReaderStyles({
  headerOffset,
  layoutMode,
}: {
  headerOffset: number;
  layoutMode: 'compact' | 'reader';
}) {
  const isReaderMode = layoutMode === 'reader';
  const tocWidth = isReaderMode ? 360 : 296;

  return {
    ...ReactReaderStyle,
    container: {
      ...ReactReaderStyle.container,
      background: isReaderMode
        ? 'radial-gradient(circle at top, rgba(117,78,38,0.18), transparent 34%), #120d0a'
        : 'var(--color-dark, #151515)',
    },
    readerArea: {
      ...ReactReaderStyle.readerArea,
      background: isReaderMode
        ? 'linear-gradient(180deg, rgba(23,17,13,0.96), rgba(18,13,10,0.98))'
        : 'var(--color-dark-alt, #1a1a1a)',
    },
    titleArea: {
      ...ReactReaderStyle.titleArea,
      display: 'none',
    },
    reader: {
      ...ReactReaderStyle.reader,
      top: headerOffset,
      left: isReaderMode ? 24 : 24,
      right: isReaderMode ? 24 : 24,
      /** Bottom chrome is laid out in-flow below the iframe (not absolutely positioned). */
      bottom: isReaderMode ? 24 : 24,
      maxWidth: isReaderMode ? '88rem' : '48rem',
      marginLeft: 'auto',
      marginRight: 'auto',
      width: '100%',
    },
    arrow: {
      ...ReactReaderStyle.arrow,
      color: 'rgba(227, 211, 187, 0.72)',
      fontSize: isReaderMode ? 56 : 48,
      textShadow: isReaderMode ? '0 10px 30px rgba(0, 0, 0, 0.45)' : undefined,
    },
    arrowHover: {
      ...ReactReaderStyle.arrowHover,
      color: '#fff4e6',
    },
    prev: {
      ...ReactReaderStyle.prev,
      display: isReaderMode ? 'none' : ReactReaderStyle.prev.display,
    },
    next: {
      ...ReactReaderStyle.next,
      display: isReaderMode ? 'none' : ReactReaderStyle.next.display,
    },
    tocArea: {
      ...ReactReaderStyle.tocArea,
      background: isReaderMode
        ? 'linear-gradient(180deg, rgba(28,20,15,0.98), rgba(16,11,8,0.98))'
        : 'var(--color-dark-elevated, #1f1f1f)',
      borderRight: '1px solid rgba(140, 102, 67, 0.18)',
      boxShadow: isReaderMode ? '18px 0 50px rgba(0,0,0,0.32)' : undefined,
      padding: isReaderMode ? '1.25rem 1rem' : '1rem 0',
      width: tocWidth,
    },
    toc: {
      ...ReactReaderStyle.toc,
      padding: 0,
      fontFamily: 'var(--font-sans)',
    },
    tocAreaButton: {
      ...ReactReaderStyle.tocAreaButton,
      fontFamily: 'var(--font-sans)',
      fontSize: isReaderMode ? '0.95rem' : '0.9375rem',
      lineHeight: 1.45,
      marginBottom: isReaderMode ? '0.45rem' : undefined,
      border: isReaderMode ? '1px solid rgba(140, 102, 67, 0.12)' : undefined,
      borderBottom: isReaderMode ? undefined : '1px solid var(--color-border, #252525)',
      borderRadius: isReaderMode ? '1rem' : undefined,
      background: isReaderMode ? 'rgba(255,255,255,0.02)' : undefined,
      padding: isReaderMode ? '0.9rem 1rem' : '0.75rem 1.25rem',
      color: 'var(--color-text, #e5e7eb)',
      textAlign: 'left' as const,
      transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
    },
    tocButton: {
      ...ReactReaderStyle.tocButton,
      background: isReaderMode
        ? 'rgba(18, 13, 10, 0.92)'
        : 'var(--color-dark-elevated, #1f1f1f)',
      border: '1px solid rgba(140, 102, 67, 0.22)',
      borderRadius: isReaderMode ? '999px' : undefined,
      color: 'var(--color-text, #e5e7eb)',
      boxShadow: isReaderMode ? '0 14px 30px rgba(0,0,0,0.22)' : undefined,
    },
    tocButtonExpanded: {
      ...ReactReaderStyle.tocButtonExpanded,
      background: isReaderMode ? 'rgba(49, 32, 19, 0.96)' : 'var(--color-dark-elevated, #1f1f1f)',
    },
    tocButtonBar: {
      ...ReactReaderStyle.tocButtonBar,
      background: '#d5b083',
    },
    containerExpanded: {
      ...ReactReaderStyle.containerExpanded,
      transform: `translateX(${tocWidth}px)`,
    },
    tocBackground: {
      ...ReactReaderStyle.tocBackground,
      left: tocWidth,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: isReaderMode ? 'blur(6px)' : undefined,
    },
    loadingView: {
      ...ReactReaderStyle.loadingView,
      color: 'var(--color-text-muted, #94a3b8)',
    },
    errorView: {
      ...ReactReaderStyle.errorView,
      color: 'var(--color-accent, #d5b083)',
    },
  };
}

function flattenToc(items: ReaderNavItem[]): ReaderNavItem[] {
  return items.flatMap((item) => [item, ...(item.subitems ? flattenToc(item.subitems) : [])]);
}

function normalizeHref(href?: string) {
  return (href || '').split('#')[0].replace(/^\/+/, '');
}

function resolveSectionLabel(toc: ReaderNavItem[], href?: string) {
  const currentHref = normalizeHref(href);
  if (!currentHref) return '';

  const flattened = flattenToc(toc);
  const exactMatch = flattened.find((item) => normalizeHref(item.href) === currentHref);
  if (exactMatch) return exactMatch.label;

  const endMatch = flattened.find((item) => {
    const itemHref = normalizeHref(item.href);
    return itemHref && (currentHref.endsWith(itemHref) || itemHref.endsWith(currentHref));
  });
  if (endMatch) return endMatch.label;

  const prefixMatch = flattened.find((item) => {
    const itemHref = normalizeHref(item.href);
    return itemHref && currentHref.startsWith(itemHref);
  });

  return prefixMatch?.label ?? '';
}

function createEpubViewStyles(layoutMode: 'compact' | 'reader') {
  return {
    viewHolder: {
      position: 'relative' as const,
      height: '100%',
      width: '100%',
    },
    view: {
      height: '100%',
      background: layoutMode === 'reader' ? '#f4ecdf' : '#fafafa',
      color: '#1a1a1a',
      borderRadius: layoutMode === 'reader' ? '1.4rem' : undefined,
      boxShadow:
        layoutMode === 'reader' ? '0 24px 70px rgba(11, 6, 3, 0.38)' : undefined,
    },
  };
}

function renderTocTree(
  items: ReaderNavItem[],
  onSelect: (href?: string) => void,
  depth = 0
): ReactNode {
  return items.map((item) => {
    const href = item.href || '';

    return (
      <div key={`${depth}-${href}-${item.label}`} className="space-y-1">
        <Button
          type="button"
          onClick={() => onSelect(href)}
          variant="ghost"
          className="block h-auto min-w-0 w-full justify-start whitespace-normal break-words rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted/60 hover:text-foreground"
          style={{ paddingLeft: `${0.75 + depth * 0.9}rem` }}
        >
          {item.label}
        </Button>
        {item.subitems?.length ? renderTocTree(item.subitems, onSelect, depth + 1) : null}
      </div>
    );
  });
}

export default function EpubViewer({
  epubUrl,
  epubData,
  title,
  storageKey,
  initialLocation,
  className = '',
  layoutMode = 'compact',
  bookSlug = null,
  sourceKind = 'built-in',
  annotationsEnabled = layoutMode === 'reader',
  onEpubLoaded,
  persistenceAdapter = null,
  preferPagedReader = true,
}: EpubViewerProps) {
  const readerMinHeightClass =
    layoutMode === 'reader' ? 'min-h-[clamp(520px,78vh,980px)]' : 'min-h-[400px]';
  const [location, setLocation] = useState<string | number>(0);
  const [epubBuffer, setEpubBuffer] = useState<ArrayBuffer | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tocItems, setTocItems] = useState<ReaderNavItem[]>([]);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [currentSectionLabel, setCurrentSectionLabel] = useState('');
  const [currentPage, setCurrentPage] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [pageDraft, setPageDraft] = useState('');
  const [currentProgress, setCurrentProgress] = useState<number | null>(null);
  const [contentHash, setContentHash] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<PortfolioAnnotation[]>([]);
  const [annotationsHydrated, setAnnotationsHydrated] = useState(!storageKey);
  const [renditionApplyKey, setRenditionApplyKey] = useState(0);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [selectionDraft, setSelectionDraft] = useState<{ cfiRange: string; quote: string } | null>(
    null
  );
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const onEpubLoadedRef = useRef(onEpubLoaded);
  onEpubLoadedRef.current = onEpubLoaded;
  const renditionCleanupRef = useRef<(() => void) | null>(null);
  const renditionRef = useRef<ReaderRendition | null>(null);
  const latestLocationRef = useRef<ReaderLocation | null>(null);
  const readerRootRef = useRef<HTMLDivElement | null>(null);
  const sourceKey = epubData
    ? `buffer:${storageKey ?? title ?? epubData.byteLength}`
    : `url:${epubUrl ?? 'missing'}`;

  useEffect(() => {
    latestLocationRef.current = null;
    renditionRef.current = null;

    if (epubData) {
      return;
    }

    if (!epubUrl) {
      return;
    }

    const controller = new AbortController();

    fetch(epubUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch EPUB (${response.status})`);
        }

        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (controller.signal.aborted) return;
        setEpubBuffer(buffer);
        setLoadedUrl(sourceKey);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? unknownErrorMessage(error) : 'Unable to load this EPUB right now.';
        setLoadedUrl(sourceKey);
        setEpubBuffer(null);
        setLoadError(message);
      });

    return () => {
      controller.abort();
    };
  }, [epubData, epubUrl, sourceKey]);

  useEffect(() => {
    return () => {
      renditionCleanupRef.current?.();
      renditionCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (initialLocation !== undefined && initialLocation !== null && initialLocation !== '') {
      queueMicrotask(() => setLocation(initialLocation));
      return;
    }

    if (!storageKey) {
      queueMicrotask(() => setLocation(0));
      return;
    }

    const saved = readStoredReaderLocation(storageKey);
    queueMicrotask(() => setLocation(saved ?? 0));
  }, [storageKey, initialLocation]);

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    setCurrentProgress(readStoredReaderProgress(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || typeof location !== 'string') return;
    try {
      persistStoredReaderLocation(storageKey, location);
    } catch {
      // ignore quota / private mode
    }
  }, [storageKey, location]);

  const locationChanged = useCallback((epubcfi: string) => {
    setLocation(epubcfi);
  }, []);
  const isActiveSourceLoaded = loadedUrl === sourceKey;
  const readyBuffer = epubData ?? (isActiveSourceLoaded ? epubBuffer : null);
  const visibleError = epubData ? null : isActiveSourceLoaded ? loadError : null;
  const isLoadingBook = epubData ? false : Boolean(epubUrl) && !isActiveSourceLoaded;
  const headerOffset = title ? READER_HEADER_H : 0;

  useEffect(() => {
    if (!readyBuffer) return;
    onEpubLoadedRef.current?.({
      buffer: readyBuffer,
      storageKey: storageKey ?? undefined,
    });
  }, [readyBuffer, storageKey]);
  const readerStyles = createReaderStyles({ headerOffset, layoutMode });
  const epubViewStyles = createEpubViewStyles(layoutMode);

  useEffect(() => {
    if (!readyBuffer || !annotationsEnabled || !storageKey) {
      setContentHash(null);
      return;
    }
    let cancelled = false;
    void sha256Hex(readyBuffer).then((h) => {
      if (!cancelled) setContentHash(h);
    });
    return () => {
      cancelled = true;
    };
  }, [readyBuffer, annotationsEnabled, storageKey]);

  useEffect(() => {
    if (!storageKey || !contentHash || !annotationsEnabled) {
      setAnnotations([]);
      setAnnotationsHydrated(true);
      return;
    }
    const currentBuffer = readyBuffer;
    if (!currentBuffer) {
      setAnnotations([]);
      setAnnotationsHydrated(true);
      return;
    }
    let cancelled = false;
    setAnnotationsHydrated(false);
    void Promise.all([
      loadEmbeddedAnnotationsFromEpub(currentBuffer),
      loadAnnotationsFromIndexedDb(storageKey, contentHash),
      persistenceAdapter?.loadState({
        storageKey,
        contentHash,
      }) ?? Promise.resolve(null),
    ]).then(([embeddedAnnotations, localAnnotations, remoteState]) => {
      if (cancelled) return;
      const mergedArtifactAnnotations = mergePersistedAnnotations(
        remoteState?.annotations ?? [],
        embeddedAnnotations?.annotations ?? [],
      );
      const mergedPersistedAnnotations = mergePersistedAnnotations(
        localAnnotations,
        mergedArtifactAnnotations,
      );
      setAnnotations(mergedPersistedAnnotations);
      void saveAnnotationsToIndexedDb(storageKey, contentHash, mergedPersistedAnnotations);

      const localProgress = readStoredReaderProgress(storageKey);
      const nextProgress = localProgress ?? remoteState?.progress ?? null;
      setCurrentProgress(nextProgress);
      if (nextProgress != null) {
        persistStoredReaderProgress(storageKey, nextProgress);
      }

      if (!initialLocation && !hasStoredReaderLocation(storageKey) && remoteState?.location) {
        setLocation(remoteState.location);
      }

      setAnnotationsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [readyBuffer, storageKey, contentHash, annotationsEnabled, persistenceAdapter, initialLocation]);

  useEffect(() => {
    if (!annotationsHydrated || !storageKey || !contentHash) return;
    const id = window.setTimeout(() => {
      void saveAnnotationsToIndexedDb(storageKey, contentHash, annotations);
      if (persistenceAdapter && sourceKind === 'built-in') {
        void persistenceAdapter.saveState({
          storageKey,
          contentHash,
          bookSlug,
          sourceKind,
          location: typeof location === 'string' ? location : null,
          progress: currentProgress,
          annotations,
        });
      }
    }, 500);
    return () => window.clearTimeout(id);
  }, [
    annotations,
    annotationsHydrated,
    storageKey,
    contentHash,
    persistenceAdapter,
    sourceKind,
    bookSlug,
    location,
    currentProgress,
  ]);

  useEffect(() => {
    if (!renditionApplyKey || !annotationsEnabled || !annotationsHydrated) return;
    const r = renditionRef.current as (ReaderRendition & { annotations?: EpubAnnotationsApi }) | null;
    if (!r?.annotations) return;
    for (const a of annotations) {
      try {
        r.annotations.highlight(
          a.cfiRange,
          { id: a.id },
          undefined,
          'portfolio-reader-highlight',
          EPUB_HIGHLIGHT_STYLES,
        );
      } catch {
        /* ignore invalid CFI */
      }
    }
  }, [renditionApplyKey, annotations, annotationsEnabled, annotationsHydrated]);

  const syncReaderPosition = useCallback(
    (nextLocation: ReaderLocation, nextTocItems: ReaderNavItem[] = tocItems) => {
      latestLocationRef.current = nextLocation;

      const nextSectionLabel = resolveSectionLabel(nextTocItems, nextLocation.start?.href);
      setCurrentSectionLabel(nextSectionLabel);

      const generatedPageTotal = renditionRef.current?.book.locations.length?.() ?? 0;
      const fallbackTotal = nextLocation.start?.displayed?.total ?? 0;
      const resolvedTotal = generatedPageTotal || fallbackTotal;
      setTotalPages(resolvedTotal > 0 ? resolvedTotal : null);

      let resolvedPage: number | null = null;
      const currentCfi = nextLocation.start?.cfi;
      let resolvedProgress: number | null = null;

      if (generatedPageTotal > 0 && currentCfi) {
        const percentage = renditionRef.current?.book.locations.percentageFromCfi(currentCfi) ?? 0;
        resolvedProgress = percentage;
        resolvedPage = Math.min(
          generatedPageTotal,
          Math.max(1, Math.round(percentage * Math.max(generatedPageTotal - 1, 1)) + 1)
        );
      } else if (nextLocation.start?.displayed?.page) {
        resolvedPage = nextLocation.start.displayed.page;
        if (fallbackTotal > 0) {
          resolvedProgress = Math.min(1, Math.max(0, nextLocation.start.displayed.page / fallbackTotal));
        }
      }

      setCurrentPage(resolvedPage);
      setPageDraft(resolvedPage ? String(resolvedPage) : '');
      setCurrentProgress(resolvedProgress);
      if (storageKey) {
        persistStoredReaderProgress(storageKey, resolvedProgress);
      }
    },
    [storageKey, tocItems]
  );

  const handleTocChanged = useCallback(
    (nextToc: ReaderNavItem[]) => {
      setTocItems(nextToc);
      if (latestLocationRef.current) {
        syncReaderPosition(latestLocationRef.current, nextToc);
      }
    },
    [syncReaderPosition]
  );

  const handleRendition = useCallback(
    (rendition: ReaderRendition) => {
      renditionCleanupRef.current?.();
      renditionRef.current = rendition;
      const applyLayout = () => {
        const useSpread =
          preferPagedReader &&
          layoutMode === 'reader' &&
          (readerRootRef.current?.clientWidth ?? 0) >= READER_SPREAD_MIN_WIDTH;

        rendition.flow(preferPagedReader ? 'paginated' : 'scrolled-doc');
        rendition.spread(
          preferPagedReader && useSpread ? 'always' : 'none',
          READER_SPREAD_MIN_WIDTH,
        );
      };

      rendition.themes.register('portfolio-reader', READER_THEME_RULES);
      rendition.themes.select('portfolio-reader');
      rendition.themes.fontSize(layoutMode === 'reader' ? '96%' : '100%');
      applyLayout();

      const handleRelocated = (nextLocation: unknown) => {
        syncReaderPosition(nextLocation as ReaderLocation);
      };

      rendition.on('relocated', handleRelocated);

      const handleSelected = (cfiRange: unknown, contents: unknown) => {
        if (!annotationsEnabled || layoutMode !== 'reader') return;
        if (typeof cfiRange !== 'string' || !cfiRange) return;
        const win = (contents as { window?: Window } | undefined)?.window;
        const quote = win?.getSelection?.()?.toString?.().trim() ?? '';
        if (!quote) return;
        setSelectionDraft({ cfiRange, quote });
      };
      rendition.on('selected', handleSelected);

      void rendition.book.loaded.navigation.then((navigation) => {
        setTocItems(navigation.toc);
        if (latestLocationRef.current) {
          syncReaderPosition(latestLocationRef.current, navigation.toc);
        }
      });

      void rendition.book.ready
        .then(() => rendition.book.locations.generate(LOCATION_GENERATION_CHARS))
        .then(() => {
          const locationTotal = rendition.book.locations.length();
          setTotalPages(locationTotal > 0 ? locationTotal : null);

          if (latestLocationRef.current) {
            syncReaderPosition(latestLocationRef.current);
          }
          setRenditionApplyKey((k) => k + 1);
        })
        .catch(() => {
          // fall back to display-based page counts if location generation fails
          setRenditionApplyKey((k) => k + 1);
        });

      if (typeof window !== 'undefined') {
        window.addEventListener('resize', applyLayout);
        renditionCleanupRef.current = () => {
          window.removeEventListener('resize', applyLayout);
          rendition.off('relocated', handleRelocated);
          rendition.off('selected', handleSelected);
        };
      } else {
        renditionCleanupRef.current = () => {
          rendition.off('relocated', handleRelocated);
          rendition.off('selected', handleSelected);
        };
      }
    },
    [annotationsEnabled, layoutMode, preferPagedReader, syncReaderPosition]
  );

  const handleStepPage = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      void renditionRef.current?.prev();
      return;
    }

    void renditionRef.current?.next();
  }, []);

  const handleJumpToPage = useCallback(() => {
    const parsedPage = Number.parseInt(pageDraft, 10);
    if (!Number.isFinite(parsedPage) || !totalPages || totalPages <= 0) {
      return;
    }

    const clampedPage = Math.min(totalPages, Math.max(1, parsedPage));
    const percentage =
      totalPages <= 1 ? 0 : (clampedPage - 1) / Math.max(totalPages - 1, 1);
    const cfi = renditionRef.current?.book.locations.cfiFromPercentage(percentage);

    if (!cfi) return;

    setLocation(cfi);
    setPageDraft(String(clampedPage));
  }, [pageDraft, totalPages]);

  const footerLabel =
    currentSectionLabel || (currentPage ? `Page ${currentPage}` : 'Current section');

  const handleTocSelect = useCallback((href?: string) => {
    if (href) {
      setLocation(href);
    }
    setIsTocOpen(false);
  }, []);

  const addHighlightFromSelection = useCallback(() => {
    if (!selectionDraft) return;
    const r = renditionRef.current as (ReaderRendition & { annotations?: EpubAnnotationsApi }) | null;
    if (!r?.annotations) return;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const next: PortfolioAnnotation = {
      id,
      cfiRange: selectionDraft.cfiRange,
      quote: selectionDraft.quote,
      note: '',
      color: 'amber',
      createdAt: now,
      updatedAt: now,
    };
    try {
      r.annotations.highlight(
        next.cfiRange,
        { id: next.id },
        undefined,
        'portfolio-reader-highlight',
        EPUB_HIGHLIGHT_STYLES,
      );
    } catch {
      return;
    }
    setAnnotations((prev) => [...prev, next]);
    setSelectionDraft(null);
  }, [selectionDraft]);

  const removeAnnotation = useCallback((row: PortfolioAnnotation) => {
    const r = renditionRef.current as (ReaderRendition & { annotations?: EpubAnnotationsApi }) | null;
    r?.annotations?.remove(row.cfiRange, 'highlight');
    setAnnotations((prev) => prev.filter((a) => a.id !== row.id));
  }, []);

  const updateAnnotationNote = useCallback((id: string, note: string) => {
    const now = new Date().toISOString();
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, note, updatedAt: now } : a)));
  }, []);

  const downloadAnnotationsJson = useCallback(() => {
    if (!storageKey || !contentHash) return;
    const payload = annotationsToExportPayload(storageKey, contentHash, annotations);
    const blob = new Blob([serializeAnnotationsExport(payload)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${storageKey}-annotations.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [annotations, contentHash, storageKey]);

  const onImportAnnotationsFile = useCallback(
    async (file: File | null) => {
      if (!file || !storageKey || !contentHash) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(await file.text()) as unknown;
      } catch {
        return;
      }
      const data = parseAnnotationsFile(parsed);
      if (!data) return;
      const r = renditionRef.current as (ReaderRendition & { annotations?: EpubAnnotationsApi }) | null;
      for (const a of annotations) {
        r?.annotations?.remove(a.cfiRange, 'highlight');
      }
      setAnnotations(data.annotations);
      setRenditionApplyKey((k) => k + 1);
    },
    [annotations, contentHash, storageKey],
  );

  const downloadAnnotatedEpub = useCallback(async () => {
    if (!readyBuffer || !storageKey || !contentHash) return;
    const payload = annotationsToExportPayload(storageKey, contentHash, annotations);
    const blob = await embedAnnotationsInEpub(readyBuffer, payload);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${storageKey}-annotated.epub`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [annotations, contentHash, readyBuffer, storageKey]);

  return (
    <div
      ref={readerRootRef}
      className={`epub-reader-root relative flex h-full ${readerMinHeightClass} flex-col overflow-hidden ${className}`}
    >
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = '';
          void onImportAnnotationsFile(file);
        }}
      />
      {title && (
        <header
          className="epub-reader-header relative z-20 flex shrink-0 items-center gap-3 border-b border-border bg-card/95 px-4 shadow-[0_1px_0_rgba(0,0,0,0.06)] backdrop-blur-sm backdrop-saturate-150 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]"
          style={{ height: READER_HEADER_H }}
        >
          <BookOpen
            className="shrink-0 text-primary"
            size={22}
            strokeWidth={1.8}
            aria-hidden
          />
          <span className="text-sm font-medium text-primary truncate">{title}</span>
        </header>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
      <div className="epub-reader-content relative isolate min-h-0 flex-1 overflow-visible">
        {/* Reader layer first (z-0); overlays render after so they stack above the iframe. */}
        <div className="absolute inset-0 z-0 min-h-0 overflow-hidden">
        {isLoadingBook ? (
          <div className="flex h-full min-h-[inherit] items-center justify-center gap-3 text-sm text-text-muted">
            <LoaderCircle size={18} className="animate-spin" />
            <span>Loading book...</span>
          </div>
        ) : visibleError || !readyBuffer ? (
          <div className="flex h-full min-h-[inherit] items-center justify-center px-6 text-center text-sm text-text-muted">
            {visibleError ?? 'Unable to load this EPUB right now.'}
          </div>
        ) : (
          <ReactReader
            key={`${sourceKey}-${readyBuffer.byteLength}`}
            url={readyBuffer}
            title=""
            location={location}
            locationChanged={locationChanged}
            showToc={false}
            tocChanged={(nextToc) => handleTocChanged(nextToc as ReaderNavItem[])}
            getRendition={(rendition) => handleRendition(rendition as ReaderRendition)}
            epubOptions={{
              flow: preferPagedReader ? 'paginated' : 'scrolled-doc',
              manager: 'default',
              spread: preferPagedReader && layoutMode === 'reader' ? 'auto' : 'none',
              minSpreadWidth: READER_SPREAD_MIN_WIDTH,
              snap: true,
            }}
            loadingView={<div className="flex h-full items-center justify-center gap-3 text-sm text-text-muted"><LoaderCircle size={18} className="animate-spin" /><span>Loading book...</span></div>}
            readerStyles={readerStyles}
            epubViewStyles={epubViewStyles}
          />
        )}
        </div>
        {layoutMode === 'reader' ? (
          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="pointer-events-none absolute left-4 top-4 z-[60]">
              <Button
                type="button"
                onClick={() => {
                  setIsNotesOpen(false);
                  setIsTocOpen((value) => !value);
                }}
                variant="outline"
                size="icon"
                className="pointer-events-auto h-10 w-10 rounded-full border-[rgba(140,102,67,0.18)] bg-[rgba(18,13,10,0.88)] text-[rgba(236,223,204,0.82)] shadow-[0_12px_24px_rgba(0,0,0,0.22)] backdrop-blur-md hover:border-[rgba(213,176,131,0.32)] hover:bg-[rgba(18,13,10,0.92)] hover:text-[#fff3e5]"
                aria-label={isTocOpen ? 'Close contents' : 'Open contents'}
              >
                {isTocOpen ? <X size={16} /> : <Menu size={16} />}
              </Button>
            </div>
            <AnimatePresence initial={false}>
              {isTocOpen ? (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-[45]"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 1 }}
                >
                  <motion.button
                    type="button"
                    aria-label="Close contents"
                    className="pointer-events-auto absolute inset-0 z-[44] bg-black/50 backdrop-blur-[2px]"
                    onClick={() => setIsTocOpen(false)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={TOC_PANEL_TRANSITION}
                  />
                  <motion.aside
                    className="pointer-events-auto absolute inset-y-0 left-0 z-[50] flex h-full min-h-0 w-[min(19rem,100vw-2rem)] flex-col rounded-r-2xl border-r border-border bg-background px-4 pb-4 pt-[4.5rem] shadow-2xl"
                    initial={{ opacity: 0, x: -28 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -28 }}
                    transition={TOC_PANEL_TRANSITION}
                  >
                    <motion.div
                      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-4 pr-1 pt-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.18, delay: 0.04 }}
                    >
                      {tocItems.length ? (
                        <div className="min-w-0 space-y-1">{renderTocTree(tocItems, handleTocSelect)}</div>
                      ) : (
                        <p className="px-3 text-sm text-muted-foreground">Loading contents...</p>
                      )}
                    </motion.div>
                  </motion.aside>
                </motion.div>
              ) : null}
            </AnimatePresence>
            {annotationsEnabled && storageKey ? (
              <>
                <div className="pointer-events-none absolute right-4 top-4 z-[60]">
                  <Button
                    type="button"
                    onClick={() => {
                      setIsNotesOpen((v) => !v);
                      setIsTocOpen(false);
                    }}
                    variant="outline"
                    size="icon"
                    className="pointer-events-auto h-10 w-10 rounded-full border-[rgba(140,102,67,0.18)] bg-[rgba(18,13,10,0.88)] text-[rgba(236,223,204,0.82)] shadow-[0_12px_24px_rgba(0,0,0,0.22)] backdrop-blur-md hover:border-[rgba(213,176,131,0.32)] hover:bg-[rgba(18,13,10,0.92)] hover:text-[#fff3e5]"
                    aria-label={isNotesOpen ? 'Close notes' : 'Open notes and highlights'}
                  >
                    <StickyNote size={16} />
                  </Button>
                </div>
                <AnimatePresence initial={false}>
                  {isNotesOpen ? (
                    <motion.div
                      className="pointer-events-none absolute inset-0 z-[45]"
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 1 }}
                    >
                      <motion.button
                        type="button"
                        aria-label="Close notes"
                        className="pointer-events-auto absolute inset-0 z-[44] bg-black/50 backdrop-blur-[2px]"
                        onClick={() => setIsNotesOpen(false)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={TOC_PANEL_TRANSITION}
                      />
                      <motion.aside
                        className="pointer-events-auto absolute inset-y-0 right-0 z-[50] flex min-h-0 w-[min(20rem,100vw-2rem)] max-w-[min(20rem,100vw-2rem)] flex-col rounded-l-2xl border-l border-border bg-background py-4 pl-3 pr-4 pt-16 text-foreground shadow-2xl"
                        initial={{ opacity: 0, x: 28 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 28 }}
                        transition={TOC_PANEL_TRANSITION}
                      >
                        <p className="px-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-primary">
                          Highlights & notes
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 px-2">
                          <Button
                            type="button"
                            onClick={() => downloadAnnotationsJson()}
                            disabled={!contentHash}
                            variant="outline"
                            size="sm"
                            className="rounded-full border-[rgba(140,102,67,0.22)] bg-[rgba(255,255,255,0.04)] px-2.5 text-[0.7rem] text-[rgba(236,223,204,0.85)] hover:bg-[rgba(255,255,255,0.08)]"
                          >
                            <Download size={12} /> Export JSON
                          </Button>
                          <Button
                            type="button"
                            onClick={() => importInputRef.current?.click()}
                            disabled={!contentHash}
                            variant="outline"
                            size="sm"
                            className="rounded-full border-[rgba(140,102,67,0.22)] bg-[rgba(255,255,255,0.04)] px-2.5 text-[0.7rem] text-[rgba(236,223,204,0.85)] hover:bg-[rgba(255,255,255,0.08)]"
                          >
                            <Upload size={12} /> Import
                          </Button>
                          <Button
                            type="button"
                            onClick={() => void downloadAnnotatedEpub()}
                            disabled={!contentHash || !readyBuffer}
                            variant="outline"
                            size="sm"
                            className="rounded-full border-[rgba(140,102,67,0.22)] bg-[rgba(255,255,255,0.04)] px-2.5 text-[0.7rem] text-[rgba(236,223,204,0.85)] hover:bg-[rgba(255,255,255,0.08)]"
                          >
                            <Download size={12} /> Annotated EPUB
                          </Button>
                        </div>
                        <p className="mt-2 px-2 text-[0.65rem] leading-snug text-[rgba(236,223,204,0.45)]">
                          Select text in the page, then use “Add highlight”. Notes are stored in this browser;
                          annotated EPUB adds META-INF/portfolio-annotations.json.
                        </p>
                        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                          {!annotations.length ? (
                            <p className="px-2 text-sm text-[rgba(236,223,204,0.5)]">No highlights yet.</p>
                          ) : (
                            annotations.map((row) => (
                              <div
                                key={row.id}
                                className="rounded-xl border border-[rgba(140,102,67,0.12)] bg-[rgba(255,255,255,0.03)] p-2.5"
                              >
                                <p className="text-[0.72rem] leading-relaxed text-[rgba(247,239,229,0.88)]">
                                  {row.quote}
                                </p>
                                <Textarea
                                  value={row.note}
                                  onChange={(e) => updateAnnotationNote(row.id, e.target.value)}
                                  placeholder="Note…"
                                  rows={2}
                                  className="mt-2 min-h-0 resize-none border-[rgba(140,102,67,0.15)] bg-[rgba(0,0,0,0.2)] px-2 py-1.5 text-[0.72rem] text-[rgba(247,239,229,0.9)] placeholder:text-[rgba(236,223,204,0.35)]"
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button
                                    type="button"
                                    onClick={() => setLocation(row.cfiRange)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto rounded-full px-2 py-1 text-[0.68rem] font-medium text-[#d5b083] hover:bg-transparent hover:text-[#f4d4ac]"
                                  >
                                    Go to
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => removeAnnotation(row)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto rounded-full px-2 py-1 text-[0.68rem] text-[rgba(246,189,162,0.85)] hover:bg-transparent hover:text-[rgba(255,214,193,0.98)]"
                                  >
                                    <Trash2 size={12} /> Remove
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.aside>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </>
            ) : null}
          </div>
        ) : null}
      {layoutMode === 'reader' && annotationsEnabled && selectionDraft ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-lg items-center gap-2 rounded-full border border-[rgba(140,102,67,0.22)] bg-[rgba(18,13,10,0.92)] px-3 py-2 text-[0.72rem] text-[rgba(236,223,204,0.88)] shadow-[0_12px_32px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <Highlighter size={14} className="shrink-0 text-[#d5b083]" aria-hidden />
            <span className="line-clamp-2 min-w-0 flex-1">{selectionDraft.quote}</span>
            <Button
              type="button"
              onClick={addHighlightFromSelection}
              variant="secondary"
              size="sm"
              className="shrink-0 rounded-full bg-[rgba(213,176,131,0.22)] text-[0.68rem] font-semibold text-[#fff3e5] hover:bg-[rgba(213,176,131,0.32)]"
            >
              Add highlight
            </Button>
            <Button
              type="button"
              onClick={() => setSelectionDraft(null)}
              variant="ghost"
              size="sm"
              className="shrink-0 rounded-full text-[0.68rem] text-[rgba(236,223,204,0.55)] hover:bg-transparent hover:text-[#fff3e5]"
            >
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
      </div>
      {layoutMode === 'reader' &&
      readyBuffer &&
      !isLoadingBook &&
      !visibleError &&
      !isTocOpen &&
      !isNotesOpen ? (
        <div className="pointer-events-none shrink-0 px-4 pb-3 pt-1">
          <div className="pointer-events-auto mx-auto flex w-full max-w-[102rem] items-center justify-between gap-3 rounded-full border border-[rgba(140,102,67,0.22)] bg-[rgba(14,10,8,0.96)] px-3 py-1.5 text-[0.76rem] text-[rgba(236,223,204,0.86)] shadow-[0_14px_34px_rgba(0,0,0,0.3)] md:px-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium tracking-[0.03em] text-[rgba(247,239,229,0.82)]">
                {footerLabel}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                onClick={() => handleStepPage('prev')}
                variant="outline"
                size="icon-sm"
                className="rounded-full border-[rgba(140,102,67,0.12)] bg-[rgba(255,255,255,0.03)] text-[rgba(236,223,204,0.78)] hover:border-[rgba(213,176,131,0.24)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#fff3e5]"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </Button>
              <div className="flex items-center gap-1.5 rounded-full border border-[rgba(140,102,67,0.1)] bg-[rgba(255,255,255,0.025)] px-2 py-1">
                <Input
                  value={pageDraft}
                  onChange={(event) => setPageDraft(event.target.value.replace(/[^\d]/g, ''))}
                  onBlur={handleJumpToPage}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleJumpToPage();
                    }
                  }}
                  inputMode="numeric"
                  aria-label="Jump to page"
                  className="h-auto w-10 border-0 bg-transparent p-0 text-right text-[0.76rem] font-medium text-[rgba(247,239,229,0.9)] shadow-none ring-0 placeholder:text-[rgba(232,216,195,0.32)] focus-visible:border-transparent focus-visible:ring-0"
                  placeholder={currentPage ? String(currentPage) : '1'}
                />
                <span className="text-[rgba(232,216,195,0.44)]">/</span>
                <span className="min-w-8 text-left text-[0.76rem] font-medium text-[rgba(232,216,195,0.68)]">
                  {totalPages ?? '...'}
                </span>
              </div>
              <Button
                type="button"
                onClick={() => handleStepPage('next')}
                variant="outline"
                size="icon-sm"
                className="rounded-full border-[rgba(140,102,67,0.12)] bg-[rgba(255,255,255,0.03)] text-[rgba(236,223,204,0.78)] hover:border-[rgba(213,176,131,0.24)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#fff3e5]"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
