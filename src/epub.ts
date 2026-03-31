import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { marked } from 'marked';
import JSZip from 'jszip';
import { mdxToHtml } from './mdxToHtml.js';
import {
  PORTFOLIO_PLANNING_PACK_MANIFEST_ZIP_PATH,
  type PlanningPackManifestEntryV1,
  type PlanningPackManifestSourceKind,
  type PortfolioPlanningPackManifestV1,
} from './planning-pack-manifest.js';
import {
  PORTFOLIO_ANNOTATIONS_JSON_PATH,
  parseAnnotationsFile,
  serializeAnnotationsExport,
  type PortfolioAnnotationsFile,
} from './reader/epub-annotations.js';

const require = createRequire(import.meta.url);
const Epub = require('epub-gen');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BookMeta {
  title: string;
  author: string;
}

interface ChapterMeta {
  key: string;
  actLabel?: string;
  chapterLabel?: string;
  chapterTitle?: string;
  chapterSubtitle?: string;
  runningHead?: string;
  tocTitle: string;
  emitOpener: boolean;
}

interface ChapterEntry {
  dir: string;
  meta: ChapterMeta;
  files: string[];
}

interface PageRenderMeta {
  pageNumber: string;
  title: string;
  displayTitle: boolean;
  filenameStem: string;
}

interface RenderedPage {
  title: string;
  filename: string;
  data: string;
}

