import { describe, expect, it } from 'vitest';

import {
  countFeaturesOff,
  manilaDateTimeToIso,
} from '@/features/dashboard/super-admin/lib/featureAvailabilityAdmin';
import type { ResolvedFeatureAvailability } from '@/lib/featureAvailability/resolveFeatureAvailability';

describe('countFeaturesOff', () => {
  it('counts unavailable resolved rows', () => {
    const resolved = {
      'inbox.meta': { available: false } as ResolvedFeatureAvailability,
      'pricing.channel_sync': { available: true } as ResolvedFeatureAvailability,
    };
    expect(countFeaturesOff(resolved)).toBe(1);
  });
});

describe('manilaDateTimeToIso', () => {
  it('builds ISO from Manila local parts', () => {
    const iso = manilaDateTimeToIso('2026-10-29', '15:30');
    expect(iso).toBeTruthy();
    expect(new Date(iso!).toISOString()).toBe(iso);
  });
});
