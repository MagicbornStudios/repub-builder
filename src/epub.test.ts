import fs from 'fs';
import os from 'os';
import path from 'path';
import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';
import { runEpub } from './epub.js';
import {
  PORTFOLIO_ANNOTATIONS_JSON_PATH,
  parseAnnotationsFile,
  sha256Hex,
} from './reader/epub-annotations.js';

const tempDirs: string[] = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repub-annotations-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('runEpub annotations embedding', () => {
  it('embeds a canonicalized annotations export into the built epub', async () => {
    const bookDir = makeTempDir();
    const outputPath = path.join(bookDir, 'book.epub');
    const annotationsPath = path.join(bookDir, 'author-annotations.json');

    fs.writeFileSync(
      path.join(bookDir, 'book.json'),
      JSON.stringify({ title: 'Spec Book', author: 'Tester' }, null, 2),
    );
    fs.writeFileSync(
      path.join(bookDir, '001-page-001-opening.md'),
      ['---', 'title: Opening', 'page: 1', '---', '', '# Opening', '', 'Hello world.'].join('\n'),
    );
    fs.writeFileSync(
      annotationsPath,
      `${JSON.stringify(
        {
          schema: 'portfolio-epub-annotations',
          version: 1,
          storageKey: 'spec-book',
          contentSha256: 'placeholder',
          annotations: [
            {
              id: 'a1',
              cfiRange: 'epubcfi(/6/2!/4/2,/1:0,/1:4)',
              quote: 'Hello',
              note: 'Author note',
              color: 'amber',
              createdAt: '2026-03-30T00:00:00.000Z',
              updatedAt: '2026-03-30T00:00:00.000Z',
            },
          ],
        },
        null,
        2,
      )}\n`,
    );

    await runEpub(bookDir, outputPath, { annotationsFile: annotationsPath });

    const outputBuffer = fs.readFileSync(outputPath);
    const zip = await JSZip.loadAsync(outputBuffer);
    const embedded = await zip.file(PORTFOLIO_ANNOTATIONS_JSON_PATH)?.async('string');
    const parsed = parseAnnotationsFile(JSON.parse(embedded ?? 'null') as unknown);
    const outputArrayBuffer = outputBuffer.buffer.slice(
      outputBuffer.byteOffset,
      outputBuffer.byteOffset + outputBuffer.byteLength,
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.storageKey).toBe('spec-book');
    expect(parsed?.annotations).toHaveLength(1);
    expect(parsed?.annotations[0]?.note).toBe('Author note');
    expect(parsed?.contentSha256).toBe(await sha256Hex(outputArrayBuffer));
  });
});