const EPUB_CSS = `
html,
body {
  margin: 0;
  padding: 0;
}

body {
  background: #f5ecde;
  color: #24170f;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 0.84rem;
  line-height: 1.46;
}

.reader-page {
  box-sizing: border-box;
  min-height: 100%;
  padding: 0.88rem 1.18rem 0.78rem;
  display: flex;
  flex-direction: column;
  page-break-inside: avoid;
  break-inside: avoid;
}

.reader-spread {
  min-height: 100%;
}

.reader-spread > .reader-page + .reader-page {
  break-before: column;
  page-break-before: always;
  -webkit-column-break-before: always;
}

.reader-page__header {
  margin: 0 0 0.4rem;
}

.reader-page__content {
  flex: 1 1 auto;
}

.reader-page__running-head {
  margin: 0;
  color: #836142;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.reader-page__scene-title {
  margin: 0.18rem 0 0;
  color: #1b120d;
  font-size: 1.16rem;
  line-height: 1.12;
}

.reader-page__figure {
  margin: 0.24rem 0 0.56rem;
  break-inside: avoid;
  page-break-inside: avoid;
}

.reader-page__figure-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 7.6rem;
  height: 7.6rem;
  padding: 0.42rem;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid rgba(102, 69, 36, 0.12);
  border-radius: 0.7rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(232, 219, 198, 0.62)),
    #efe1cb;
  box-shadow: 0 12px 24px rgba(32, 18, 8, 0.12);
}

.reader-page__figure img {
  display: block;
  width: 100%;
  height: 100%;
  margin: 0 auto;
  object-fit: cover;
  object-position: center;
  border-radius: 0.52rem;
}

.reader-page__figure--placeholder .reader-page__figure-frame {
  border-style: dashed;
}

.reader-page__placeholder {
  display: flex;
  min-height: 6.8rem;
  width: 100%;
  align-items: center;
  justify-content: center;
  border-radius: 0.52rem;
  background:
    radial-gradient(circle at top, rgba(140, 102, 67, 0.14), transparent 58%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(216, 196, 166, 0.34));
  color: #8b6a4a;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-align: center;
  text-transform: uppercase;
}

.reader-page__body {
  flex: 1 1 auto;
}

.reader-page__body > :first-child {
  margin-top: 0;
}

.reader-page__body p {
  margin: 0 0 0.58rem;
  orphans: 3;
  widows: 3;
}

.reader-page__body img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 1rem auto;
  border-radius: 0.8rem;
}

.reader-page__footer {
  margin-top: auto;
  padding-top: 0.45rem;
  border-top: 1px solid rgba(94, 67, 41, 0.16);
  text-align: center;
}

.reader-page__folio {
  color: #836142;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
}

.reader-chapter-opener {
  box-sizing: border-box;
  min-height: 100%;
  padding: 2.4rem 2rem 2rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}

.reader-chapter-opener__act,
.reader-chapter-opener__label {
  margin: 0;
  color: #836142;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.reader-chapter-opener__label {
  margin-top: 0.55rem;
}

.reader-chapter-opener__title {
  margin: 0.9rem 0 0;
  color: #1b120d;
  font-size: 2.2rem;
  line-height: 1.04;
}

.reader-chapter-opener__subtitle {
  margin: 0.7rem 0 0;
  color: #5f4633;
  font-size: 0.98rem;
}

.h1,
nav h1,
h1.h1 {
  margin: 0 0 1.2rem;
  color: #1d120d;
  font-size: 2.1rem;
  line-height: 1.08;
}

nav {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(245, 236, 221, 0.95));
  border: 1px solid rgba(102, 69, 36, 0.18);
  border-radius: 1.4rem;
  box-shadow: 0 18px 40px rgba(43, 27, 16, 0.08);
  padding: 1.8rem 2rem;
}

nav ol {
  margin: 1.1rem 0 0;
  padding: 0 0 0 1.35rem;
}

nav li {
  border-bottom: 1px solid rgba(102, 69, 36, 0.12);
  margin: 0;
  padding: 0.5rem 0;
}

nav li:last-child {
  border-bottom: none;
}

nav a,
nav a:visited {
  color: #2a1710;
  font-size: 0.98rem;
  font-weight: 600;
  text-decoration: none;
}

.planning-appendix-doc {
  box-sizing: border-box;
  min-height: 100%;
  padding: 1.1rem 1.05rem 1.6rem;
  background: #f5ecde;
  color: #24170f;
}

.planning-appendix-header {
  margin: 0 0 0.85rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid rgba(94, 67, 41, 0.2);
}

.planning-appendix-kicker {
  margin: 0 0 0.28rem;
  color: #836142;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.planning-appendix-title {
  margin: 0;
  color: #1b120d;
  font-size: 1.05rem;
  line-height: 1.2;
}

.planning-appendix-path {
  margin: 0.35rem 0 0;
  color: #6b5340;
  font-family: Arial, Helvetica, sans-serif;
  font-size: 0.68rem;
  word-break: break-all;
}

.planning-appendix-body {
  font-size: 0.82rem;
  line-height: 1.45;
}

.planning-appendix-body > :first-child {
  margin-top: 0;
}

.planning-appendix-pre {
  margin: 0;
  padding: 0.65rem 0.75rem;
  overflow-x: auto;
  border-radius: 0.45rem;
  border: 1px solid rgba(102, 69, 36, 0.18);
  background: rgba(255, 255, 255, 0.45);
  color: #2a1710;
  font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
  font-size: 0.68rem;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
}
`;

