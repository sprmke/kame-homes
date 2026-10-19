#!/usr/bin/env node
/**
 * Launch-audit Phase 7 walker for hosted dev (`dev.kamehomes.space`).
 *
 * Signs in as the seeded QA accounts (scripts/dev/seed-readiness-qa-dev.mjs), visits each host,
 * guest and public route at 375 / 768 / 1280 px and records: final path (redirects), tab title,
 * console errors, horizontal overflow, crash / not-found text, and whether the phone bottom tab
 * bar is present. Screenshots go to the gitignored ui/e2e/artifacts/readiness/.
 *
 *   node scripts/dev/qa-walk-hosted-dev.mjs                 # all groups
 *   node scripts/dev/qa-walk-hosted-dev.mjs --group host    # host | guest | public
 *   node scripts/dev/qa-walk-hosted-dev.mjs --json out.json
 *   node scripts/dev/qa-walk-hosted-dev.mjs --group host --as <member email> --viewport 375
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DEV_REF = 'fworvijbrwpyngycotbz';
const UI = 'https://dev.kamehomes.space';
const ARTIFACTS = resolve(ROOT, 'ui/e2e/artifacts/readiness');

function readEnv(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
  return out;
}

const devEnv = readEnv(resolve(ROOT, 'supabase/.env.dev.local'));
const uiEnv = readEnv(resolve(ROOT, 'ui/.env.development.dev'));
const qa = readEnv(resolve(ROOT, 'supabase/.env.qa.dev.local'));
const URL_BASE = (devEnv.DEV_SUPABASE_URL ?? '').replace(/\/$/, '').replace(/\/functions\/v1$/, '');
const SRK = devEnv.DEV_SERVICE_ROLE_KEY ?? '';
const ANON = uiEnv.VITE_SUPABASE_ANON_KEY ?? '';
if (!URL_BASE.includes(DEV_REF) || !qa.QA_OWNER_ORG_SLUG) {
  console.error('Hosted dev only; run seed-readiness-qa-dev.mjs first.');
  process.exit(1);
}

const args = process.argv.slice(2);
const groupArg = args.includes('--group') ? args[args.indexOf('--group') + 1] : null;
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const asEmail = args.includes('--as') ? args[args.indexOf('--as') + 1] : null;
const viewportArg = args.includes('--viewport') ? args[args.indexOf('--viewport') + 1] : null;
const VIEWPORTS = [
  { name: '375', width: 375, height: 812, mobile: true },
  { name: '768', width: 768, height: 1024, mobile: true },
  { name: '1280', width: 1280, height: 800, mobile: false },
].filter((vp) => !viewportArg || vp.name === viewportArg);

const org = qa.QA_OWNER_ORG_SLUG;
const prop = qa.QA_OWNER_PROPERTY_SLUG;
const P = `/org/${org}/property/${prop}`;

const GROUPS = {
  host: {
    account: qa.QA_OWNER_EMAIL,
    paths: [
      `/org/${org}/dashboard`,
      `/org/${org}/properties`,
      `/org/${org}/bookings`,
      `/org/${org}/analytics`,
      `/org/${org}/team`,
      `/org/${org}/settings`,
      `/org/${org}/plans`,
      `/org/${org}/activity`,
      `/org/${org}/announcements`,
      `/org/${org}/help-support`,
      `/org/${org}/setup-guide`,
      P,
      `${P}/bookings`,
      `${P}/calendar`,
      `${P}/pricing`,
      `${P}/finance`,
      `${P}/maintenance`,
      `${P}/operations`,
      `${P}/team`,
      `${P}/marketing`,
      `${P}/inbox`,
      `${P}/notifications`,
      `${P}/templates`,
      `${P}/public-pages`,
      `${P}/analytics`,
      `${P}/activity`,
      `${P}/announcements`,
      `${P}/settings`,
      `${P}/help-support`,
    ],
  },
  guest: {
    account: qa.QA_GUEST_EMAIL,
    paths: ['/account', '/account/stays', '/account/vouchers', '/account/favorites', '/account/tickets'],
  },
  public: {
    account: null,
    paths: [
      '/',
      '/properties',
      `/properties/${prop}`,
      `/properties/${prop}/calendar`,
      `/properties/${prop}/form`,
      '/parkings',
      '/developments',
      '/services',
      '/search',
      '/for-hosts',
      '/for-hosts/pricing',
      '/for-hosts/login',
      '/for-guests/login',
      '/about',
      '/contact',
      '/support',
      '/privacy',
      '/terms',
      '/cookies',
      '/this-route-does-not-exist',
    ],
  },
};

async function session(email) {
  const link = await fetch(`${URL_BASE}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  }).then((r) => r.json());
  const tokenHash = link.hashed_token ?? link.properties?.hashed_token;
  const s = await fetch(`${URL_BASE}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
  }).then((r) => r.json());
  if (!s.access_token) throw new Error(`session failed for ${email}`);
  return s;
}

const CRASH_RE = /something went wrong|unexpected error|application error|failed to load/i;
const NOT_FOUND_RE = /page not found|404/i;

mkdirSync(ARTIFACTS, { recursive: true });
const browser = await chromium.launch();
const results = [];

for (const [group, spec] of Object.entries(GROUPS)) {
  if (groupArg && groupArg !== group) continue;
  const account = group === 'host' && asEmail ? asEmail : spec.account;
  const s = account ? await session(account) : null;
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      deviceScaleFactor: 1,
    });
    if (s) {
      await context.addInitScript(
        ([key, value]) => {
          if (!localStorage.getItem(key)) localStorage.setItem(key, value);
        },
        [`sb-${DEV_REF}-auth-token`, JSON.stringify(s)]
      );
    }
    const page = await context.newPage();
    for (const path of spec.paths) {
      const errors = [];
      const onConsole = (msg) => {
        if (msg.type() === 'error') errors.push(msg.text().slice(0, 160));
      };
      const onPageError = (err) => errors.push(`pageerror: ${String(err).slice(0, 160)}`);
      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      let status = null;
      try {
        const res = await page.goto(UI + path, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        status = res?.status() ?? null;
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
        await page.waitForTimeout(1200);
      } catch (e) {
        errors.push(`nav: ${String(e).slice(0, 120)}`);
      }
      const probe = await page
        .evaluate(() => {
          const doc = document.documentElement;
          const text = document.body?.innerText ?? '';
          const nav = [...document.querySelectorAll('nav')].find((n) => {
            const r = n.getBoundingClientRect();
            return r.height > 0 && r.bottom >= window.innerHeight - 4 && r.top > window.innerHeight / 2;
          });
          return {
            title: document.title,
            finalPath: location.pathname,
            overflowPx: Math.max(0, doc.scrollWidth - doc.clientWidth),
            bottomNav: Boolean(nav),
            text: text.slice(0, 4000),
          };
        })
        .catch(() => ({ title: '', finalPath: '', overflowPx: 0, bottomNav: false, text: '' }));
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      const slug = `${group}-${vp.name}-${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'root'}`;
      await page.screenshot({ path: resolve(ARTIFACTS, `${slug}.png`) }).catch(() => {});
      const row = {
        group,
        viewport: vp.name,
        path,
        status,
        finalPath: probe.finalPath,
        redirected: probe.finalPath !== path.split('?')[0],
        title: probe.title,
        overflowPx: probe.overflowPx,
        bottomNav: probe.bottomNav,
        crash: CRASH_RE.test(probe.text),
        notFound: NOT_FOUND_RE.test(probe.text) && !path.includes('does-not-exist'),
        errors: [...new Set(errors)].slice(0, 5),
      };
      results.push(row);
      const flags = [
        row.redirected ? `→ ${row.finalPath}` : '',
        row.overflowPx ? `overflow ${row.overflowPx}px` : '',
        row.crash ? 'CRASH' : '',
        row.notFound ? 'NOT FOUND' : '',
        vp.width < 1024 && group !== 'public' && !row.bottomNav ? 'no bottom nav' : '',
        row.errors.length ? `${row.errors.length} console err` : '',
      ]
        .filter(Boolean)
        .join(' · ');
      console.log(`${vp.name.padStart(4)} ${path.padEnd(48)} ${row.title.padEnd(40).slice(0, 40)} ${flags}`);
    }
    await context.close();
  }
}

await browser.close();
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.crash || r.notFound || r.overflowPx > 0);
console.log(`\n${results.length} page loads, ${bad.length} with crash/not-found/overflow.`);
