/**
 * Live identity verification — canonical verdict model, flag catalog, hashing, and expiry.
 *
 * This file is the server source of truth. The client mirror lives at
 * `ui/src/features/verification/lib/identityVerdict.ts` and a parity test keeps the two
 * in lockstep, the same arrangement as `statusMachine.ts` / `workflow.ts`.
 *
 * Design rules that must not drift:
 *   * `resolveVerdict` is deterministic. No AI call decides a verdict on its own; AI output
 *     arrives as a signal (extraction confidence, face match) and the rules below turn the
 *     signal set into a verdict.
 *   * `verified` needs a cryptographic or provider-grade authenticity proof **and** a
 *     liveness pass. A client-side liveness pass alone is never enough to call a document
 *     genuine, and a genuine document is never enough to call the holder the right person.
 *   * A missing liveness result is `null`, never `false`. `null` means "we could not run
 *     the check", which caps the verdict at `unverified` without claiming the guest failed.
 */

export const IDENTITY_VERDICTS = [
  'verified',
  'partially_verified',
  'unverified',
  'rejected',
  'expired',
] as const;
export type IdentityVerdict = (typeof IDENTITY_VERDICTS)[number];

/** Verdicts that count as a usable identity for reuse and badges. */
export const ACTIVE_IDENTITY_VERDICTS = ['verified', 'partially_verified'] as const;
export type ActiveIdentityVerdict = (typeof ACTIVE_IDENTITY_VERDICTS)[number];

export const IDENTITY_METHODS = ['philsys_qr', 'mrz', 'document_ai', 'provider'] as const;
export type IdentityMethod = (typeof IDENTITY_METHODS)[number];

export const IDENTITY_SUBJECT_KINDS = ['guest', 'org_owner'] as const;
export type IdentitySubjectKind = (typeof IDENTITY_SUBJECT_KINDS)[number];

export const IDENTITY_LIVENESS_GRADES = ['clientside', 'certified'] as const;
export type IdentityLivenessGrade = (typeof IDENTITY_LIVENESS_GRADES)[number];

export const IDENTITY_FACE_MATCH_VERDICTS = [
  'match',
  'likely_match',
  'unclear',
  'mismatch',
  'skipped',
] as const;
export type IdentityFaceMatchVerdict = (typeof IDENTITY_FACE_MATCH_VERDICTS)[number];

export type IdentityFlagSeverity = 'info' | 'warning' | 'blocking';

export type IdentityFlag = {
  code: IdentityFlagCode;
  severity: IdentityFlagSeverity;
  detail?: string;
};

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

const FLAG_SEVERITY: Record<IdentityFlagCode, IdentityFlagSeverity> = {
  // Hard failures — a reviewer sees these first and they can never reach an active verdict.
  signature_invalid: 'blocking',
  document_expired: 'blocking',
  age_under_18: 'blocking',
  duplicate_document: 'blocking',
  face_mismatch: 'blocking',
  reviewer_rejected: 'blocking',
  // Soft signals — a human decides.
  name_mismatch: 'warning',
  dob_mismatch: 'warning',
  liveness_failed: 'warning',
  liveness_unavailable: 'info',
  low_quality: 'warning',
  screen_capture_suspected: 'warning',
  extraction_incomplete: 'info',
  no_document_image: 'info',
  ai_unavailable: 'info',
};

export function makeFlag(code: IdentityFlagCode, detail?: string): IdentityFlag {
  return detail ? { code, severity: FLAG_SEVERITY[code], detail } : { code, severity: FLAG_SEVERITY[code] };
}

/** Everything the verdict engine is allowed to look at. */
export type IdentitySignals = {
  method: IdentityMethod;
  /** True only when a real cryptographic or provider-grade authenticity proof verified. */
  signatureValid: boolean;
  /** True only when a signature was checked and failed (a configured key rejected it). */
  signatureInvalid?: boolean;
  /** True = passed, false = failed, null = not run / unavailable. */
  livenessPassed: boolean | null;
  livenessGrade: IdentityLivenessGrade | null;
  faceMatchVerdict: IdentityFaceMatchVerdict;
  /** The extractor produced enough fields to be useful (name plus at least one other). */
  fieldsRead: boolean;
  documentExpired?: boolean;
  ageUnder18?: boolean;
  nameMismatch?: boolean;
  dobMismatch?: boolean;
  duplicateDocument?: boolean;
  lowQuality?: boolean;
  screenCaptureSuspected?: boolean;
  aiUnavailable?: boolean;
  hasDocumentImage?: boolean;
  reviewerRejected?: boolean;
};

