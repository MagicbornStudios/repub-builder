import JSZip from 'jszip';

export const PORTFOLIO_ANNOTATIONS_SCHEMA = 'portfolio-epub-annotations' as const;
export const PORTFOLIO_ANNOTATIONS_JSON_PATH = 'META-INF/portfolio-annotations.json' as const;
const DB_NAME = 'portfolio-reader-v1';
const STORE_NAME = 'epub-annotations';
const DB_VERSION = 1;

export type PortfolioAnnotation = {
  id: string;
  cfiRange: string;
  quote: string;
  note: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};

export type PortfolioAnnotationsFile = {
  schema: typeof PORTFOLIO_ANNOTATIONS_SCHEMA;
  version: number;
  storageKey: string;
  contentSha256: string;
  annotations: PortfolioAnnotation[];
};

async function normalizeEpubBufferForHash(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    if (!zip.file(PORTFOLIO_ANNOTATIONS_JSON_PATH)) return buffer;
    delete zip.files[PORTFOLIO_ANNOTATIONS_JSON_PATH];
    return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  } catch {
    return buffer;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseAnnotationsFile(raw: unknown): PortfolioAnnotationsFile | null {
  if (!isRecord(raw)) return null;
  if (raw.schema !== PORTFOLIO_ANNOTATIONS_SCHEMA) return null;
  if (typeof raw.version !== 'number' || raw.version !== 1) return null;
  if (typeof raw.storageKey !== 'string' || typeof raw.contentSha256 !== 'string') return null;
  if (!Array.isArray(raw.annotations)) return null;

  const annotations: PortfolioAnnotation[] = [];
  for (const item of raw.annotations) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== 'string' || typeof item.cfiRange !== 'string') continue;
    annotations.push({
      id: item.id,
      cfiRange: item.cfiRange,
      quote: typeof item.quote === 'string' ? item.quote : '',
      note: typeof item.note === 'string' ? item.note : '',
      color: typeof item.color === 'string' ? item.color : 'amber',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
    });
  }

  return {
    schema: PORTFOLIO_ANNOTATIONS_SCHEMA,
    version: 1,
    storageKey: raw.storageKey,
    contentSha256: raw.contentSha256,
    annotations,
  };
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const normalized = await normalizeEpubBufferForHash(buffer);
  const digest = await crypto.subtle.digest('SHA-256', normalized);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function storeKey(storageKey: string, contentSha256: string) {
  return `${storageKey}::${contentSha256}`;
}

export async function loadAnnotationsFromIndexedDb(
  storageKey: string,
  contentSha256: string,
): Promise<PortfolioAnnotation[]> {
  if (typeof indexedDB === 'undefined') return [];
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(storeKey(storageKey, contentSha256));
      getReq.onerror = () => reject(getReq.error);
      getReq.onsuccess = () => {
        const value = getReq.result as { annotations?: PortfolioAnnotation[] } | undefined;
        resolve(Array.isArray(value?.annotations) ? value!.annotations : []);
      };
    });
  } catch {
    return [];
  }
}

export async function saveAnnotationsToIndexedDb(
  storageKey: string,
  contentSha256: string,
  annotations: PortfolioAnnotation[],
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const putReq = store.put({ annotations }, storeKey(storageKey, contentSha256));
    putReq.onerror = () => reject(putReq.error);
    putReq.onsuccess = () => resolve();
  });
}

export function annotationsToExportPayload(
  storageKey: string,
  contentSha256: string,
  annotations: PortfolioAnnotation[],
): PortfolioAnnotationsFile {
  return {
    schema: PORTFOLIO_ANNOTATIONS_SCHEMA,
    version: 1,
    storageKey,
    contentSha256,
    annotations,
  };
}

export function serializeAnnotationsExport(payload: PortfolioAnnotationsFile): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export async function loadEmbeddedAnnotationsFromEpub(
  epubBuffer: ArrayBuffer,
): Promise<PortfolioAnnotationsFile | null> {
  try {
    const zip = await JSZip.loadAsync(epubBuffer);
    const raw = await zip.file(PORTFOLIO_ANNOTATIONS_JSON_PATH)?.async('string');
    if (!raw) return null;
    return parseAnnotationsFile(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function embedAnnotationsInEpub(
  epubBuffer: ArrayBuffer,
  payload: PortfolioAnnotationsFile,
): Promise<Blob> {
  const zip = await JSZip.loadAsync(epubBuffer);
  zip.file(PORTFOLIO_ANNOTATIONS_JSON_PATH, serializeAnnotationsExport(payload));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
