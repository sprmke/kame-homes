#!/usr/bin/env node
/**
 * CI gate: fail the build if the Workbox precache set grows past the budget in
 * scripts/pwa/precache-globs.json.
 *
 * The precache is the install payload for every user — an accidental un-ignore of
 * a heavy lazy chunk (Polotno studio, mediabunny encoders) or a new giant
 * dependency landing in the main bundle must be a loud failure, not a silent
 * regression.
 *
 * Run after `bun run build` (uses ui/dist). Mirrors the vite injectManifest globs.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = path.join(repoRoot, 'ui/dist');
const cfg = JSON.parse(
  readFileSync(path.join(repoRoot, 'scripts/pwa/precache-globs.json'), 'utf8')
);

/** Very small glob → RegExp (supports `**`, `*`, `?`, `{a,b}`, `.`). */
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 1;
        if (glob[i + 1] === '/') i += 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') re += '[^/]';
    else if (c === '.') re += '\\.';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      re += `(${glob
        .slice(i + 1, end)
        .split(',')
        .join('|')})`;
      i = end;
    } else re += c.replace(/[+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

const includeRes = cfg.globPatterns.map(globToRegExp);
// vite-plugin-pwa auto-excludes the emitted SW itself from the precache manifest.
const ignoreRes = [...cfg.globIgnores, 'sw.js', 'sw.js.map', 'registerSW.js'].map(globToRegExp);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(distDir);
} catch {
  console.error(`[precache-budget] ui/dist not found — run \`bun run build\` first.`);
  process.exit(1);
}

let totalBytes = 0;
const kept = [];
for (const abs of files) {
  const rel = path.relative(distDir, abs).split(path.sep).join('/');
  if (!includeRes.some((re) => re.test(rel))) continue;
  if (ignoreRes.some((re) => re.test(rel))) continue;
  const size = statSync(abs).size;
  totalBytes += size;
  kept.push({ rel, size });
}

kept.sort((a, b) => b.size - a.size);
const totalKiB = totalBytes / 1024;
const budgetKiB = cfg.budgetKiB;

console.log(
  `[precache-budget] ${kept.length} precached files, ${totalKiB.toFixed(1)} KiB / ${budgetKiB} KiB budget`
);
for (const f of kept.slice(0, 8)) {
  console.log(`  ${(f.size / 1024).toFixed(1).padStart(9)} KiB  ${f.rel}`);
}

if (totalKiB > budgetKiB) {
  console.error(
    `\n[precache-budget] OVER BUDGET by ${(totalKiB - budgetKiB).toFixed(1)} KiB.\n` +
      `Reduce the precache: code-split the main bundle, or add the offending chunk to\n` +
      `globIgnores in scripts/pwa/precache-globs.json and let it runtime-cache instead.`
  );
  process.exit(1);
}
console.log('[precache-budget] OK');
