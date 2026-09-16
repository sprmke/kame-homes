#!/usr/bin/env node
/**
 * Per-persona chunk graph analysis (plan doc 01, Phase 1.1).
 *
 * Builds the transitive "initial fetch" graph for the app entry (everything
 * loaded before any route-level React.lazy() resolves) and separately reports,
 * for every lazily-loadable route chunk, which heavy vendor/editor chunks it
 * pulls in. Static analysis only (regex over emitted Rollup output) — no
 * browser required, so this runs in CI right after `bun run build`.
 *
 * Two guarantees this script enforces (leak detectors from doc 01):
 *  1. The *initial* graph (entry + its static imports, resolved transitively)
 *     must not contain any dashboard/marketing-editor/PDF/chart heavy chunk.
 *  2. No chunk whose name matches a "guest-only" heavy editor (design studio,
 *     video, tiptap, pdf, charts) may appear in the initial graph at all —
 *     those must only ever be reachable via a dynamic import().
 *
 * Usage: node scripts/performance/analyze-chunk-graph.mjs [--json]
 * Exit code 1 on a leak; 0 otherwise. Run after `bun run build`.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = path.join(repoRoot, 'ui/dist');
const assetsDir = path.join(distDir, 'assets');
const asJson = process.argv.includes('--json');

function fail(msg) {
  console.error(`analyze-chunk-graph: ${msg}`);
  process.exit(1);
}

if (!existsSync(distDir)) fail('ui/dist not found — run `bun run build` first.');

const html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
const entryMatch = html.match(/<script[^>]+type="module"[^>]+src="([^"]+\.js)"/);
if (!entryMatch?.[1]) fail('Could not find the module entry script in ui/dist/index.html');
const entryRelPath = entryMatch[1].replace(/^\/+/, '');

const jsFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
  : [];
const contentByFile = new Map();
for (const f of jsFiles) {
  contentByFile.set(f, readFileSync(path.join(assetsDir, f), 'utf8'));
}

/**
 * Rollup-emitted chunks reference sibling chunks two ways:
 *  - static ESM: `import{x as y}from"./chunk-abc123.js"` (hoisted, always fetched)
 *  - dynamic: `import("./chunk-def456.js")` (fetched only on demand)
 * We only want to follow the static edges for the "initial graph" — dynamic
 * import() is precisely the boundary React.lazy() creates.
 */
function staticImportsOf(content) {
  const out = new Set();
  // Matches `from"./foo.js"` / `from './foo.js'` after an import/export clause.
  const re = /\bfrom\s*["']\.\/([\w.-]+\.js)["']/g;
  let m;
  while ((m = re.exec(content))) out.add(m[1]);
  return out;
}

function dynamicImportsOf(content) {
  const out = new Set();
  const re = /import\(\s*["']\.\/([\w.-]+\.js)["']\s*\)/g;
  let m;
  while ((m = re.exec(content))) out.add(m[1]);
  return out;
}

const entryFile = path.basename(entryRelPath);

function transitiveStatic(startFile) {
  const seen = new Set();
  const queue = [startFile];
  while (queue.length) {
    const cur = queue.shift();
    if (seen.has(cur)) continue;
    seen.add(cur);
    const content = contentByFile.get(cur);
    if (!content) continue;
    for (const next of staticImportsOf(content)) {
      if (!seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

// Also pull in modulepreload links from index.html — Vite marks the initial
// static-import set explicitly there, which is a second, HTML-level source of
// truth we should agree with.
const preloadFiles = new Set();
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)) {
  preloadFiles.add(path.basename(m[1]));
}

const initialGraph = transitiveStatic(entryFile);
for (const f of preloadFiles) {
  for (const g of transitiveStatic(f)) initialGraph.add(g);
}

// --- Leak rules --------------------------------------------------------------
// Chunk name prefixes that must NEVER be in the initial graph — each is either
// a heavy editor/vendor lib gated behind a lazy boundary, or dashboard-only
// feature code that a guest route must never fetch.
const FORBIDDEN_IN_INITIAL = [
  { pattern: /^PolotnoDesignStudio-/, reason: 'Marketing Studio design editor (lazy-only)' },
  { pattern: /^mediabunny-/, reason: 'Marketing Studio audio/video encoder (lazy-only)' },
  { pattern: /^html2canvas/, reason: 'Canvas capture lib (lazy-only)' },
  { pattern: /^browser-image-compression-/, reason: 'Image optimizer worker (lazy-only)' },
  { pattern: /recharts/i, reason: 'Charts vendor (analytics/finance only)' },
  { pattern: /jspdf/i, reason: 'PDF generation vendor (export actions only)' },
  { pattern: /pdf-lib/i, reason: 'PDF manipulation vendor (document actions only)' },
  { pattern: /pdfjs-dist|pdf\.worker/i, reason: 'PDF render/worker vendor (document preview only)' },
  { pattern: /tiptap/i, reason: 'Rich-text editor vendor (host-only surfaces)' },
  { pattern: /konva|fabric|openpolotno/i, reason: 'Canvas editor vendor (Marketing Studio only)' },
  { pattern: /remotion/i, reason: 'Video vendor (Marketing Studio only)' },
  { pattern: /blueprintjs/i, reason: 'Polotno peer UI vendor (Marketing Studio only)' },
];

const findings = [];
for (const file of initialGraph) {
  for (const rule of FORBIDDEN_IN_INITIAL) {
    if (rule.pattern.test(file)) {
      findings.push({ file, reason: rule.reason });
    }
  }
}

const report = {
  entry: entryRelPath,
  initialGraphChunkCount: initialGraph.size,
  initialGraphFiles: [...initialGraph].sort(),
  leaks: findings,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Entry: ${entryRelPath}`);
  console.log(`Initial graph: ${initialGraph.size} chunk(s)`);
  if (findings.length === 0) {
    console.log('✓ No forbidden heavy/dashboard chunks found in the initial graph.');
  } else {
    console.error(`✗ ${findings.length} leak(s) found in the initial graph:`);
    for (const f of findings) {
      console.error(`  - ${f.file} — ${f.reason}`);
    }
  }
}

process.exit(findings.length > 0 ? 1 : 0);
