import { describe, expect, it } from 'vitest';

import {
  detectPresetFromRange,
  getDateRangeFromPreset,
  navigateReferenceDate,
  formatDateRangeDisplay,
  isCurrentPeriod,
  toIsoDate,
  fromIsoDate,
} from '@/lib/date/navigation';

describe('detectPresetFromRange', () => {
  it('detectPresetFromRange is exported', () => {
    expect(typeof detectPresetFromRange).toBe('function');
  });
});

describe('getDateRangeFromPreset', () => {
  it('getDateRangeFromPreset is exported', () => {
    expect(typeof getDateRangeFromPreset).toBe('function');
  });
});

describe('navigateReferenceDate', () => {
  it('navigateReferenceDate is exported', () => {
    expect(typeof navigateReferenceDate).toBe('function');
  });
});

describe('formatDateRangeDisplay', () => {
  it('formatDateRangeDisplay is exported', () => {
    expect(typeof formatDateRangeDisplay).toBe('function');
  });

  it('uses abbreviated month in compact mode', () => {
    const from = new Date(2026, 8, 1);
    const to = new Date(2026, 8, 30);
    expect(formatDateRangeDisplay(from, to, 'month')).toBe('September 2026');
    expect(formatDateRangeDisplay(from, to, 'month', { compact: true })).toBe('Sep 2026');
  });
});

describe('isCurrentPeriod', () => {
  it('isCurrentPeriod is exported', () => {
    expect(typeof isCurrentPeriod).toBe('function');
  });
});

describe('toIsoDate', () => {
  it('toIsoDate is exported', () => {
    expect(typeof toIsoDate).toBe('function');
  });
});

describe('fromIsoDate', () => {
  it('fromIsoDate is exported', () => {
    expect(typeof fromIsoDate).toBe('function');
  });
});
