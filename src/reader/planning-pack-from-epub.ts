import JSZip from 'jszip';
import {
  PORTFOLIO_PLANNING_PACK_MANIFEST_ZIP_PATH,
  parsePortfolioPlanningPackManifest,
  type PlanningPackManifestEntryV1,
} from '../planning-pack-manifest';

/** Matches `BuiltinEmbedPack` from repo-planner (avoid runtime dependency here). */
export type ExtractedReaderPlanningPack = {
  id: string;
  label: string;
  description?: string;
  files: { path: string; content: string }[];
};

export function readerBookPlanningPackId(bookSlug: string): string {
  return `book-${bookSlug}-planning`;
}

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTagsToText(html: string): string {
  const withBreaks = html
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const stripped = withBreaks.replace(/<[^>]+>/g, '');
  return decodeBasicEntities(stripped)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractPathLabelFromXhtml(xhtml: string): string | null {
  const m = xhtml.match(/class="planning-appendix-path"[^>]*>([^<]*)</i);
  if (!m) return null;
  const t = decodeBasicEntities(m[1]).trim();
  return t || null;
}

function extractMainContentFromXhtml(xhtml: string): string | null {
  const preM = xhtml.match(/<pre class="planning-appendix-pre">([\s\S]*?)<\/pre>/i);
  if (preM) {
    return decodeBasicEntities(preM[1].replace(/\r\n/g, '\n')).trimEnd();
  }
  const bodyM = xhtml.match(/<div class="planning-appendix-body">([\s\S]*?)<\/div>/i);
  if (bodyM) {
    return stripTagsToText(bodyM[1]);
  }
  return null;
}

function normalizeZipPath(zip: JSZip, href: string): string | null {
  const forward = href.replace(/\\/g, '/').replace(/^\//, '');
  if (zip.files[forward] && !zip.files[forward].dir) return forward;
  const lower = forward.toLowerCase();
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir) continue;
    if (name.replace(/\\/g, '/').toLowerCase() === lower) {
      return name.replace(/\\/g, '/');
    }
  }
  return null;
}

function listFallbackPlanHrefs(zip: JSZip): string[] {
  const out: string[] = [];
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir) continue;
    const norm = name.replace(/\\/g, '/');
    if (/^OEBPS\/plan-[^/]+\.xhtml$/i.test(norm)) {
      out.push(norm);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

async function loadXhtml(zip: JSZip, href: string): Promise<string | null> {
  const key = normalizeZipPath(zip, href);
  if (!key) return null;
  const f = zip.file(key);
  if (!f) return null;
  return f.async('string');
}

async function entryToFile(
  zip: JSZip,
  entry: PlanningPackManifestEntryV1,
): Promise<{ path: string; content: string } | null> {
  const xhtml = await loadXhtml(zip, entry.href);
  if (!xhtml) return null;
  const content = extractMainContentFromXhtml(xhtml);
  if (content === null) return null;
  return { path: entry.virtualPath, content };
}

async function fallbackEntryFromHref(
  zip: JSZip,
  href: string,
): Promise<{ path: string; content: string } | null> {
  const xhtml = await loadXhtml(zip, href);
  if (!xhtml) return null;
  const content = extractMainContentFromXhtml(xhtml);
  if (content === null) return null;
  const label = extractPathLabelFromXhtml(xhtml);
  const base = href.split('/').pop() ?? href;
  const virtualPath = label
    ? `docs/books/planning/${label
        .split(/\s*\/\s*/)
        .map((p) => p.trim())
        .filter(Boolean)
        .join('/')}`
    : `planning/epub/${base}`;
  return { path: virtualPath, content };
}

/**
 * Build one embed-shaped planning pack from EPUB bytes (manifest-first, then plan-*.xhtml fallback).
 */
export async function extractPlanningPackFromEpub(
  buffer: ArrayBuffer | Uint8Array,
  options: { bookSlug: string; packLabel?: string },
): Promise<ExtractedReaderPlanningPack | null> {
  const zip = await JSZip.loadAsync(buffer);
  const manifestFile = zip.file(PORTFOLIO_PLANNING_PACK_MANIFEST_ZIP_PATH);
  const manifestText = manifestFile ? await manifestFile.async('string') : null;
  const manifest = manifestText ? parsePortfolioPlanningPackManifest(manifestText) : null;

  const files: { path: string; content: string }[] = [];

  if (manifest?.entries.length) {
    for (const e of manifest.entries) {
      const row = await entryToFile(zip, e);
      if (row) files.push(row);
    }
  }

  if (files.length === 0) {
    for (const href of listFallbackPlanHrefs(zip)) {
      const row = await fallbackEntryFromHref(zip, href);
      if (row) files.push(row);
    }
  }

  if (files.length === 0) return null;

  const id = readerBookPlanningPackId(options.bookSlug);
  const label = options.packLabel ?? `Book — planning`;

  return {
    id,
    label,
    description: 'Planning supplement extracted from the EPUB artifact (read-only in cockpit).',
    files,
  };
}
