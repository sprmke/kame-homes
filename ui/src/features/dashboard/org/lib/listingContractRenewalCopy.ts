import type { ListingContractRenewalPhase } from '@/features/dashboard/org/lib/contractLifecycle';

export function listingContractRenewalTitle(phase: ListingContractRenewalPhase): string {
  switch (phase) {
    case 'pre_expiry':
      return 'Contract renewal reminder';
    case 'grace':
      return 'Contract expired. Renewal required';
    case 'locked':
      return 'Listing access locked';
    case 'granted':
      return 'Temporary access active';
    default:
      return 'Contract renewal';
  }
}

export const LISTING_CONTRACT_RENEWAL_PRIMARY = 'Submit renewal contract';
export const LISTING_CONTRACT_RENEWAL_DISMISS = 'Dismiss';
