#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildRepub } from './index.js';
import { runRead } from './read.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const sub = argv[0];

function help(): void {
  console.log(`repub - Build and read RichEPub (.repub) and EPUB

Usage:
  repub build [project-dir]     Build .repub from Vite project (default: cwd)
  repub read <file.repub>       Serve reader and open in browser
  repub epub <folder> [--planning <dir>]... [--annotations <file>] [--output out.epub]  Pack folder of .md/.mdx into EPUB

Options:
  --skip-install   (build) Skip npm install before build
  --skip-build     (build) Skip Vite build; use existing dist/
  --output <path>  (epub) Output file path
  --planning <dir> (epub) Repeatable; bundle .md/.mdx/.xml/.toml/.txt from each tree as spine appendix (excluded from TOC)
  --annotations <file> (epub) Optional exported annotation JSON to embed into META-INF/portfolio-annotations.json
  --help, -h       Show this help
  --version, -v    Show version
`);
}

function version(): void {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version: string };
  console.log(pkg.version);
}

async function main(): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    help();
    return;
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    version();
    return;
  }

  if (sub === 'build') {
    const projectDir = argv[1] ? path.resolve(argv[1]) : process.cwd();
    const skipInstall = argv.includes('--skip-install');
    const skipBuild = argv.includes('--skip-build');
    const out = await buildRepub({ projectDir, skipInstall, skipBuild });
    console.log('Built:', out);
    return;
  }

  if (sub === 'read') {
    const fileArg = argv[1];
    if (!fileArg) {
      console.error('repub read requires <file.repub>');
      process.exit(1);
    }
    const repubPath = path.resolve(fileArg);
    await runRead(repubPath);
    return;
  }

  if (sub === 'epub') {
    const planningDirs: string[] = [];
    let annotationsFile: string | undefined;
    let outputPath: string | undefined;
    const positional: string[] = [];
    for (let i = 1; i < argv.length; i += 1) {
      const a = argv[i];
      if (a === '--output') {
        const next = argv[i + 1];
        if (!next) {
          console.error('repub epub: --output requires a path');
          process.exit(1);
        }
        outputPath = path.resolve(next);
        i += 1;
        continue;
      }
      if (a === '--planning') {
        const next = argv[i + 1];
        if (!next) {
          console.error('repub epub: --planning requires a directory');
          process.exit(1);
        }
        planningDirs.push(path.resolve(next));
        i += 1;
        continue;
      }
      if (a === '--annotations') {
        const next = argv[i + 1];
        if (!next) {
          console.error('repub epub: --annotations requires a file');
          process.exit(1);
        }
        annotationsFile = path.resolve(next);
        i += 1;
        continue;
      }
      if (a.startsWith('-')) {
        console.error(`Unknown option: ${a}`);
        process.exit(1);
      }
      positional.push(a);
    }
    const folderArg = positional[0];
    if (!folderArg) {
      console.error('repub epub requires <folder>');
      process.exit(1);
    }
    const folder = path.resolve(folderArg);
    const resolvedOutput = outputPath ?? path.join(folder, 'book.epub');
    const { runEpub } = await import('./epub.js');
    await runEpub(
      folder,
      resolvedOutput,
      planningDirs.length > 0 || annotationsFile
        ? { planningDirs, annotationsFile }
        : undefined,
    );
    return;
  }

  // Legacy: no subcommand -> treat first arg as project dir for build
  const projectDir = argv[0] ? path.resolve(argv[0]) : process.cwd();
  const skipInstall = argv.includes('--skip-install');
  const skipBuild = argv.includes('--skip-build');
  const out = await buildRepub({ projectDir, skipInstall, skipBuild });
  console.log('Built:', out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
