#!/usr/bin/env node
/**
 * CI guard (production-readiness doc 04, Phase 4.3) — `ui/index.html` may
 * never gain a plain, render-blocking `<script src="...">` tag.
 *
 * Any script added to the document head/body must be `defer`, `async`, or
 * `type="module"` (module scripts are deferred by default) so it cannot
 * block first paint the way the render-blocking Google Fonts stylesheet
 * used to (fixed in this same doc — see the comment in ui/index.html).
 *
 * The one exception is the small inline theme-detection script, which is
 * *deliberately* synchronous (it must run before first paint to avoid a
 * flash of the wrong theme) — this script only checks tags with a `src`
 * attribute, so the inline script is untouched by this rule.
 *
 * Usage: node scripts/performance/assert-no-blocking-scripts.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const indexHtmlPath = path.join(repoRoot, 'ui/index.html');

function fail(msg) {
  console.error(`assert-no-blocking-scripts: ${msg}`);
  process.exit(1);
}

if (!existsSync(indexHtmlPath)) fail('ui/index.html not found.');

const html = readFileSync(indexHtmlPath, 'utf8');
const scriptTags = [...html.matchAll(/<script\b([^>]*)>/g)];

const offenders = [];
for (const match of scriptTags) {
  const attrs = match[1];
  const hasSrc = /\bsrc=/.test(attrs);
  if (!hasSrc) continue; // inline scripts (e.g. the theme-flash guard) are fine

  const isDeferred = /\bdefer\b/.test(attrs) || /\basync\b/.test(attrs);
  const isModule = /type=["']module["']/.test(attrs);
  if (!isDeferred && !isModule) {
    offenders.push(match[0]);
  }
}

if (offenders.length > 0) {
  console.error('assert-no-blocking-scripts: render-blocking <script src> found in ui/index.html:');
  for (const o of offenders) console.error(`  ${o}`);
  console.error('\nAdd `defer`, `async`, or `type="module"` — a plain <script src> blocks first paint.');
  process.exit(1);
}

console.log('assert-no-blocking-scripts: OK — no render-blocking <script src> in ui/index.html.');
