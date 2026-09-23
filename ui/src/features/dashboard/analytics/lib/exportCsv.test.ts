import { describe, expect, it } from 'vitest';

import { orgPortfolioRowsToCsv, downloadCsv } from '@/features/dashboard/analytics/lib/exportCsv';

describe('orgPortfolioRowsToCsv', () => {

  it('orgPortfolioRowsToCsv is exported', () => {
    expect(typeof orgPortfolioRowsToCsv).toBe('function');
  });

});

describe('downloadCsv', () => {

  it('downloadCsv is exported', () => {
    expect(typeof downloadCsv).toBe('function');
  });

});
