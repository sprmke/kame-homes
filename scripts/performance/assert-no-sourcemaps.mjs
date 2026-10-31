#!/usr/bin/env node
/**
 * CI guard (production-readiness doc 02, Phase 2.1/2.5) — no `.map` file may
 * reach the deployed output.
 *
 * `ui/vite.config.ts` sets `sourcemap: 'hidden'` only when PostHog source-map
 * upload is configured (POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID), and
 * that plugin's `deleteAfterUpload: true` removes the generated `.map` files
 * from `dist` once they've been uploaded for symbolication. A public `.map`
 * file hands an attacker the readable source of the admin dashboard — this
 * script is the backstop that catches a future config change (e.g. the
 * upload step failing silently, or `deleteAfterUpload` being flipped) before
 * it ships.
 *
 * Usage: node scripts/performance/assert-no-sourcemaps.mjs (run after `bun run build`)
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = path.join(repoRoot, 'ui/dist');

function fail(msg) {
  console.error(`assert-no-sourcemaps: ${msg}`);
  process.exit(1);
}

if (!existsSync(distDir)) fail('ui/dist not found — run `bun run build` first.');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const mapFiles = walk(distDir).filter((f) => f.endsWith('.map'));

if (mapFiles.length > 0) {
  console.error(`assert-no-sourcemaps: ${mapFiles.length} source map(s) found in ui/dist:`);
  for (const f of mapFiles) {
    console.error(`  - ${path.relative(distDir, f)} (${statSync(f).size} bytes)`);
  }
  console.error(
    '\nA public .map file exposes readable admin-dashboard source. If PostHog source-map ' +
      'upload is enabled, deleteAfterUpload should have removed these — check the upload step.'
  );
  process.exit(1);
}

console.log('assert-no-sourcemaps: OK — no .map files in ui/dist.');