function slugToTitle(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isGenericPageTitle(value: string): boolean {
  return /^page\s+\d+$/i.test(value.trim());
}

function loadMeta(folder: string): BookMeta {
  const p = path.join(folder, 'book.json');
  if (!fs.existsSync(p)) {
    return { title: slugToTitle(path.basename(folder)), author: '' };
  }

  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  return {
    title: data.title || slugToTitle(path.basename(folder)),
    author: data.author || '',
  };
}

function deriveChapterMeta(chapterDirName: string, chapterIndex: number): ChapterMeta {
  const clean = chapterDirName.replace(/^\d+[-_]?/, '');
  const key = clean || `chapter-${chapterIndex + 1}`;

  if (/^prologue$/i.test(clean)) {
    return {
      key,
      chapterLabel: 'Prologue',
      chapterTitle: '',
      runningHead: 'Prologue',
      tocTitle: 'Prologue',
      emitOpener: true,
    };
  }

  const numberedMatch = clean.match(/^chapter[-_ ]?(\d+)(?:[-_](.+))?$/i);
  if (numberedMatch) {
    const chapterNumber = numberedMatch[1];
    const chapterTitle = numberedMatch[2] ? slugToTitle(numberedMatch[2]) : '';
    return {
      key,
      chapterLabel: `Chapter ${chapterNumber}`,
      chapterTitle,
      runningHead: chapterTitle || `Chapter ${chapterNumber}`,
      tocTitle: chapterTitle ? `Chapter ${chapterNumber}: ${chapterTitle}` : `Chapter ${chapterNumber}`,
      emitOpener: true,
    };
  }

  const title = slugToTitle(clean);
  return {
    key,
    chapterLabel: `Chapter ${chapterIndex + 1}`,
    chapterTitle: title,
    runningHead: title,
    tocTitle: title ? `Chapter ${chapterIndex + 1}: ${title}` : `Chapter ${chapterIndex + 1}`,
    emitOpener: true,
  };
}

function loadChapterMeta(chapterDir: string, chapterIndex: number): ChapterMeta {
  const defaults = deriveChapterMeta(path.basename(chapterDir), chapterIndex);
  const chapterMetaPath = path.join(chapterDir, 'chapter.json');
  if (!fs.existsSync(chapterMetaPath)) {
    return defaults;
  }

  const data = JSON.parse(fs.readFileSync(chapterMetaPath, 'utf8'));
  return {
    ...defaults,
    ...data,
    key: data.key || defaults.key,
    tocTitle: data.tocTitle || defaults.tocTitle,
    emitOpener: data.emitOpener ?? defaults.emitOpener,
  };
}

function collectChapterEntries(folder: string): ChapterEntry[] {
  const chaptersDir = path.join(folder, 'chapters');
  if (fs.existsSync(chaptersDir)) {
    return fs.readdirSync(chaptersDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry, chapterIndex) => {
        const dir = path.join(chaptersDir, entry.name);
        const files = fs.readdirSync(dir, { withFileTypes: true })
          .filter((file) => file.isFile() && /\.(md|mdx)$/i.test(file.name))
          .map((file) => path.join(dir, file.name))
          .sort();

        return {
          dir,
          meta: loadChapterMeta(dir, chapterIndex),
          files,
        };
      });
  }

  const files = fs.readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
    .map((entry) => path.join(folder, entry.name))
    .sort();

  return [
    {
      dir: folder,
      meta: {
        key: path.basename(folder),
        runningHead: slugToTitle(path.basename(folder)),
        tocTitle: slugToTitle(path.basename(folder)),
        emitOpener: false,
      },
      files,
    },
  ];
}

function rewriteImagesToFileUrls(html: string, folder: string): string {
  const imagesDir = path.join(folder, 'images');
  if (!fs.existsSync(imagesDir)) return html;

  return html.replace(
    /(<img[^>]*\ssrc=["'])(\/books\/[^/]+\/images\/)([^"')]+)(["'][^>]*>)/g,
    (_, before, _prefix, imageName, after) => {
      const localPath = path.join(imagesDir, (imageName as string).trim());
      if (!fs.existsSync(localPath)) return '';
      return `${before}${localPath}${after}`;
    }
  );
}

function extractTitle(content: string): string {
  const h1 = content.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : '';
}

function extractLeadImage(html: string): { leadFigure: string; bodyHtml: string } {
  const match = html.match(/^\s*<p>\s*(<img[^>]+>)\s*<\/p>/i);
  if (!match) {
    const inlineLeadMatch = html.match(/^\s*<p>\s*(<img[^>]+>)\s*([\s\S]*?)<\/p>/i);
    if (!inlineLeadMatch) {
      return { leadFigure: '', bodyHtml: html.trim() };
    }

    const [, imageTag, paragraphRemainder] = inlineLeadMatch;
    const rebuiltLeadParagraph = paragraphRemainder.trim()
      ? `<p>${paragraphRemainder.trim()}</p>`
      : '';

    return {
      leadFigure: `<figure class="reader-page__figure">${imageTag}</figure>`,
      bodyHtml: html.replace(inlineLeadMatch[0], rebuiltLeadParagraph).trim(),
    };
  }

  return {
    leadFigure: `<figure class="reader-page__figure">${match[1]}</figure>`,
    bodyHtml: html.replace(match[0], '').trim(),
  };
}

