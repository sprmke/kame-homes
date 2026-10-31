#!/usr/bin/env node
/**
 * CI budget gate (plan doc 00, Phase 0.5): fails the build when bundle totals
 * regress past the thresholds in performance-budgets.json.
 *
 * Distinct from scripts/performance/check-initial-bundle-budget.mjs (which only
 * checks the entry + modulepreload set) — this also checks the *total* shipped
 * JS/CSS across all chunks, which catches slow bundle bloat that never crosses
 * the initial-payload boundary (e.g. a new heavy dashboard-only dependency).
 *
 * Reads `performance-budgets.json.warnOnly` — while true, over-budget findings
 * are printed but do not fail the run (see doc 00 Phase 0.5: "start every new
 * budget in warn mode for one week of merges, then flip to fail").
 *
 * Run after `bun run build`.
 */
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = path.join(repoRoot, 'ui/dist');
const assetsDir = path.join(distDir, 'assets');
const budgetsPath = path.join(repoRoot, 'performance-budgets.json');

function fail(msg) {
  console.error(`check-budgets: ${msg}`);
  process.exit(1);
}

if (!existsSync(distDir)) fail('ui/dist not found — run `bun run build` first.');
if (!existsSync(budgetsPath)) fail('performance-budgets.json not found at repo root.');

const budgets = JSON.parse(readFileSync(budgetsPath, 'utf8'));
const warnOnly = budgets.warnOnly !== false;

const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
const jsFiles = assetFiles.filter((f) => f.endsWith('.js'));
const cssFiles = assetFiles.filter((f) => f.endsWith('.css'));

function gzipKib(files) {
  const totalBytes = files.reduce((sum, f) => {
    const raw = readFileSync(path.join(assetsDir, f));
    return sum + gzipSync(raw, { level: 6 }).byteLength;
  }, 0);
  return totalBytes / 1024;
}

const totalJsGzipKib = gzipKib(jsFiles);
const totalCssGzipKib = gzipKib(cssFiles);

const checks = [
  {
    name: 'Total JS (gzip)',
    actual: totalJsGzipKib,
    budget: budgets.bundle?.totalJsGzipKib,
  },
  {
    name: 'Total CSS (gzip)',
    actual: totalCssGzipKib,
    budget: budgets.bundle?.totalCssGzipKib,
  },
];

console.log('Bundle budget check:');
const failures = [];
for (const check of checks) {
  if (check.budget == null) continue;
  const over = check.actual > check.budget;
  const status = over ? (warnOnly ? 'WARN' : 'FAIL') : 'OK';
  console.log(`  [${status}] ${check.name}: ${check.actual.toFixed(1)} KiB (budget ${check.budget} KiB)`);
  if (over && !warnOnly) failures.push(check.name);
}

if (failures.length > 0) {
  console.error(`\ncheck-budgets: ${failures.length} budget(s) exceeded: ${failures.join(', ')}`);
  process.exit(1);
}

if (warnOnly) {
  console.log('\n(warnOnly mode — set performance-budgets.json "warnOnly": false to enforce.)');
}
