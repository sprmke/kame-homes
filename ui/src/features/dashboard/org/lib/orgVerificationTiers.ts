import {
  emptyContractLegLifecycle,
  parseContractLegLifecycle,
  type ContractLegLifecycle,
} from '@/features/dashboard/org/lib/contractLifecycle';
import {
  ORG_SOCIAL_PROOF_PLATFORMS,
  ORG_VERIFICATION_RIGHTS,
  ORG_VERIFICATION_STATUSES,
  type OrgSocialProofPlatform,
  type OrgVerificationRights,
  type OrgVerificationStatus,
} from '@/features/dashboard/org/lib/orgVerification';
import {
  VERIFICATION_TIER2_DOC_LABELS,
  VERIFICATION_TIER2_SUBTITLE,
} from '@/features/dashboard/org/lib/verificationCopy';

export type { ContractLegLifecycle } from '@/features/dashboard/org/lib/contractLifecycle';

export type OrgVerificationRejectionKind = 'changes' | 'rejected';

export type OrgVerificationAssets = {
  validIdPath: string | null;
  socialProofPath: string | null;
  selfieWithIdPath: string | null;
  platformAdminProofPath: string | null;
  legitimacyCheckProofPath: string | null;
  businessPermitOrBirPath: string | null;
  /** @deprecated listing-scoped; kept as a backfill read fallback. */
  propertyOwnershipProofPath: string | null;
  /** @deprecated listing-scoped; kept as a backfill read fallback. */
  parkingSocialProofPath: string | null;
  /** @deprecated listing-scoped; kept as a backfill read fallback. */
  ownershipProofPath: string | null;
  /** @deprecated listing-scoped; kept as a backfill read fallback. */
  azurePmoConfirmationPath: string | null;
  pmoEmailPaths: string[];
};

export type OrgVerificationDetail = {
  baseStatus: OrgVerificationStatus;
  enhancedStatus: OrgVerificationStatus;
  socialPlatform: OrgSocialProofPlatform | null;
  platformAdminPlatform: OrgSocialProofPlatform | null;
  /** @deprecated listing-scoped */
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
  /** When kind=changes, which docs must be re-uploaded. Empty = show all (legacy). */
  baseChangesRequestedDocs: OrgVerificationChangeDocId[];
  assets: OrgVerificationAssets;
  propertyLifecycle: ContractLegLifecycle;
  parkingLifecycle: ContractLegLifecycle;
  verifiedBadge: boolean;
};

export type OrgVerificationChangeDocId = 'validId' | 'socialProof';

const CHANGE_DOC_IDS: readonly OrgVerificationChangeDocId[] = ['validId', 'socialProof'];

function asChangesRequestedDocs(value: unknown): OrgVerificationChangeDocId[] {
  if (!Array.isArray(value)) return [];
  const out: OrgVerificationChangeDocId[] = [];
  for (const item of value) {
    if (
      typeof item === 'string' &&
      (CHANGE_DOC_IDS as readonly string[]).includes(item) &&
      !out.includes(item as OrgVerificationChangeDocId)
    ) {
      out.push(item as OrgVerificationChangeDocId);
    }
  }
  return out;
}

export type VerificationChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
  optional?: boolean;
};

/** Host Tier 1 checklist rows backed by an uploaded file (submitted-docs list + count). */
const HOST_TIER_DOCUMENT_ITEM_IDS = new Set(['valid-id', 'facebook-page']);

/** Recommended Tier 2 checklist rows backed by an uploaded file. */
const RECOMMENDED_TIER_DOCUMENT_ITEM_IDS = new Set([
  'selfie',
  'platform-admin',
  'legitimacy-check',
  'business-permit',
]);

export function hostTierDocumentChecklistItems(
  items: VerificationChecklistItem[]
): VerificationChecklistItem[] {
  return items.filter((item) => HOST_TIER_DOCUMENT_ITEM_IDS.has(item.id));
}

export function recommendedTierDocumentChecklistItems(
  items: VerificationChecklistItem[]
): VerificationChecklistItem[] {
  return items.filter((item) => RECOMMENDED_TIER_DOCUMENT_ITEM_IDS.has(item.id));
}

