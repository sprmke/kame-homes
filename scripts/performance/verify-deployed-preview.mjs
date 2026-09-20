#!/usr/bin/env node
/**
 * Production-readiness docs 02 + 16 — assert a deployed Vercel preview (or dev)
 * negotiates compression, does not leak source maps, and serves expected cache
 * headers for HTML vs hashed assets.
 *
 * Usage:
 *   PREVIEW_URL=https://dev.kamehomes.space node scripts/performance/verify-deployed-preview.mjs
 *   bun run verify:deployed-preview
 *
 * Optional:
 *   HEALTH_URL=https://<project>.supabase.co/functions/v1/get-health
 */
import { readFileSync } from 'node:fs';

const previewUrl = (process.env.PREVIEW_URL ?? process.env.DEPLOYED_PREVIEW_URL ?? '').replace(
  /\/$/,
  ''
);
const healthUrl = process.env.HEALTH_URL?.trim() || '';

function fail(msg) {
  console.error(`verify-deployed-preview: ${msg}`);
  process.exit(1);
}

if (!previewUrl) {
  fail('Set PREVIEW_URL (e.g. https://dev.kamehomes.space)');
}

async function head(url, headers = {}) {
  const res = await fetch(url, { method: 'HEAD', headers, redirect: 'follow' });
  const h = new Map();
  res.headers.forEach((v, k) => h.set(k.toLowerCase(), v));
  return { status: res.status, headers: h };
}

async function getText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) fail(`GET ${url} returned ${res.status}`);
  return res.text();
}

function assertIncludes(h, key, fragment, context) {
  const v = h.get(key);
  if (!v || !v.toLowerCase().includes(fragment.toLowerCase())) {
    fail(`${context}: expected ${key} to include "${fragment}", got ${v ?? '(missing)'}`);
  }
}

console.log(`verify-deployed-preview: ${previewUrl}`);

const indexHead = await head(`${previewUrl}/`);
if (indexHead.status !== 200) fail(`/ returned ${indexHead.status}`);
assertIncludes(indexHead.headers, 'cache-control', 'must-revalidate', 'index.html');

const html = await getText(`${previewUrl}/`);
const jsMatch = html.match(/\/assets\/[^"']+\.js/);
if (!jsMatch) fail('Could not find a hashed JS asset in index.html');
const jsPath = jsMatch[0];

const jsBr = await head(`${previewUrl}${jsPath}`, {
  'Accept-Encoding': 'br, gzip',
});
if (jsBr.status !== 200) fail(`${jsPath} returned ${jsBr.status}`);
const enc = jsBr.headers.get('content-encoding') ?? '';
if (!enc.includes('br') && !enc.includes('gzip')) {
  fail(`${jsPath}: expected br or gzip Content-Encoding, got "${enc || '(none)'}"`);
}
assertIncludes(jsBr.headers, 'cache-control', 'immutable', 'hashed JS');

const mapProbe = await head(`${previewUrl}${jsPath}.map`);
if (mapProbe.status === 200) {
  fail(`${jsPath}.map is publicly reachable (status 200)`);
}
if (mapProbe.status !== 404 && mapProbe.status !== 403) {
  console.warn(
    `verify-deployed-preview: note — ${jsPath}.map returned ${mapProbe.status} (expected 403/404)`
  );
}

const faviconHead = await head(`${previewUrl}/favicon/favicon-32x32.png`, {
  'Accept-Encoding': 'br, gzip',
});
if (faviconHead.status === 200) {
  const favEnc = faviconHead.headers.get('content-encoding') ?? '';
  if (!favEnc.includes('br') && !favEnc.includes('gzip')) {
    console.warn(
      `verify-deployed-preview: favicon has no Content-Encoding (may be small enough to skip compression)`
    );
  }
  assertIncludes(faviconHead.headers, 'cache-control', 'max-age', 'favicon');
}

const swHead = await head(`${previewUrl}/sw.js`);
if (swHead.status === 200) {
  assertIncludes(swHead.headers, 'cache-control', 'must-revalidate', 'sw.js');
}

const manifestHead = await head(`${previewUrl}/manifest.webmanifest`);
if (manifestHead.status === 200) {
  assertIncludes(manifestHead.headers, 'cache-control', 'must-revalidate', 'manifest.webmanifest');
}

if (healthUrl) {
  const healthRes = await fetch(healthUrl, { redirect: 'follow' });
  const body = await healthRes.text();
  if (!healthRes.ok) {
    fail(`HEALTH_URL ${healthRes.status}: ${body.slice(0, 200)}`);
  }
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    fail(`HEALTH_URL did not return JSON: ${body.slice(0, 200)}`);
  }
  if (json.status !== 'ok' && json.status !== 'degraded') {
    fail(`HEALTH_URL unexpected status field: ${JSON.stringify(json)}`);
  }
  console.log(`verify-deployed-preview: health OK (${json.status})`);
} else {
  console.log('verify-deployed-preview: HEALTH_URL not set — skipping get-health probe');
}

console.log('verify-deployed-preview: OK');
