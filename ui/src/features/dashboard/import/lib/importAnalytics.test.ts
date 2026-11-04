import { describe, expect, it } from 'vitest';

import { importSourceForFile, rowCountBucket } from './importAnalytics';

describe('importSourceForFile', () => {
  it('recognises both Excel extensions', () => {
    expect(importSourceForFile('reservations.xlsx')).toBe('xlsx');
    expect(importSourceForFile('reservations.XLS')).toBe('xls');
  });

  it('treats CSV and anything unknown as csv, because CSV is what the parser requires', () => {
    expect(importSourceForFile('reservations.csv')).toBe('csv');
    expect(importSourceForFile('export')).toBe('csv');
    expect(importSourceForFile('')).toBe('csv');
  });
});

describe('rowCountBucket', () => {
  it('buckets at the documented boundaries', () => {
    expect(rowCountBucket(1)).toBe('1-10');
    expect(rowCountBucket(10)).toBe('1-10');
    expect(rowCountBucket(11)).toBe('11-50');
    expect(rowCountBucket(50)).toBe('11-50');
    expect(rowCountBucket(51)).toBe('51-200');
    expect(rowCountBucket(200)).toBe('51-200');
    expect(rowCountBucket(201)).toBe('200+');
  });
});
