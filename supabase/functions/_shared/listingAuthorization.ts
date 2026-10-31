/**
 * Per-listing authorization — properties.settings / parkings.settings.listingAuthorization.
 *
 * Scope split (see docs/workflow/in-progress/verification-scope-split.md):
 *   Org verification  → is this host a legitimate person/entity?
 *   This module       → is this listing legitimate, and may this host list it?
 *
 * Tier 1 (base):        rights + contract end + primary ownership/authorization proof → listing ACTIVE
 * Tier 2 (recommended): additional ownership proof + Azure PMO confirmation → listing Recommended badge
 *
 * Both tiers are independent of the org tiers — neither side cascades.
 * Asset files live in the private bucket listing-authorization-assets (paths only in settings).
 */

import {
  contractLegLifecycleToSettingsValue,
  emptyContractLegLifecycle,
  parseContractLegLifecycle,
  resolveListingContractRenewalPhase,
  type ContractLegLifecycle,
} from './contractLifecycle.ts';
import { manilaTodayYmd } from './calendarAvailabilityManila.ts';
import {
  ORG_VERIFICATION_RIGHTS,
  readOrgVerificationFromSettings,
  type OrgVerificationRights,
  type OrgVerificationState,
  verificationRightsNeedsContractEnd,
} from './orgVerification.ts';

export type { ContractLegLifecycle } from './contractLifecycle.ts';

export const LISTING_AUTHORIZATION_BUCKET = 'listing-authorization-assets';

export const LISTING_KINDS = ['property', 'parking'] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

export const LISTING_AUTHORIZATION_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;
export type ListingAuthorizationStatus = (typeof LISTING_AUTHORIZATION_STATUSES)[number];

/** changes = resubmit with notes; rejected = denied outright. */
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
  /** Tier 1 — Certificate of Title, notarized SPA, sublease contract, or equivalent. */
  proofPath: string | null;
  /** Tier 2 — a second, independent ownership/authorization document. */
  additionalProofPath: string | null;
  /** Tier 2 — Azure Property Management confirmation (email, approved GAF, gate pass). */
  azurePmoConfirmationPath: string | null;
};

export type ListingAuthorizationState = {
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
  /** Contract-expiry lifecycle for this listing (moved off the org legs). */
  lifecycle: ContractLegLifecycle;
};

const EMPTY_ASSETS: ListingAuthorizationAssets = {
  proofPath: null,
  additionalProofPath: null,
  azurePmoConfirmationPath: null,
};

export function emptyListingAuthorizationState(): ListingAuthorizationState {
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
    assets: { ...EMPTY_ASSETS },
    lifecycle: emptyContractLegLifecycle(),
  };
}

const LEGACY_RIGHTS_MAP: Record<string, OrgVerificationRights> = {
  owner: 'property_owner',
  renter: 'authorized_representative',
  sublessee: 'sublessee',
};

function asStatus(value: unknown): ListingAuthorizationStatus {
  if (
    typeof value === 'string' &&
    (LISTING_AUTHORIZATION_STATUSES as readonly string[]).includes(value)
  ) {
    return value as ListingAuthorizationStatus;
  }
  return 'none';
}

function asRejectionKind(value: unknown): ListingAuthorizationRejectionKind | null {
  if (value === 'changes' || value === 'rejected') return value;
  // Legacy value from the early approvals UI.
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
  if ((ORG_VERIFICATION_RIGHTS as readonly string[]).includes(trimmed)) {
    return trimmed as OrgVerificationRights;
  }
  return LEGACY_RIGHTS_MAP[trimmed] ?? null;
}

export function isListingKind(value: unknown): value is ListingKind {
  return typeof value === 'string' && (LISTING_KINDS as readonly string[]).includes(value);
}

export function isListingAuthorizationTier(value: unknown): value is ListingAuthorizationTier {
  return (
    typeof value === 'string' && (LISTING_AUTHORIZATION_TIERS as readonly string[]).includes(value)
  );
}

export function readListingAuthorizationFromSettings(
  settings: Record<string, unknown> | null | undefined
): ListingAuthorizationState {
  const raw = settings?.listingAuthorization;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyListingAuthorizationState();
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
  };
}

