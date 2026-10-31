import {
  resolveListingContractRenewalPhase,
  listingHasContractRenewalLifecycle,
  type ContractLegLifecycle,
  type ListingContractRenewalPhase,
} from '@/features/dashboard/org/lib/contractLifecycle';
import {
  readListingAuthorizationSummary,
  type ListingKind,
} from '@/features/dashboard/org/lib/listingAuthorization';
import {
  persistsListingContractRenewalDailyDismiss,
  readListingContractRenewalDismissedYmd,
} from '@/features/dashboard/org/lib/listingContractRenewalDismiss';
import type { Parking, Property } from '@/features/dashboard/org/types';

const PHASE_PRIORITY: Record<ListingContractRenewalPhase, number> = {
  locked: 0,
  grace: 1,
  pre_expiry: 2,
  granted: 3,
  none: 99,
};

export type ListingContractRenewalCandidate = {
  listingKind: ListingKind;
  listingId: string;
  listingName: string;
  listingSlug: string;
  listingSettings: Record<string, unknown>;
  phase: ListingContractRenewalPhase;
  dismissible: boolean;
  contractEndDate: string | null;
  lifecycle: ContractLegLifecycle;
};

function pushCandidate(
  out: ListingContractRenewalCandidate[],
  listingKind: ListingKind,
  listing: Property | Parking,
  todayYmd: string
): void {
  const authorization = readListingAuthorizationSummary(listing.settings);
  if (!listingHasContractRenewalLifecycle(authorization.contractEndDate, authorization.lifecycle)) {
    return;
  }
  const phase = resolveListingContractRenewalPhase(
    authorization.contractEndDate,
    authorization.lifecycle,
    todayYmd
  );
  if (phase === 'none') return;

  const dismissible = phase !== 'locked';
  if (
    persistsListingContractRenewalDailyDismiss(phase) &&
    readListingContractRenewalDismissedYmd(listingKind, listing.id) === todayYmd
  ) {
    return;
  }

  out.push({
    listingKind,
    listingId: listing.id,
    listingName: listing.name,
    listingSlug: listing.slug,
    listingSettings: listing.settings,
    phase,
    dismissible,
    contractEndDate: authorization.contractEndDate,
    lifecycle: authorization.lifecycle,
  });
}

/** Org owner's listings that need a contract renewal reminder today, highest urgency first. */
export function collectListingContractRenewalCandidates(
  properties: Property[],
  parkings: Parking[],
  todayYmd: string
): ListingContractRenewalCandidate[] {
  const out: ListingContractRenewalCandidate[] = [];
  for (const property of properties) {
    pushCandidate(out, 'property', property, todayYmd);
  }
  for (const parking of parkings) {
    pushCandidate(out, 'parking', parking, todayYmd);
  }
  out.sort((a, b) => {
    const byPhase = PHASE_PRIORITY[a.phase] - PHASE_PRIORITY[b.phase];
    if (byPhase !== 0) return byPhase;
    return a.listingName.localeCompare(b.listingName);
  });
  return out;
}

export function pickListingContractRenewalCandidate(
  candidates: ListingContractRenewalCandidate[]
): ListingContractRenewalCandidate | null {
  return candidates[0] ?? null;
}
