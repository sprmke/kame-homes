/**
 * Organization host verification — settings shape + helpers.
 * Asset files live in private bucket org-verification-assets (paths only in settings).
 */

import {
  contractLegLifecycleToSettingsValue,
  emptyContractLegLifecycle,
  parseContractLegLifecycle,
  type ContractLegLifecycle,
} from './contractLifecycle.ts';

export type { ContractLegLifecycle } from './contractLifecycle.ts';

export const ORG_VERIFICATION_BUCKET = 'org-verification-assets';

export const ORG_VERIFICATION_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;
export type OrgVerificationStatus = (typeof ORG_VERIFICATION_STATUSES)[number];

/** How a `rejected` status was decided — changes = request resubmit with notes; rejected = deny with reason. */
export const ORG_VERIFICATION_REJECTION_KINDS = ['changes', 'rejected'] as const;
export type OrgVerificationRejectionKind = (typeof ORG_VERIFICATION_REJECTION_KINDS)[number];

export const ORG_SOCIAL_PROOF_PLATFORMS = ['facebook', 'instagram', 'airbnb'] as const;
export type OrgSocialProofPlatform = (typeof ORG_SOCIAL_PROOF_PLATFORMS)[number];

export const ORG_VERIFICATION_RIGHTS = [
  'property_owner',
  'authorized_representative',
  'sublessee',
  'property_admin',
] as const;
export type OrgVerificationRights = (typeof ORG_VERIFICATION_RIGHTS)[number];

/** @deprecated Use ORG_VERIFICATION_RIGHTS */
export const ORG_PARKING_RELATIONSHIPS = ORG_VERIFICATION_RIGHTS;

/** @deprecated Use OrgVerificationRights */
export type OrgParkingRelationship = OrgVerificationRights;

const LEGACY_RIGHTS_MAP: Record<string, OrgVerificationRights> = {
  owner: 'property_owner',
  renter: 'authorized_representative',
  sublessee: 'sublessee',
};

export function verificationRightsNeedsContractEnd(
  rights: OrgVerificationRights | null | undefined
): boolean {
  return rights === 'authorized_representative' || rights === 'sublessee';
}

/** @deprecated Use verificationRightsNeedsContractEnd */
export function parkingRelationshipNeedsContractEnd(
  relationship: OrgVerificationRights | null | undefined
): boolean {
  return verificationRightsNeedsContractEnd(relationship);
}

export function todayManilaYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

