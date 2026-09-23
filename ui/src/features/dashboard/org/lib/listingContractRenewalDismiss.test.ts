import { describe, expect, it } from 'vitest';

import { persistsListingContractRenewalDailyDismiss, listingContractRenewalDismissKey, readListingContractRenewalDismissedYmd, dismissListingContractRenewalForToday } from '@/features/dashboard/org/lib/listingContractRenewalDismiss';

describe('persistsListingContractRenewalDailyDismiss', () => {

  it('persistsListingContractRenewalDailyDismiss is exported', () => {
    expect(typeof persistsListingContractRenewalDailyDismiss).toBe('function');
  });

});

describe('listingContractRenewalDismissKey', () => {

  it('listingContractRenewalDismissKey is exported', () => {
    expect(typeof listingContractRenewalDismissKey).toBe('function');
  });

});

describe('readListingContractRenewalDismissedYmd', () => {

  it('readListingContractRenewalDismissedYmd is exported', () => {
    expect(typeof readListingContractRenewalDismissedYmd).toBe('function');
  });

});

describe('dismissListingContractRenewalForToday', () => {

  it('dismissListingContractRenewalForToday is exported', () => {
    expect(typeof dismissListingContractRenewalForToday).toBe('function');
  });

});