function createFigureHtml(leadFigure: string): string {
  if (leadFigure) {
    return leadFigure.replace(
      'class="reader-page__figure"',
      'class="reader-page__figure"><div class="reader-page__figure-frame"'
    ).replace('</figure>', '</div></figure>');
  }

  return `
    <figure class="reader-page__figure reader-page__figure--placeholder" aria-hidden="true">
      <div class="reader-page__figure-frame">
        <div class="reader-page__placeholder">Illustration Pending</div>
      </div>
    </figure>
  `.trim();
}

function extractPageNumber(fullPath: string, explicitPage: unknown, title: string, fallbackIndex: number): string {
  if (typeof explicitPage === 'number' || typeof explicitPage === 'string') {
    const normalized = String(explicitPage).trim();
    if (normalized) return normalized;
  }

  const basename = path.basename(fullPath);
  const fileMatch = basename.match(/page[-_ ]?(\d+)/i);
  if (fileMatch) return fileMatch[1];

  const titleMatch = title.match(/page\s+(\d+)/i);
  if (titleMatch) return titleMatch[1];

  return String(fallbackIndex + 1);
}

function inferFilenameTitle(fullPath: string): string {
  const basename = path.basename(fullPath, path.extname(fullPath));
  const fileMatch = basename.match(/page[-_ ]?\d+(?:[-_](.+))?$/i);
  if (!fileMatch || !fileMatch[1]) return '';
  return slugToTitle(fileMatch[1]);
}

function buildPageMeta(fullPath: string, data: Record<string, unknown>, content: string, fallbackIndex: number): PageRenderMeta {
  const headingTitle = extractTitle(content);
  const filenameTitle = inferFilenameTitle(fullPath);
  const explicitTitle = typeof data.title === 'string' ? data.title.trim() : '';
  const title = explicitTitle || headingTitle || filenameTitle;
  const displayTitle = data.displayTitle === true;
  const pageNumber = extractPageNumber(fullPath, data.page, title, fallbackIndex);

  return {
    pageNumber,
    title: title && !isGenericPageTitle(title) ? title : '',
    displayTitle,
    filenameStem: path.basename(fullPath, path.extname(fullPath)),
  };
}

function stripLeadingPageHeading(html: string): string {
  return html.replace(/^\s*<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>\s*/i, '').trim();
}

function buildRunningHead(chapterMeta: ChapterMeta): string {
  return chapterMeta.runningHead || chapterMeta.chapterTitle || chapterMeta.chapterLabel || chapterMeta.tocTitle;
}

function renderChapterOpener(chapterMeta: ChapterMeta): string {
  const act = chapterMeta.actLabel
    ? `<p class="reader-chapter-opener__act">${escapeHtml(chapterMeta.actLabel)}</p>`
    : '';
  const label = chapterMeta.chapterLabel
    ? `<p class="reader-chapter-opener__label">${escapeHtml(chapterMeta.chapterLabel)}</p>`
    : '';
  const titleText = chapterMeta.chapterTitle || chapterMeta.chapterLabel || chapterMeta.tocTitle;
  const title = titleText
    ? `<h1 class="reader-chapter-opener__title">${escapeHtml(titleText)}</h1>`
    : '';
  const subtitle = chapterMeta.chapterSubtitle
    ? `<p class="reader-chapter-opener__subtitle">${escapeHtml(chapterMeta.chapterSubtitle)}</p>`
    : '';

  return `
    <section class="reader-chapter-opener">
      ${act}
      ${label}
      ${title}
      ${subtitle}
    </section>
  `.trim();
}

const PLANNING_SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '__pycache__',
]);

const PLANNING_TEXT_EXT = /\.(md|mdx|xml|toml|txt)$/i;

function slugifyForFilename(value: string): string {
  const s = value
    .replace(/\\/g, '/')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return s || 'doc';
}

function collectPlanningFilePaths(rootDir: string): string[] {
  const root = path.resolve(rootDir);
  if (!fs.existsSync(root)) {
    console.warn(`Planning dir not found, skipping: ${root}`);
    return [];
  }
  const out: string[] = [];
  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (PLANNING_SKIP_DIR_NAMES.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && PLANNING_TEXT_EXT.test(ent.name)) out.push(full);
    }
  }
  walk(root);
  return out.sort((a, b) => a.localeCompare(b));
}