export function validateVerificationContractEndDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Contract end date is required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return 'Enter a valid date';
  const parsed = new Date(`${trimmed}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Enter a valid date';
  if (trimmed < todayManilaYmd()) return 'End date cannot be in the past';
  return null;
}

/** @deprecated Use validateVerificationContractEndDate */
export function validateParkingContractEndDate(value: string): string | null {
  return validateVerificationContractEndDate(value);
}

export const ORG_VERIFICATION_ASSET_TYPES = [
  'valid_id',
  'social_proof',
  'selfie_with_id',
  'platform_admin_proof',
  'legitimacy_check_proof',
  'business_permit_bir',
  /** @deprecated listing-scoped — see _shared/listingAuthorization.ts */
  'property_ownership_proof',
  /** @deprecated listing-scoped — see _shared/listingAuthorization.ts */
  'parking_social_proof',
  /** @deprecated listing-scoped — see _shared/listingAuthorization.ts */
  'ownership_proof',
  /** @deprecated listing-scoped — see _shared/listingAuthorization.ts */
  'azure_pmo_confirmation',
  /** @deprecated use azure_pmo_confirmation */
  'ops_proof',
  /** @deprecated maps to azurePmoConfirmationPath */
  'pmo_email_1',
] as const;
export type OrgVerificationAssetType = (typeof ORG_VERIFICATION_ASSET_TYPES)[number];

export type OrgVerificationAssets = {
  /** Tier 1 — government-issued ID. */
  validIdPath: string | null;
  /** Tier 1 — Facebook Page screenshot (platform is pinned to Facebook). Also required on Tier 2. */
  socialProofPath: string | null;
  /** Tier 2 — selfie holding the valid ID. */
  selfieWithIdPath: string | null;
  /** Tier 2, optional — admin/owner screenshot on another listing platform. */
  platformAdminProofPath: string | null;
  /** Tier 2, optional — any extra proof of business legitimacy. */
  legitimacyCheckProofPath: string | null;
  /** Tier 2, optional — business permit or BIR registration. Host scope only, never per listing. */
  businessPermitOrBirPath: string | null;
  /** @deprecated listing-scoped; kept as a backfill read fallback. */
  propertyOwnershipProofPath: string | null;
  /** @deprecated listing-scoped; kept as a backfill read fallback. */
  parkingSocialProofPath: string | null;
  /** @deprecated listing-scoped; kept as a backfill read fallback. */
  ownershipProofPath: string | null;
  /** @deprecated listing-scoped; kept as a backfill read fallback. */
  azurePmoConfirmationPath: string | null;
  /** @deprecated read fallback — use azurePmoConfirmationPath */
  pmoEmailPaths: string[];
};

/** Docs Super Admin can flag for re-upload on “Request changes”. */
export const ORG_VERIFICATION_CHANGE_DOC_IDS = ['validId', 'socialProof'] as const;
export type OrgVerificationChangeDocId = (typeof ORG_VERIFICATION_CHANGE_DOC_IDS)[number];

function asChangeDocId(value: unknown): OrgVerificationChangeDocId | null {
  if (
    typeof value === 'string' &&
    (ORG_VERIFICATION_CHANGE_DOC_IDS as readonly string[]).includes(value)
  ) {
    return value as OrgVerificationChangeDocId;
  }
  return null;
}

export function asChangesRequestedDocs(value: unknown): OrgVerificationChangeDocId[] {
  if (!Array.isArray(value)) return [];
  const out: OrgVerificationChangeDocId[] = [];
  for (const item of value) {
    const id = asChangeDocId(item);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export type OrgVerificationState = {
  baseStatus: OrgVerificationStatus;
  enhancedStatus: OrgVerificationStatus;
  /** @deprecated Tier 1 is pinned to Facebook; kept for legacy reads. */
  socialPlatform: OrgSocialProofPlatform | null;
  /** Tier 2 — which platform the admin/owner screenshot came from. */
  platformAdminPlatform: OrgSocialProofPlatform | null;
  /** @deprecated listing-scoped; kept as a backfill read fallback. */
  parkingSocialPlatform: OrgSocialProofPlatform | null;
  /** @deprecated listing-scoped; kept as a backfill read fallback. */
  propertyRelationship: OrgVerificationRights | null;
  propertyContractEndDate: string | null;
  parkingRelationship: OrgVerificationRights | null;
  parkingContractEndDate: string | null;
  baseSubmittedAt: string | null;
  enhancedSubmittedAt: string | null;
  baseRejectionReason: string | null;
  enhancedRejectionReason: string | null;
  baseRejectionKind: OrgVerificationRejectionKind | null;
  enhancedRejectionKind: OrgVerificationRejectionKind | null;
  /** When kind=changes, which Tier 1 docs the host must re-upload. Empty = all (legacy). */
  baseChangesRequestedDocs: OrgVerificationChangeDocId[];
  assets: OrgVerificationAssets;
  /** Unit handoff Phase B — property-leg contract expiry lifecycle. */
  propertyLifecycle: ContractLegLifecycle;
  /** Unit handoff Phase B — parking-leg contract expiry lifecycle. */
  parkingLifecycle: ContractLegLifecycle;
};

const EMPTY_ASSETS: OrgVerificationAssets = {
  validIdPath: null,
  socialProofPath: null,
  selfieWithIdPath: null,
  platformAdminProofPath: null,
  legitimacyCheckProofPath: null,
  businessPermitOrBirPath: null,
  propertyOwnershipProofPath: null,
  parkingSocialProofPath: null,
  ownershipProofPath: null,
  azurePmoConfirmationPath: null,
  pmoEmailPaths: [],
};

export function emptyOrgVerificationState(): OrgVerificationState {
  return {
    baseStatus: 'none',
    enhancedStatus: 'none',
    socialPlatform: null,
    platformAdminPlatform: null,
    parkingSocialPlatform: null,
    propertyRelationship: null,
    propertyContractEndDate: null,
    parkingRelationship: null,
    parkingContractEndDate: null,
    baseSubmittedAt: null,
    enhancedSubmittedAt: null,
    baseRejectionReason: null,
    enhancedRejectionReason: null,
    baseRejectionKind: null,
    enhancedRejectionKind: null,
    baseChangesRequestedDocs: [],
    assets: { ...EMPTY_ASSETS, pmoEmailPaths: [] },
    propertyLifecycle: emptyContractLegLifecycle(),
    parkingLifecycle: emptyContractLegLifecycle(),
  };
}

function asRejectionKind(value: unknown): OrgVerificationRejectionKind | null {
  if (value === 'changes' || value === 'rejected') return value;
  // Legacy value from early approvals UI
  if (value === 'compliance') return 'changes';
  return null;
}

function asStatus(value: unknown): OrgVerificationStatus {
  if (
    typeof value === 'string' &&
    ORG_VERIFICATION_STATUSES.includes(value as OrgVerificationStatus)
  ) {
    return value as OrgVerificationStatus;
  }
  return 'none';
}

function asPlatform(value: unknown): OrgSocialProofPlatform | null {
  if (
    typeof value === 'string' &&
    ORG_SOCIAL_PROOF_PLATFORMS.includes(value as OrgSocialProofPlatform)
  ) {
    return value as OrgSocialProofPlatform;
  }
  return null;
}

function asPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asVerificationRights(value: unknown): OrgVerificationRights | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (ORG_VERIFICATION_RIGHTS.includes(trimmed as OrgVerificationRights)) {
    return trimmed as OrgVerificationRights;
  }
  return LEGACY_RIGHTS_MAP[trimmed] ?? null;
}

export function readOrgVerificationFromSettings(
  settings: Record<string, unknown> | null | undefined
): OrgVerificationState {
  const raw = settings?.verification;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyOrgVerificationState();
  }
  const v = raw as Record<string, unknown>;
  const assetsRaw =
    v.assets && typeof v.assets === 'object' && !Array.isArray(v.assets)
      ? (v.assets as Record<string, unknown>)
      : {};

  const pmoRaw = assetsRaw.pmoEmailPaths;
  const pmoEmailPaths = Array.isArray(pmoRaw)
    ? pmoRaw
        .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .map((p) => p.trim())
    : [];
  const azurePmoConfirmationPath =
    asPath(assetsRaw.azurePmoConfirmationPath) ??
    asPath(assetsRaw.opsProofPath) ??
    pmoEmailPaths[0] ??
    null;

  return {
    baseStatus: asStatus(v.baseStatus),
    enhancedStatus: asStatus(v.enhancedStatus),
    socialPlatform: asPlatform(v.socialPlatform),
    platformAdminPlatform: asPlatform(v.platformAdminPlatform),
    parkingSocialPlatform: asPlatform(v.parkingSocialPlatform),
    propertyRelationship: asVerificationRights(v.propertyRelationship),
    propertyContractEndDate: asPath(v.propertyContractEndDate),
    parkingRelationship: asVerificationRights(v.parkingRelationship),
    parkingContractEndDate: asPath(v.parkingContractEndDate),
    baseSubmittedAt: asPath(v.baseSubmittedAt),
    enhancedSubmittedAt: asPath(v.enhancedSubmittedAt),
    baseRejectionReason: asPath(v.baseRejectionReason),
    enhancedRejectionReason: asPath(v.enhancedRejectionReason),
    baseRejectionKind:
      asStatus(v.baseStatus) === 'rejected'
        ? (asRejectionKind(v.baseRejectionKind) ?? 'rejected')
        : null,
    enhancedRejectionKind:
      asStatus(v.enhancedStatus) === 'rejected'
        ? (asRejectionKind(v.enhancedRejectionKind) ?? 'rejected')
        : null,
    baseChangesRequestedDocs:
      asStatus(v.baseStatus) === 'rejected' && asRejectionKind(v.baseRejectionKind) === 'changes'
        ? asChangesRequestedDocs(v.baseChangesRequestedDocs)
        : [],
    assets: {
      validIdPath: asPath(assetsRaw.validIdPath),
      socialProofPath: asPath(assetsRaw.socialProofPath),
      selfieWithIdPath: asPath(assetsRaw.selfieWithIdPath),
      platformAdminProofPath: asPath(assetsRaw.platformAdminProofPath),
      legitimacyCheckProofPath: asPath(assetsRaw.legitimacyCheckProofPath),
      businessPermitOrBirPath: asPath(assetsRaw.businessPermitOrBirPath),
      propertyOwnershipProofPath: asPath(assetsRaw.propertyOwnershipProofPath),
      parkingSocialProofPath: asPath(assetsRaw.parkingSocialProofPath),
      ownershipProofPath: asPath(assetsRaw.ownershipProofPath),
      azurePmoConfirmationPath,
      pmoEmailPaths,
    },
    propertyLifecycle: parseContractLegLifecycle(v.propertyLifecycle),
    parkingLifecycle: parseContractLegLifecycle(v.parkingLifecycle),
  };
}

export function orgVerificationToSettingsValue(
  state: OrgVerificationState
): Record<string, unknown> {
  return {
    baseStatus: state.baseStatus,
    enhancedStatus: state.enhancedStatus,
    socialPlatform: state.socialPlatform,
    platformAdminPlatform: state.platformAdminPlatform,
    parkingSocialPlatform: state.parkingSocialPlatform,
    propertyRelationship: state.propertyRelationship,
    propertyContractEndDate: state.propertyContractEndDate,
    parkingRelationship: state.parkingRelationship,
    parkingContractEndDate: state.parkingContractEndDate,
    baseSubmittedAt: state.baseSubmittedAt,
    enhancedSubmittedAt: state.enhancedSubmittedAt,
    baseRejectionReason: state.baseRejectionReason,
    enhancedRejectionReason: state.enhancedRejectionReason,
    baseRejectionKind: state.baseRejectionKind,
    enhancedRejectionKind: state.enhancedRejectionKind,
    baseChangesRequestedDocs: state.baseChangesRequestedDocs,
    assets: {
      validIdPath: state.assets.validIdPath,
      socialProofPath: state.assets.socialProofPath,
      selfieWithIdPath: state.assets.selfieWithIdPath,
      platformAdminProofPath: state.assets.platformAdminProofPath,
      legitimacyCheckProofPath: state.assets.legitimacyCheckProofPath,
      businessPermitOrBirPath: state.assets.businessPermitOrBirPath,
      propertyOwnershipProofPath: state.assets.propertyOwnershipProofPath,
      parkingSocialProofPath: state.assets.parkingSocialProofPath,
      ownershipProofPath: state.assets.ownershipProofPath,
      azurePmoConfirmationPath: state.assets.azurePmoConfirmationPath,
      pmoEmailPaths: state.assets.pmoEmailPaths,
    },
    propertyLifecycle: contractLegLifecycleToSettingsValue(state.propertyLifecycle),
    parkingLifecycle: contractLegLifecycleToSettingsValue(state.parkingLifecycle),
  };
}

/** Host-wide Recommended badge (org Tier 2). Per-listing badges live in listingAuthorization. */
export function isOrgVerifiedBadge(state: OrgVerificationState): boolean {
  return state.enhancedStatus === 'approved';
}

/**
 * Tier 1 (host identity) — Valid ID and Facebook Page screenshot.
 * Listing authority is not part of host base.
 */
export function canSubmitBaseVerification(state: OrgVerificationState): boolean {
  return Boolean(state.assets.validIdPath && state.assets.socialProofPath);
}

/**
 * Tier 2 (host Recommended) — selfie with ID. Other-platform admin screenshot
 * and business permit / BIR are optional and must never block submit.
 */
export function canSubmitEnhancedVerification(state: OrgVerificationState): boolean {
  return Boolean(state.assets.selfieWithIdPath);
}

export function assetTypeToPathKey(
  assetType: OrgVerificationAssetType
): keyof OrgVerificationAssets {
  switch (assetType) {
    case 'valid_id':
      return 'validIdPath';
    case 'social_proof':
      return 'socialProofPath';
    case 'selfie_with_id':
      return 'selfieWithIdPath';
    case 'platform_admin_proof':
      return 'platformAdminProofPath';
    case 'legitimacy_check_proof':
      return 'legitimacyCheckProofPath';
    case 'business_permit_bir':
      return 'businessPermitOrBirPath';
    case 'property_ownership_proof':
      return 'propertyOwnershipProofPath';
    case 'parking_social_proof':
      return 'parkingSocialProofPath';
    case 'ownership_proof':
      return 'ownershipProofPath';
    case 'azure_pmo_confirmation':
    case 'ops_proof':
    case 'pmo_email_1':
      return 'azurePmoConfirmationPath';
  }
}

export function applyAssetPath(
  state: OrgVerificationState,
  assetType: OrgVerificationAssetType,
  path: string
): OrgVerificationState {
  const key = assetTypeToPathKey(assetType);
  return {
    ...state,
    assets: {
      ...state.assets,
      pmoEmailPaths: [...state.assets.pmoEmailPaths],
      [key]: path,
    },
  };
}
