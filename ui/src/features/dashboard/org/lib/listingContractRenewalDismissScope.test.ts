import { describe, expect, it } from 'vitest';

import { isOnListingRenewalShell, isListingContractRenewalModalDismissible, shouldAutoOpenLockedListingRenewal } from '@/features/dashboard/org/lib/listingContractRenewalDismissScope';

describe('isOnListingRenewalShell', () => {

  it('isOnListingRenewalShell is exported', () => {
    expect(typeof isOnListingRenewalShell).toBe('function');
  });

});

describe('isListingContractRenewalModalDismissible', () => {

  it('isListingContractRenewalModalDismissible is exported', () => {
    expect(typeof isListingContractRenewalModalDismissible).toBe('function');
  });

});

describe('shouldAutoOpenLockedListingRenewal', () => {

  it('shouldAutoOpenLockedListingRenewal is exported', () => {
    expect(typeof shouldAutoOpenLockedListingRenewal).toBe('function');
  });

});
