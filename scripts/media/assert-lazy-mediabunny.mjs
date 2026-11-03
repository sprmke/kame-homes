#!/usr/bin/env node
/**
 * CI guard: Mediabunny (WebCodecs video/audio probing, transcoding, posters) must stay lazy.
 *
 * The Marketing media pipeline (`ui/src/features/dashboard/marketing/lib/media/prepareMarketingMedia.ts`)
 * and the Remotion web renderer both pull it in with dynamic `import()`, so it only downloads
 * inside the Videos editor or on a media upload. This runs after `vite build` and fails when:
 *   1. `dist/index.html` references a Mediabunny chunk, or
 *   2. the word "mediabunny" appears inside any chunk the entry loads eagerly (the entry, vendor
 *      chunks and modulepreloads), which means a static import slipped in.
 *
 * Usage:  node scripts/media/assert-lazy-mediabunny.mjs [dist-dir]   (defaults to ui/dist)
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const distDir = process.argv[2] ? process.argv[2] : join(repoRoot, 'ui', 'dist');
const assetsDir = join(distDir, 'assets');
const indexHtml = join(distDir, 'index.html');

function fail(message) {
  console.error(`\n✗ lazy-mediabunny assertion failed:\n  ${message}\n`);
  process.exit(1);
}

if (!existsSync(indexHtml)) fail(`no index.html in ${distDir}; run \`bun run build\` first`);
const html = readFileSync(indexHtml, 'utf8');
if (/mediabunny/i.test(html))
  fail('index.html references Mediabunny; it must be dynamically imported');

const eager = [...html.matchAll(/(?:src|href)="[^"]*\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
for (const chunk of eager) {
  const path = join(assetsDir, chunk);
  if (existsSync(path) && /mediabunny/i.test(readFileSync(path, 'utf8'))) {
    fail(`Mediabunny source appears inside eagerly-loaded chunk ${chunk}`);
  }
}

const hasLazy = readdirSync(assetsDir).some(
  (file) =>
    file.endsWith('.js') &&
    !eager.includes(file) &&
    /mediabunny/i.test(readFileSync(join(assetsDir, file), 'utf8'))
);
if (!hasLazy)
  fail('no lazy chunk contains Mediabunny; the check is not looking at the right build');

console.log(`✓ Mediabunny is lazy: absent from ${eager.length} eagerly-loaded chunks`);
