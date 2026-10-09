#!/usr/bin/env node
/**
 * Bundle-size budget for the new app (index.html), measured gzipped from the last `vite build`:
 *   entry    the app's own entry chunk (main-*.js)
 *   initial  everything the first page load downloads: the entry plus its static imports (vendor chunks)
 *   app      every JS chunk the app can load, lazy screens included
 *
 * Budgets sit about 15% above the sizes when they were set; raise them deliberately, in the same change
 * that grows the bundle. Usage: npm run build && node scripts/check-bundle-size.mjs [--json]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

// reset 2026-10-09 when the legacy client was deleted, from entry 62.2 kB, initial 191.8 kB, app 278.1 kB:
// modules the legacy client shared with the app (deck storage, protocol helpers) moved from shared chunks
// into the entry, so the entry grew while the first load shrank
// app raised 2026-10-09 from 306 kB for M5 (admin console, about page, event variants, report dialog, deck sync),
// all lazy chunks; the Events screen became lazy to keep the entry under budget
// app raised 2026-10-09 from 322 kB for B082 (internationalization): the Spanish catalog is a lazy chunk of its own
// (6.4 kB), downloaded only by players who use Spanish; the Settings dialog went lazy, so the entry shrank 3.7 kB
const BUDGET_KB = {
  entry: 68,
  initial: 212,
  app: 336,
};

const dist = new URL('../dist/', import.meta.url).pathname;
const manifestPath = join(dist, '.vite', 'manifest.json');
if (!existsSync(manifestPath)) {
  console.error(`No build manifest at ${manifestPath}. Run \`npm run build\` first.`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

const gzipCache = new Map();
function gzipKb(file) {
  if (!gzipCache.has(file)) gzipCache.set(file, gzipSync(readFileSync(join(dist, file))).length / 1024);
  return gzipCache.get(file);
}

/** JS files reachable from a manifest key, through static imports and (optionally) dynamic ones. */
function reachable(key, { dynamic }) {
  const seen = new Set();
  const files = new Set();
  const visit = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const chunk = manifest[name];
    if (!chunk) return;
    if (chunk.file.endsWith('.js')) files.add(chunk.file);
    for (const next of chunk.imports ?? []) visit(next);
    if (dynamic) for (const next of chunk.dynamicImports ?? []) visit(next);
  };
  visit(key);
  return [...files];
}

const sum = (files) => files.reduce((total, file) => total + gzipKb(file), 0);

const entry = manifest['index.html'];
if (!entry?.isEntry) {
  console.error('index.html is not an entry in the build manifest.');
  process.exit(2);
}
const initialFiles = reachable('index.html', { dynamic: false });
const appFiles = reachable('index.html', { dynamic: true });
const allFiles = readdirSync(join(dist, 'assets')).filter((file) => file.endsWith('.js')).map((file) => `assets/${file}`);

const measured = {
  entry: gzipKb(entry.file),
  initial: sum(initialFiles),
  app: sum(appFiles),
};

const rows = [
  ['entry', `${entry.file}`, measured.entry, BUDGET_KB.entry],
  ['initial', `${initialFiles.length} chunks`, measured.initial, BUDGET_KB.initial],
  ['app', `${appFiles.length} chunks`, measured.app, BUDGET_KB.app],
  ['all dist JS', `${allFiles.length} chunks`, sum(allFiles), null],
];

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ measuredKb: measured, budgetKb: BUDGET_KB }, null, 2));
} else {
  console.log('JS bundle size (gzip)');
  for (const [name, detail, kb, budget] of rows) {
    const status = budget === null ? '' : kb <= budget ? `  ok   (budget ${budget} kB)` : `  OVER (budget ${budget} kB)`;
    console.log(`  ${name.padEnd(12)} ${kb.toFixed(1).padStart(7)} kB${status}   ${detail}`);
  }
  console.log('\n  initial chunks:');
  for (const file of initialFiles.sort((a, b) => gzipKb(b) - gzipKb(a))) {
    console.log(`    ${gzipKb(file).toFixed(1).padStart(7)} kB  ${file}`);
  }
}

const over = Object.entries(measured).filter(([name, kb]) => kb > BUDGET_KB[name]);
if (over.length > 0) {
  console.error(`\nBundle budget exceeded: ${over.map(([name, kb]) => `${name} ${kb.toFixed(1)} kB > ${BUDGET_KB[name]} kB`).join(', ')}.`);
  console.error('Trim the bundle (lazy-load the new code?) or raise BUDGET_KB in scripts/check-bundle-size.mjs on purpose.');
  process.exit(1);
}
