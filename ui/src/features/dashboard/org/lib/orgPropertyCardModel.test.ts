import { describe, expect, it } from 'vitest';

import { orgPropertyCardModel, orgPropertiesSummaryFromList } from '@/features/dashboard/org/lib/orgPropertyCardModel';

describe('orgPropertyCardModel', () => {

  it('orgPropertyCardModel is exported', () => {
    expect(typeof orgPropertyCardModel).toBe('function');
  });

});

describe('orgPropertiesSummaryFromList', () => {

  it('orgPropertiesSummaryFromList is exported', () => {
    expect(typeof orgPropertiesSummaryFromList).toBe('function');
  });

});
