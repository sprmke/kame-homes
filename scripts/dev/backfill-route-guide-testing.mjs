#!/usr/bin/env bun
/**
 * One-shot backfill: insert ## Testing sections into route guides that lack them.
 * Run: bun scripts/dev/backfill-route-guide-testing.mjs
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '../..');
const ROUTES = path.join(ROOT, 'docs/guides/routes');

/** @param {string} rel Path under docs/guides/routes/ */
function testingFor(rel) {
  const p = rel.replace(/\\/g, '/');

  if (p.startsWith('admin/')) {
    const e2e =
      p === 'admin/overview.md'
        ? '`ui/e2e/features/admin/adminShellSmoke.spec.ts` (`@ci`)'
        : 'N/A — use `adminShellSmoke` for `/admin` shell only';
    return table([
      ['Unit', '`superAdminVerification_test.ts` when auth rules change', '—'],
      ['E2E', e2e, '—'],
      ['Manual', '—', '[`super-admin-manual.md`](../testing/super-admin-manual.md)'],
    ]);
  }

  if (p.startsWith('org/parking/')) {
    return table([
      ['Unit', '`parkingStatusMachine_test.ts`', '—'],
      ['E2E', '[`parking-playwright.md`](../testing/parking-playwright.md) guest/host specs', 'PayMongo live'],
      ['N/A', 'Parking host dashboard shell load', '—'],
    ]);
  }

  if (p === 'org/activity.md') {
    return table([
      ['Unit', '`activityLog.ts` catalog helpers', '—'],
      ['E2E', '`ui/e2e/features/org/orgHubSmoke.spec.ts` activity shell (`@ci`)', 'CSV export'],
    ]);
  }

  if (p === 'org/parkings.md') {
    return table([
      ['E2E', '`orgHubSmoke.spec.ts` + parking marketplace specs', '—'],
      ['N/A', 'Org parkings inventory dedicated smoke', '—'],
    ]);
  }

  if (p === 'org/inbox.md' || p === 'org/selector.md') {
    return table([
      ['E2E', '`ui/e2e/features/auth/legacyRouteRedirectSmoke.spec.ts` redirect paths (`@ci`)', '—'],
      ['N/A', 'Redirect-only route', '—'],
    ]);
  }

  if (p.includes('help-support')) {
    return table([
      ['N/A', 'Help docs + tickets UI', 'Manual QA when copy changes'],
    ]);
  }

  if (p === 'org/setup-guide.md') {
    return table([
      ['Unit', '`setupGuideProgress` / step assembly tests', '—'],
      ['N/A', 'Setup Guide overlay auto-open', 'Manual onboarding'],
    ]);
  }

  if (p === 'org/property/bookings.md') {
    return table([
      ['Unit', '`workflow.test.ts`', '—'],
      ['E2E', '`dashboardModulesSmoke.spec.ts` bookings shell (`@ci`)', '—'],
    ]);
  }

  if (
    p === 'org/property/calendar.md' ||
    p === 'org/property/custom-pages.md' ||
    p === 'org/property/staff.md' ||
    p === 'org/property/operations.md'
  ) {
    return table([
      ['E2E', '`ui/e2e/features/auth/legacyRouteRedirectSmoke.spec.ts` (`@ci`)', '—'],
      ['N/A', 'Redirect-only route', '—'],
    ]);
  }

  if (p === 'org/property/announcements.md') {
    return table([
      ['N/A', 'Announcements CRUD', 'Manual when copy changes'],
    ]);
  }

  if (p === 'accept-invite.md') {
    return table([
      ['E2E', '`ui/e2e/features/auth/acceptInviteSmoke.spec.ts` (`@ci`)', 'Real invite email'],
    ]);
  }

  if (p === 'sign-in.md') {
    return table([
      ['E2E', '`ui/e2e/features/auth/legacyRedirectSmoke.spec.ts` (`@ci`)', '—'],
    ]);
  }

  if (p === 'onboarding.md') {
    return table([
      ['Unit', 'setup guide / org creation validators when pure', '—'],
      ['N/A', 'Full onboarding + verification upload', 'Manual host verification'],
    ]);
  }

  if (p === 'developments.md') {
    return table([
      ['E2E', '`publicPagesSmoke.spec.ts` developments list (`@ci`)', '—'],
    ]);
  }

  if (p === 'legal.md' || p === 'services.md') {
    return table([
      ['E2E', p === 'legal.md' ? '`publicPagesSmoke.spec.ts` terms (`@ci`)' : 'N/A', '—'],
      ['N/A', 'Static marketing copy', '—'],
    ]);
  }

  if (p === 'success.md') {
    return table([
      ['E2E', '`guestFormSubmit.spec.ts` success path (`@smoke` `@ci`)', '—'],
    ]);
  }

  if (p === 'parkings.md' || p === 'bookings/parking.md') {
    return table([
      ['Unit', '`parkingStatusMachine_test.ts`', '—'],
      ['E2E', '[`parking-playwright.md`](../testing/parking-playwright.md)', 'PayMongo `@live`'],
    ]);
  }

  if (p === 'guest-booking-document.md') {
    return table([
      ['Unit', 'guest document token allow-list when pure', '—'],
      ['N/A', 'Signed URL redirect', 'Manual token QA'],
    ]);
  }

  if (p === 'property-showcase.md') {
    return table([
      ['Manual', '—', '[`property-showcase-manual.md`](../testing/property-showcase-manual.md)'],
    ]);
  }

  if (p.startsWith('account/')) {
    if (p === 'account/messages.md' || p === 'account/wishlist.md') {
      return table([
        ['E2E', '`legacyRouteRedirectSmoke.spec.ts` (`@ci`)', '—'],
        ['N/A', 'Redirect-only', '—'],
      ]);
    }
    if (p === 'account/index.md') {
      return table([
        ['E2E', 'N/A — redirects to profile', '—'],
      ]);
    }
    if (p === 'account/tickets.md') {
      return table([
        ['N/A', 'Guest tickets UI', 'Manual when triage flow changes'],
      ]);
    }
  }

  if (p === 'properties/chat.md') {
    return table([
      ['N/A', 'Property-scoped guest chat', 'Manual + stays hub E2E for list'],
    ]);
  }

  return table([
    ['Unit', 'Colocated `*.test.ts` / `*_test.ts` when rules change', '—'],
    ['E2E', 'See [`docs/guides/testing/README.md`](../testing/README.md) domain inventory', '—'],
    ['N/A', 'No dedicated smoke yet', 'Add when primary journey changes'],
  ]);
}

