// Copies the canonical consolidated-results.json (repo root) into public/ so the
// static site can fetch it. Runs automatically before dev/build (npm pre-hooks).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../consolidated-results.json');
const dest = resolve(here, '../public/consolidated-results.json');

if (existsSync(src)) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log('[sync-data] consolidated-results.json -> public/');
} else {
  console.warn('[sync-data] repo-root consolidated-results.json not found; using existing public/ copy');
}
