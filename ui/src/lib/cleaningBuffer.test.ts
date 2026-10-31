import { describe, expect, it } from 'vitest';

import {
  CLEANING_BUFFER_MIN_MINUTES,
  CLEANING_BUFFER_OPTIONS,
  DEFAULT_CLEANING_BUFFER_MINUTES,
  isValidCleaningBufferMinutes,
  normalizeCleaningBufferMinutes,
} from '@/lib/cleaningBuffer';

describe('cleaning buffer', () => {
  it('exposes stepped options from 1h to 6h', () => {
    expect(CLEANING_BUFFER_OPTIONS[0]?.value).toBe(CLEANING_BUFFER_MIN_MINUTES);
    expect(CLEANING_BUFFER_OPTIONS.at(-1)?.value).toBe(360);
    expect(CLEANING_BUFFER_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });

  it('validates 30-minute steps within range', () => {
    expect(isValidCleaningBufferMinutes(90)).toBe(true);
    expect(isValidCleaningBufferMinutes(75)).toBe(false);
    expect(isValidCleaningBufferMinutes(30)).toBe(false);
  });

  it('normalizes invalid values to default', () => {
    expect(normalizeCleaningBufferMinutes(null)).toBe(DEFAULT_CLEANING_BUFFER_MINUTES);
    expect(normalizeCleaningBufferMinutes(999)).toBe(DEFAULT_CLEANING_BUFFER_MINUTES);
    expect(normalizeCleaningBufferMinutes(120)).toBe(120);
  });
});
