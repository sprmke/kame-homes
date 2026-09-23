import { describe, expect, it } from 'vitest';

import { collectListingContractRenewalCandidates, pickListingContractRenewalCandidate } from '@/features/dashboard/org/lib/listingContractRenewalCandidates';

describe('collectListingContractRenewalCandidates', () => {

  it('collectListingContractRenewalCandidates is exported', () => {
    expect(typeof collectListingContractRenewalCandidates).toBe('function');
  });

});

describe('pickListingContractRenewalCandidate', () => {

  it('pickListingContractRenewalCandidate is exported', () => {
    expect(typeof pickListingContractRenewalCandidate).toBe('function');
  });

});
