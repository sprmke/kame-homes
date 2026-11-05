#!/usr/bin/env bun
/**
 * Fails when a Documented route guide lacks a Host-facing knowledge section
 * with enough Q&A rows, or when a previously synced guide would drop out of
 * `bun run sync:support-content`.
 *
 * Tiered minimums:
 *   - MAJOR_GUIDES: 5 Q&A
 *   - every other documented guide: 3 Q&A
 *
 * Super-admin (`docs/guides/routes/admin/**`) and README indexes are exempt.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { countHostFacingQa, findMarkdownFiles, GUIDES_DIR, ROOT } from './lib/supportContent.ts';

const SNAPSHOT_PATH = join(ROOT, 'scripts/ai-knowledge-synced-guides.txt');
const DEFAULT_MIN_QA = 3;
const MAJOR_MIN_QA = 5;

/** High-traffic module pages that need a fuller answer set. */
export const MAJOR_GUIDES = new Set([
  // Org scope
  'docs/guides/routes/org/selector.md',
  'docs/guides/routes/org/dashboard.md',
  'docs/guides/routes/org/settings.md',
  'docs/guides/routes/org/team.md',
  'docs/guides/routes/org/properties.md',
  'docs/guides/routes/org/parkings.md',
  'docs/guides/routes/org/bookings.md',
  'docs/guides/routes/org/plans.md',
  'docs/guides/routes/org/activity.md',
  'docs/guides/routes/org/announcements.md',
  'docs/guides/routes/org/analytics.md',
  'docs/guides/routes/org/reviews.md',
  'docs/guides/routes/org/help-support.md',
  // Property scope
  'docs/guides/routes/org/property/dashboard.md',
  'docs/guides/routes/org/property/bookings.md',
  'docs/guides/routes/org/property/bookings-detail.md',
  'docs/guides/routes/org/property/operations.md',
  'docs/guides/routes/org/property/maintenance.md',
  'docs/guides/routes/org/property/finance.md',
  'docs/guides/routes/org/property/activity.md',
  'docs/guides/routes/org/property/marketing.md',
  'docs/guides/routes/org/property/analytics.md',
  'docs/guides/routes/org/property/reviews.md',
  'docs/guides/routes/org/property/public-pages.md',
  'docs/guides/routes/org/property/pricing.md',
  'docs/guides/routes/org/property/templates.md',
  'docs/guides/routes/org/property/announcements.md',
  'docs/guides/routes/org/property/settings.md',
  'docs/guides/routes/org/property/team.md',
  'docs/guides/routes/org/property/staff.md',
  'docs/guides/routes/org/property/notifications.md',
  'docs/guides/routes/org/property/inbox.md',
  'docs/guides/routes/org/property/help-support.md',
  // Parking scope
  'docs/guides/routes/org/parking/bookings.md',
  'docs/guides/routes/org/parking/dashboard.md',
  'docs/guides/routes/org/parking/finance.md',
  'docs/guides/routes/org/parking/pricing.md',
  'docs/guides/routes/org/parking/settings.md',
  'docs/guides/routes/org/parking/team.md',
  'docs/guides/routes/org/parking/inbox.md',
  'docs/guides/routes/org/parking/notifications.md',
  'docs/guides/routes/org/parking/announcements.md',
  'docs/guides/routes/org/parking/activity.md',
  'docs/guides/routes/org/parking/help-support.md',
  // Guest portal
  'docs/guides/routes/account/trips.md',
  'docs/guides/routes/account/stays.md',
  'docs/guides/routes/account/vouchers.md',
  'docs/guides/routes/account/tickets.md',
]);

function isExempt(relPath: string): boolean {
  if (relPath === 'docs/guides/routes/README.md') return true;
  if (relPath.startsWith('docs/guides/routes/admin/')) return true;
  return false;
}

function isDocumented(content: string): boolean {
  return (
    /\*\*Status:\*\*\s*Documented\b/i.test(content) || /^status:\s*documented\b/im.test(content)
  );
}

function loadSnapshot(): string[] {
  if (!existsSync(SNAPSHOT_PATH)) return [];
  return readFileSync(SNAPSHOT_PATH, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

const files = findMarkdownFiles(GUIDES_DIR);
const qaByPath = new Map<string, number>();
const missing: string[] = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  if (!statSync(file).isFile()) continue;
  const content = readFileSync(file, 'utf8');
  const count = countHostFacingQa(content);
  qaByPath.set(rel, count);
  if (isExempt(rel) || !isDocumented(content)) continue;
  const min = MAJOR_GUIDES.has(rel) ? MAJOR_MIN_QA : DEFAULT_MIN_QA;
  if (count < min) missing.push(`${rel} (${count} Q&A, need ${min})`);
}

const dropped: string[] = [];
for (const path of loadSnapshot()) {
  const count = qaByPath.get(path) ?? 0;
  if (count < 1) dropped.push(path);
}

if (missing.length > 0 || dropped.length > 0) {
  if (missing.length > 0) {
    console.error('Documented route guides missing Host-facing knowledge:');
    for (const row of missing) console.error(`  - ${row}`);
  }
  if (dropped.length > 0) {
    console.error('Previously synced guides would drop from the knowledge base:');
    for (const row of dropped) console.error(`  - ${row}`);
  }
  process.exit(1);
}

const documented = [...qaByPath.keys()].filter((path) => {
  if (isExempt(path)) return false;
  const content = readFileSync(join(ROOT, path), 'utf8');
  return isDocumented(content);
}).length;

console.log(
  `OK — ${documented} documented host guides meet their Q&A minimum (${MAJOR_MIN_QA} for major modules, ${DEFAULT_MIN_QA} otherwise).`
);
