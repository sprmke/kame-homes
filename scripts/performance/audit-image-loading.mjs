#!/usr/bin/env node
/**
 * Image loading/CLS audit (production-readiness doc 03, Phases 3.1-3.2).
 *
 * Reports (does not fail CI — see note below) every raw `<img` JSX tag in
 * `ui/src` that is missing:
 *   - an explicit `loading` attribute (defaults to eager, the opposite of
 *     what most below-fold images need), and/or
 *   - a size hint (`width`/`height` attrs, or a `aspect-` / `size-` Tailwind
 *     class in `className`) that prevents layout shift while it loads.
 *
 * Deliberately a *report*, not a blocking gate: many of this app's images get
 * their box from a parent element's `aspect-*`/`size-*` class rather than
 * their own attributes, which this script cannot always see, and a chunk of
 * the un-annotated sites are conditionally-rendered post-upload previews
 * where `loading` has no real effect (already-in-viewport, user-triggered).
 * Blocking on a heuristic like this produces false positives that get the
 * check disabled. Use `--strict` to exit 1 anyway (e.g. for a one-off
 * cleanup sprint's CI gate).
 *
 * Usage: node scripts/performance/audit-image-loading.mjs [--strict]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(repoRoot, 'ui/src');
const strict = process.argv.includes('--strict');

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/** Extract each `<img ...>` (or `<img ... />`) tag's attribute source as one string. */
function extractImgTags(content) {
  const tags = [];
  const re = /<img\b[^>]*>/gs;
  let m;
  while ((m = re.exec(content))) {
    const start = m.index;
    const line = content.slice(0, start).split('\n').length;
    tags.push({ text: m[0], line });
  }
  return tags;
}

const files = walk(srcDir);
const findings = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes('<img')) continue;
  const rel = path.relative(repoRoot, file);
  for (const tag of extractImgTags(content)) {
    const hasLoading = /\bloading=/.test(tag.text);
    const hasDimAttrs = /\bwidth=/.test(tag.text) && /\bheight=/.test(tag.text);
    const hasSizeClassHint = /className=\{?[^}]*\b(aspect-|size-|h-full|w-full)/.test(tag.text);
    const hasSizeHint = hasDimAttrs || hasSizeClassHint;

    if (!hasLoading || !hasSizeHint) {
      findings.push({
        file: rel,
        line: tag.line,
        missingLoading: !hasLoading,
        missingSizeHint: !hasSizeHint,
      });
    }
  }
}

console.log(`audit-image-loading: scanned ${files.length} files, found ${findings.length} <img> tag(s) to review.\n`);

const missingLoading = findings.filter((f) => f.missingLoading);
const missingSize = findings.filter((f) => f.missingSizeHint);

console.log(`  ${missingLoading.length} missing an explicit \`loading\` attribute`);
console.log(`  ${missingSize.length} with no visible width/height or aspect-*/size-* size hint\n`);

if (findings.length > 0) {
  console.log('Detail (file:line — flags):');
  for (const f of findings) {
    const flags = [f.missingLoading && 'loading', f.missingSizeHint && 'size-hint']
      .filter(Boolean)
      .join(', ');
    console.log(`  ${f.file}:${f.line} — missing: ${flags}`);
  }
}

if (strict && findings.length > 0) {
  console.error(`\naudit-image-loading: --strict mode, failing on ${findings.length} finding(s).`);
  process.exit(1);
}
