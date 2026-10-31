/**
 * Listing-scoped verification copy. Host-scoped strings stay in `verificationCopy.ts` —
 * listing verification answers "may this host list this unit?", not "is this host real?".
 */

import type { ListingKind } from '@/features/dashboard/org/lib/listingAuthorization';

export const LISTING_VERIFICATION_TIER1_TITLE = 'Listing verified';
export const LISTING_VERIFICATION_TIER2_TITLE = 'Recommended';

export const LISTING_VERIFICATION_TIER1_BENEFIT = 'Required before this listing goes live';
export const LISTING_VERIFICATION_TIER2_BENEFIT =
  'Earn a Recommended badge on this listing’s public page.';

export const LISTING_VERIFICATION_REVIEW_TIMELINE =
  'Review usually takes a few hours up to 3 days.';

export const LISTING_VERIFICATION_TIER1_APPROVED_PROPERTY =
  'This property is live on the platform.';
export const LISTING_VERIFICATION_TIER1_APPROVED_PARKING = 'This parking is live on the platform.';

export const LISTING_VERIFICATION_TIER2_APPROVED =
  'Recommended badge is live on this listing’s page.';

export const LISTING_VERIFICATION_BENEFIT_BULLETS = [
  'Recommended badge on this listing',
  'Higher placement in guest search',
  'Fewer pre-booking questions from guests',
] as const;

export const LISTING_VERIFICATION_DOC_LABELS = {
  proof: 'Proof of ownership or authorization',
  additionalProof: 'Additional proof of ownership or authorization',
  azurePmoConfirmation: 'Azure Property Management email confirmation',
} as const;

export const LISTING_VERIFICATION_DOC_HELP = {
  additionalProof:
    'A second document that backs the first (e.g. Certificate of Title, Deed of Sale, Sublease Contract, or Notarized Authorization (SPA)).',
  azurePmoConfirmation:
    'e.g. Property Management email confirmation, approved GAF, gate pass, or building pass.',
} as const;

export const LISTING_VERIFICATION_PREVIEW_CAPTION = 'Guests see this on this listing.';
export const LISTING_VERIFICATION_PREVIEW_FALLBACK = 'Your listing';
export const LISTING_VERIFICATION_SIDEBAR_SUBLABEL = 'Verify this listing.';
export const LISTING_VERIFICATION_TIER2_PREREQ =
  'Finish listing authorization before submitting Recommended documents.';

export function listingVerificationModalTitle(kind: ListingKind): string {
  return kind === 'parking' ? 'Parking verification' : 'Property verification';
}

export function listingKindLabel(listingKind: ListingKind): string {
  return listingKind === 'parking' ? 'Parking' : 'Property';
}

export function listingTier1ApprovedCopy(listingKind: ListingKind): string {
  return listingKind === 'parking'
    ? LISTING_VERIFICATION_TIER1_APPROVED_PARKING
    : LISTING_VERIFICATION_TIER1_APPROVED_PROPERTY;
}
