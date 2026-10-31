import { describe, expect, it } from 'vitest';

import {
  resolveAsyncAvailabilityState,
  resolveNameAvailabilityState,
} from '@/lib/availabilityCheckState';

describe('resolveNameAvailabilityState', () => {
  it('stays idle until ready', () => {
    expect(
      resolveNameAvailabilityState({
        ready: false,
        showChecking: true,
        isUnavailable: true,
        isFetched: true,
      })
    ).toBe('idle');
  });

  it('prefers checking over other states when ready', () => {
    expect(
      resolveNameAvailabilityState({
        ready: true,
        showChecking: true,
        isUnavailable: true,
        isFetched: true,
      })
    ).toBe('checking');
  });

  it('marks unavailable when name is taken', () => {
    expect(
      resolveNameAvailabilityState({
        ready: true,
        showChecking: false,
        isUnavailable: true,
        isFetched: true,
      })
    ).toBe('unavailable');
  });

  it('marks available after fetch when not unavailable', () => {
    expect(
      resolveNameAvailabilityState({
        ready: true,
        showChecking: false,
        isUnavailable: false,
        isFetched: true,
      })
    ).toBe('available');
  });
});

describe('resolveAsyncAvailabilityState', () => {
  it('returns available when ready and no conflict', () => {
    expect(
      resolveAsyncAvailabilityState({ ready: true, isChecking: false, hasConflict: false })
    ).toBe('available');
  });

  it('returns unavailable when conflict exists', () => {
    expect(
      resolveAsyncAvailabilityState({ ready: true, isChecking: false, hasConflict: true })
    ).toBe('unavailable');
  });
});
