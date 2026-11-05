import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  resolveOrgLandingPath,
  pickLandingOrgSlug,
  userOwnsOrganization,
  HOST_VERIFICATION_REJECTED_PATH,
} from '@/features/dashboard/org/lib/orgLanding';

type StorageValues = Record<string, string>;

function stubLastTenantContext(values: StorageValues) {
  const map = new Map(Object.entries(values));
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => map.get(key) ?? null,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const ORGS = [
  { slug: 'org-a', settings: {} },
  { slug: 'org-b', settings: {} },
] as const;

describe('resolveOrgLandingPath', () => {
  it('resolveOrgLandingPath is exported', () => {
    expect(typeof resolveOrgLandingPath).toBe('function');
  });

  it('defaults to the first accessible org dashboard when nothing was visited before', () => {
    expect(resolveOrgLandingPath(ORGS)).toBe('/org/org-a/dashboard');
    expect(pickLandingOrgSlug(ORGS)).toBe('org-a');
  });

  it('honors the last visited parking listing in the last-used org', () => {
    stubLastTenantContext({
      'kame-last-org-slug': 'org-a',
      'kame-last-tenant-kind': 'parking',
      'kame-last-parking-slug': 'lot-9',
    });
    expect(
      resolveOrgLandingPath(ORGS, { parkingSlugs: ['lot-9'] })
    ).toBe('/org/org-a/parking/lot-9');
  });

  it('honors the last visited property listing in the last-used org', () => {
    stubLastTenantContext({
      'kame-last-org-slug': 'org-b',
      'kame-last-tenant-kind': 'property',
      'kame-last-property-slug': 'villa-sol',
    });
    expect(
      resolveOrgLandingPath(ORGS, { propertySlugs: ['villa-sol', 'other'] })
    ).toBe('/org/org-b/property/villa-sol');
  });

  it('falls back to the org dashboard when the stored listing slug no longer exists', () => {
    stubLastTenantContext({
      'kame-last-org-slug': 'org-a',
      'kame-last-tenant-kind': 'parking',
      'kame-last-parking-slug': 'deleted-lot',
    });
    expect(
      resolveOrgLandingPath(ORGS, { parkingSlugs: ['lot-9'] })
    ).toBe('/org/org-a/dashboard');
  });

  it('ignores stored listing slugs that belong to a different org', () => {
    stubLastTenantContext({
      'kame-last-org-slug': 'org-zz',
      'kame-last-tenant-kind': 'parking',
      'kame-last-parking-slug': 'lot-9',
    });
    expect(
      resolveOrgLandingPath(ORGS, { parkingSlugs: ['lot-9'] })
    ).toBe('/org/org-a/dashboard');
  });

  it('falls back to the org dashboard when no org was visited before', () => {
    stubLastTenantContext({ 'kame-last-org-slug': 'org-a' });
    expect(resolveOrgLandingPath(ORGS)).toBe('/org/org-a/dashboard');
  });
});

describe('userOwnsOrganization', () => {
  it('userOwnsOrganization is exported', () => {
    expect(typeof userOwnsOrganization).toBe('function');
  });
});

describe('HOST_VERIFICATION_REJECTED_PATH', () => {
  it('is defined', () => {
    expect(HOST_VERIFICATION_REJECTED_PATH).toBeDefined();
  });
});
