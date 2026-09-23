import { describe, expect, it } from 'vitest';

import { mapPropertySummaryToCard, mapDevelopmentSummaryToCard, mapParkingSummaryToSlot } from '@/features/guest/search/lib/mapSearchSummaries';

describe('mapPropertySummaryToCard', () => {

  it('mapPropertySummaryToCard is exported', () => {
    expect(typeof mapPropertySummaryToCard).toBe('function');
  });

});

describe('mapDevelopmentSummaryToCard', () => {

  it('mapDevelopmentSummaryToCard is exported', () => {
    expect(typeof mapDevelopmentSummaryToCard).toBe('function');
  });

});

describe('mapParkingSummaryToSlot', () => {

  it('mapParkingSummaryToSlot is exported', () => {
    expect(typeof mapParkingSummaryToSlot).toBe('function');
  });

});
