import type { ReaderAppSearch } from './types';

/** Build reader URL for a host-mounted path (e.g. `/apps/reader`). */
export function readerAppHref(readerAppPath: string, opts?: ReaderAppSearch): string {
  const p = new URLSearchParams();
  if (opts?.book) p.set('book', opts.book);
  if (opts?.record) p.set('record', opts.record);
  if (opts?.at) p.set('at', opts.at);
  if (opts?.cfi) p.set('cfi', opts.cfi);
  const q = p.toString();
  return q ? `${readerAppPath}?${q}` : readerAppPath;
}
