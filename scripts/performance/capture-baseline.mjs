#!/usr/bin/env node
/**
 * Production-readiness baseline snapshot (plan doc 00).
 *
 * Captures per-chunk gzip + brotli sizes from `ui/dist`, dependency counts, and
 * repo-scale metrics (migrations, edge functions, UI files) into a timestamped
 * JSON under docs/workflow/planned/production-readiness-checklist/baselines/.
 *
 * Run after `bun run build`. Does not require a running server — pure static
 * analysis of the build output, so it is safe to run in CI or locally.
 *
 * Usage: node scripts/performance/capture-baseline.mjs [--label=<text>]
 */
import { execSync } from 'node:child_process';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = path.join(repoRoot, 'ui/dist');
const assetsDir = path.join(distDir, 'assets');
const baselineDir = path.join(
  repoRoot,
  'docs/workflow/planned/production-readiness-checklist/baselines'
);

function fail(msg) {
  console.error(`capture-baseline: ${msg}`);
  process.exit(1);
}

if (!existsSync(distDir)) {
  fail('ui/dist not found — run `bun run build` first.');
}

const args = process.argv.slice(2);
const labelArg = args.find((a) => a.startsWith('--label='));
const label = labelArg ? labelArg.slice('--label='.length) : null;

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function sizes(filePath) {
  const raw = readFileSync(filePath);
  return {
    rawBytes: raw.byteLength,
    gzipBytes: gzipSync(raw, { level: 9 }).byteLength,
    brotliBytes: brotliCompressSync(raw).byteLength,
  };
}

// --- Per-chunk bundle sizes -------------------------------------------------
const assetFiles = walk(assetsDir).filter((f) => /\.(js|css)$/.test(f));
const chunks = assetFiles
  .map((f) => {
    const rel = path.relative(distDir, f).split(path.sep).join('/');
    const { rawBytes, gzipBytes, brotliBytes } = sizes(f);
    return { path: rel, type: rel.endsWith('.css') ? 'css' : 'js', rawBytes, gzipBytes, brotliBytes };
  })
  .sort((a, b) => b.gzipBytes - a.gzipBytes);

const totalJs = chunks.filter((c) => c.type === 'js');
const totalCss = chunks.filter((c) => c.type === 'css');
const sum = (arr, key) => arr.reduce((acc, c) => acc + c[key], 0);

// --- Initial payload (entry + modulepreload) per index.html ----------------
const html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/);
const initialPaths = new Set(entryMatch?.[1] ? [entryMatch[1]] : []);
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) {
  initialPaths.add(m[1]);
}
const initialChunks = [...initialPaths].map((p) => {
  const filePath = path.join(distDir, p.replace(/^\/+/, ''));
  const rel = path.relative(distDir, filePath).split(path.sep).join('/');
  return { path: rel, ...sizes(filePath) };
});

// --- Dependency + repo scale metrics -----------------------------------------
function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}
const rootPkg = readJson(path.join(repoRoot, 'package.json'));
const uiPkg = readJson(path.join(repoRoot, 'ui/package.json'));

function countFiles(dir, matcher) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) count += countFiles(full, matcher);
    else if (matcher(entry.name)) count += 1;
  }
  return count;
}

const uiFileCount = countFiles(path.join(repoRoot, 'ui/src'), (n) => /\.(ts|tsx)$/.test(n));
const edgeFunctionCount = existsSync(path.join(repoRoot, 'supabase/functions'))
  ? readdirSync(path.join(repoRoot, 'supabase/functions'), { withFileTypes: true }).filter((e) =>
      e.isDirectory()
    ).length
  : 0;
const migrationCount = existsSync(path.join(repoRoot, 'supabase/migrations'))
  ? readdirSync(path.join(repoRoot, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).length
  : 0;

function gitInfo() {
  try {
    const sha = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot }).toString().trim();
    const dirty = execSync('git status --porcelain', { cwd: repoRoot }).toString().trim().length > 0;
    return { sha, branch, dirty };
  } catch {
    return { sha: null, branch: null, dirty: null };
  }
}

const snapshot = {
  capturedAt: new Date().toISOString(),
  label,
  git: gitInfo(),
  repoScale: {
    uiTsFiles: uiFileCount,
    edgeFunctions: edgeFunctionCount,
    migrations: migrationCount,
    uiDependencies: Object.keys(uiPkg.dependencies || {}).length,
    uiDevDependencies: Object.keys(uiPkg.devDependencies || {}).length,
    rootDependencies: Object.keys(rootPkg.dependencies || {}).length,
    rootDevDependencies: Object.keys(rootPkg.devDependencies || {}).length,
  },
  bundle: {
    totalChunks: chunks.length,
    totalJsGzipBytes: sum(totalJs, 'gzipBytes'),
    totalJsBrotliBytes: sum(totalJs, 'brotliBytes'),
    totalCssGzipBytes: sum(totalCss, 'gzipBytes'),
    totalCssBrotliBytes: sum(totalCss, 'brotliBytes'),
    entry: entryMatch?.[1]
      ? chunks.find((c) => c.path === entryMatch[1].replace(/^\/+/, '')) ?? null
      : null,
    initialPayload: {
      chunkCount: initialChunks.length,
      totalGzipBytes: sum(initialChunks, 'gzipBytes'),
      totalBrotliBytes: sum(initialChunks, 'brotliBytes'),
      chunks: initialChunks,
    },
    // Top 20 largest chunks for quick eyeballing of regressions.
    largestChunks: chunks.slice(0, 20),
  },
};

if (!existsSync(baselineDir)) mkdirSync(baselineDir, { recursive: true });
const filename = `${snapshot.capturedAt.slice(0, 10)}${label ? `-${label}` : ''}.json`;
const outPath = path.join(baselineDir, filename);
writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');

const entryGzipKib = snapshot.bundle.entry ? snapshot.bundle.entry.gzipBytes / 1024 : 0;

console.log(`Baseline captured: ${path.relative(repoRoot, outPath)}`);
console.log(`  Entry: ${entryMatch?.[1] ?? '(not found)'} — ${entryGzipKib.toFixed(1)} KiB gzip`);
console.log(
  `  Initial payload: ${snapshot.bundle.initialPayload.chunkCount} chunks, ` +
    `${(snapshot.bundle.initialPayload.totalGzipBytes / 1024).toFixed(1)} KiB gzip`
);
console.log(
  `  Total JS: ${(snapshot.bundle.totalJsGzipBytes / 1024).toFixed(1)} KiB gzip across ${totalJs.length} chunks`
);
console.log(`  UI files: ${uiFileCount}, edge functions: ${edgeFunctionCount}, migrations: ${migrationCount}`);