export interface RunEpubOptions {
  planningDirs?: string[];
  annotationsFile?: string;
}

function sha256HexForBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

async function canonicalizeEpubBufferForAnnotationsHash(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  if (!zip.file(PORTFOLIO_ANNOTATIONS_JSON_PATH)) return buffer;
  delete zip.files[PORTFOLIO_ANNOTATIONS_JSON_PATH];
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function loadAnnotationsExportFile(annotationsFile?: string): PortfolioAnnotationsFile | null {
  if (!annotationsFile) return null;
  const raw = JSON.parse(fs.readFileSync(annotationsFile, 'utf8')) as unknown;
  const parsed = parseAnnotationsFile(raw);
  if (!parsed) {
    throw new Error(`Invalid annotations export file: ${annotationsFile}`);
  }
  return parsed;
}

function virtualPathForPlanningFile(planningRootAbs: string, fileAbs: string): string {
  const rel = path.relative(planningRootAbs, fileAbs);
  const posixRel = rel.split(path.sep).join('/');
  const norm = planningRootAbs.replace(/\\/g, '/');
  const needle = '/content/docs/';
  const idx = norm.lastIndexOf(needle);
  if (idx !== -1) {
    return `docs/${norm.slice(idx + needle.length)}/${posixRel}`;
  }
  return `planning/${path.basename(planningRootAbs)}/${posixRel}`;
}

function sourceKindForPlanningFile(fileAbs: string): PlanningPackManifestSourceKind {
  const ext = path.extname(fileAbs).toLowerCase();
  if (ext === '.mdx') return 'mdx';
  if (ext === '.md') return 'md';
  return 'raw';
}

async function buildPlanningAppendixContent(
  bookFolder: string,
  planningRoots: string[],
): Promise<{
  content: Array<{
    title: string;
    data: string;
    filename: string;
    excludeFromToc?: boolean;
  }>;
  manifestEntries: PlanningPackManifestEntryV1[];
}> {
  const items: Array<{
    title: string;
    data: string;
    filename: string;
    excludeFromToc?: boolean;
  }> = [];
  const manifestEntries: PlanningPackManifestEntryV1[] = [];
  const usedFilenames = new Set<string>();

  for (const rootRaw of planningRoots) {
    const root = path.resolve(rootRaw);
    const rootLabel = path.basename(root);
    const filePaths = collectPlanningFilePaths(root);

    for (const fileAbs of filePaths) {
      const rel = path.relative(root, fileAbs);
      const relDisplay = rel.split(path.sep).join(' / ');
      const ext = path.extname(fileAbs).toLowerCase();
      const baseStem = slugifyForFilename(
        `${rootLabel}-${rel.replace(/\.[^.]+$/, '')}`,
      );
      let stem = `plan-${baseStem}`;
      if (usedFilenames.has(stem)) {
        let n = 2;
        while (usedFilenames.has(`${stem}-${n}`)) n += 1;
        stem = `${stem}-${n}`;
      }
      usedFilenames.add(stem);

      let title: string;
      let data: string;

      if (ext === '.md' || ext === '.mdx') {
        const raw = fs.readFileSync(fileAbs, 'utf8');
        const parsed = matter(raw);
        const fm = parsed.data as Record<string, unknown>;
        const body = parsed.content;
        if (typeof fm.title === 'string' && fm.title.trim()) {
          title = `${rootLabel}: ${fm.title.trim()}`;
        } else {
          title = `${rootLabel}: ${relDisplay}`;
        }
        const html =
          ext === '.mdx' ? await mdxToHtml(body, fileAbs) : await marked.parse(body);
        const htmlRewritten = rewriteImagesToFileUrls(html, bookFolder);
        const bodyInner = stripLeadingPageHeading(htmlRewritten.trim());
        data = `
    <article class="planning-appendix-doc">
      <header class="planning-appendix-header">
        <p class="planning-appendix-kicker">Planning supplement</p>
        <h1 class="planning-appendix-title">${escapeHtml(title)}</h1>
        <p class="planning-appendix-path">${escapeHtml(relDisplay)}</p>
      </header>
      <div class="planning-appendix-body">${bodyInner}</div>
    </article>
  `.trim();
      } else {
        title = `${rootLabel}: ${relDisplay}`;
        const rawText = fs.readFileSync(fileAbs, 'utf8');
        data = `
    <article class="planning-appendix-doc planning-appendix-doc--raw">
      <header class="planning-appendix-header">
        <p class="planning-appendix-kicker">Planning supplement</p>
        <h1 class="planning-appendix-title">${escapeHtml(title)}</h1>
        <p class="planning-appendix-path">${escapeHtml(relDisplay)}</p>
      </header>
      <pre class="planning-appendix-pre">${escapeHtml(rawText)}</pre>
    </article>
  `.trim();
      }

      manifestEntries.push({
        href: `OEBPS/${stem}.xhtml`,
        virtualPath: virtualPathForPlanningFile(root, fileAbs),
        title,
        sourceKind: sourceKindForPlanningFile(fileAbs),
      });

      items.push({
        title,
        filename: stem,
        excludeFromToc: true,
        data,
      });
    }
  }

  return { content: items, manifestEntries };
}

async function injectPortfolioPlanningPackManifest(
  epubPath: string,
  manifest: PortfolioPlanningPackManifestV1,
): Promise<void> {
  const zip = await JSZip.loadAsync(fs.readFileSync(epubPath));
  zip.file(PORTFOLIO_PLANNING_PACK_MANIFEST_ZIP_PATH, JSON.stringify(manifest, null, 2), {
    compression: 'DEFLATE',
  });
  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(epubPath, out);
}

async function injectPortfolioAnnotations(
  epubPath: string,
  annotations: PortfolioAnnotationsFile,
): Promise<void> {
  const sourceZip = await JSZip.loadAsync(fs.readFileSync(epubPath));
  delete sourceZip.files[PORTFOLIO_ANNOTATIONS_JSON_PATH];
  const baseOut = await sourceZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const provisionalZip = await JSZip.loadAsync(baseOut);
  provisionalZip.file(PORTFOLIO_ANNOTATIONS_JSON_PATH, serializeAnnotationsExport(annotations), {
    compression: 'DEFLATE',
  });
  const provisionalOut = await provisionalZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
  });
  const canonicalHash = sha256HexForBuffer(
    await canonicalizeEpubBufferForAnnotationsHash(provisionalOut),
  );

  const nextPayload: PortfolioAnnotationsFile = {
    ...annotations,
    contentSha256: canonicalHash,
  };

  const finalZip = await JSZip.loadAsync(baseOut);
  finalZip.file(PORTFOLIO_ANNOTATIONS_JSON_PATH, serializeAnnotationsExport(nextPayload), {
    compression: 'DEFLATE',
  });
  const finalOut = await finalZip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(epubPath, finalOut);
}

