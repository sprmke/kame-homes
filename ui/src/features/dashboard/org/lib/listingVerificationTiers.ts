/**
 * Listing tier definitions and checklists — the listing-scope counterpart of
 * `orgVerificationTiers.ts`. Listing status never derives from org status.
 */

import {
  isListingAuthorizationChangesRequested,
  isListingAuthorizationHardRejected,
  listingRightsNeedContractEnd,
  readListingAuthorizationSummary,
  type ListingAuthorizationStatus,
  type ListingAuthorizationSummary,
  type ListingKind,
} from '@/features/dashboard/org/lib/listingAuthorization';
import {
  LISTING_VERIFICATION_DOC_LABELS,
  LISTING_VERIFICATION_TIER1_BENEFIT,
  LISTING_VERIFICATION_TIER1_TITLE,
  LISTING_VERIFICATION_TIER2_BENEFIT,
  LISTING_VERIFICATION_TIER2_TITLE,
} from '@/features/dashboard/org/lib/listingVerificationCopy';
import { ORG_VERIFICATION_RIGHTS } from '@/features/dashboard/org/lib/orgVerification';
import type {
  VerificationChecklistItem,
  VerificationTierDefinition,
} from '@/features/dashboard/org/lib/orgVerificationTiers';

/** Listing Tier 1 rows backed by an uploaded file. */
const LISTING_BASE_DOCUMENT_ITEM_IDS = new Set(['listing-proof']);

/** Listing Tier 2 rows backed by an uploaded file. */
const LISTING_RECOMMENDED_DOCUMENT_ITEM_IDS = new Set([
  'listing-additional-proof',
  'listing-azure-pmo-confirmation',
]);

export function listingBaseDocumentChecklistItems(
  items: VerificationChecklistItem[]
): VerificationChecklistItem[] {
  return items.filter((item) => LISTING_BASE_DOCUMENT_ITEM_IDS.has(item.id));
}

export function listingRecommendedDocumentChecklistItems(
  items: VerificationChecklistItem[]
): VerificationChecklistItem[] {
  return items.filter((item) => LISTING_RECOMMENDED_DOCUMENT_ITEM_IDS.has(item.id));
}

function rightsLabel(state: ListingAuthorizationSummary): string | null {
  if (!state.relationship) return null;
  return ORG_VERIFICATION_RIGHTS.find((entry) => entry.value === state.relationship)?.label ?? null;
}

export function readListingAuthorization(
  settings: Record<string, unknown> | null | undefined
): ListingAuthorizationSummary {
  return readListingAuthorizationSummary(settings);
}

export function buildListingBaseChecklist(
  state: ListingAuthorizationSummary,
  listingKind: ListingKind
): VerificationChecklistItem[] {
  const rights = rightsLabel(state);
  const items: VerificationChecklistItem[] = [
    {
      id: 'listing-rights',
      label: rights
        ? `${listingKind === 'parking' ? 'Parking' : 'Property'} rights · ${rights}`
        : `${listingKind === 'parking' ? 'Parking' : 'Property'} rights`,
      complete: Boolean(state.relationship),
    },
  ];

  if (listingRightsNeedContractEnd(state.relationship)) {
    items.push({
      id: 'listing-contract',
      label: state.contractEndDate
        ? `Contract end · ${state.contractEndDate}`
        : 'Contract end date',
      complete: Boolean(state.contractEndDate),
    });
  }

  items.push({
    id: 'listing-proof',
    label: LISTING_VERIFICATION_DOC_LABELS.proof,
    complete: Boolean(state.assets.proofPath),
  });

  return items;
}

export function buildListingRecommendedChecklist(
  state: ListingAuthorizationSummary
): VerificationChecklistItem[] {
  return [
    {
      id: 'listing-additional-proof',
      label: LISTING_VERIFICATION_DOC_LABELS.additionalProof,
      complete: Boolean(state.assets.additionalProofPath),
    },
    {
      id: 'listing-azure-pmo-confirmation',
      label: LISTING_VERIFICATION_DOC_LABELS.azurePmoConfirmation,
      complete: Boolean(state.assets.azurePmoConfirmationPath),
    },
  ];
}

export function buildListingVerificationTiers(
  state: ListingAuthorizationSummary
): VerificationTierDefinition[] {
  return [
    {
      id: 'listing_base',
      level: 1,
      title: LISTING_VERIFICATION_TIER1_TITLE,
      benefit: LISTING_VERIFICATION_TIER1_BENEFIT,
      status: state.baseStatus,
      requirementLabel: 'Required to list',
    },
    {
      id: 'listing_recommended',
      level: 2,
      title: LISTING_VERIFICATION_TIER2_TITLE,
      benefit: LISTING_VERIFICATION_TIER2_BENEFIT,
      status: state.recommendedStatus,
      requirementLabel: 'Optional badge',
    },
  ];
}

/** Which tab the modal lands on when it opens. */
export function defaultListingVerificationStepIndex(
  state: ListingAuthorizationSummary,
  options?: { renewMode?: boolean }
): number {
  if (options?.renewMode || state.baseStatus !== 'approved') return 0;
  if (state.recommendedStatus === 'none') return 1;
  return 0;
}

export function listingVerificationSidebarLabel(state: ListingAuthorizationSummary): string {
  if (state.baseStatus === 'approved' && state.recommendedStatus === 'approved') {
    return 'Verification';
  }
  if (isListingAuthorizationChangesRequested(state)) return 'Changes requested';
  if (isListingAuthorizationHardRejected(state)) return 'Verification declined';
  if (state.recommendedStatus === 'approved') return 'Verification';
  if (state.recommendedStatus === 'pending') return 'Badge in review';
  if (state.recommendedStatus === 'rejected') return 'Resubmit badge';
  if (state.baseStatus === 'pending') return 'Verification in review';
  if (state.baseStatus === 'rejected') return 'Verification declined';
  if (state.recommendedStatus === 'none' && state.baseStatus === 'approved') {
    return 'Get Recommended badge';
  }
  if (state.baseStatus === 'none') return 'Get Verified';
  return 'Verification';
}

export function listingVerificationStatusLabel(status: ListingAuthorizationStatus): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'pending':
      return 'In review';
    case 'rejected':
      return 'Declined';
    default:
      return 'Not started';
  }
}