export function listingAuthorizationToSettingsValue(
  state: ListingAuthorizationState
): Record<string, unknown> {
  return {
    relationship: state.relationship,
    contractEndDate: state.contractEndDate,
    baseStatus: state.baseStatus,
    recommendedStatus: state.recommendedStatus,
    baseSubmittedAt: state.baseSubmittedAt,
    recommendedSubmittedAt: state.recommendedSubmittedAt,
    baseRejectionReason: state.baseRejectionReason,
    recommendedRejectionReason: state.recommendedRejectionReason,
    baseRejectionKind: state.baseRejectionKind,
    recommendedRejectionKind: state.recommendedRejectionKind,
    assets: {
      proofPath: state.assets.proofPath,
      additionalProofPath: state.assets.additionalProofPath,
      azurePmoConfirmationPath: state.assets.azurePmoConfirmationPath,
    },
    lifecycle: contractLegLifecycleToSettingsValue(state.lifecycle),
  };
}

export function mergeListingAuthorizationIntoSettings(
  settings: Record<string, unknown> | null | undefined,
  state: ListingAuthorizationState
): Record<string, unknown> {
  const base =
    settings && typeof settings === 'object' && !Array.isArray(settings) ? { ...settings } : {};
  return {
    ...base,
    listingAuthorization: listingAuthorizationToSettingsValue(state),
  };
}

/**
 * Pre-migration fallback: derive listing authorization from the matching org leg so
 * listings that predate the backfill still resolve rights, contract end, and Tier 1 proof.
 */
export function listingAuthorizationFromOrgLeg(
  orgSettings: Record<string, unknown> | null | undefined,
  listingKind: ListingKind
): ListingAuthorizationState {
  const org = readOrgVerificationFromSettings(orgSettings);
  return listingAuthorizationFromOrgVerification(org, listingKind);
}

export function listingAuthorizationFromOrgVerification(
  org: OrgVerificationState,
  listingKind: ListingKind
): ListingAuthorizationState {
  const isParking = listingKind === 'parking';
  const state = emptyListingAuthorizationState();

  return {
    ...state,
    relationship: isParking ? org.parkingRelationship : org.propertyRelationship,
    contractEndDate: isParking ? org.parkingContractEndDate : org.propertyContractEndDate,
    baseStatus: org.baseStatus,
    baseSubmittedAt: org.baseSubmittedAt,
    baseRejectionReason: org.baseRejectionReason,
    baseRejectionKind: org.baseRejectionKind,
    assets: {
      proofPath: isParking
        ? org.assets.parkingSocialProofPath
        : org.assets.propertyOwnershipProofPath,
      additionalProofPath: org.assets.ownershipProofPath,
      azurePmoConfirmationPath: org.assets.azurePmoConfirmationPath,
    },
    lifecycle: isParking ? org.parkingLifecycle : org.propertyLifecycle,
  };
}

/** True when the listing row has no authorization block of its own yet. */
export function listingAuthorizationUsesLegacyFallback(
  settings: Record<string, unknown> | null | undefined
): boolean {
  const raw = settings?.listingAuthorization;
  return !raw || typeof raw !== 'object' || Array.isArray(raw);
}

/**
 * Read the listing block, falling back to the org leg when the listing has none.
 * Use this on every read path until the backfill is confirmed everywhere.
 */
export function resolveListingAuthorization(
  listingSettings: Record<string, unknown> | null | undefined,
  orgSettings: Record<string, unknown> | null | undefined,
  listingKind: ListingKind
): ListingAuthorizationState {
  if (listingAuthorizationUsesLegacyFallback(listingSettings)) {
    return listingAuthorizationFromOrgLeg(orgSettings, listingKind);
  }
  return readListingAuthorizationFromSettings(listingSettings);
}

function rightsReady(
  rights: OrgVerificationRights | null,
  contractEndDate: string | null
): boolean {
  if (!rights) return false;
  if (verificationRightsNeedsContractEnd(rights) && !contractEndDate) return false;
  return true;
}

export function listingRightsNeedContractEnd(state: ListingAuthorizationState): boolean {
  return verificationRightsNeedsContractEnd(state.relationship);
}

/** Primary ownership / authorization proof collected on listing Tier 1 (not onboarding). */
export function listingAuthorizationHasPrimaryProof(state: ListingAuthorizationState): boolean {
  return Boolean(state.assets.proofPath);
}

