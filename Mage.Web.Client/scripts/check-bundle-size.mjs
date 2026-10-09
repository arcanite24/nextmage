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
// app raised 2026-10-09 from 336 kB: first for the rest of M6 (spectator broadcast mode, practice tools, the guided
// first game, playmat settings, state patches, the PWA update prompt; measured 340.6 kB), then for M7 Career (about
// 14.5 kB of lazy Career screens and their messages, 2.7 kB more Spanish catalog). The entry only gained the Home
// entry point and its two messages
// app raised 2026-10-09 from 372 kB for M9 Career modes (campaign map, puzzle book, gauntlet, solo sealed and draft,
// weekly challenge): about 29.3 kB of lazy chunks, most of it their English and Spanish messages; on top of M8's
// Career progress screens (371.8 kB on their branch) with about 4 kB of headroom for the merge. The modes share one
// route in the entry (+0.3 kB)
// entry raised 2026-10-09 from 68 kB: the generated RPC client lives in the entry, and M9 added 18 Career mode
// methods to it; with M8 and M9 merged the entry measured 68.2 kB
// 2026-10-09 (playtest fixes, budgets unchanged): the icons the entry uses load with it (vendor-lucide), and icons only
// lazy screens use share one lazy chunk (vite.config.ts) instead of two dozen tiny ones; with both playtest branches
// merged: entry 65.8 kB, initial 199.5 kB, app 402.7 kB
// app raised 2026-10-09 from 405 kB for M10 (Career as a game: its own shell and HUD, the hub, opponent ladder, versus,
// results scene, pack opening, binder, ceremonies, menu navigation, synthesized cues and music, opponent voices in the
// match): about 18.6 kB of lazy Career chunks and their English and Spanish messages, measured 421.3 kB. The entry gained
// the /career layout route (+0.3 kB, 66.1 kB)
// app raised 2026-10-09 from 425 kB for the M10 polish (the shop as a counter of drawn booster packs, the new pack
// opening, the progress screen as a reward road, medal case and locker): lazy Career chunks and their messages,
// measured 426.7 kB
const BUDGET_KB = {
  entry: 69,
  initial: 212,
  app: 432,
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