function table(rows) {
  const lines = [
    '---',
    '',
    '## Testing',
    '',
    '| Layer | Path / spec | Manual |',
    '| ----- | ----------- | ------ |',
    ...rows.map(([a, b, c]) => `| ${a} | ${b} | ${c ?? '—'} |`),
    '',
  ];
  return lines.join('\n');
}

async function walk(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full, rel)));
    else if (e.name.endsWith('.md') && e.name !== 'README.md') files.push({ rel, full });
  }
  return files;
}

function insertTesting(content, block) {
  if (content.includes('## Testing')) return content;
  const anchors = ['\n---\n\n## Related docs', '\n---\n\n## Related\n', '\n## Related docs', '\n## Related\n'];
  for (const anchor of anchors) {
    const idx = content.lastIndexOf(anchor);
    if (idx !== -1) {
      return content.slice(0, idx) + block + content.slice(idx);
    }
  }
  const pending = content.lastIndexOf('\n## Pending');
  if (pending !== -1) {
    return content.slice(0, pending) + block + content.slice(pending);
  }
  return content.trimEnd() + '\n' + block;
}

const files = await walk(ROUTES);
let updated = 0;
for (const { rel, full } of files) {
  const raw = await readFile(full, 'utf8');
  if (raw.includes('## Testing')) continue;
  const next = insertTesting(raw, testingFor(rel));
  if (next !== raw) {
    await writeFile(full, next);
    updated += 1;
    console.log('updated', rel);
  }
}
console.log(`Done. Updated ${updated} route guides.`);
