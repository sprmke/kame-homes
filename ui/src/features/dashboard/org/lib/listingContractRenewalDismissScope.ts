import type { ListingKind } from '@/features/dashboard/org/lib/listingAuthorization';
import type { ListingContractRenewalCandidate } from '@/features/dashboard/org/lib/listingContractRenewalCandidates';

export type ListingContractRenewalRouteContext = {
  isOrgOnlyRoute: boolean;
  isOnAffectedListingShell: boolean;
};

/** True when the current property/parking admin shell matches the renewal candidate. */
export function isOnListingRenewalShell(
  candidate: ListingContractRenewalCandidate,
  listingKind: ListingKind | null,
  listingId: string | null | undefined
): boolean {
  if (!listingKind || !listingId) return false;
  return candidate.listingKind === listingKind && candidate.listingId === listingId;
}

/**
 * Locked reminders are non-dismissible only on the affected listing shell.
 * Org dashboard and sibling listings stay closeable so multi-listing hosts can work.
 */
export function isListingContractRenewalModalDismissible(
  candidate: ListingContractRenewalCandidate,
  route: ListingContractRenewalRouteContext
): boolean {
  if (candidate.dismissible) return true;
  if (route.isOrgOnlyRoute) return true;
  if (!route.isOnAffectedListingShell) return true;
  return false;
}

/** Locked modal always re-opens on the affected listing shell; elsewhere once per login. */
export function shouldAutoOpenLockedListingRenewal(
  route: ListingContractRenewalRouteContext,
  alreadyShownThisLogin: boolean
): boolean {
  if (route.isOnAffectedListingShell) return true;
  return !alreadyShownThisLogin;
}
