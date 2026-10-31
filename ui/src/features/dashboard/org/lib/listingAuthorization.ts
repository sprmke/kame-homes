/**
 * UI mirror of supabase/functions/_shared/listingAuthorization.ts — keep the tier gates in sync.
 * Listing scope answers "is this listing real and may this host list it?"; org scope answers
 * "is this host real?". Neither cascades into the other.
 */

import {
  emptyContractLegLifecycle,
  listingHasContractRenewalLifecycle,
  parseContractLegLifecycle,
  resolveListingContractRenewalPhase,
  type ContractLegLifecycle,
  type ListingContractRenewalPhase,
} from './contractLifecycle.ts';
import { todayManilaYmd } from './orgVerification.ts';
import {
  ORG_VERIFICATION_RIGHTS,
  verificationRightsNeedsContractEnd,
  type OrgVerificationRights,
} from './orgVerification.ts';

export const LISTING_KINDS = ['property', 'parking'] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

export const LISTING_AUTHORIZATION_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;
export type ListingAuthorizationStatus = (typeof LISTING_AUTHORIZATION_STATUSES)[number];

export const LISTING_AUTHORIZATION_REJECTION_KINDS = ['changes', 'rejected'] as const;
export type ListingAuthorizationRejectionKind =
  (typeof LISTING_AUTHORIZATION_REJECTION_KINDS)[number];

export const LISTING_AUTHORIZATION_ASSET_TYPES = [
  'proof',
  'additional_proof',
  'azure_pmo_confirmation',
] as const;
export type ListingAuthorizationAssetType = (typeof LISTING_AUTHORIZATION_ASSET_TYPES)[number];

export const LISTING_AUTHORIZATION_TIERS = ['base', 'recommended'] as const;
export type ListingAuthorizationTier = (typeof LISTING_AUTHORIZATION_TIERS)[number];

export type ListingAuthorizationAssets = {
  proofPath: string | null;
  additionalProofPath: string | null;
  azurePmoConfirmationPath: string | null;
};

export type ListingAuthorizationSummary = {
  relationship: OrgVerificationRights | null;
  contractEndDate: string | null;
  baseStatus: ListingAuthorizationStatus;
  recommendedStatus: ListingAuthorizationStatus;
  baseSubmittedAt: string | null;
  recommendedSubmittedAt: string | null;
  baseRejectionReason: string | null;
  recommendedRejectionReason: string | null;
  baseRejectionKind: ListingAuthorizationRejectionKind | null;
  recommendedRejectionKind: ListingAuthorizationRejectionKind | null;
  assets: ListingAuthorizationAssets;
  /** Contract expiry, grace, lock, and consideration for this listing. */
  lifecycle: ContractLegLifecycle;
  /** listing Tier 2 approved */
  recommendedBadge: boolean;
};

const LEGACY_RIGHTS_MAP: Record<string, OrgVerificationRights> = {
  owner: 'property_owner',
  renter: 'authorized_representative',
  sublessee: 'sublessee',
};

function asStatus(value: unknown): ListingAuthorizationStatus {
  return LISTING_AUTHORIZATION_STATUSES.includes(value as ListingAuthorizationStatus)
    ? (value as ListingAuthorizationStatus)
    : 'none';
}

function asRejectionKind(value: unknown): ListingAuthorizationRejectionKind | null {
  if (value === 'changes' || value === 'rejected') return value;
  if (value === 'compliance') return 'changes';
  return null;
}

function asPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asRights(value: unknown): OrgVerificationRights | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (ORG_VERIFICATION_RIGHTS.some((entry) => entry.value === trimmed)) {
    return trimmed as OrgVerificationRights;
  }
  return LEGACY_RIGHTS_MAP[trimmed] ?? null;
}

export function emptyListingAuthorizationSummary(): ListingAuthorizationSummary {
  return {
    relationship: null,
    contractEndDate: null,
    baseStatus: 'none',
    recommendedStatus: 'none',
    baseSubmittedAt: null,
    recommendedSubmittedAt: null,
    baseRejectionReason: null,
    recommendedRejectionReason: null,
    baseRejectionKind: null,
    recommendedRejectionKind: null,
    assets: { proofPath: null, additionalProofPath: null, azurePmoConfirmationPath: null },
    lifecycle: emptyContractLegLifecycle(),
    recommendedBadge: false,
  };
}

