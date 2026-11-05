import { describe, expect, it } from 'vitest';

import {
  dateViewScope,
  readCalendarPeriod,
  readRememberedDateRange,
  rememberCalendarPeriod,
  rememberDateRange,
  rememberedAppliedRange,
  resolveRangeWithMemory,
  type DateRangeStorage,
} from '@/lib/date/rememberedDateRange';

function memoryStorage(): DateRangeStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('dateViewScope', () => {
  it('scopes parking, property, then org', () => {
    expect(dateViewScope({ orgSlug: 'acme', propertySlug: 'solea', parkingSlug: 'bay-1' })).toBe(
      'parking:acme:bay-1'
    );
    expect(dateViewScope({ orgSlug: 'acme', propertySlug: 'solea' })).toBe('property:acme:solea');
    expect(dateViewScope({ orgSlug: 'acme' })).toBe('org:acme');
    expect(dateViewScope({})).toBeNull();
  });
});

describe('remembered date range', () => {
  it('restores a saved range when the URL has no dates', () => {
    const storage = memoryStorage();
    rememberDateRange(
      'property:acme:solea',
      'dashboard',
      { preset: 'month', from: '2026-10-01', to: '2026-10-31' },
      storage
    );
    expect(
      resolveRangeWithMemory(
        new URLSearchParams(),
        'property:acme:solea',
        'dashboard',
        () => ({ from: '2026-11-01', to: '2026-11-30' }),
        storage
      )
    ).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('lets an explicit URL range win over storage', () => {
    const storage = memoryStorage();
    rememberDateRange(
      'property:acme:solea',
      'dashboard',
      { preset: 'year', from: '2026-01-01', to: '2026-12-31' },
      storage
    );
    expect(
      resolveRangeWithMemory(
        new URLSearchParams('from=2026-03-01&to=2026-03-31'),
        'property:acme:solea',
        'dashboard',
        () => ({ from: '2026-11-01', to: '2026-11-30' }),
        storage
      )
    ).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });

  it('falls back to the current month when nothing is saved', () => {
    expect(
      resolveRangeWithMemory(
        new URLSearchParams(),
        'property:acme:solea',
        'dashboard',
        () => ({ from: '2026-10-01', to: '2026-10-31' }),
        memoryStorage()
      )
    ).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('does not apply a cleared bookings filter', () => {
    const storage = memoryStorage();
    rememberDateRange('org:acme', 'bookings', { preset: 'all', from: '', to: '' }, storage);
    expect(rememberedAppliedRange('org:acme', 'bookings', storage)).toBeNull();
    expect(readRememberedDateRange('org:acme', 'bookings', storage)?.preset).toBe('all');
  });

  it('ignores corrupt storage', () => {
    const storage = memoryStorage();
    storage.setItem('kh-date-range:v1:dashboard:property:acme:solea', '{not json');
    expect(readRememberedDateRange('property:acme:solea', 'dashboard', storage)).toBeNull();
  });

  it('keeps dashboard and bookings ranges separate', () => {
    const storage = memoryStorage();
    rememberDateRange(
      'property:acme:solea',
      'dashboard',
      { preset: 'year', from: '2026-01-01', to: '2026-12-31' },
      storage
    );
    rememberDateRange(
      'property:acme:solea',
      'bookings',
      { preset: 'week', from: '2026-10-18', to: '2026-10-24' },
      storage
    );
    expect(readRememberedDateRange('property:acme:solea', 'bookings', storage)?.preset).toBe(
      'week'
    );
    expect(readRememberedDateRange('property:acme:solea', 'dashboard', storage)?.preset).toBe(
      'year'
    );
  });
});

describe('calendar period memory', () => {
  it('defaults to nothing saved and round-trips week', () => {
    const storage = memoryStorage();
    expect(readCalendarPeriod('property:acme:solea', storage)).toBeNull();
    rememberCalendarPeriod('property:acme:solea', 'week', storage);
    expect(readCalendarPeriod('property:acme:solea', storage)).toBe('week');
  });
});