export type IdentityVerdictResult = {
  verdict: IdentityVerdict;
  flags: IdentityFlag[];
  /** Short, reviewer-facing reason. Never contains PII or a document number. */
  reason: string;
};

const FACE_MATCH_ACCEPTABLE = new Set<IdentityFaceMatchVerdict>(['match', 'likely_match']);

/**
 * Deterministic verdict from signals. Order matters: hard failures short-circuit, then the
 * authenticity paths, then the "captured but unproven" default.
 */
export function resolveVerdict(signals: IdentitySignals): IdentityVerdictResult {
  const flags: IdentityFlag[] = [];

  if (signals.reviewerRejected) flags.push(makeFlag('reviewer_rejected'));
  if (signals.documentExpired) flags.push(makeFlag('document_expired'));
  if (signals.ageUnder18) flags.push(makeFlag('age_under_18'));
  if (signals.duplicateDocument) flags.push(makeFlag('duplicate_document'));
  if (signals.nameMismatch) flags.push(makeFlag('name_mismatch'));
  if (signals.dobMismatch) flags.push(makeFlag('dob_mismatch'));
  if (signals.livenessPassed === false) flags.push(makeFlag('liveness_failed'));
  if (signals.livenessPassed === null) flags.push(makeFlag('liveness_unavailable'));
  if (signals.faceMatchVerdict === 'mismatch') flags.push(makeFlag('face_mismatch'));
  if (signals.lowQuality) flags.push(makeFlag('low_quality'));
  if (signals.screenCaptureSuspected) flags.push(makeFlag('screen_capture_suspected'));
  if (signals.aiUnavailable) flags.push(makeFlag('ai_unavailable'));
  if (!signals.fieldsRead) flags.push(makeFlag('extraction_incomplete'));
  if (signals.hasDocumentImage === false) flags.push(makeFlag('no_document_image'));
  // A PhilSys payload that failed signature verification is a blocking signal, but only
  // when a key was configured. An unconfigured key returns signatureValid=false with no
  // flag, because "we did not check" is not "the card is fake".
  if (signals.signatureInvalid) flags.push(makeFlag('signature_invalid'));

  const blocking = flags.filter((flag) => flag.severity === 'blocking');

  if (blocking.length > 0) {
    return { verdict: 'rejected', flags, reason: blocking[0]?.code ?? 'rejected' };
  }

  // `verified` — cryptographic authenticity proof plus a liveness pass plus a face match
  // that agrees. Anything less is not proof that the document belongs to this person.
  if (
    signals.signatureValid &&
    signals.livenessPassed === true &&
    FACE_MATCH_ACCEPTABLE.has(signals.faceMatchVerdict) &&
    signals.fieldsRead &&
    !signals.screenCaptureSuspected
  ) {
    return { verdict: 'verified', flags, reason: 'signature_valid_and_liveness_passed' };
  }

  // `partially_verified` — a validated read (MRZ checksums, or a confident extraction) plus
  // a liveness pass, but no cryptographic proof of authenticity. An opinion, not proof.
  const validatedRead = signals.method === 'mrz' || (signals.method === 'document_ai' && signals.fieldsRead);
  if (validatedRead && signals.livenessPassed === true && signals.fieldsRead) {
    return {
      verdict: 'partially_verified',
      flags,
      reason: signals.method === 'mrz' ? 'mrz_checksums_valid' : 'ai_extraction_confident',
    };
  }

  return { verdict: 'unverified', flags, reason: 'needs_human_review' };
}

// `signatureInvalid` is a separate signal from `signatureValid === false`: the latter also
// covers "no key configured, nothing checked", which must not reject a guest.