export function readListingAuthorizationSummary(
  settings: Record<string, unknown> | null | undefined
): ListingAuthorizationSummary {
  const raw = settings?.listingAuthorization;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyListingAuthorizationSummary();
  }
  const v = raw as Record<string, unknown>;
  const assetsRaw =
    v.assets && typeof v.assets === 'object' && !Array.isArray(v.assets)
      ? (v.assets as Record<string, unknown>)
      : {};

  const baseStatus = asStatus(v.baseStatus);
  const recommendedStatus = asStatus(v.recommendedStatus);

  return {
    relationship: asRights(v.relationship),
    contractEndDate: asPath(v.contractEndDate),
    baseStatus,
    recommendedStatus,
    baseSubmittedAt: asPath(v.baseSubmittedAt),
    recommendedSubmittedAt: asPath(v.recommendedSubmittedAt),
    baseRejectionReason: asPath(v.baseRejectionReason),
    recommendedRejectionReason: asPath(v.recommendedRejectionReason),
    baseRejectionKind:
      baseStatus === 'rejected' ? (asRejectionKind(v.baseRejectionKind) ?? 'rejected') : null,
    recommendedRejectionKind:
      recommendedStatus === 'rejected'
        ? (asRejectionKind(v.recommendedRejectionKind) ?? 'rejected')
        : null,
    assets: {
      proofPath: asPath(assetsRaw.proofPath),
      additionalProofPath: asPath(assetsRaw.additionalProofPath),
      azurePmoConfirmationPath: asPath(assetsRaw.azurePmoConfirmationPath),
    },
    lifecycle: parseContractLegLifecycle(v.lifecycle),
    recommendedBadge: recommendedStatus === 'approved',
  };
}

export function listingRightsNeedContractEnd(
  relationship: OrgVerificationRights | '' | null | undefined
): boolean {
  return verificationRightsNeedsContractEnd(relationship);
}

export function isListingAuthorizationHardRejected(state: ListingAuthorizationSummary): boolean {
  return state.baseStatus === 'rejected' && state.baseRejectionKind === 'rejected';
}

export function isListingAuthorizationChangesRequested(
  state: ListingAuthorizationSummary
): boolean {
  return state.baseStatus === 'rejected' && state.baseRejectionKind === 'changes';
}

/** Primary ownership / authorization proof collected on listing Tier 1 (not onboarding). */
export function listingAuthorizationHasPrimaryProof(state: ListingAuthorizationSummary): boolean {
  return Boolean(state.assets.proofPath);
}

/** Additional proof + Azure PMO collected on listing Tier 2. */
export function listingAuthorizationHasRecommendedDocs(
  state: ListingAuthorizationSummary
): boolean {
  return Boolean(state.assets.additionalProofPath && state.assets.azurePmoConfirmationPath);
}

/** Tier 1 submit from onboarding — rights (+ contract end). Primary proof uploads in the listing modal. */
export function canSubmitBaseListingAuthorization(state: ListingAuthorizationSummary): boolean {
  if (state.baseStatus === 'pending') return false;
  if (isListingAuthorizationHardRejected(state)) return false;
  if (!state.relationship) return false;
  if (listingRightsNeedContractEnd(state.relationship) && !state.contractEndDate) return false;
  return true;
}

/** Tier 2 — listing Tier 1 approved; additional proof + Azure PMO. */
export function canSubmitRecommendedListingAuthorization(
  state: ListingAuthorizationSummary
): boolean {
  if (state.baseStatus !== 'approved') return false;
  if (state.recommendedStatus === 'approved' || state.recommendedStatus === 'pending') return false;
  return listingAuthorizationHasRecommendedDocs(state);
}

export function isListingAuthorized(state: ListingAuthorizationSummary): boolean {
  return state.baseStatus === 'approved';
}

export function isListingRenewEligible(
  state: ListingAuthorizationSummary,
  todayYmd: string = todayManilaYmd()
): boolean {
  if (state.baseStatus !== 'approved') return false;
  const phase = resolveListingContractRenewalPhase(
    state.contractEndDate,
    state.lifecycle,
    todayYmd
  );
  return phase === 'pre_expiry' || phase === 'grace' || phase === 'locked';
}

export function canSubmitListingRenewal(
  state: ListingAuthorizationSummary,
  todayYmd: string = todayManilaYmd()
): boolean {
  if (!isListingRenewEligible(state, todayYmd)) return false;
  if (!state.assets.proofPath) return false;
  if (!state.relationship) return false;
  if (listingRightsNeedContractEnd(state.relationship) && !state.contractEndDate) return false;
  return true;
}

export { listingHasContractRenewalLifecycle, resolveListingContractRenewalPhase };
export type { ListingContractRenewalPhase };

/** Sidebar entry stays visible once listing verification has started. */
export function shouldShowListingVerificationCta(state: ListingAuthorizationSummary): boolean {
  return state.baseStatus !== 'none' || state.recommendedStatus !== 'none';
}
