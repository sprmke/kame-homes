#!/usr/bin/env bun
/**
 * Walk property dashboard routes via playwright-cli (requires prior auth session).
 * Usage: bun scripts/dev/qa-walk-property-pages.mjs [orgSlug] [propertySlug]
 */
import { $ } from 'bun';

const org = process.argv[2] ?? 'kame-home';
const property = process.argv[3] ?? 'monaco-2612';
const base = `http://localhost:5173/org/${org}/property/${property}`;
const paths = [
  '',
  '/bookings',
  '/finance',
  '/pricing',
  '/maintenance',
  '/team',
  '/marketing',
  '/inbox',
  '/notifications',
  '/templates',
  '/public-pages',
  '/plans',
  '/settings',
  '/help-support',
];

for (const p of paths) {
  await $`bun x playwright-cli goto ${base + p}`.quiet().nothrow();
  await Bun.sleep(2000);
  const r = await $`bun x playwright-cli eval ${'document.title + " | " + location.pathname'}`.nothrow();
  const text = r.stdout.toString();
  const m = [...text.matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const result = m.find((s) => s.includes('|')) ?? m.at(-1) ?? text.slice(0, 160).replace(/\n/g, ' ');
  console.log((p || '/dashboard').padEnd(16), result);
}
