#!/usr/bin/env node
/**
 * Edge function conformance sweep — production-readiness doc 18 "Backend & APIs",
 * Phase 18.1.
 *
 * Static, regex/string-based audit over every `supabase/functions/<fn>/index.ts`
 * (skips `_shared/` and `tests/`). This is NOT a type-aware or AST-based check —
 * it is a fast, dependency-free heuristic sweep meant to be re-run repeatedly as
 * the codebase evolves, not a one-time hand audit. False positives/negatives are
 * possible; treat the output as a triage list, not ground truth for any single
 * function.
 *
 * Usage:
 *   node scripts/dev/audit-edge-functions.mjs            # markdown table + summary
 *   node scripts/dev/audit-edge-functions.mjs --csv       # CSV instead of markdown
 *   node scripts/dev/audit-edge-functions.mjs --gaps-only # only rows with >=1 gap
 *   node scripts/dev/audit-edge-functions.mjs --check     # CI: fail on new hand-rolled serve()
 *
 * See docs/architecture/edge-functions.md ("Conformance sweep" section).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const FUNCTIONS_DIR = join(REPO_ROOT, 'supabase', 'functions');

const args = process.argv.slice(2);
const format = args.includes('--csv') ? 'csv' : 'markdown';
const gapsOnly = args.includes('--gaps-only');
const checkMode = args.includes('--check');

/** Wrapper detection, in priority order (a file should only match one). */
const WRAPPER_PATTERNS = [
  ['serveAdmin', /\bserveAdmin\s*\(/],
  ['serveSuperAdmin', /\bserveSuperAdmin\s*\(/],
  ['serveAuthenticated', /\bserveAuthenticated\s*\(/],
  ['servePublic', /\bservePublic\s*\(/],
  ['serveCronPost', /\bserveCronPost\s*\(/],
];

/** Hand-rolled raw serve — only flagged when no wrapper above matched. */
const RAW_SERVE_PATTERNS = [/\bDeno\.serve\s*\(/, /(?<!\w)serve\s*\(\s*async/, /\bserve\s*\(\s*\(/];

const VALIDATION_PATTERNS = [
  /from ['"].*zod['"]/,
  /\bz\.(object|string|number|enum|array)\s*\(/,
  /\.safeParse\s*\(/,
  /\.parse\s*\(/,
  /from ['"].*\/validation/,
  /from ['"].*Validator/,
];

const BOUNDED_QUERY_PATTERNS = [/\.limit\s*\(/, /\.range\s*\(/];
const SELECT_PATTERN = /\.select\s*\(/;

const ACTIVITY_LOG_PATTERNS = [
  /from ['"].*_shared\/activityLog(\.ts)?['"]/,
  /\bactivity-log:\s*N\/A/i,
];

/** Functions where a hand-rolled serve is a known, reviewed exception — do not flag. */
const RAW_SERVE_ALLOWLIST = new Set([
  'ical-export',
  'meta-inbox-oauth-callback',
  'parking-broadcast-email',
  'submit-form',
  'submit-form-completion',
  'submit-pay-parking',
  'submit-sd-form',
  'calendar-sync-cron',
  'sd-refund-cron',
  'superhost-assessment-cron',
  'meta-inbox-backfill',
  'meta-inbox-webhook',
  'upload-app-settings-asset',
  'upload-org-settings-asset',
  'upload-development-media',
  'upload-parking-media',
  'upload-parking-settings-asset',
  'upload-property-media',
  'upload-property-template-asset',
]);

function walkFunctionDirs() {
  const entries = readdirSync(FUNCTIONS_DIR, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === '_shared' || entry.name === 'tests') continue;
    if (entry.name.startsWith('.')) continue;
    dirs.push(entry.name);
  }
  return dirs.sort();
}

function findIndexFile(fnDir) {
  const direct = join(FUNCTIONS_DIR, fnDir, 'index.ts');
  try {
    statSync(direct);
    return direct;
  } catch {
    return null;
  }
}

function detectWrapper(src) {
  for (const [name, pattern] of WRAPPER_PATTERNS) {
    if (pattern.test(src)) return name;
  }
  return null;
}

function detectRawServe(src) {
  return RAW_SERVE_PATTERNS.some((p) => p.test(src));
}

function inferExpectedTier(fnDir) {
  const name = fnDir.toLowerCase();
  if (name.startsWith('admin-') || name.includes('/admin/')) return 'super-admin (guess)';
  if (name.includes('super-admin') || name.includes('platform-')) return 'super-admin (guess)';
  if (name.endsWith('-cron') || name.includes('cron')) return 'serveCronPost (guess)';
  if (name.includes('webhook')) return 'servePublic + webhook verification (guess)';
  if (name.startsWith('get-public') || name.startsWith('list-public') || name.startsWith('submit-')) {
    return 'servePublic (guess)';
  }
  if (name.startsWith('search-') || name.startsWith('get-') || name.startsWith('list-')) {
    return 'ambiguous — check individually';
  }
  return 'ambiguous — check individually';
}

function detectAny(src, patterns) {
  return patterns.some((p) => p.test(src));
}

function auditFunction(fnDir) {
  const filePath = findIndexFile(fnDir);
  if (!filePath) {
    return {
      fn: fnDir,
      missingIndex: true,
    };
  }
  const src = readFileSync(filePath, 'utf8');
  const relPath = relative(REPO_ROOT, filePath);

  const wrapper = detectWrapper(src);
  const rawServe = !wrapper && detectRawServe(src);
  const hasValidation = detectAny(src, VALIDATION_PATTERNS);
  const usesJsonSuccess = /\bjsonSuccess\s*\(/.test(src);
  const usesJsonError = /\bjsonError(FromCatch)?\s*\(/.test(src);
  const usesIdempotency = /from ['"].*_shared\/idempotency(\.ts)?['"]/.test(src);
  const hasSelect = SELECT_PATTERN.test(src);
  const hasBoundedQuery = detectAny(src, BOUNDED_QUERY_PATTERNS);
  const hasActivityLog = detectAny(src, ACTIVITY_LOG_PATTERNS);

  const gaps = [];
  if (!wrapper && rawServe) gaps.push('no-serve-wrapper');
  if (!hasValidation) gaps.push('no-validation-detected');
  if (!usesJsonSuccess && !usesJsonError) gaps.push('no-jsonSuccess/jsonError');
  if (hasSelect && !hasBoundedQuery) gaps.push('unbounded-select');
  if (!hasActivityLog) gaps.push('no-activity-log-reference');

  return {
    fn: fnDir,
    relPath,
    wrapper: wrapper ?? (rawServe ? 'RAW serve()' : 'none-detected'),
    rawServe,
    expectedTier: rawServe ? inferExpectedTier(fnDir) : '',
    hasValidation,
    usesJsonSuccess,
    usesJsonError,
    usesIdempotency,
    hasSelect,
    hasBoundedQuery,
    hasActivityLog,
    gaps,
  };
}

function runCheck(valid) {
  const raw = valid.filter((r) => r.rawServe);
  const unexpected = raw.filter((r) => !RAW_SERVE_ALLOWLIST.has(r.fn));
  const stale = [...RAW_SERVE_ALLOWLIST].filter((name) => !valid.some((r) => r.fn === name));
  if (unexpected.length || stale.length) {
    if (unexpected.length) {
      console.error('New hand-rolled serve() outside the reviewed allowlist (doc 18):');
      for (const r of unexpected) console.error(`  ${r.fn}`);
    }
    if (stale.length) {
      console.error('Allowlisted functions missing from supabase/functions (stale allowlist):');
      for (const name of stale) console.error(`  ${name}`);
    }
    process.exit(1);
  }
  console.error(
    `ok: ${valid.length} functions; ${raw.length} reviewed hand-rolled serve() on allowlist`
  );
}

function main() {
  const fnDirs = walkFunctionDirs();
  const results = fnDirs.map(auditFunction);

  const valid = results.filter((r) => !r.missingIndex);
  const missingIndex = results.filter((r) => r.missingIndex);

  if (checkMode) {
    runCheck(valid);
    return;
  }

  const rows = gapsOnly ? valid.filter((r) => r.gaps.length > 0) : valid;

  if (format === 'csv') {
    const header = [
      'function',
      'path',
      'wrapper',
      'raw_serve_flag',
      'expected_tier_guess',
      'has_validation',
      'uses_jsonSuccess',
      'uses_jsonError',
      'uses_idempotency',
      'has_select',
      'has_bounded_query',
      'has_activity_log_ref',
      'gaps',
    ];
    console.log(header.join(','));
    for (const r of rows) {
      console.log(
        [
          r.fn,
          r.relPath,
          r.wrapper,
          r.rawServe ? 'yes' : 'no',
          r.expectedTier,
          r.hasValidation ? 'yes' : 'no',
          r.usesJsonSuccess ? 'yes' : 'no',
          r.usesJsonError ? 'yes' : 'no',
          r.usesIdempotency ? 'yes' : 'no',
          r.hasSelect ? 'yes' : 'no',
          r.hasBoundedQuery ? 'yes' : 'no',
          r.hasActivityLog ? 'yes' : 'no',
          `"${r.gaps.join('; ')}"`,
        ].join(',')
      );
    }
  } else {
    console.log(
      '| Function | Wrapper | Validation | jsonSuccess/Error | Idempotency | Bounded query | Activity log | Gaps |'
    );
    console.log('| --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of rows) {
      const boundedQueryCell = r.hasSelect ? (r.hasBoundedQuery ? 'yes' : 'NO (has select)') : 'n/a';
      console.log(
        `| \`${r.fn}\` | ${r.wrapper} | ${r.hasValidation ? 'yes' : 'no'} | ${
          r.usesJsonSuccess || r.usesJsonError ? 'yes' : 'NO'
        } | ${r.usesIdempotency ? 'yes' : 'no'} | ${boundedQueryCell} | ${
          r.hasActivityLog ? 'yes' : 'no'
        } | ${r.gaps.join('; ') || '-'} |`
      );
    }
  }

  // ---- Summary ----
  const total = valid.length;
  const wrapperCounts = {};
  let rawServeCount = 0;
  let noValidation = 0;
  let noJsonHelpers = 0;
  let noIdempotency = 0;
  let unboundedSelect = 0;
  let noActivityLog = 0;
  let zeroGaps = 0;

  for (const r of valid) {
    wrapperCounts[r.wrapper] = (wrapperCounts[r.wrapper] ?? 0) + 1;
    if (r.rawServe) rawServeCount += 1;
    if (!r.hasValidation) noValidation += 1;
    if (!r.usesJsonSuccess && !r.usesJsonError) noJsonHelpers += 1;
    if (!r.usesIdempotency) noIdempotency += 1;
    if (r.hasSelect && !r.hasBoundedQuery) unboundedSelect += 1;
    if (!r.hasActivityLog) noActivityLog += 1;
    if (r.gaps.length === 0) zeroGaps += 1;
  }

  console.error('');
  console.error('=== Conformance sweep summary ===');
  console.error(`Total function directories scanned: ${fnDirs.length}`);
  if (missingIndex.length) {
    console.error(
      `Skipped (no index.ts found): ${missingIndex.length} — ${missingIndex
        .map((r) => r.fn)
        .join(', ')}`
    );
  }
  console.error(`Functions audited: ${total}`);
  console.error('');
  console.error('Wrapper usage:');
  for (const [wrapper, count] of Object.entries(wrapperCounts).sort((a, b) => b[1] - a[1])) {
    console.error(`  ${wrapper}: ${count}`);
  }
  console.error('');
  console.error(`${rawServeCount} functions with no serve* wrapper (hand-rolled serve/Deno.serve)`);
  console.error(`${noValidation} functions with no validation helper detected (heuristic)`);
  console.error(`${noJsonHelpers} functions with no jsonSuccess/jsonError usage detected`);
  console.error(`${noIdempotency} functions with no _shared/idempotency.ts import`);
  console.error(`${unboundedSelect} functions with .select( but no .limit(/.range( anywhere`);
  console.error(`${noActivityLog} functions with no _shared/activityLog.ts reference or N/A comment`);
  console.error(`${zeroGaps} functions with zero flagged gaps (heuristic-clean)`);
  console.error('');
  console.error('Note: heuristics are string/regex based, not type-aware. A "gap" here is a');
  console.error('lead for manual review, not a confirmed defect — see docs/architecture/');
  console.error('edge-functions.md for how this feeds the doc 18 conformance table.');
}

main();
