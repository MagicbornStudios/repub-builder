import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import {
  annotationsToExportPayload,
  embedAnnotationsInEpub,
  loadEmbeddedAnnotationsFromEpub,
  sha256Hex,
} from './epub-annotations.js';

describe('epub annotation helpers', () => {
  it('loads embedded annotations and keeps the canonical hash stable', async () => {
    const baseZip = new JSZip();
    baseZip.file('mimetype', 'application/epub+zip');
    baseZip.file('META-INF/container.xml', '<container />');
    baseZip.file('OEBPS/chapter.xhtml', '<html><body><p>Hello world</p></body></html>');

    const baseBuffer = await baseZip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    const baseHash = await sha256Hex(baseBuffer);
    const payload = annotationsToExportPayload('demo-book', baseHash, [
      {
        id: 'a1',
        cfiRange: 'epubcfi(/6/2!/4/2,/1:0,/1:4)',
        quote: 'Hello',
        note: 'inline note',
        color: 'amber',
        createdAt: '2026-03-30T00:00:00.000Z',
        updatedAt: '2026-03-30T00:00:00.000Z',
      },
    ]);

    const annotatedBlob = await embedAnnotationsInEpub(baseBuffer, payload);
    const annotatedBuffer = await annotatedBlob.arrayBuffer();
    const loaded = await loadEmbeddedAnnotationsFromEpub(annotatedBuffer);

    expect(loaded?.storageKey).toBe('demo-book');
    expect(loaded?.annotations).toHaveLength(1);
    expect(loaded?.annotations[0]?.note).toBe('inline note');
    expect(await sha256Hex(annotatedBuffer)).toBe(baseHash);
  });
});
