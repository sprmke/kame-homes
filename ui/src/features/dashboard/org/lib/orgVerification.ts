export const ORG_VERIFICATION_STATUSES = ['none', 'pending', 'approved', 'rejected'] as const;
export type OrgVerificationStatus = (typeof ORG_VERIFICATION_STATUSES)[number];

export const ORG_SOCIAL_PROOF_PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'airbnb', label: 'Airbnb' },
] as const;

export type OrgSocialProofPlatform = (typeof ORG_SOCIAL_PROOF_PLATFORMS)[number]['value'];

/** Property / parking rights — onboarding verification + org contact role. */
export const ORG_VERIFICATION_RIGHTS = [
  { value: 'property_owner', label: 'Property Owner' },
  { value: 'authorized_representative', label: 'Authorized Representative' },
  { value: 'sublessee', label: 'Sublessee' },
  { value: 'property_admin', label: 'Property Admin' },
] as const;

export type OrgVerificationRights = (typeof ORG_VERIFICATION_RIGHTS)[number]['value'];

export type VerificationSectionKind = 'property' | 'parking';

export function verificationRightsFieldLabel(kind: VerificationSectionKind): string {
  return kind === 'parking' ? 'Parking Rights' : 'Property Rights';
}

export function verificationRightsFieldHelp(kind: VerificationSectionKind): string {
  return kind === 'parking'
    ? 'Select the option that best describes your legal relationship to this parking slot.'
    : 'Select the option that best describes your legal relationship to this property.';
}

export function verificationRightsSelectPlaceholder(kind: VerificationSectionKind): string {
  return kind === 'parking' ? 'Select parking rights' : 'Select property rights';
}

/** @deprecated Use ORG_VERIFICATION_RIGHTS */
export const ORG_PARKING_RELATIONSHIPS = ORG_VERIFICATION_RIGHTS;

/** @deprecated Use OrgVerificationRights */
export type OrgParkingRelationship = OrgVerificationRights;

export function verificationRightsNeedsContractEnd(
  rights: OrgVerificationRights | '' | null | undefined
): boolean {
  return rights === 'authorized_representative' || rights === 'sublessee';
}

/** @deprecated Use verificationRightsNeedsContractEnd */
export function parkingRelationshipNeedsContractEnd(
  relationship: OrgVerificationRights | '' | null | undefined
): boolean {
  return verificationRightsNeedsContractEnd(relationship);
}

/** Today as YYYY-MM-DD in Asia/Manila (for lease end validation). */
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

export type OrgVerificationSummary = {
  baseStatus: OrgVerificationStatus;
  enhancedStatus: OrgVerificationStatus;
  socialPlatform: OrgSocialProofPlatform | null;
  verifiedBadge: boolean;
};

export function readOrgVerificationSummary(
  settings: Record<string, unknown> | null | undefined
): OrgVerificationSummary {
  const raw = settings?.verification;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      baseStatus: 'none',
      enhancedStatus: 'none',
      socialPlatform: null,
      verifiedBadge: false,
    };
  }
  const v = raw as Record<string, unknown>;
  const baseStatus = ORG_VERIFICATION_STATUSES.includes(v.baseStatus as OrgVerificationStatus)
    ? (v.baseStatus as OrgVerificationStatus)
    : 'none';
  const enhancedStatus = ORG_VERIFICATION_STATUSES.includes(
    v.enhancedStatus as OrgVerificationStatus
  )
    ? (v.enhancedStatus as OrgVerificationStatus)
    : 'none';
  const socialPlatform =
    typeof v.socialPlatform === 'string' &&
    ORG_SOCIAL_PROOF_PLATFORMS.some((p) => p.value === v.socialPlatform)
      ? (v.socialPlatform as OrgSocialProofPlatform)
      : null;

  return {
    baseStatus,
    enhancedStatus,
    socialPlatform,
    verifiedBadge: enhancedStatus === 'approved',
  };
}

/** Sidebar entry stays visible once verification has started (status + future contract renewals). */
export function shouldShowGetVerifiedCta(summary: OrgVerificationSummary): boolean {
  return summary.baseStatus !== 'none' || summary.enhancedStatus !== 'none';
}

export const VERIFICATION_ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp,application/pdf';

export function validateVerificationFile(file: File): string | null {
  const mime = file.type.toLowerCase();
  const allowed = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]);
  if (!allowed.has(mime)) return 'Use JPEG, PNG, WebP, or PDF';
  if (file.size > 5 * 1024 * 1024) return 'File must be 5 MB or smaller';
  return null;
}

export function propertyAccessScreenshotHelp(
  platform: OrgSocialProofPlatform | '',
  kind: 'property' | 'parking' = 'property'
): string {
  const listingWord = kind === 'parking' ? 'parking listing' : 'listing';
  if (platform === 'facebook') {
    return kind === 'parking'
      ? 'Facebook Page screenshot showing the Page name and that you’re logged in as admin or editor for your parking listing.'
      : 'Facebook Page screenshot showing the Page name and that you’re logged in as admin or editor.';
  }
  if (platform === 'instagram') {
    return `Screenshot of your Instagram page while logged in as owner or admin for your ${listingWord}.`;
  }
  if (platform === 'airbnb') {
    return kind === 'parking'
      ? 'Screenshot of your Airbnb parking or hosting dashboard while logged in as the host.'
      : 'Screenshot of your Airbnb listing or hosting dashboard while logged in as the host.';
  }
  return kind === 'parking'
    ? 'Pick a platform first, then upload a screenshot showing you manage that parking listing as owner or admin.'
    : 'Pick a platform first, then upload a screenshot showing you are logged in as owner or admin of that Page or listing.';
}

export function verificationRightsProofHelp(
  rights: OrgVerificationRights | '',
  kind: 'property' | 'parking' = 'property'
): string {
  const slotWord = kind === 'parking' ? 'this slot' : 'this property';
  if (rights === 'property_owner') {
    return kind === 'parking'
      ? 'Title, deed, PMO confirmation, or Azure parking assignment showing you own this slot.'
      : 'Title, deed, or PMO confirmation showing you own this unit.';
  }
  if (rights === 'authorized_representative') {
    return `Notarized authorization or management agreement showing your authority over ${slotWord}, including when it ends.`;
  }
  if (rights === 'sublessee') {
    return `Sublease approval or contract for ${slotWord}, including the sublease term or end date.`;
  }
  if (rights === 'property_admin') {
    return `PMO appointment letter or property admin authorization for ${slotWord}.`;
  }
  return kind === 'parking'
    ? 'Select your parking rights first, then upload a document that supports it.'
    : 'Select your property rights first, then upload a document that supports it.';
}

/** @deprecated Use verificationRightsProofHelp */
export function parkingOwnershipProofHelp(rights: OrgVerificationRights | ''): string {
  return verificationRightsProofHelp(rights, 'parking');
}
