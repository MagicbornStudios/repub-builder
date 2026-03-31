import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { PORTFOLIO_PLANNING_PACK_MANIFEST_ZIP_PATH } from '../planning-pack-manifest';
import { extractPlanningPackFromEpub, readerBookPlanningPackId } from './planning-pack-from-epub';

function sampleAppendixXhtml(pathLabel: string, bodyInner: string, raw = false): string {
  if (raw) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body>
<article class="planning-appendix-doc planning-appendix-doc--raw">
<header class="planning-appendix-header">
<p class="planning-appendix-path">${pathLabel}</p>
</header>
<pre class="planning-appendix-pre">line1&amp;2</pre>
</article>
</body></html>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><body>
<article class="planning-appendix-doc">
<header class="planning-appendix-header">
<p class="planning-appendix-path">${pathLabel}</p>
</header>
<div class="planning-appendix-body">${bodyInner}</div>
</article>
</body></html>`;
}

describe('readerBookPlanningPackId', () => {
  it('prefixes slug', () => {
    expect(readerBookPlanningPackId('mordreds_tale')).toBe('book-mordreds_tale-planning');
  });
});

describe('extractPlanningPackFromEpub', () => {
  it('reads manifest entries and extracts body text', async () => {
    const zip = new JSZip();
    zip.file(
      PORTFOLIO_PLANNING_PACK_MANIFEST_ZIP_PATH,
      JSON.stringify({
        planningPackManifestVersion: 1,
        entries: [
          {
            href: 'OEBPS/plan-demo.xhtml',
            virtualPath: 'docs/books/planning/demo.md',
            title: 'Demo',
            sourceKind: 'md',
          },
        ],
      }),
    );
    zip.file('OEBPS/plan-demo.xhtml', sampleAppendixXhtml('demo.md', '<p>Hello <em>world</em></p>'));

    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const pack = await extractPlanningPackFromEpub(buf, { bookSlug: 'mordreds_tale' });

    expect(pack?.id).toBe('book-mordreds_tale-planning');
    expect(pack?.files).toHaveLength(1);
    expect(pack?.files[0].path).toBe('docs/books/planning/demo.md');
    expect(pack?.files[0].content).toContain('Hello');
    expect(pack?.files[0].content).toContain('world');
  });

  it('falls back to OEBPS/plan-*.xhtml without manifest', async () => {
    const zip = new JSZip();
    zip.file(
      'OEBPS/plan-orphan.xhtml',
      sampleAppendixXhtml('notes / todo.md', '<p>Fallback</p>'),
    );
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const pack = await extractPlanningPackFromEpub(buf, { bookSlug: 'x' });
    expect(pack?.files[0].path).toBe('docs/books/planning/notes/todo.md');
    expect(pack?.files[0].content).toContain('Fallback');
  });

  it('decodes raw pre content', async () => {
    const zip = new JSZip();
    zip.file('OEBPS/plan-raw.xhtml', sampleAppendixXhtml('x', '', true));
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const pack = await extractPlanningPackFromEpub(buf, { bookSlug: 'y' });
    expect(pack?.files[0].content).toContain('line1&2');
  });

  it('returns null when no planning appendix', async () => {
    const zip = new JSZip();
    zip.file('OEBPS/chapter1.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>Hi</p></body></html>');
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    expect(await extractPlanningPackFromEpub(buf, { bookSlug: 'z' })).toBeNull();
  });
});