/** Additional proof + Azure PMO collected on listing Tier 2. */
export function listingAuthorizationHasRecommendedDocs(state: ListingAuthorizationState): boolean {
  return Boolean(state.assets.additionalProofPath && state.assets.azurePmoConfirmationPath);
}

/** Tier 1 submit from onboarding — rights (+ contract end). Primary proof uploads in the listing modal. */
export function canSubmitBaseListingAuthorization(state: ListingAuthorizationState): boolean {
  if (state.baseStatus === 'pending') return false;
  if (isListingAuthorizationHardRejected(state)) return false;
  return rightsReady(state.relationship, state.contractEndDate);
}

/**
 * Tier 2 — independent of org tiers, but requires this listing's Tier 1 to be approved
 * so a Recommended badge never outranks unverified authorization. Additional proof and
 * Azure PMO are collected here; primary ownership proof is listing Tier 1.
 */
export function canSubmitRecommendedListingAuthorization(
  state: ListingAuthorizationState
): boolean {
  if (state.baseStatus !== 'approved') return false;
  if (state.recommendedStatus === 'approved' || state.recommendedStatus === 'pending') return false;
  return listingAuthorizationHasRecommendedDocs(state);
}

/** Public per-listing Recommended badge. */
export function isListingRecommendedBadge(state: ListingAuthorizationState): boolean {
  return state.recommendedStatus === 'approved';
}

/** Tier 1 approved — the listing may be ACTIVE regardless of org verification status. */
export function isListingAuthorized(state: ListingAuthorizationState): boolean {
  return state.baseStatus === 'approved';
}

/** Approved listing in pre-expiry, grace, or locked — eligible to submit a renewal. */
export function isListingRenewEligible(
  state: ListingAuthorizationState,
  todayYmd: string = manilaTodayYmd()
): boolean {
  if (state.baseStatus !== 'approved') return false;
  const phase = resolveListingContractRenewalPhase(
    state.contractEndDate,
    state.lifecycle,
    todayYmd
  );
  return phase === 'pre_expiry' || phase === 'grace' || phase === 'locked';
}

/** Renewal submit — rights plus a proof file (proof is not required for first-time base). */
export function canSubmitListingRenewal(
  state: ListingAuthorizationState,
  todayYmd: string = manilaTodayYmd()
): boolean {
  if (!isListingRenewEligible(state, todayYmd)) return false;
  if (!state.assets.proofPath) return false;
  return rightsReady(state.relationship, state.contractEndDate);
}

export function isListingAuthorizationHardRejected(state: ListingAuthorizationState): boolean {
  return state.baseStatus === 'rejected' && state.baseRejectionKind === 'rejected';
}

export function isListingAuthorizationChangesRequested(state: ListingAuthorizationState): boolean {
  return state.baseStatus === 'rejected' && state.baseRejectionKind === 'changes';
}

export function assetTypeToPathKey(
  assetType: ListingAuthorizationAssetType
): keyof ListingAuthorizationAssets {
  switch (assetType) {
    case 'proof':
      return 'proofPath';
    case 'additional_proof':
      return 'additionalProofPath';
    case 'azure_pmo_confirmation':
      return 'azurePmoConfirmationPath';
  }
}

export function applyListingAssetPath(
  state: ListingAuthorizationState,
  assetType: ListingAuthorizationAssetType,
  path: string
): ListingAuthorizationState {
  return {
    ...state,
    assets: {
      ...state.assets,
      [assetTypeToPathKey(assetType)]: path,
    },
  };
}

/** Gaps for the org listing rollup — not post-onboarding uploads still ahead of the host. */
export function missingListingDocs(state: ListingAuthorizationState): string[] {
  const missing: string[] = [];
  if (!rightsReady(state.relationship, state.contractEndDate)) missing.push('rights');
  if (state.recommendedStatus !== 'none') {
    if (!state.assets.additionalProofPath) missing.push('additional_proof');
    if (!state.assets.azurePmoConfirmationPath) missing.push('azure_pmo_confirmation');
  }
  return missing;
}

/** Listing table for a kind — properties or parkings. */
export function listingTableForKind(listingKind: ListingKind): 'properties' | 'parkings' {
  return listingKind === 'parking' ? 'parkings' : 'properties';
}
