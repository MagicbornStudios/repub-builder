import fs from 'node:fs';
import { installHookLog } from '../../../scripts/run-install-hook-log.mjs';

installHookLog('[repub-builder] prepare: start');
fs.writeSync(
  2,
  '[repub-builder] prepare: tsup (ESM + DTS). Hooks log: repo `.tmp/pnpm-install-hooks.log`\n',
);
