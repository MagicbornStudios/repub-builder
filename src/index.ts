import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import archiver from 'archiver';
import type { RepubConfig, RepubManifest } from './types.js';

const FORMAT_VERSION = 1;
const BUILDER_VERSION = '1.0.0';

export interface BuildOptions {
  projectDir: string;
  skipInstall?: boolean;
  skipBuild?: boolean;
}

export function loadRepubConfig(projectDir: string): RepubConfig {
  const configPath = path.join(projectDir, 'repub.config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`repub.config.json not found in ${projectDir}`);
  }
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return {
    title: raw.title ?? 'Untitled',
    author: raw.author,
    entry: raw.entry ?? 'content/index.html',
    outputPath: raw.outputPath ?? path.join(projectDir, 'dist', 'book.repub'),
  };
}

export function getDependenciesFromPackageJson(projectDir: string): Record<string, string> {
  const pkgPath = path.join(projectDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return {};
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return typeof deps === 'object' && deps !== null ? deps : {};
}

function rewriteAssetPaths(html: string): string {
  return html
    .replace(/(\s(src|href)=["'])\.\/assets\//g, '$1../assets/')
    .replace(/(\s(src|href)=["'])\/assets\//g, '$1../assets/')
    .replace(/(\s(src|href)=["'])assets\//g, '$1../assets/');
}

export async function buildRepub(options: BuildOptions): Promise<string> {
  const { projectDir, skipInstall = false, skipBuild = false } = options;
  const config = loadRepubConfig(projectDir);
  const distDir = path.join(projectDir, 'dist');
  const outputPath = path.isAbsolute(config.outputPath!)
    ? config.outputPath!
    : path.join(projectDir, config.outputPath!);

  if (!skipInstall) {
    const install = spawnSync('npm', ['install'], { cwd: projectDir, stdio: 'inherit', shell: true });
    if (install.status !== 0) throw new Error('npm install failed');
  }

  if (!skipBuild) {
    const build = spawnSync('npm', ['run', 'build'], { cwd: projectDir, stdio: 'inherit', shell: true });
    if (build.status !== 0) throw new Error('npm run build failed');
  }

  if (!fs.existsSync(distDir)) throw new Error(`dist directory not found at ${distDir}`);

  const indexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexPath)) throw new Error('dist/index.html not found');

  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  indexHtml = rewriteAssetPaths(indexHtml);

  const assetsDir = path.join(distDir, 'assets');
  const manifest: RepubManifest = {
    formatVersion: FORMAT_VERSION,
    title: config.title,
    author: config.author,
    entry: 'content/index.html',
    dependencies: getDependenciesFromPackageJson(projectDir),
    buildInfo: {
      builderVersion: BUILDER_VERSION,
      buildTime: new Date().toISOString(),
    },
  };

  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return await new Promise<string>((resolve, reject) => {
    output.on('close', () => resolve(outputPath));
    archive.on('error', reject);
    archive.pipe(output);

    archive.append(JSON.stringify(manifest, null, 2), { name: 'repub.json' });
    archive.append(indexHtml, { name: 'content/index.html' });

    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir, { withFileTypes: true });
      for (const f of files) {
        const full = path.join(assetsDir, f.name);
        if (f.isFile()) {
          archive.file(full, { name: `assets/${f.name}` });
        }
      }
    }

    archive.finalize();
  });
}