function wrapPageHtml({
  chapterMeta,
  title,
  bodyHtml,
  leadFigure,
  pageNumber,
  displayTitle,
}: {
  chapterMeta: ChapterMeta;
  title: string;
  bodyHtml: string;
  leadFigure: string;
  pageNumber: string;
  displayTitle: boolean;
}): string {
  const runningHead = buildRunningHead(chapterMeta);
  const runningHeadHtml = runningHead
    ? `<p class="reader-page__running-head">${escapeHtml(runningHead)}</p>`
    : '';
  const sceneTitle = displayTitle && title
    ? `<h2 class="reader-page__scene-title">${escapeHtml(title)}</h2>`
    : '';
  const header = runningHeadHtml || sceneTitle
    ? `<header class="reader-page__header">${runningHeadHtml}${sceneTitle}</header>`
    : '';
  const figureHtml = createFigureHtml(leadFigure);

  return `
    <article class="reader-page" data-page-number="${escapeHtml(pageNumber)}">
      ${header}
      <div class="reader-page__content">
        ${figureHtml}
        <div class="reader-page__body">${bodyHtml}</div>
      </div>
      <footer class="reader-page__footer">
        <span class="reader-page__folio">${escapeHtml(pageNumber)}</span>
      </footer>
    </article>
  `.trim();
}

