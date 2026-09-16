#!/usr/bin/env node
/**
 * Route performance baseline (plan doc 00, Phase 0.2).
 *
 * Runs Lighthouse (mobile preset, throttled) against a local `vite preview`
 * server for the fixed 9-route list from the plan, and stores LCP/INP/CLS/TBT
 * + transfer size per route in a timestamped baseline JSON.
 *
 * IMPORTANT (see plan doc 00 edge cases): `vite preview` is not production —
 * no CDN, no brotli negotiation, no real network. Treat these numbers as
 * *relative* regression detection only. For an absolute number, run this
 * against a deployed Vercel preview via --base-url (Phase 0.4).
 *
 * Usage:
 *   bun run build            # once
 *   node scripts/performance/lighthouse-routes.mjs [--base-url=http://host] [--label=text]
 *
 * Without --base-url, starts `vite preview` locally on an ephemeral port.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const baselineDir = path.join(
  repoRoot,
  'docs/workflow/planned/production-readiness-checklist/baselines'
);

const args = process.argv.slice(2);
const baseUrlArg = args.find((a) => a.startsWith('--base-url='));
const labelArg = args.find((a) => a.startsWith('--label='));
const label = labelArg ? labelArg.slice('--label='.length) : null;
const externalBaseUrl = baseUrlArg ? baseUrlArg.slice('--base-url='.length) : null;

// The route list from plan doc 00, Phase 0.2 — paths verified against the real
// router (ui/src/features/{guest,dashboard}/**/routes/*.tsx) on 2026-09-16.
// `:propertySlug` / `:orgSlug` routes need a real seeded tenant to render their
// authenticated content; pass PERF_PROPERTY_SLUG / PERF_ORG_SLUG env vars to
// point at one on hosted dev. Without them, Lighthouse still measures the
// redirect/guard shell (auth check, 404, etc.) — useful, just not the full page.
const propertySlug = process.env.PERF_PROPERTY_SLUG || 'demo-property';
const orgSlug = process.env.PERF_ORG_SLUG || 'demo-org';

const ROUTES = [
  { path: '/', persona: 'guest-anon', name: 'Public landing' },
  { path: '/properties', persona: 'guest-anon', name: 'Property search/list' },
  { path: `/properties/${propertySlug}/form`, persona: 'guest-anon', name: 'Guest booking form' },
  { path: '/parkings', persona: 'guest-anon', name: 'Parking landing' },
  { path: '/account', persona: 'guest-auth', name: 'Guest account (redirects to sign-in if anon)' },
  {
    path: `/org/${orgSlug}/property/${propertySlug}/bookings`,
    persona: 'host',
    name: 'Admin bookings dashboard (needs auth session + real slugs)',
  },
  {
    path: `/org/${orgSlug}/property/${propertySlug}/finance`,
    persona: 'host',
    name: 'Admin finance (needs auth session + real slugs)',
  },
  { path: '/for-hosts/pricing', persona: 'host', name: 'Plans/pricing page' },
  { path: '/admin', persona: 'super-admin', name: 'Super-admin shell (redirects if unauthenticated)' },
];

function fail(msg) {
  console.error(`lighthouse-routes: ${msg}`);
  process.exit(1);
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function startPreviewServer() {
  const port = 4173 + Math.floor(Math.random() * 1000);
  const child = spawn('bun', ['run', 'preview', '--', '--port', String(port), '--strictPort'], {
    cwd: path.join(repoRoot, 'ui'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const baseUrl = `http://localhost:${port}`;
  const up = await waitForServer(baseUrl);
  if (!up) {
    child.kill();
    fail('vite preview server did not start in time.');
  }
  return { baseUrl, stop: () => child.kill() };
}

async function runLighthouse(url, chromePort) {
  const result = await lighthouse(
    url,
    {
      port: chromePort,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
      formFactor: 'mobile',
      screenEmulation: {
        mobile: true,
        width: 412,
        height: 823,
        deviceScaleFactor: 2.625,
        disabled: false,
      },
      throttling: {
        rttMs: 150,
        throughputKbps: 1638.4,
        cpuSlowdownMultiplier: 4,
        requestLatencyMs: 0,
        downloadThroughputKbps: 0,
        uploadThroughputKbps: 0,
      },
    },
    undefined
  );
  const lhr = result.lhr;
  const audits = lhr.audits;
  return {
    performanceScore: lhr.categories.performance?.score != null ? lhr.categories.performance.score * 100 : null,
    lcpMs: audits['largest-contentful-paint']?.numericValue ?? null,
    clsScore: audits['cumulative-layout-shift']?.numericValue ?? null,
    tbtMs: audits['total-blocking-time']?.numericValue ?? null,
    fcpMs: audits['first-contentful-paint']?.numericValue ?? null,
    speedIndexMs: audits['speed-index']?.numericValue ?? null,
    totalByteWeightBytes: audits['total-byte-weight']?.numericValue ?? null,
  };
}

async function main() {
  if (!existsSync(path.join(repoRoot, 'ui/dist')) && !externalBaseUrl) {
    fail('ui/dist not found — run `bun run build` first, or pass --base-url for a deployed preview.');
  }

  let server = null;
  let chrome = null;
  // A killed/interrupted run must not leave an orphaned `vite preview` server
  // or headless Chrome process behind — both were observed to survive a
  // plain `kill` of this script's own PID during development of this tool.
  const cleanup = () => {
    try {
      // chrome-launcher's kill() is synchronous (returns undefined, not a
      // Promise) despite the async-sounding name — no .catch() to chain.
      chrome?.kill();
    } catch {
      // Best-effort cleanup; never let a cleanup failure mask the real error.
    }
    // Belt-and-suspenders: chrome-launcher spawns Chrome detached in its own
    // process group so `.kill()` can (in principle) signal the whole tree,
    // but this was observed to leave GPU-helper/renderer children alive on
    // macOS. Chrome is launched with `detached: true`, so its PID is also
    // its process-group ID — a negative PID signals the whole group.
    if (chrome?.pid) {
      try {
        process.kill(-chrome.pid, 'SIGKILL');
      } catch {
        // ESRCH is expected once chrome.kill() already reaped it; ignore.
      }
    }
    server?.stop();
  };
  process.once('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  let baseUrl = externalBaseUrl;
  if (!baseUrl) {
    console.log('Starting local `vite preview` server...');
    server = await startPreviewServer();
    baseUrl = server.baseUrl;
  }

  const chromePath = process.env.CHROME_PATH || undefined;
  chrome = await launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    chromePath,
  });

  // Fail fast with a clear diagnostic rather than silently reporting `n/a`
  // for all 9 routes: some sandboxed/CI-like environments make headless
  // Chrome unable to paint anything (Lighthouse raises NO_FCP), and it has
  // been observed to be *intermittent* rather than a hard permanent failure
  // in at least one such environment — hence the retry before giving up.
  // This is an environment limitation, not a bug in this script or the app —
  // re-run on a machine with normal headless Chrome support (a developer
  // laptop, or GitHub Actions, which already installs Chromium via
  // `bun x playwright install chromium`).
  let sanityOk = false;
  let lastSanityError = null;
  for (let attempt = 1; attempt <= 2 && !sanityOk; attempt += 1) {
    try {
      const sanity = await runLighthouse(baseUrl, chrome.port);
      sanityOk = sanity.lcpMs != null || sanity.performanceScore != null;
      if (!sanityOk) lastSanityError = 'Lighthouse returned no metrics (NO_FCP)';
    } catch (err) {
      lastSanityError = err?.message ?? String(err);
    }
    if (!sanityOk && attempt === 1) {
      console.log('  Sanity probe failed, retrying once before giving up...');
    }
  }
  if (!sanityOk) {
    cleanup();
    fail(
      `Headless Chrome could not paint the page after 2 attempts (${lastSanityError}). ` +
        'This environment likely has no real display server available to Chrome ' +
        '(seen: "CVDisplayLinkCreateWithCGDisplay failed" / "did not paint any content" on ' +
        'the machine this script was written on). Re-run on a machine with working headless ' +
        'Chrome support — see scripts/README.md for the full troubleshooting note.'
    );
  }

  const results = [];
  try {
    for (const route of ROUTES) {
      const url = `${baseUrl}${route.path}`;
      process.stdout.write(`  Auditing ${route.persona} / ${route.name} (${url})... `);
      try {
        const metrics = await runLighthouse(url, chrome.port);
        const hasMetrics = metrics.lcpMs != null && metrics.performanceScore != null;
        results.push({ ...route, url, metrics, error: hasMetrics ? null : 'Lighthouse returned no metrics (see JSON)' });
        const fmt = (v, digits = 0) => (v == null ? 'n/a' : v.toFixed(digits));
        console.log(
          `LCP ${fmt(metrics.lcpMs)}ms, CLS ${fmt(metrics.clsScore, 3)}, ` +
            `TBT ${fmt(metrics.tbtMs)}ms, score ${fmt(metrics.performanceScore)}` +
            (hasMetrics ? '' : ' — WARNING: incomplete trace, re-run (see README troubleshooting)')
        );
      } catch (err) {
        results.push({ ...route, url, metrics: null, error: String(err?.message ?? err) });
        console.log(`FAILED (${err?.message ?? err})`);
      }
    }
  } finally {
    cleanup();
  }

  const snapshot = {
    capturedAt: new Date().toISOString(),
    label,
    baseUrl,
    mode: externalBaseUrl ? 'deployed-preview' : 'local-vite-preview',
    note: externalBaseUrl
      ? null
      : 'Local `vite preview` — no CDN/brotli negotiation. Relative regression detection only; see doc 00 Phase 0.4 for the deployed-preview run.',
    routes: results,
  };

  if (!existsSync(baselineDir)) mkdirSync(baselineDir, { recursive: true });
  const filename = `${snapshot.capturedAt.slice(0, 10)}-lighthouse${label ? `-${label}` : ''}.json`;
  const outPath = path.join(baselineDir, filename);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`\nLighthouse baseline captured: ${path.relative(repoRoot, outPath)}`);

  const failedRoutes = results.filter((r) => r.error);
  if (failedRoutes.length > 0) {
    console.error(`\n${failedRoutes.length} route(s) failed to audit — see JSON for details.`);
  }
}

main().catch((err) => {
  console.error('lighthouse-routes: unexpected error', err);
  process.exit(1);
});
