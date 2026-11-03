import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  capabilityForPath,
  isMidTaskRoute,
  KNOWN_ROUTE_SEGMENTS,
  ROUTE_CAPABILITIES,
} from '@/lib/pwa/routeCapabilities';

describe('capabilityForPath', () => {
  it.each([
    ['/', 'public-landing'],
    ['/properties', 'guest-listing'],
    ['/properties/monaco', 'guest-listing'],
    ['/properties/monaco/form', 'guest-form'],
    ['/properties/monaco/calendar', 'guest-form'],
    ['/properties/monaco/stay-guide', 'guest-stay-guide'],
    ['/parkings/monaco/form', 'guest-form'],
    ['/account/trips', 'guest-trips'],
    ['/account/profile', 'guest-account'],
    ['/for-hosts/login', 'host-auth'],
    ['/onboarding', 'host-auth'],
    ['/org/acme', 'org-admin'],
    ['/org/acme/property/monaco', 'property-dashboard'],
    ['/org/acme/property/monaco/bookings', 'property-bookings'],
    ['/org/acme/property/monaco/bookings/abc', 'property-bookings'],
    ['/org/acme/property/monaco/inbox', 'property-inbox'],
    ['/org/acme/property/monaco/finance', 'property-operations'],
    ['/org/acme/property/monaco/marketing', 'property-editors'],
    ['/org/acme/parking/spot-1', 'parking-sections'],
    ['/org/acme/parking/spot-1/bookings', 'parking-bookings'],
    ['/admin', 'super-admin'],
    ['/admin/orgs', 'super-admin'],
    ['/for-hosts', 'public-marketing'],
    ['/privacy', 'public-marketing'],
    ['/app', 'launch'],
    ['/bookings', 'legacy-admin-redirect'],
  ])('%s resolves to %s', (path, id) => {
    expect(capabilityForPath(path).id).toBe(id);
  });

  it('falls back for an unknown path', () => {
    expect(capabilityForPath('/totally-new-section').id).toBe('fallback');
  });

  it('ignores the query string', () => {
    expect(capabilityForPath('/properties/monaco/form?step=2').id).toBe('guest-form');
  });
});

describe('install offer policy', () => {
  it('never offers install mid-task', () => {
    expect(isMidTaskRoute('/properties/monaco/form')).toBe(true);
    expect(isMidTaskRoute('/for-hosts/login')).toBe(true);
    expect(isMidTaskRoute('/org/acme/property/monaco/marketing')).toBe(true);
    expect(isMidTaskRoute('/org/acme/property/monaco/bookings')).toBe(false);
  });

  it('is passive on public marketing pages', () => {
    expect(capabilityForPath('/for-hosts/pricing').installOffer).toBe('passive');
  });

  it('places the guest install card inline only on trips', () => {
    expect(capabilityForPath('/account/trips').installOffer).toBe('inline');
  });
});

describe('registry invariants', () => {
  it('has one rule per id', () => {
    const ids = ROUTE_CAPABILITIES.map((rule) => rule.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every declared route segment resolves to a rule, not the fallback', () => {
    for (const segment of KNOWN_ROUTE_SEGMENTS) {
      expect(capabilityForPath(`/${segment}`), segment).not.toBe(
        ROUTE_CAPABILITIES.find(() => false)
      );
      expect(capabilityForPath(`/${segment}`).id, segment).not.toBe('fallback');
    }
  });

  it('every absolute path declared in a router file is classified', () => {
    // Guards the P1-10 drift failure mode: a brand-new top-level section must be
    // added to the registry, not silently fall through to the defaults.
    const roots = ['src/features', 'src/routes'];
    const declared = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') continue;
          walk(full);
        } else if (/\.tsx?$/.test(entry.name)) {
          const source = readFileSync(full, 'utf8');
          for (const match of source.matchAll(/path="\/([a-z0-9-]+)/g)) {
            if (match[1]) declared.add(match[1]);
          }
        }
      }
    };
    for (const root of roots) walk(root);
    expect(declared.size).toBeGreaterThan(10);
    for (const segment of declared) {
      expect(KNOWN_ROUTE_SEGMENTS.has(segment), `unclassified route: /${segment}`).toBe(true);
    }
  });
});
