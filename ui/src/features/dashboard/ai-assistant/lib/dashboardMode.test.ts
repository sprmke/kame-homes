import { describe, expect, it } from 'vitest';

import {
  dashboardModeStorageKey,
  readCachedDashboardMode,
  reconcileDashboardModeOnUserId,
  resolveDashboardModeAvailability,
  resolveEffectiveDashboardMode,
  writeCachedDashboardMode,
} from '@/features/dashboard/ai-assistant/lib/dashboardMode';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

describe('dashboard mode cache', () => {
  it('is keyed per user', () => {
    const storage = memoryStorage();
    writeCachedDashboardMode('u1', 'ai', storage);
    expect(readCachedDashboardMode('u1', storage)).toBe('ai');
    expect(readCachedDashboardMode('u2', storage)).toBeNull();
    expect(dashboardModeStorageKey('u1')).toBe('kame-admin-ui-mode:u1');
  });

  it('ignores junk values and throwing storage', () => {
    const storage = memoryStorage();
    storage.setItem(dashboardModeStorageKey('u1'), 'chat');
    expect(readCachedDashboardMode('u1', storage)).toBeNull();
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readCachedDashboardMode('u1', throwing)).toBeNull();
  });
});

describe('resolveDashboardModeAvailability', () => {
  const base = {
    superAdmin: false,
    loading: false,
    assistantVisible: true,
    aiModeEnabled: true,
    planAllowed: true,
  };

  it('is available when every gate passes', () => {
    expect(resolveDashboardModeAvailability(base)).toBe('available');
  });

  it('locks on plan only', () => {
    expect(resolveDashboardModeAvailability({ ...base, planAllowed: false })).toBe('locked');
  });

  it('is pending while access loads, except for super-admin', () => {
    expect(resolveDashboardModeAvailability({ ...base, loading: true })).toBe('pending');
    expect(resolveDashboardModeAvailability({ ...base, loading: true, superAdmin: true })).toBe(
      'hidden'
    );
  });

  it('hides for super-admin, kill switch and AI mode switch', () => {
    expect(resolveDashboardModeAvailability({ ...base, superAdmin: true })).toBe('hidden');
    expect(resolveDashboardModeAvailability({ ...base, assistantVisible: false })).toBe('hidden');
    expect(resolveDashboardModeAvailability({ ...base, aiModeEnabled: false })).toBe('hidden');
  });
});

describe('resolveEffectiveDashboardMode', () => {
  it('falls back to advanced unless available', () => {
    expect(resolveEffectiveDashboardMode('ai', 'available')).toBe('ai');
    expect(resolveEffectiveDashboardMode('ai', 'pending')).toBe('ai');
    expect(resolveEffectiveDashboardMode('ai', 'locked')).toBe('advanced');
    expect(resolveEffectiveDashboardMode('ai', 'hidden')).toBe('advanced');
    expect(resolveEffectiveDashboardMode('advanced', 'available')).toBe('advanced');
  });
});

describe('reconcileDashboardModeOnUserId', () => {
  it('keeps a ?mode= choice when auth userId first arrives', () => {
    expect(
      reconcileDashboardModeOnUserId({
        previousUserId: null,
        nextUserId: 'u1',
        inSessionChoice: true,
      })
    ).toBe('keep-session');
  });

  it('hydrates from cache when there was no in-session override', () => {
    expect(
      reconcileDashboardModeOnUserId({
        previousUserId: null,
        nextUserId: 'u1',
        inSessionChoice: false,
      })
    ).toBe('hydrate-cache');
  });

  it('treats a real user switch as a cache hydrate', () => {
    expect(
      reconcileDashboardModeOnUserId({
        previousUserId: 'u1',
        nextUserId: 'u2',
        inSessionChoice: true,
      })
    ).toBe('hydrate-cache');
  });

  it('no-ops when the user id did not change', () => {
    expect(
      reconcileDashboardModeOnUserId({
        previousUserId: 'u1',
        nextUserId: 'u1',
        inSessionChoice: true,
      })
    ).toBe('noop');
  });
});
