import { describe, expect, it } from 'vitest';

import { orgParkingCardModel, orgParkingsSummaryFromList } from '@/features/dashboard/org/lib/orgParkingCardModel';

describe('orgParkingCardModel', () => {

  it('orgParkingCardModel is exported', () => {
    expect(typeof orgParkingCardModel).toBe('function');
  });

});

describe('orgParkingsSummaryFromList', () => {

  it('orgParkingsSummaryFromList is exported', () => {
    expect(typeof orgParkingsSummaryFromList).toBe('function');
  });

});
