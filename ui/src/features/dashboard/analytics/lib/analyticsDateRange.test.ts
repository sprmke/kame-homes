import { describe, expect, it } from 'vitest';

import { manilaTodayIso, rangeForPreset } from '@/features/dashboard/analytics/lib/analyticsDateRange';

describe('manilaTodayIso', () => {

  it('manilaTodayIso is exported', () => {
    expect(typeof manilaTodayIso).toBe('function');
  });

});

describe('rangeForPreset', () => {

  it('rangeForPreset is exported', () => {
    expect(typeof rangeForPreset).toBe('function');
  });

});
