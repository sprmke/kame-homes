import { describe, expect, it } from 'vitest';

import { listingApprovalHasDualTierQueue, defaultListingApprovalReviewTier, latestListingApprovalSubmittedAt, listingApprovalTierStatus, listingApprovalTierRejectionKind, listingApprovalTierRejectionReason, listingApprovalTierSubmittedAt } from '@/features/dashboard/super-admin/lib/listingApprovalReviewTier';

describe('listingApprovalHasDualTierQueue', () => {

  it('listingApprovalHasDualTierQueue is exported', () => {
    expect(typeof listingApprovalHasDualTierQueue).toBe('function');
  });

});

describe('defaultListingApprovalReviewTier', () => {

  it('defaultListingApprovalReviewTier is exported', () => {
    expect(typeof defaultListingApprovalReviewTier).toBe('function');
  });

});

describe('latestListingApprovalSubmittedAt', () => {

  it('latestListingApprovalSubmittedAt is exported', () => {
    expect(typeof latestListingApprovalSubmittedAt).toBe('function');
  });

});

describe('listingApprovalTierStatus', () => {

  it('listingApprovalTierStatus is exported', () => {
    expect(typeof listingApprovalTierStatus).toBe('function');
  });

});

describe('listingApprovalTierRejectionKind', () => {

  it('listingApprovalTierRejectionKind is exported', () => {
    expect(typeof listingApprovalTierRejectionKind).toBe('function');
  });

});

describe('listingApprovalTierRejectionReason', () => {

  it('listingApprovalTierRejectionReason is exported', () => {
    expect(typeof listingApprovalTierRejectionReason).toBe('function');
  });

});

describe('listingApprovalTierSubmittedAt', () => {

  it('listingApprovalTierSubmittedAt is exported', () => {
    expect(typeof listingApprovalTierSubmittedAt).toBe('function');
  });

});