export async function runEpub(
  folder: string,
  outputPath: string,
  options?: RunEpubOptions,
): Promise<void> {
  const meta = loadMeta(folder);
  const chapterEntries = collectChapterEntries(folder).filter((entry) => entry.files.length > 0);
  const files = chapterEntries.flatMap((entry) => entry.files);

  if (files.length === 0) {
    throw new Error(`No .md or .mdx files found in ${folder}`);
  }

  const content: Array<{
    title: string;
    data: string;
    excludeFromToc?: boolean;
    filename?: string;
  }> = [];

  let globalPageIndex = 0;

  for (const chapterEntry of chapterEntries) {
    if (chapterEntry.meta.emitOpener) {
      content.push({
        title: chapterEntry.meta.tocTitle,
        data: renderChapterOpener(chapterEntry.meta),
        filename: `${chapterEntry.meta.key}-opener`,
      });
    }

    const renderedPages: RenderedPage[] = [];

    for (const fullPath of chapterEntry.files) {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const { data, content: markdownContent } = matter(raw);
      const ext = path.extname(fullPath).toLowerCase();
      const html =
        ext === '.mdx'
          ? await mdxToHtml(markdownContent, fullPath)
          : await marked.parse(markdownContent);
      const htmlRewritten = rewriteImagesToFileUrls(html, folder);
      const pageMeta = buildPageMeta(fullPath, data, markdownContent, globalPageIndex);
      const cleanedHtml = stripLeadingPageHeading(htmlRewritten);
      const { leadFigure, bodyHtml } = extractLeadImage(cleanedHtml);

      renderedPages.push({
        title: pageMeta.title || `Page ${pageMeta.pageNumber}`,
        filename: `${chapterEntry.meta.key}-${pageMeta.filenameStem}`,
        data: wrapPageHtml({
          chapterMeta: chapterEntry.meta,
          title: pageMeta.title,
          bodyHtml,
          leadFigure,
          pageNumber: pageMeta.pageNumber,
          displayTitle: pageMeta.displayTitle,
        }),
      });

      globalPageIndex += 1;
    }

    for (let index = 0; index < renderedPages.length; index += 2) {
      const spreadPages = renderedPages.slice(index, index + 2);
      const spreadBase = spreadPages[0];
      const spreadSuffix =
        spreadPages.length > 1 ? `-${spreadPages[spreadPages.length - 1].filename}` : '';

      content.push({
        title: spreadBase.title,
        filename: `${spreadBase.filename}${spreadSuffix}`,
        excludeFromToc: true,
        data: `<section class="reader-spread">${spreadPages.map((page) => page.data).join('\n')}</section>`,
      });
    }
  }

  const planningRoots = (options?.planningDirs ?? [])
    .map((d) => path.resolve(d))
    .filter((d) => fs.existsSync(d));
  const annotationsExport = options?.annotationsFile
    ? loadAnnotationsExportFile(path.resolve(options.annotationsFile))
    : null;

  let planningManifest: PortfolioPlanningPackManifestV1 | null = null;

  if (planningRoots.length > 0) {
    const appendix = await buildPlanningAppendixContent(folder, planningRoots);
    content.push(...appendix.content);
    if (appendix.manifestEntries.length > 0) {
      planningManifest = {
        planningPackManifestVersion: 1,
        entries: appendix.manifestEntries,
      };
    }
  }

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const option = {
    title: meta.title,
    author: meta.author,
    tocTitle: 'Contents',
    appendChapterTitles: false,
    css: EPUB_CSS,
    customOpfTemplatePath: path.join(__dirname, 'templates', 'content.opf.ejs'),
    content,
  };

  await new Epub(option, outputPath).promise;
  if (planningManifest) {
    await injectPortfolioPlanningPackManifest(outputPath, planningManifest);
  }
  if (annotationsExport) {
    await injectPortfolioAnnotations(outputPath, annotationsExport);
  }
  console.log('EPUB:', outputPath);
}
