import { afterEach, describe, expect, it } from 'vitest';

import {
  clearTenantSlugRemapForTests,
  rememberTenantSlugChange,
  resolveRemappedSlug,
  rewriteDashboardPathForSlugRemap,
} from '@/features/dashboard/org/lib/tenantSlugRemap';

afterEach(() => {
  clearTenantSlugRemapForTests();
});

describe('rememberTenantSlugChange', () => {
  it('maps old slug to new', () => {
    rememberTenantSlugChange('property', 'monaco-2612', 'monaco-2612-b');
    expect(resolveRemappedSlug('property', 'monaco-2612')).toBe('monaco-2612-b');
    expect(resolveRemappedSlug('property', 'monaco-2612-b')).toBe('monaco-2612-b');
  });

  it('chains aliases when renamed again', () => {
    rememberTenantSlugChange('property', 'a', 'b');
    rememberTenantSlugChange('property', 'b', 'c');
    expect(resolveRemappedSlug('property', 'a')).toBe('c');
    expect(resolveRemappedSlug('property', 'b')).toBe('c');
  });

  it('ignores no-op renames', () => {
    rememberTenantSlugChange('org', 'same', 'same');
    expect(resolveRemappedSlug('org', 'same')).toBe('same');
  });
});

describe('rewriteDashboardPathForSlugRemap', () => {
  it('rewrites property slug in path', () => {
    rememberTenantSlugChange('property', 'monaco-2612', 'monaco-2612-b');
    expect(rewriteDashboardPathForSlugRemap('/org/kame-home/property/monaco-2612/bookings')).toBe(
      '/org/kame-home/property/monaco-2612-b/bookings'
    );
  });

  it('rewrites org slug and property slug together', () => {
    rememberTenantSlugChange('org', 'old-org', 'new-org');
    rememberTenantSlugChange('property', 'old-prop', 'new-prop');
    expect(rewriteDashboardPathForSlugRemap('/org/old-org/property/old-prop/settings')).toBe(
      '/org/new-org/property/new-prop/settings'
    );
  });

  it('rewrites parking slug', () => {
    rememberTenantSlugChange('parking', 'slot-a', 'slot-b');
    expect(rewriteDashboardPathForSlugRemap('/org/acme/parking/slot-a/dashboard')).toBe(
      '/org/acme/parking/slot-b/dashboard'
    );
  });

  it('returns null when nothing remapped', () => {
    expect(rewriteDashboardPathForSlugRemap('/org/kame-home/property/monaco/bookings')).toBeNull();
  });

  it('returns null for non-org paths', () => {
    rememberTenantSlugChange('property', 'x', 'y');
    expect(rewriteDashboardPathForSlugRemap('/properties/x')).toBeNull();
  });
});
