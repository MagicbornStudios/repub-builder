import { spawn } from 'node:child_process';
import path from 'node:path';
import chokidar from 'chokidar';

export type RepubWatchOptions = {
  /** Directory to watch (recursively). */
  watchDir: string;
  debounceMs: number;
  /** Working directory for the command. */
  cwd: string;
  /** argv-style: [executable, ...args] */
  command: string[];
};

function log(...parts: unknown[]) {
  console.log('[repub watch]', ...parts);
}

/**
 * Long-running file watcher: runs `command` once at startup, then again (debounced) when
 * anything under `watchDir` changes.
 */
export function runWatch(opts: RepubWatchOptions): void {
  const watchDir = path.resolve(opts.watchDir);
  const cwd = path.resolve(opts.cwd);
  const [exe, ...args] = opts.command;
  if (!exe) {
    console.error('repub watch: empty command after --');
    process.exit(1);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;

  const fire = () => {
    log(`run: ${opts.command.join(' ')} (cwd=${cwd})`);
    const child = spawn(exe, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
      shell: false,
    });
    child.on('error', (err) => {
      console.error('[repub watch] spawn error:', err);
    });
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fire();
    }, opts.debounceMs);
  };

  fire();
  log(`watching ${watchDir} (debounce ${opts.debounceMs}ms)`);

  chokidar
    .watch(watchDir, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 100 },
    })
    .on('all', () => {
      schedule();
    });
}