export type IdentityVerificationRow = {
  id: string;
  subject_kind: IdentitySubjectKind;
  guest_user_id: string | null;
  /** The host account. Present for `org_owner`, including before the org exists. */
  owner_user_id: string | null;
  organization_id: string | null;
  booking_id: string | null;
  guest_slot: number | null;
  subject_email_hash: string | null;
  verdict: IdentityVerdict;
  method: IdentityMethod;
  provider: string | null;
  provider_ref: string | null;
  document_type: string | null;
  document_number_hash: string | null;
  document_expiry: string | null;
  full_name: string | null;
  date_of_birth: string | null;
  sex: string | null;
  nationality: string | null;
  signature_valid: boolean;
  liveness_passed: boolean | null;
  liveness_grade: IdentityLivenessGrade | null;
  face_match_verdict: IdentityFaceMatchVerdict | null;
  face_match_source: string | null;
  quality_score: number | null;
  flags: IdentityFlag[];
  document_front_path: string | null;
  selfie_path: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  verified_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Human label shown in the shared badge. Never overclaims. */
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

/**
 * Which subject a session or verdict belongs to. Used by the UI and by the session
 * endpoints so the two cannot disagree about what a row means.
 */
export function isActiveIdentityVerdict(verdict: IdentityVerdict): verdict is ActiveIdentityVerdict {
  return (ACTIVE_IDENTITY_VERDICTS as readonly string[]).includes(verdict);
}

/** How long a verdict stays valid when the document itself does not expire sooner. */
export const DEFAULT_IDENTITY_VALIDITY_DAYS = 365;

/** Capture images are deleted after this many days unless a review is still open. */
export const DEFAULT_IDENTITY_CAPTURE_RETENTION_DAYS = 7;

/** Capture retention extended for a verdict that a human still has to look at. */
export const IDENTITY_REVIEW_RETENTION_DAYS = 30;

export function identityValidityDays(): number {
  const raw = Deno.env.get('IDENTITY_VERDICT_VALIDITY_DAYS')?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 30 && parsed <= 3650
    ? Math.trunc(parsed)
    : DEFAULT_IDENTITY_VALIDITY_DAYS;
}

export function identityCaptureRetentionDays(): number {
  const raw = Deno.env.get('IDENTITY_CAPTURE_RETENTION_DAYS')?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 365
    ? Math.trunc(parsed)
    : DEFAULT_IDENTITY_CAPTURE_RETENTION_DAYS;
}

/**
 * `expires_at` = the earlier of the document expiry and the policy window, so a passport
 * that expires in two weeks stops being "verified" in two weeks.
 */
export function computeIdentityExpiry(
  verifiedAt: Date,
  documentExpiryYmd: string | null | undefined,
  validityDays = identityValidityDays()
): Date {
  const policyExpiry = new Date(verifiedAt.getTime() + validityDays * 24 * 60 * 60 * 1000);
  const parsedDocumentExpiry = parseYmdAsManilaDate(documentExpiryYmd);
  if (!parsedDocumentExpiry) return policyExpiry;
  return parsedDocumentExpiry.getTime() < policyExpiry.getTime() ? parsedDocumentExpiry : policyExpiry;
}

/** Parse `YYYY-MM-DD` as a Manila-local date at end of day, so an ID expiring today still counts. */
export function parseYmdAsManilaDate(value: string | null | undefined): Date | null {
  const trimmed = value?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T23:59:59+08:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Normalize a document number before hashing: uppercase, strip spaces and separators. */
export function normalizeDocumentNumber(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Normalize an email for the subject hash. */
export function normalizeIdentityEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

function identityPepper(): string {
  const pepper = Deno.env.get('IDENTITY_HASH_PEPPER')?.trim();
  if (pepper) return pepper;
  // Never silently fall back to a service-role key: rotating that key would break every
  // duplicate check, and a leaked key must not become a hashing oracle.
  throw new Error('IDENTITY_HASH_PEPPER is required');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/** sha256(normalized || pepper). Stable across requests, useless without the pepper. */
export async function hashIdentityValue(
  value: string | null | undefined,
  pepper = identityPepper()
): Promise<string | null> {
  const normalized = (value ?? '').trim();
  if (!normalized) return null;
  return sha256Hex(`${normalized}${pepper}`);
}

export async function hashIdentityEmail(email: string | null | undefined): Promise<string | null> {
  const normalized = normalizeIdentityEmail(email);
  if (!normalized) return null;
  return hashIdentityValue(normalized);
}

export async function hashDocumentNumber(number: string | null | undefined): Promise<string | null> {
  const normalized = normalizeDocumentNumber(number);
  if (!normalized) return null;
  return hashIdentityValue(normalized);
}

/**
 * Do two names describe the same person closely enough that an AI extraction mismatch
 * should be a warning rather than a block? Order-insensitive, initials-tolerant, and
 * forgiving of the middle-name/suffix noise generated IDs carry.
 */
export function namesLikelyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return true; // Nothing to compare against is not a mismatch.
  if (left === right) return true;

  const leftTokens = new Set(left.split(' '));
  const rightTokens = right.split(' ');
  let shared = 0;
  for (const token of rightTokens) {
    if (token.length === 1) continue; // Ignore bare middle initials.
    if (leftTokens.has(token)) shared += 1;
  }
  const shorter = Math.min(leftTokens.size, rightTokens.filter((t) => t.length > 1).length);
  return shorter > 0 && shared / shorter >= 0.6;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Age in years at a reference instant, from a `YYYY-MM-DD` date of birth. */
export function ageFromDateOfBirth(
  dateOfBirthYmd: string | null | undefined,
  now = new Date()
): number | null {
  const dob = parseYmdAsManilaDate(dateOfBirthYmd);
  if (!dob) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}
