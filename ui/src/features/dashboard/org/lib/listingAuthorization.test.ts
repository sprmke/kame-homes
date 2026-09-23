import { describe, expect, it } from 'vitest';

import { emptyListingAuthorizationSummary, readListingAuthorizationSummary, listingRightsNeedContractEnd, isListingAuthorizationHardRejected, isListingAuthorizationChangesRequested, listingAuthorizationHasPrimaryProof, listingAuthorizationHasRecommendedDocs, canSubmitBaseListingAuthorization, canSubmitRecommendedListingAuthorization, isListingAuthorized, isListingRenewEligible, canSubmitListingRenewal, shouldShowListingVerificationCta, LISTING_KINDS, LISTING_AUTHORIZATION_STATUSES, LISTING_AUTHORIZATION_REJECTION_KINDS, LISTING_AUTHORIZATION_ASSET_TYPES, LISTING_AUTHORIZATION_TIERS } from '@/features/dashboard/org/lib/listingAuthorization';

describe('emptyListingAuthorizationSummary', () => {

  it('emptyListingAuthorizationSummary is exported', () => {
    expect(typeof emptyListingAuthorizationSummary).toBe('function');
  });

});

describe('readListingAuthorizationSummary', () => {

  it('readListingAuthorizationSummary is exported', () => {
    expect(typeof readListingAuthorizationSummary).toBe('function');
  });

});

describe('listingRightsNeedContractEnd', () => {

  it('listingRightsNeedContractEnd is exported', () => {
    expect(typeof listingRightsNeedContractEnd).toBe('function');
  });

});

describe('isListingAuthorizationHardRejected', () => {

  it('isListingAuthorizationHardRejected is exported', () => {
    expect(typeof isListingAuthorizationHardRejected).toBe('function');
  });

});

describe('isListingAuthorizationChangesRequested', () => {

  it('isListingAuthorizationChangesRequested is exported', () => {
    expect(typeof isListingAuthorizationChangesRequested).toBe('function');
  });

});

describe('listingAuthorizationHasPrimaryProof', () => {

  it('listingAuthorizationHasPrimaryProof is exported', () => {
    expect(typeof listingAuthorizationHasPrimaryProof).toBe('function');
  });

});

describe('listingAuthorizationHasRecommendedDocs', () => {

  it('listingAuthorizationHasRecommendedDocs is exported', () => {
    expect(typeof listingAuthorizationHasRecommendedDocs).toBe('function');
  });

});

describe('canSubmitBaseListingAuthorization', () => {

  it('canSubmitBaseListingAuthorization is exported', () => {
    expect(typeof canSubmitBaseListingAuthorization).toBe('function');
  });

});

describe('canSubmitRecommendedListingAuthorization', () => {

  it('canSubmitRecommendedListingAuthorization is exported', () => {
    expect(typeof canSubmitRecommendedListingAuthorization).toBe('function');
  });

});

describe('isListingAuthorized', () => {

  it('isListingAuthorized is exported', () => {
    expect(typeof isListingAuthorized).toBe('function');
  });

});

describe('isListingRenewEligible', () => {

  it('isListingRenewEligible is exported', () => {
    expect(typeof isListingRenewEligible).toBe('function');
  });

});

describe('canSubmitListingRenewal', () => {

  it('canSubmitListingRenewal is exported', () => {
    expect(typeof canSubmitListingRenewal).toBe('function');
  });

});

describe('shouldShowListingVerificationCta', () => {

  it('shouldShowListingVerificationCta is exported', () => {
    expect(typeof shouldShowListingVerificationCta).toBe('function');
  });

});

describe('LISTING_KINDS', () => {
  it('is defined', () => {
    expect(LISTING_KINDS).toBeDefined();
  });
});

describe('LISTING_AUTHORIZATION_STATUSES', () => {
  it('is defined', () => {
    expect(LISTING_AUTHORIZATION_STATUSES).toBeDefined();
  });
});

describe('LISTING_AUTHORIZATION_REJECTION_KINDS', () => {
  it('is defined', () => {
    expect(LISTING_AUTHORIZATION_REJECTION_KINDS).toBeDefined();
  });
});

describe('LISTING_AUTHORIZATION_ASSET_TYPES', () => {
  it('is defined', () => {
    expect(LISTING_AUTHORIZATION_ASSET_TYPES).toBeDefined();
  });
});

describe('LISTING_AUTHORIZATION_TIERS', () => {
  it('is defined', () => {
    expect(LISTING_AUTHORIZATION_TIERS).toBeDefined();
  });
});

