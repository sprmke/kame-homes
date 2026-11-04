#!/usr/bin/env node
/**
 * Lighthouse 3x median on the baseline routes (production-readiness doc 00 / plan 5.10).
 *
 *   BASE_URL=https://kamespace.com node scripts/performance/lighthouse-medians.mjs [--runs=3]
 *
 * Prints a markdown table of median perf/a11y/BP/SEO plus LCP/TBT/CLS, and writes
 * docs/workflow/in-progress/production-readiness/evidence/lighthouse-medians-<date>.md
 * unless --no-write is passed.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BASE = (process.env.BASE_URL ?? '').replace(/\/$/, '');
if (!BASE) {
  console.error('Set BASE_URL (e.g. https://kamespace.com)');
  process.exit(1);
}
const runsArg = process.argv.find((a) => a.startsWith('--runs='));
const RUNS = runsArg ? Number(runsArg.split('=')[1]) : 3;
const NO_WRITE = process.argv.includes('--no-write');

const ROUTES = [
  '/',
  '/properties',
  '/parkings',
  '/developments',
  '/search',
  '/for-hosts',
  '/for-hosts/pricing',
  '/properties/monaco-2604',
  '/properties/monaco-2604/form',
];

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const lighthouseBin = resolve('node_modules/.bin/lighthouse');

function runOnce(url) {
  const dir = mkdtempSync(join(tmpdir(), 'lh-'));
  const out = join(dir, 'report.json');
  execFileSync(
    lighthouseBin,
    [
      url,
      '--quiet',
      '--output=json',
      `--output-path=${out}`,
      '--only-categories=performance,accessibility,best-practices,seo',
      '--form-factor=mobile',
      '--throttling-method=simulate',
      '--chrome-flags=--headless=new --no-sandbox',
    ],
    { stdio: 'ignore', timeout: 180_000 }
  );
  const report = JSON.parse(readFileSync(out, 'utf8'));
  const score = (key) => Math.round((report.categories[key]?.score ?? 0) * 100);
  return {
    perf: score('performance'),
    a11y: score('accessibility'),
    bp: score('best-practices'),
    seo: score('seo'),
    lcp: report.audits['largest-contentful-paint']?.numericValue ?? null,
    tbt: report.audits['total-blocking-time']?.numericValue ?? null,
    cls: report.audits['cumulative-layout-shift']?.numericValue ?? null,
  };
}

const rows = [];
for (const route of ROUTES) {
  const url = `${BASE}${route}`;
  const samples = [];
  for (let i = 0; i < RUNS; i += 1) {
    try {
      samples.push(runOnce(url));
      process.stdout.write('.');
    } catch (err) {
      process.stdout.write('x');
      console.error(`\n${url} run ${i + 1} failed: ${err.message.slice(0, 120)}`);
    }
  }
  if (!samples.length) {
    rows.push({ route, missing: true });
    continue;
  }
  rows.push({
    route,
    perf: median(samples.map((s) => s.perf)),
    a11y: median(samples.map((s) => s.a11y)),
    bp: median(samples.map((s) => s.bp)),
    seo: median(samples.map((s) => s.seo)),
    lcp: Math.round(median(samples.map((s) => s.lcp ?? 0))),
    tbt: Math.round(median(samples.map((s) => s.tbt ?? 0))),
    cls: Number(median(samples.map((s) => s.cls ?? 0)).toFixed(3)),
    n: samples.length,
  });
}
process.stdout.write('\n');

const table = [
  `| Route | Perf | A11y | BP | SEO | LCP | TBT | CLS | n |`,
  `| --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
  ...rows.map((r) =>
    r.missing
      ? `| ${r.route} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | 0 |`
      : `| ${r.route} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${(r.lcp / 1000).toFixed(1)}s | ${r.tbt}ms | ${r.cls} | ${r.n} |`
  ),
];
console.log(table.join('\n'));

if (!NO_WRITE) {
  const date = new Date().toISOString().slice(0, 10);
  const path = resolve(
    'docs/workflow/in-progress/production-readiness/evidence',
    `lighthouse-medians-${date}.md`
  );
  writeFileSync(
    path,
    [
      `---`,
      `title: 'Lighthouse 3x median — ${BASE} (${date})'`,
      `status: active`,
      `stage: in-progress`,
      `kind: evidence`,
      `readiness: verified`,
      `launch_gate: A`,
      `launch_blocker: false`,
      `last_verified: '${date}'`,
      `---`,
      ``,
      `# Lighthouse 3x median`,
      ``,
      `Mobile emulation, simulated throttling, ${RUNS} runs per route, median reported.`,
      `Command: \`BASE_URL=${BASE} node scripts/performance/lighthouse-medians.mjs\`.`,
      ``,
      ...table,
      ``,
    ].join('\n')
  );
  console.log(`\nWrote ${path}`);
}
