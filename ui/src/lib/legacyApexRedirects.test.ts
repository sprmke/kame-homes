import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Regression guard for the legacy apex redirect map in `ui/vercel.json`
 * (cutover plan 02 task 5.1). The rules only fire when `kamehomes.space` /
 * `www.kamehomes.space` are attached to the `kame-homes` project, so a wrong
 * or reordered map would silently drop guests on `/properties` instead of
 * their booking form.
 */

type Rule = {
  source: string;
  has?: Array<{ type: string; value: string }>;
  destination?: string;
  permanent?: boolean;
};

const LEGACY_HOSTS = ['kamehomes.space', 'www.kamehomes.space'];
/** Legacy single-unit tenant; guests never had a second property. */
const LEGACY_PROPERTY_SLUG = 'kame-home';
const NEW_ORIGIN = 'https://kamespace.com';

const config = JSON.parse(
  readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')
) as { redirects?: Rule[] };

const redirects = config.redirects ?? [];

function rulesForHost(host: string): Rule[] {
  return redirects.filter((rule) => rule.has?.some((has) => has.value === host));
}

describe('legacy apex redirects', () => {
  it('defines the redirect array', () => {
    expect(Array.isArray(redirects)).toBe(true);
    expect(redirects.length).toBeGreaterThan(0);
  });

  it.each(LEGACY_HOSTS)('scopes every rule to %s only', (host) => {
    expect(rulesForHost(host).length).toBeGreaterThan(0);
    for (const rule of redirects) {
      for (const condition of rule.has ?? []) {
        expect(condition.type).toBe('host');
      }
    }
    // Dev and preview hosts must never be redirected by these rules.
    for (const rule of redirects) {
      const hosts = (rule.has ?? []).map((has) => has.value);
      for (const value of hosts) {
        expect(LEGACY_HOSTS).toContain(value);
      }
    }
  });

  it.each(LEGACY_HOSTS)('is permanent (308) for %s', (host) => {
    for (const rule of rulesForHost(host)) {
      expect(rule.permanent).toBe(true);
    }
  });

  it.each(LEGACY_HOSTS)('injects the legacy property slug for %s', (host) => {
    for (const path of ['/form', '/calendar', '/success']) {
      const rule = rulesForHost(host).find((entry) => entry.source === path);
      expect(rule?.destination).toBe(`${NEW_ORIGIN}/properties/${LEGACY_PROPERTY_SLUG}${path}`);
    }
  });

  it.each(LEGACY_HOSTS)('ends with a catch-all that keeps path and query for %s', (host) => {
    const hostRules = rulesForHost(host);
    const last = hostRules.at(-1);
    // The catch-all excludes the service-worker control files: a redirected SW
    // script can never install, which would strand every installed app on the
    // retired origin (PWA v2, P0-3).
    expect(last?.source).toBe(
      '/((?!sw\\.js$|pwa-version\\.json$|manifest\\.webmanifest$|retirement-sw\\.js$|precache-tiers\\.json$).*)'
    );
    expect(last?.destination).toBe(`${NEW_ORIGIN}/$1`);

    // Specific paths must be evaluated before the catch-all (first match wins).
    const catchAllIndex = hostRules.indexOf(last!);
    for (const path of ['/form', '/calendar', '/success']) {
      const index = hostRules.findIndex((entry) => entry.source === path);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(catchAllIndex);
    }
  });

  it.each(LEGACY_HOSTS)('lets the service worker files through unbounced for %s', (host) => {
    const hostRules = rulesForHost(host);
    const catchAll = hostRules.at(-1)!;
    // `source` is a path-to-regexp pattern; assert the negative lookahead covers
    // every file the browser fetches to update or kill-switch a worker.
    for (const file of ['sw.js', 'pwa-version.json', 'manifest.webmanifest', 'precache-tiers.json']) {
      expect(catchAll.source).toContain(file.replace('.', '\\.'));
    }
  });
});
