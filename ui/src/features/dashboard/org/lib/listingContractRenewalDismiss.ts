import type { ListingContractRenewalPhase } from '@/features/dashboard/org/lib/contractLifecycle';
import type { ListingKind } from '@/features/dashboard/org/lib/listingAuthorization';

const PREFIX = 'listing-contract-renewal-dismiss';

/** Daily localStorage snooze. Grace re-opens on refresh; locked is not daily-snoozed. */
export function persistsListingContractRenewalDailyDismiss(
  phase: ListingContractRenewalPhase
): boolean {
  return phase === 'pre_expiry' || phase === 'granted';
}

export function listingContractRenewalDismissKey(
  listingKind: ListingKind,
  listingId: string
): string {
  return `${PREFIX}:${listingKind}:${listingId}`;
}

export function readListingContractRenewalDismissedYmd(
  listingKind: ListingKind,
  listingId: string
): string | null {
  try {
    const raw = localStorage.getItem(listingContractRenewalDismissKey(listingKind, listingId));
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function dismissListingContractRenewalForToday(
  listingKind: ListingKind,
  listingId: string,
  todayYmd: string
): void {
  try {
    localStorage.setItem(listingContractRenewalDismissKey(listingKind, listingId), todayYmd);
  } catch {
    // ignore quota / private mode
  }
}