export type VerificationTierDefinition = {
  id: 'host' | 'verified' | 'listing_base' | 'listing_recommended';
  level: number;
  title: string;
  benefit: string;
  status: OrgVerificationStatus;
  /** Overrides the default "Required to host" / "Optional badge" sublabel. */
  requirementLabel?: string;
};

const LEGACY_RIGHTS_MAP: Record<string, OrgVerificationRights> = {
  owner: 'property_owner',
  renter: 'authorized_representative',
  sublessee: 'sublessee',
};

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
  if (typeof value === 'string' && ORG_SOCIAL_PROOF_PLATFORMS.some((p) => p.value === value)) {
    return value as OrgSocialProofPlatform;
  }
  return null;
}

function asPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function asRejectionKind(value: unknown): OrgVerificationRejectionKind | null {
  if (value === 'changes' || value === 'rejected') return value;
  if (value === 'compliance') return 'changes';
  return null;
}

function asRights(value: unknown): OrgVerificationRights | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (ORG_VERIFICATION_RIGHTS.some((r) => r.value === trimmed)) {
    return trimmed as OrgVerificationRights;
  }
  return LEGACY_RIGHTS_MAP[trimmed] ?? null;
}

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

export function readOrgVerificationDetail(
  settings: Record<string, unknown> | null | undefined
): OrgVerificationDetail {
  const raw = settings?.verification;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      baseStatus: 'none',
      enhancedStatus: 'none',
      socialPlatform: null,
      platformAdminPlatform: null,
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
      verifiedBadge: false,
    };
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

  const baseStatus = asStatus(v.baseStatus);
  const enhancedStatus = asStatus(v.enhancedStatus);

  return {
    baseStatus,
    enhancedStatus,
    socialPlatform: asPlatform(v.socialPlatform),
    platformAdminPlatform: asPlatform(v.platformAdminPlatform),
    propertyRelationship: asRights(v.propertyRelationship),
    propertyContractEndDate: asPath(v.propertyContractEndDate),
    parkingRelationship: asRights(v.parkingRelationship),
    parkingContractEndDate: asPath(v.parkingContractEndDate),
    baseSubmittedAt: asPath(v.baseSubmittedAt),
    enhancedSubmittedAt: asPath(v.enhancedSubmittedAt),
    baseRejectionReason: asPath(v.baseRejectionReason),
    enhancedRejectionReason: asPath(v.enhancedRejectionReason),
    baseRejectionKind:
      baseStatus === 'rejected' ? (asRejectionKind(v.baseRejectionKind) ?? 'rejected') : null,
    enhancedRejectionKind:
      enhancedStatus === 'rejected'
        ? (asRejectionKind(v.enhancedRejectionKind) ?? 'rejected')
        : null,
    baseChangesRequestedDocs:
      baseStatus === 'rejected' && asRejectionKind(v.baseRejectionKind) === 'changes'
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
    verifiedBadge: enhancedStatus === 'approved',
  };
}

export function resolveHostModes(org: { hostModes?: string[] } | null): string[] {
  const modes = org?.hostModes?.filter((m) => m === 'property' || m === 'parking') ?? [];
  return modes.length > 0 ? modes : ['property'];
}

export function buildHostTierChecklist(detail: OrgVerificationDetail): VerificationChecklistItem[] {
  return [
    {
      id: 'valid-id',
      label: 'Valid ID',
      complete: Boolean(detail.assets.validIdPath),
    },
    {
      id: 'facebook-page',
      label: 'Facebook Page screenshot',
      complete: Boolean(detail.assets.socialProofPath),
    },
  ];
}

export function buildVerifiedTierChecklist(
  detail: OrgVerificationDetail
): VerificationChecklistItem[] {
  const items: VerificationChecklistItem[] = [
    {
      id: 'selfie',
      label: VERIFICATION_TIER2_DOC_LABELS.selfie,
      complete: Boolean(detail.assets.selfieWithIdPath),
    },
    {
      id: 'platform-admin',
      label: VERIFICATION_TIER2_DOC_LABELS.platformAdmin,
      complete: Boolean(detail.assets.platformAdminProofPath),
      optional: true,
    },
  ];
  if (detail.assets.legitimacyCheckProofPath) {
    items.push({
      id: 'legitimacy-check',
      label: VERIFICATION_TIER2_DOC_LABELS.legitimacyCheck,
      complete: true,
      optional: true,
    });
  }
  items.push({
    id: 'business-permit',
    label: VERIFICATION_TIER2_DOC_LABELS.businessPermit,
    complete: Boolean(detail.assets.businessPermitOrBirPath),
    optional: true,
  });
  return items;
}

