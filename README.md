# @portfolio/repub-builder

Build **RichEPub** (`.repub`) files from a Vite + React + Tailwind project, and reuse the same reader/runtime package in host apps. The output is a ZIP container with a manifest (`repub.json`), entry HTML, and bundled assets.

## Install

This package is meant to be installed directly from GitHub instead of npm:

```bash
pnpm add git+https://github.com/MagicbornStudios/repub-builder.git#main
```

For a pinned install, replace `#main` with a tag such as `#v0.1.0`.

## Usage

From a repub project directory with `vite.config.ts` and build output in `dist/`:

```bash
npx repub-build
# or
npx repub-build /path/to/repub-project
```

Options:

- `--skip-install` Skip `npm install` before build
- `--skip-build` Skip the Vite build and use the existing `dist/`

Output: a `.repub` file in the project directory.

## Watch (arbitrary command)

Run a command once at startup, then again whenever files under a directory change (debounced). Uses **chokidar** for recursive watching.

```bash
repub watch <watchDir> [--debounce <ms>] [--cwd <dir>] -- <command...>
```

Example from the portfolio monorepo root (rebuild site EPUBs + manifest when `books/` changes):

```bash
repub watch books --debounce 600 --cwd . -- node scripts/build-books.cjs
```

## Programmatic API

```ts
import { buildRepub } from '@portfolio/repub-builder';

const outPath = await buildRepub({ projectDir: process.cwd() });
console.log('Built:', outPath);
```

## Format

See the RichEPub format spec in the portfolio docs repo for the container layout and `repub.json` schema:

https://github.com/MagicbornStudios/custom_portfolio/tree/main/apps/portfolio/content/docs/richepub

## Package direction

This repo is the standalone source of truth for the build pipeline and shared reader runtime. The portfolio monorepo vendors it back as a submodule, but the package surface is designed to work as a normal git-installed `dist/` library.
