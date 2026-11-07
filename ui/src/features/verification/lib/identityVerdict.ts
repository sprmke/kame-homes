/**
 * Client mirror of the identity verdict model.
 *
 * The server owns `resolveVerdict`. This file only mirrors the enums, labels and badge
 * styling so the UI cannot invent a status the server never writes. `identityVerdict.test.ts`
 * reads the Deno source and fails when the two lists drift.
 *
 * Copy rules that are not negotiable:
 *   * `verified` may say "Verified"; `partially_verified` may not.
 *   * Client-side liveness is never presented as a biometric or certified check.
 */

export const IDENTITY_VERDICTS = [
  'verified',
  'partially_verified',
  'unverified',
  'rejected',
  'expired',
] as const;
export type IdentityVerdict = (typeof IDENTITY_VERDICTS)[number];

export const ACTIVE_IDENTITY_VERDICTS = ['verified', 'partially_verified'] as const;

export const IDENTITY_FLAG_CODES = [
  'signature_invalid',
  'document_expired',
  'name_mismatch',
  'dob_mismatch',
  'age_under_18',
  'liveness_failed',
  'liveness_unavailable',
  'face_mismatch',
  'duplicate_document',
  'low_quality',
  'screen_capture_suspected',
  'ai_unavailable',
  'extraction_incomplete',
  'no_document_image',
  'reviewer_rejected',
] as const;
export type IdentityFlagCode = (typeof IDENTITY_FLAG_CODES)[number];

export type IdentityFlagSeverity = 'info' | 'warning' | 'blocking';

export type IdentityFlag = {
  code: IdentityFlagCode;
  severity: IdentityFlagSeverity;
  detail?: string;
};

export function isActiveIdentityVerdict(verdict: IdentityVerdict | null | undefined): boolean {
  return !!verdict && (ACTIVE_IDENTITY_VERDICTS as readonly string[]).includes(verdict);
}

export function identityVerdictLabel(verdict: IdentityVerdict): string {
  switch (verdict) {
    case 'verified':
      return 'Verified';
    case 'partially_verified':
      return 'Partially verified';
    case 'unverified':
      return 'Needs review';
    case 'rejected':
      return 'Not accepted';
    case 'expired':
      return 'Expired';
    default:
      return 'Unverified';
  }
}

/** One short line for the badge tooltip. Never overclaims a client-side check. */
export function identityVerdictDetail(verdict: IdentityVerdict): string {
  switch (verdict) {
    case 'verified':
      return 'The document was verified and matched to the person.';
    case 'partially_verified':
      return 'The document was readable and the person was checked on this device.';
    case 'unverified':
      return 'Captured but not confirmed. A host reviews it.';
    case 'rejected':
      return 'This document was not accepted.';
    case 'expired':
      return 'This verification has expired. Verify again to renew.';
    default:
      return 'Identity not verified.';
  }
}

export const IDENTITY_FLAG_LABELS: Record<IdentityFlagCode, string> = {
  signature_invalid: 'QR signature did not match',
  document_expired: 'Document expired',
  name_mismatch: 'Name does not match the booking',
  dob_mismatch: 'Date of birth does not match',
  age_under_18: 'Guest is under 18',
  liveness_failed: 'Liveness check failed',
  liveness_unavailable: 'Liveness check could not run',
  face_mismatch: 'Face does not match the document',
  duplicate_document: 'Same document used by another guest',
  low_quality: 'Photo quality too low',
  screen_capture_suspected: 'Looks like a photo of a screen',
  ai_unavailable: 'Automatic checks were unavailable',
  extraction_incomplete: 'Some details could not be read',
  no_document_image: 'No document photo captured',
  reviewer_rejected: 'Rejected by a reviewer',
};

export type VerdictBadgeTone = 'success' | 'info' | 'warning' | 'danger' | 'muted';

export function identityVerdictTone(verdict: IdentityVerdict): VerdictBadgeTone {
  switch (verdict) {
    case 'verified':
      return 'success';
    case 'partially_verified':
      return 'info';
    case 'unverified':
      return 'warning';
    case 'rejected':
      return 'danger';
    default:
      return 'muted';
  }
}

/** Display order for flags in review UIs: blocking first, then warnings, then info. */
export function sortIdentityFlags(flags: readonly IdentityFlag[]): IdentityFlag[] {
  const rank: Record<IdentityFlagSeverity, number> = { blocking: 0, warning: 1, info: 2 };
  return [...flags].sort((a, b) => rank[a.severity] - rank[b.severity]);
}
