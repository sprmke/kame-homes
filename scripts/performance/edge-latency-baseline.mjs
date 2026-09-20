#!/usr/bin/env node
/**
 * Edge function latency baseline (plan doc 00, Phase 0.3).
 *
 * Hits a fixed list of public edge functions against a target Supabase project
 * N times each, records p50/p95/p99 and a naive cold-vs-warm split (first call
 * per function vs the rest), and stores the result in a timestamped baseline
 * JSON.
 *
 * Only *public* GET endpoints are exercised by default — hitting authenticated
 * endpoints requires a real session token, which this script deliberately does
 * not fabricate (never run this against production; use hosted dev).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/performance/edge-latency-baseline.mjs [--iterations=20] [--label=text]
 *
 * With SUPABASE_ACCESS_TOKEN set (a real signed-in session's access token), the
 * script also exercises the authenticated endpoints listed in AUTH_ENDPOINTS.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baselineDir = path.join(
  repoRoot,
  'docs/workflow/planned/production-readiness-checklist/baselines'
);

const args = process.argv.slice(2);
const iterationsArg = args.find((a) => a.startsWith('--iterations='));
const labelArg = args.find((a) => a.startsWith('--label='));
const iterations = iterationsArg ? Number(iterationsArg.split('=')[1]) : 20;
const label = labelArg ? labelArg.slice('--label='.length) : null;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN; // optional

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    'edge-latency-baseline: SUPABASE_URL and SUPABASE_ANON_KEY are required.\n' +
      'Point these at hosted dev — never production. See docs/PROJECT.md for the project ref.'
  );
  process.exit(1);
}

// Public GET endpoints — safe to hit repeatedly, no side effects, no auth
// required. Query params are minimal placeholders; a 4xx due to a missing
// required param still measures real latency and is recorded as such.
const PUBLIC_ENDPOINTS = [
  { name: 'get-health', path: '/functions/v1/get-health' },
  { name: 'list-public-pricing-plans', path: '/functions/v1/list-public-pricing-plans' },
  { name: 'list-public-properties', path: '/functions/v1/list-public-properties?page=1&pageSize=5' },
  { name: 'list-public-parkings', path: '/functions/v1/list-public-parkings?page=1&pageSize=5' },
];

// Authenticated endpoints — only exercised when SUPABASE_ACCESS_TOKEN is set.
const AUTH_ENDPOINTS = [
  { name: 'list-bookings', path: '/functions/v1/list-bookings' },
  { name: 'list-organizations', path: '/functions/v1/list-organizations' },
];

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

async function timeRequest(url, headers) {
  const start = performance.now();
  try {
    const res = await fetch(url, { headers });
    // Drain the body so the timing includes full response transfer, not just headers.
    await res.arrayBuffer();
    const elapsed = performance.now() - start;
    return { elapsed, status: res.status, ok: true };
  } catch (err) {
    const elapsed = performance.now() - start;
    return { elapsed, status: null, ok: false, error: String(err?.message ?? err) };
  }
}

async function benchmark(endpoint, headers, n) {
  const timings = [];
  const statuses = new Map();
  let coldMs = null;
  for (let i = 0; i < n; i += 1) {
    const url = `${SUPABASE_URL}${endpoint.path}`;
    const result = await timeRequest(url, headers);
    if (i === 0) coldMs = result.elapsed;
    timings.push(result.elapsed);
    const key = result.ok ? String(result.status) : `error:${result.error}`;
    statuses.set(key, (statuses.get(key) ?? 0) + 1);
  }
  const sorted = [...timings].sort((a, b) => a - b);
  const warm = timings.slice(1); // exclude the first (cold) call
  const warmSorted = [...warm].sort((a, b) => a - b);
  return {
    name: endpoint.name,
    path: endpoint.path,
    iterations: n,
    coldMs: coldMs != null ? Math.round(coldMs) : null,
    warmP50Ms: warmSorted.length ? Math.round(percentile(warmSorted, 50)) : null,
    warmP95Ms: warmSorted.length ? Math.round(percentile(warmSorted, 95)) : null,
    warmP99Ms: warmSorted.length ? Math.round(percentile(warmSorted, 99)) : null,
    allP50Ms: Math.round(percentile(sorted, 50)),
    allP95Ms: Math.round(percentile(sorted, 95)),
    allP99Ms: Math.round(percentile(sorted, 99)),
    statusCounts: Object.fromEntries(statuses),
  };
}

async function main() {
  console.log(`Edge latency baseline: ${iterations} iterations per endpoint against ${SUPABASE_URL}`);

  const publicHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  const publicResults = [];
  for (const endpoint of PUBLIC_ENDPOINTS) {
    process.stdout.write(`  ${endpoint.name}... `);
    const result = await benchmark(endpoint, publicHeaders, iterations);
    publicResults.push(result);
    console.log(`cold ${result.coldMs}ms, warm p50 ${result.warmP50Ms}ms, p95 ${result.warmP95Ms}ms, p99 ${result.warmP99Ms}ms`);
  }

  let authResults = [];
  if (SUPABASE_ACCESS_TOKEN) {
    const authHeaders = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` };
    for (const endpoint of AUTH_ENDPOINTS) {
      process.stdout.write(`  ${endpoint.name} (auth)... `);
      const result = await benchmark(endpoint, authHeaders, iterations);
      authResults.push(result);
      console.log(`cold ${result.coldMs}ms, warm p50 ${result.warmP50Ms}ms, p95 ${result.warmP95Ms}ms, p99 ${result.warmP99Ms}ms`);
    }
  } else {
    console.log('  (SUPABASE_ACCESS_TOKEN not set — skipping authenticated endpoints)');
  }

  const snapshot = {
    capturedAt: new Date().toISOString(),
    label,
    supabaseUrl: SUPABASE_URL,
    iterations,
    publicEndpoints: publicResults,
    authenticatedEndpoints: authResults,
    note:
      'Cold = first call per endpoint (may include a Deno Deploy cold start). Warm p50/p95/p99 exclude that first call. Run this against hosted dev only.',
  };

  if (!existsSync(baselineDir)) mkdirSync(baselineDir, { recursive: true });
  const filename = `${snapshot.capturedAt.slice(0, 10)}-edge-latency${label ? `-${label}` : ''}.json`;
  const outPath = path.join(baselineDir, filename);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`\nEdge latency baseline captured: ${path.relative(repoRoot, outPath)}`);
}

main().catch((err) => {
  console.error('edge-latency-baseline: unexpected error', err);
  process.exit(1);
});
