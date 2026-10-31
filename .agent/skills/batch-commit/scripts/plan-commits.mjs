#!/usr/bin/env node
/**
 * Plan small commit batches from unstaged + untracked changes.
 *
 * Usage:
 *   node .cursor/skills/batch-commit/scripts/plan-commits.mjs
 *   node .cursor/skills/batch-commit/scripts/plan-commits.mjs --commits 10
 *   node .cursor/skills/batch-commit/scripts/plan-commits.mjs --commits 5 --min 5 --max 10
 *
 * `--commits N` limits output to the first N batches (daily commit quota).
 * Does NOT commit anything.
 */

import { execSync } from 'node:child_process';

function parseArgs(argv) {
  const opts = { commits: null, min: 5, max: 10 };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--commits' && argv[i + 1]) opts.commits = Number(argv[++i]);
    else if (arg === '--min' && argv[i + 1]) opts.min = Number(argv[++i]);
    else if (arg === '--max' && argv[i + 1]) opts.max = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') {
      console.log(`Usage: plan-commits.mjs [--commits N] [--min 5] [--max 10]`);
      process.exit(0);
    }
  }
  if (opts.commits != null && (!Number.isFinite(opts.commits) || opts.commits < 1)) {
    console.error('--commits must be a positive integer');
    process.exit(1);
  }
  return opts;
}

const { commits: commitLimit, min: MIN_FILES, max: MAX_FILES } = parseArgs(process.argv);

function gitPorcelain() {
  return execSync('git status --porcelain=v1 -uall', { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean);
}

/** @param {string} line */
function parseLine(line) {
  const xy = line.slice(0, 2);
  let path = line.slice(3);
  if (path.includes(' -> ')) {
    path = path.split(' -> ').pop().trim();
  }
  const status =
    xy === '??' ? 'untracked' : xy.includes('D') ? 'deleted' : xy.includes('A') ? 'added' : 'modified';
  return { path, status, xy };
}

/** @param {string} path */
function bucketKey(path) {
  if (path.startsWith('ui/src/features/guest/')) return `guest:${path.split('/')[4] ?? 'guest'}`;
  if (path.startsWith('ui/src/features/dashboard/')) return `dashboard:${path.split('/')[4] ?? 'dashboard'}`;
  if (path.startsWith('ui/src/')) return `ui:${path.split('/')[2] ?? 'ui'}`;
  if (path.startsWith('supabase/functions/_shared/')) return 'supabase:shared';
  if (path.startsWith('supabase/functions/')) return `supabase-fn:${path.split('/')[2] ?? 'fn'}`;
  if (path.startsWith('supabase/migrations/')) return 'supabase:migrations';
  if (path.startsWith('supabase/')) return 'supabase:other';
  if (path.startsWith('docs/')) return `docs:${path.split('/')[1] ?? 'docs'}`;
  if (path.startsWith('.cursor/') || path.startsWith('.claude/')) return 'tooling:cursor';
  if (path.startsWith('scripts/')) return 'scripts';
  if (path.startsWith('.vscode/') || path.startsWith('.husky/')) return 'tooling:editor';
  return 'root';
}

/** @param {Array<{path:string,status:string,xy:string}>} files */
function packBuckets(files) {
  /** @type {Map<string, typeof files>} */
  const buckets = new Map();
  for (const f of files) {
    const key = bucketKey(f.path);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(f);
  }
  return buckets;
}

/** @param {typeof files} group */
function packGroup(group) {
  const batches = [];
  for (let i = 0; i < group.length; i += MAX_FILES) {
    batches.push(group.slice(i, i + MAX_FILES));
  }
  if (batches.length >= 2) {
    const last = batches[batches.length - 1];
    if (last.length < MIN_FILES && batches[batches.length - 2].length < MAX_FILES) {
      batches[batches.length - 2].push(...last);
      batches.pop();
    }
  }
  return batches;
}

/** @param {Map<string, typeof files>} buckets */
function suggestBatches(buckets) {
  /** @type {Array<{bucket:string, files: typeof files}>} */
  const suggested = [];
  for (const [bucket, group] of [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    for (const batch of packGroup(group)) {
      if (batch.length < MIN_FILES && suggested.length > 0) {
        const prev = suggested[suggested.length - 1];
        if (prev.files.length < MAX_FILES) {
          prev.files.push(...batch);
          continue;
        }
      }
      suggested.push({ bucket, files: batch });
    }
  }
  return suggested;
}

function batchToJson(b, i) {
  return {
    index: i + 1,
    bucket: b.bucket,
    fileCount: b.files.length,
    paths: b.files.map((f) => f.path),
    statuses: b.files.map((f) => f.status),
  };
}

const lines = gitPorcelain();
if (lines.length === 0) {
  console.log(
    JSON.stringify(
      {
        totalFiles: 0,
        targetBatchSize: `${MIN_FILES}-${MAX_FILES}`,
        commitLimit,
        suggestedBatches: [],
        dailyPlan: [],
        remainingAfterPlan: { batches: 0, files: 0 },
        message: 'No unstaged or untracked changes.',
      },
      null,
      2
    )
  );
  process.exit(0);
}

const files = lines.map(parseLine);
const buckets = packBuckets(files);
const bucketObj = Object.fromEntries([...buckets.entries()].map(([k, v]) => [k, v.map((f) => f.path)]));
const allBatches = suggestBatches(buckets);
const suggestedBatches = allBatches.map(batchToJson);
const dailyPlan = (commitLimit ? allBatches.slice(0, commitLimit) : allBatches).map(batchToJson);

const plannedPaths = new Set(dailyPlan.flatMap((b) => b.paths));
const remainingFiles = files.filter((f) => !plannedPaths.has(f.path)).length;
const remainingBatches = commitLimit ? Math.max(0, allBatches.length - commitLimit) : 0;

console.log(
  JSON.stringify(
    {
      totalFiles: files.length,
      targetBatchSize: `${MIN_FILES}-${MAX_FILES}`,
      commitLimit: commitLimit ?? 'all',
      totalBatchesIfAllCommitted: allBatches.length,
      dailyPlan,
      remainingAfterPlan: {
        batches: remainingBatches,
        files: remainingFiles,
      },
      suggestedBatches: commitLimit ? undefined : suggestedBatches,
      buckets: bucketObj,
    },
    null,
    2
  )
);
