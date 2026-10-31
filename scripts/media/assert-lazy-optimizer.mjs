#!/usr/bin/env node
/**
 * CI guard (plan §10.6) — `browser-image-compression` must stay a lazy chunk.
 *
 * The optimizer (`ui/src/lib/media/imageOptimization.ts`) pulls the library in
 * with a dynamic `import()` so it never ships in the initial/vendor bundle and
 * only downloads once a viewer actually picks an image to optimize.
 *
 * This script runs after `vite build` and fails if:
 *   1. `dist/index.html` eagerly references the library (modulepreload / script), or
 *   2. the library got merged into an eagerly-loaded chunk instead of its own
 *      code-split chunk.
 *
 * Usage:  node scripts/media/assert-lazy-optimizer.mjs [dist-dir]
 *         (defaults to ui/dist)
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const distDir = process.argv[2] ? process.argv[2] : join(repoRoot, 'ui', 'dist');
const assetsDir = join(distDir, 'assets');
const indexHtml = join(distDir, 'index.html');

const LIB = 'browser-image-compression';
// A token that appears in the library source but nowhere in our own code.
const LIB_FINGERPRINT = 'drawImageInCanvas';

function fail(msg) {
  console.error(`\n✗ lazy-optimizer assertion failed:\n  ${msg}\n`);
  process.exit(1);
}

if (!existsSync(distDir)) fail(`build output not found at ${distDir} — run \`bun run build\` first`);
if (!existsSync(indexHtml)) fail(`no index.html in ${distDir}`);

const html = readFileSync(indexHtml, 'utf8');
if (html.includes(LIB)) {
  fail(`${LIB} is referenced from index.html — it must be dynamically imported, not eager`);
}

const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));

// Which eagerly-loaded entry/preloaded chunks does index.html pull in?
const eagerChunks = new Set(
  [...html.matchAll(/(?:src|href)="[^"]*\/assets\/([^"]+\.js)"/g)].map((m) => m[1])
);

const lazyChunk = jsFiles.find((f) => f.startsWith(`${LIB}-`) || f.startsWith(`${LIB}.`));
if (!lazyChunk) {
  fail(`no dedicated \`${LIB}-*.js\` chunk found — the library was not code-split`);
}
if (eagerChunks.has(lazyChunk)) {
  fail(`${lazyChunk} is eagerly loaded by index.html`);
}

// Defence in depth: the fingerprint must not appear inside any eager chunk.
for (const chunk of eagerChunks) {
  const p = join(assetsDir, chunk);
  if (existsSync(p) && readFileSync(p, 'utf8').includes(LIB_FINGERPRINT)) {
    fail(`${LIB} source appears inside eagerly-loaded chunk ${chunk}`);
  }
}

console.log(`✓ ${LIB} is lazy: served as ${lazyChunk}, absent from the initial bundle`);