export function buildVerificationTiers(
  detail: OrgVerificationDetail
): VerificationTierDefinition[] {
  return [
    {
      id: 'host',
      level: 1,
      title: 'Verified',
      benefit: 'Required to host',
      status: detail.baseStatus,
    },
    {
      id: 'verified',
      level: 2,
      title: 'Recommended',
      benefit: VERIFICATION_TIER2_SUBTITLE,
      status: detail.enhancedStatus,
    },
  ];
}

export function countApprovedTiers(detail: OrgVerificationDetail): number {
  let count = 0;
  if (detail.baseStatus === 'approved') count += 1;
  if (detail.enhancedStatus === 'approved') count += 1;
  return count;
}

export function verificationSidebarLabel(detail: OrgVerificationDetail): string {
  if (detail.baseStatus === 'approved' && detail.enhancedStatus === 'approved') {
    return 'Verification';
  }
  if (detail.enhancedStatus === 'approved') return 'Recommended';
  if (detail.enhancedStatus === 'pending') return 'Badge in review';
  if (detail.enhancedStatus === 'rejected') return 'Resubmit badge';
  if (detail.baseStatus === 'pending') return 'Verification in review';
  if (detail.baseStatus === 'rejected') {
    return detail.baseRejectionKind === 'changes' ? 'Changes requested' : 'Verification declined';
  }
  if (detail.enhancedStatus === 'none') return 'Get Recommended badge';
  return 'Get Verified';
}

export function verificationStatusLabel(
  status: OrgVerificationStatus,
  kind?: OrgVerificationRejectionKind | null
): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'pending':
      return 'In review';
    case 'rejected':
      return kind === 'changes' ? 'Changes requested' : 'Declined';
    default:
      return 'Not started';
  }
}

/** Hard reject from Super Admin — blocks dashboard access; host must start a new application. */
export function isHostVerificationHardRejectedFromDetail(detail: OrgVerificationDetail): boolean {
  return detail.baseStatus === 'rejected' && detail.baseRejectionKind === 'rejected';
}

export function isHostVerificationHardRejected(
  settings: Record<string, unknown> | null | undefined
): boolean {
  return isHostVerificationHardRejectedFromDetail(readOrgVerificationDetail(settings));
}

/** Soft reject — host keeps dashboard access but must resubmit via forced Get Verified modal. */
export function isHostVerificationChangesRequestedFromDetail(
  detail: OrgVerificationDetail
): boolean {
  return detail.baseStatus === 'rejected' && detail.baseRejectionKind === 'changes';
}

export function isHostVerificationChangesRequested(
  settings: Record<string, unknown> | null | undefined
): boolean {
  return isHostVerificationChangesRequestedFromDetail(readOrgVerificationDetail(settings));
}

export function canSubmitVerifiedTier(
  detail: OrgVerificationDetail,
  slots: {
    selfie: boolean;
  }
): boolean {
  if (detail.enhancedStatus === 'approved' || detail.enhancedStatus === 'pending') {
    return false;
  }
  return slots.selfie;
}

/** Client-side gate for Tier 1 — Valid ID + Facebook Page (mirrors server `canSubmitBaseVerification`). */
export function canSubmitHostTier(
  detail: OrgVerificationDetail,
  _hostModes: string[],
  slots: {
    validId: boolean;
    socialProof: boolean;
  },
  options?: { changesRequestedDocs?: OrgVerificationChangeDocId[] | null }
): boolean {
  if (detail.baseStatus === 'approved' || detail.baseStatus === 'pending') {
    return false;
  }
  if (isHostVerificationHardRejectedFromDetail(detail)) {
    return false;
  }

  const docs = options?.changesRequestedDocs?.filter(Boolean) ?? [];

  if (docs.length > 0) {
    if (docs.includes('validId') && !slots.validId) return false;
    if (docs.includes('socialProof') && !slots.socialProof) return false;
  }

  return Boolean(slots.validId && slots.socialProof);
}
