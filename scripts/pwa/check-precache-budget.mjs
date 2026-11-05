#!/usr/bin/env node
/**
 * CI gate: fail the build when a PWA precache tier outgrows its budget.
 *
 * The shell tier is what every visitor (including an anonymous guest on mobile
 * data opening a booking link) downloads during service-worker install. The host
 * tier is warmed only after a host signs in. On-demand chunks are never
 * precached — an accidental un-ignore of a heavy lazy chunk would land there and
 * trip the total budget.
 *
 * Reads `ui/dist/precache-tiers.json` (written by `scripts/pwa/generate-precache-tiers.mjs`)
 * and the budgets in `scripts/pwa/precache-globs.json`.
 *
 * Run after `bun run build`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tiersPath = path.join(repoRoot, 'ui/dist/precache-tiers.json');
const cfgPath = path.join(repoRoot, 'scripts/pwa/precache-globs.json');

const kib = (bytes) => parseFloat((bytes / 1024).toFixed(1));

let tiers;
let cfg;
try {
  tiers = JSON.parse(readFileSync(tiersPath, 'utf8'));
  cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
} catch {
  console.error('[precache-budget] ui/dist/precache-tiers.json not found — run `bun run build` first.');
  process.exit(1);
}

const budgets = {
  shell: cfg.shellBudgetKiB ?? 3072,
  host: cfg.hostBudgetKiB ?? 9216,
};
const totalBudgetKiB = cfg.totalBudgetKiB ?? 12288;

const totals = {};
let failed = false;

for (const tier of ['shell', 'host']) {
  const entries = tiers[tier] ?? [];
  const bytes = entries.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0);
  const totalKiB = kib(bytes);
  totals[tier] = totalKiB;
  const budget = budgets[tier];
  const used = budget > 0 ? Math.round((totalKiB / budget) * 100) : 0;
  console.log(
    `[precache-budget] ${tier.padEnd(5)} ${String(entries.length).padStart(4)} files  ` +
      `${String(totalKiB).padStart(9)} KiB / ${budget} KiB (${used}%)`
  );
  for (const entry of [...entries]
    .sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0))
    .slice(0, 8)) {
    console.log(`  ${kib(entry.bytes ?? 0).toFixed(1).padStart(9)} KiB  ${entry.url}`);
  }
  if (totalKiB > budget) {
    console.error(`\n[precache-budget] ${tier} tier OVER BUDGET by ${(totalKiB - budget).toFixed(1)} KiB.`);
    failed = true;
  }
}

const onDemand = tiers.onDemand ?? [];
const onDemandKiB = kib(onDemand.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0));
console.log(
  `[precache-budget] on-demand ${String(onDemand.length).padStart(4)} files  ` +
    `${String(onDemandKiB).padStart(9)} KiB (never precached)`
);

const allKiB = kib([...(tiers.shell ?? []), ...(tiers.host ?? []), ...onDemand].reduce(
  (sum, entry) => sum + (entry.bytes ?? 0),
  0
));
console.log(`[precache-budget] total   ${allKiB} KiB / ${totalBudgetKiB} KiB`);
if (allKiB > totalBudgetKiB) {
  console.error(`\n[precache-budget] total bundle OVER BUDGET by ${(allKiB - totalBudgetKiB).toFixed(1)} KiB.`);
  failed = true;
}

if (failed) {
  console.error(
    '\n[precache-budget] Reduce the tier: code-split the route, move the module under a\n' +
      '`features/dashboard/**` path (host tier), or add it to `onDemandPrefixes` in\n' +
      'scripts/pwa/precache-globs.json after confirming it is genuinely task-specific.'
  );
  process.exit(1);
}
console.log('[precache-budget] OK');
