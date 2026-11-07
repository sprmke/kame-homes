/**
 * Identity capture session lifecycle + verification pipeline.
 *
 * One module owns the state machine so the five edge handlers stay thin and cannot
 * disagree about what a status means.
 *
 *   pending ──claim──▶ in_progress ──upload──▶ captured ──submit──▶ completed
 *      │                    │                     │                    │
 *      └────────────── failed / expired ◀─────────┘                    │
 *                                                                       ▼
 *                                                              identity_verifications
 *
 * Invariants:
 *   * `submit` only runs from `pending` / `in_progress` / `captured`. Anything else is a
 *     replay and is rejected without side effects.
 *   * A session can complete exactly once. `result_id` is the idempotency marker.
 *   * A capture path must live under the session's own prefix, so a token cannot point the
 *     pipeline at someone else's image.
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { extractIdentityDocument, type IdentityExtraction } from './identityAiService.ts';
import { parseMrz, type MrzFields } from './mrz.ts';
import { decodePhilSysPayload, type PhilSysDecodeResult, type PhilSysFields } from './philsysQr.ts';
import {
  ageFromDateOfBirth,
  computeIdentityExpiry,
  hashDocumentNumber,
  hashIdentityEmail,
  identityCaptureRetentionDays,
  makeFlag,
  namesLikelyMatch,
  parseYmdAsManilaDate,
  resolveVerdict,
  type IdentityFaceMatchVerdict,
  type IdentityFlag,
  type IdentityLivenessGrade,
  type IdentityMethod,
  type IdentitySignals,
  type IdentitySubjectKind,
  type IdentityVerdict,
} from './identityVerification.ts';
import { hashIdentitySessionToken, mintIdentitySessionToken } from './identitySessionToken.ts';
import { resolvePropertyEntitlements } from './planEntitlements.ts';

export const IDENTITY_CAPTURE_BUCKET = 'identity-captures';

/** Explicit column list — the `select('*')` guard exists for a reason. */
const SESSION_COLUMNS =
  'id, token_hash, subject_kind, guest_user_id, owner_user_id, organization_id, booking_id, guest_slot, subject_email_hash, property_id, status, step, origin_device, failure_reason, attempt_count, claimed_at, result_id, expires_at, created_at, updated_at';

export const IDENTITY_CAPTURE_KINDS = [
  'document_front',
  'document_back',
  'selfie',
  'liveness_frame',
] as const;
export type IdentityCaptureKind = (typeof IDENTITY_CAPTURE_KINDS)[number];

export type IdentitySessionStatus =
  | 'pending'
  | 'in_progress'
  | 'captured'
  | 'submitted'
  | 'completed'
  | 'failed'
  | 'expired';

export type IdentitySessionRow = {
  id: string;
  token_hash: string;
  subject_kind: IdentitySubjectKind;
  guest_user_id: string | null;
  owner_user_id: string | null;
  organization_id: string | null;
  booking_id: string | null;
  guest_slot: number | null;
  subject_email_hash: string | null;
  property_id: string | null;
  status: IdentitySessionStatus;
  step: string | null;
  origin_device: 'desktop' | 'mobile' | null;
  failure_reason: string | null;
  attempt_count: number;
  claimed_at: string | null;
  result_id: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

/** Statuses that may still accept a submit. */
const SUBMITTABLE: ReadonlySet<IdentitySessionStatus> = new Set(['pending', 'in_progress', 'captured']);

export function isSubmittable(status: IdentitySessionStatus): boolean {
  return SUBMITTABLE.has(status);
}

export function isTerminal(status: IdentitySessionStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'expired';
}

export type CreateIdentitySessionInput = {
  subjectKind: IdentitySubjectKind;
  guestUserId?: string | null;
  /** The host account. Required for `org_owner`; ignored for `guest`. */
  ownerUserId?: string | null;
  organizationId?: string | null;
  bookingId?: string | null;
  guestSlot?: number | null;
  email?: string | null;
  propertyId?: string | null;
  originDevice?: 'desktop' | 'mobile' | null;
};

export type CreatedIdentitySession = {
  session: IdentitySessionRow;
  token: string;
  expiresAt: string;
};

function optionalUuid(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed || null;
}

export async function createIdentitySession(
  supabase: SupabaseClient,
  input: CreateIdentitySessionInput
): Promise<CreatedIdentitySession> {
  const guestSlot = input.guestSlot ?? null;
  if (guestSlot !== null && (guestSlot < 1 || guestSlot > 5)) {
    throw new Error('guestSlot must be between 1 and 5');
  }

  let emailHash: string | null = null;
  if (input.subjectKind === 'guest') {
    emailHash = await hashIdentityEmail(input.email);
    if (!emailHash) {
      throw new Error('An email address is required to verify a guest identity');
    }
  } else if (!input.ownerUserId?.trim()) {
    // The organization may not exist yet (registration), so the host account is the key.
    throw new Error('A signed-in host is required to verify an organization owner');
  }

  // Only the primary guest links to the account. Additional guests are different people,
  // so an account link would (a) let slot 2 wipe slot 1's active verdict and (b) claim a
  // companion's identity as the booker's own.
  const accountGuestUserId =
    input.subjectKind === 'guest' && (guestSlot === null || guestSlot === 1)
      ? optionalUuid(input.guestUserId)
      : null;

  // 10 minutes from creation; a fresh session is minted on retry rather than extended.
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { data: placeholder, error: placeholderError } = await supabase
    .from('identity_verification_sessions')
    .insert({
      token_hash: `pending-${crypto.randomUUID()}`,
      subject_kind: input.subjectKind,
      guest_user_id: accountGuestUserId,
      owner_user_id:
        input.subjectKind === 'org_owner' ? optionalUuid(input.ownerUserId) : null,
      organization_id: optionalUuid(input.organizationId),
      booking_id: optionalUuid(input.bookingId),
      guest_slot: guestSlot,
      subject_email_hash: emailHash,
      property_id: optionalUuid(input.propertyId),
      origin_device: input.originDevice ?? null,
      expires_at: expiresAt,
    })
    .select(SESSION_COLUMNS)
    .single();
  if (placeholderError || !placeholder) {
    throw new Error(placeholderError?.message ?? 'Could not create the identity session');
  }

  const sessionId = (placeholder as IdentitySessionRow).id;
  const minted = await mintIdentitySessionToken(sessionId);

  const { data: updated, error: updateError } = await supabase
    .from('identity_verification_sessions')
    .update({ token_hash: minted.tokenHash, expires_at: minted.expiresAt.toISOString() })
    .eq('id', sessionId)
    .select(SESSION_COLUMNS)
    .single();
  if (updateError || !updated) {
    throw new Error(updateError?.message ?? 'Could not finalize the identity session');
  }

  return {
    session: updated as IdentitySessionRow,
    token: minted.token,
    expiresAt: minted.expiresAt.toISOString(),
  };
}

export async function loadSessionByToken(
  supabase: SupabaseClient,
  sessionId: string,
  token: string
): Promise<IdentitySessionRow | null> {
  const tokenHash = await hashIdentitySessionToken(token);
  const { data, error } = await supabase
    .from('identity_verification_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', sessionId)
    .eq('token_hash', tokenHash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IdentitySessionRow | null) ?? null;
}

/** Mark the session as expired in the database when the clock says so. */
export async function expireSessionIfStale(
  supabase: SupabaseClient,
  session: IdentitySessionRow
): Promise<IdentitySessionRow> {
  if (isTerminal(session.status)) return session;
  if (Date.parse(session.expires_at) > Date.now()) return session;
  const { data } = await supabase
    .from('identity_verification_sessions')
    .update({ status: 'expired', failure_reason: 'expired' })
    .eq('id', session.id)
    .select(SESSION_COLUMNS)
    .single();
  return (data as IdentitySessionRow | null) ?? { ...session, status: 'expired', failure_reason: 'expired' };
}

export async function claimSession(
  supabase: SupabaseClient,
  session: IdentitySessionRow,
  originDevice: 'desktop' | 'mobile'
): Promise<IdentitySessionRow> {
  if (session.status !== 'pending') return session;
  const { data, error } = await supabase
    .from('identity_verification_sessions')
    .update({
      status: 'in_progress',
      claimed_at: new Date().toISOString(),
      origin_device: originDevice,
    })
    .eq('id', session.id)
    .eq('status', 'pending')
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return (data as IdentitySessionRow | null) ?? session;
}

export async function updateSessionStep(
  supabase: SupabaseClient,
  sessionId: string,
  step: string | null
): Promise<void> {
  await supabase
    .from('identity_verification_sessions')
    .update({ step })
    .eq('id', sessionId)
    .in('status', ['pending', 'in_progress', 'captured']);
}

/** Storage key for one capture. Enforces the session prefix so a token cannot reach elsewhere. */
export function identityCaptureStorageKey(input: {
  session: IdentitySessionRow;
  kind: IdentityCaptureKind;
  index?: number;
  extension: 'jpg' | 'png' | 'webp';
}): string {
  const suffix = input.index === undefined ? '' : `_${input.index}`;
  return `${input.session.subject_kind}/${sessionSubjectRef(input.session)}/${input.session.id}/${input.kind}${suffix}.${input.extension}`;
}

function sessionSubjectRef(
  session: Pick<IdentitySessionRow, 'id' | 'organization_id' | 'owner_user_id' | 'guest_user_id'>
): string {
  return session.organization_id ?? session.owner_user_id ?? session.guest_user_id ?? session.id;
}

export function isCapturePathOwnedBySession(session: IdentitySessionRow, path: string): boolean {
  return path.startsWith(`${session.subject_kind}/${sessionSubjectRef(session)}/${session.id}/`);
}

/** Folder that holds every capture for one session. */
export function identityCapturePrefix(session: Pick<
  IdentitySessionRow,
  'id' | 'subject_kind' | 'guest_user_id' | 'owner_user_id' | 'organization_id'
>): string {
  return `${session.subject_kind}/${sessionSubjectRef(session)}/${session.id}`;
}

export async function markCaptured(supabase: SupabaseClient, sessionId: string): Promise<void> {
  await supabase
    .from('identity_verification_sessions')
    .update({ status: 'captured' })
    .eq('id', sessionId)
    .in('status', ['pending', 'in_progress']);
}

export async function failSession(
  supabase: SupabaseClient,
  sessionId: string,
  reason: string
): Promise<void> {
  await supabase
    .from('identity_verification_sessions')
    .update({ status: 'failed', failure_reason: reason.slice(0, 200) })
    .eq('id', sessionId)
    .in('status', ['pending', 'in_progress', 'captured']);
}

// --- submit contract -------------------------------------------------------------------

export type IdentitySubmitPayload = {
  consentAccepted: boolean;
  documentFrontPath?: string | null;
  documentBackPath?: string | null;
  selfiePath?: string | null;
  livenessFramePaths?: string[];
  philsysQr?: string | null;
  mrz?: string | null;
  documentTypeHint?: string | null;
  liveness?: {
    passed: boolean | null;
    challenges?: string[];
    frameCount?: number;
    elapsedMs?: number;
  } | null;
  quality?: { score?: number } | null;
};

// Must match `LivenessChallenge` in `ui/src/features/verification/hooks/useLivenessChallenges.ts`.
const ALLOWED_LIVENESS_CHALLENGES = new Set([
  'blink',
  'turn_head',
  'turn_left',
  'turn_right',
  'open_mouth',
]);

export type LivenessTimelineCheck = { ok: boolean; reason?: string; passed: boolean | null };

/**
 * Server-side sanity on the liveness result. A replayed set of stills cannot produce a
 * plausible elapsed time plus distinct challenges, so an implausible payload is treated as
 * a failed check rather than "unavailable": the client had to fabricate it.
 */
export function evaluateLivenessTimeline(
  liveness: IdentitySubmitPayload['liveness']
): LivenessTimelineCheck {
  if (!liveness) return { ok: true, passed: null };
  if (liveness.passed === null || liveness.passed === undefined) return { ok: true, passed: null };

  const elapsedMs = Number(liveness.elapsedMs ?? 0);
  const challenges = (liveness.challenges ?? []).filter((challenge) =>
    ALLOWED_LIVENESS_CHALLENGES.has(challenge)
  );
  const frameCount = Number(liveness.frameCount ?? 0);

  if (elapsedMs > 0 && elapsedMs < 1200) return { ok: false, reason: 'too_fast', passed: false };
  if (elapsedMs > 120_000) return { ok: false, reason: 'too_slow', passed: false };
  if (challenges.length < 2) return { ok: false, reason: 'missing_challenges', passed: false };
  if (frameCount < 2) return { ok: false, reason: 'missing_frames', passed: false };

  return { ok: true, passed: Boolean(liveness.passed) };
}

export type VerificationOutcome = {
  verificationId: string;
  verdict: IdentityVerdict;
  flags: IdentityFlag[];
  fields: {
    documentType: string | null;
    fullName: string | null;
    dateOfBirth: string | null;
    documentNumberHash: string | null;
  };
};

async function downloadCapture(
  supabase: SupabaseClient,
  path: string
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const { data, error } = await supabase.storage.from(IDENTITY_CAPTURE_BUCKET).download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  return { bytes, mimeType: data.type || 'image/jpeg' };
}

function pickDeterministicFields(
  philsys: PhilSysDecodeResult | null,
  mrz: MrzFields | null
): {
  method: IdentityMethod;
  fields: {
    documentType: string | null;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    dateOfBirth: string | null;
    sex: string | null;
    nationality: string | null;
    documentNumber: string | null;
    documentExpiry: string | null;
  };
  signatureValid: boolean;
  signatureInvalid: boolean;
} | null {
  if (philsys?.fields) {
    const fields: PhilSysFields = philsys.fields;
    return {
      method: 'philsys_qr',
      fields: {
        documentType: philsys.kind === 'v3' ? 'ephilid' : 'philid',
        fullName: fields.fullName,
        firstName: fields.firstName,
        lastName: fields.lastName,
        dateOfBirth: fields.dateOfBirth,
        sex: fields.sex,
        nationality: fields.nationality,
        documentNumber: fields.documentNumber,
        documentExpiry: fields.documentExpiry,
      },
      signatureValid: philsys.signature.checked && philsys.signature.valid,
      signatureInvalid: philsys.signature.checked && !philsys.signature.valid,
    };
  }
  if (mrz) {
    return {
      method: 'mrz',
      fields: {
        documentType: mrz.format === 'TD3' ? 'passport' : 'other',
        fullName: mrz.fullName,
        firstName: mrz.firstName,
        lastName: mrz.lastName,
        dateOfBirth: mrz.dateOfBirth,
        sex: mrz.sex,
        nationality: mrz.nationality,
        documentNumber: mrz.documentNumber,
        documentExpiry: mrz.documentExpiry,
      },
      signatureValid: false,
      signatureInvalid: false,
    };
  }
  return null;
}

export type RunVerificationInput = {
  session: IdentitySessionRow;
  payload: IdentitySubmitPayload;
  /** Optional expectation used for the name/DOB cross-check (booking form name). */
  expectedFullName?: string | null;
  expectedDateOfBirth?: string | null;
};

/**
 * The pipeline. Deterministic reads win; AI fills the gaps and supplies face-match and
 * screen-capture signals. Returns the persisted verdict.
 */
export async function runIdentityVerification(
  supabase: SupabaseClient,
  input: RunVerificationInput
): Promise<VerificationOutcome> {
  const { session, payload } = input;
  if (!payload.consentAccepted) {
    throw new Error('Consent is required before verification');
  }

  const frontPath = payload.documentFrontPath?.trim() || null;
  const selfiePath = payload.selfiePath?.trim() || null;
  if (frontPath && !isCapturePathOwnedBySession(session, frontPath)) {
    throw new Error('Capture path does not belong to this session');
  }
  if (selfiePath && !isCapturePathOwnedBySession(session, selfiePath)) {
    throw new Error('Selfie path does not belong to this session');
  }

  // 1. Deterministic reads.
  let philsys: PhilSysDecodeResult | null = null;
  if (payload.philsysQr?.trim()) {
    philsys = await decodePhilSysPayload(payload.philsysQr, {
      publicKeyBase64: Deno.env.get('PHILSYS_PUBLIC_KEY') ?? null,
    });
  }
  const mrz = payload.mrz?.trim() ? parseMrz(payload.mrz) : null;
  const deterministic = pickDeterministicFields(philsys, mrz);

  // 2. AI extraction — fills gaps and supplies face match / screen capture signals.
  const documentImage = frontPath ? await downloadCapture(supabase, frontPath) : null;
  const selfieImage = selfiePath ? await downloadCapture(supabase, selfiePath) : null;

  let ai: IdentityExtraction | null = null;
  let aiAllowed = false;
  if (session.property_id) {
    try {
      const entitlements = await resolvePropertyEntitlements(session.property_id);
      aiAllowed = Boolean(entitlements.aiValidations);
    } catch {
      aiAllowed = false;
    }
  } else if (session.subject_kind === 'org_owner') {
    // Host verification has no property, and at registration no organization yet either.
    // The call is metered to the org's plan once `organization_id` is attached.
    aiAllowed = true;
  }

  if (aiAllowed && documentImage) {
    ai = await extractIdentityDocument({
      documentBytes: documentImage.bytes,
      documentMimeType: documentImage.mimeType,
      selfieBytes: selfieImage?.bytes ?? null,
      selfieMimeType: selfieImage?.mimeType ?? null,
      usageContext: {
        organizationId: session.organization_id,
        propertyId: session.property_id,
        actorUserId: session.guest_user_id,
        actorType: session.guest_user_id ? 'guest' : 'staff',
      },
    });
  }

  // 3. Merge fields: deterministic values win over AI.
  const merged = {
    documentType: deterministic?.fields.documentType ?? ai?.documentType ?? payload.documentTypeHint ?? null,
    fullName: deterministic?.fields.fullName ?? ai?.fullName ?? null,
    firstName: deterministic?.fields.firstName ?? null,
    lastName: deterministic?.fields.lastName ?? null,
    dateOfBirth: deterministic?.fields.dateOfBirth ?? ai?.dateOfBirth ?? null,
    sex: deterministic?.fields.sex ?? ai?.sex ?? null,
    nationality: deterministic?.fields.nationality ?? ai?.nationality ?? null,
    documentNumber: deterministic?.fields.documentNumber ?? ai?.documentNumber ?? null,
    documentExpiry: deterministic?.fields.documentExpiry ?? ai?.expiryDate ?? null,
  };

  const fieldsRead = Boolean(merged.fullName || merged.documentNumber || merged.dateOfBirth);
  const method: IdentityMethod = deterministic?.method ?? 'document_ai';

  // 4. Signals.
  const livenessCheck = evaluateLivenessTimeline(payload.liveness);
  const documentExpiryDate = parseYmdAsManilaDate(merged.documentExpiry);
  const documentExpired = documentExpiryDate ? documentExpiryDate.getTime() < Date.now() : false;
  const age = ageFromDateOfBirth(merged.dateOfBirth);
  const ageUnder18 = age !== null && age < 18;

  const expectedName = input.expectedFullName?.trim() || null;
  const nameMismatch =
    expectedName && merged.fullName ? !namesLikelyMatch(expectedName, merged.fullName) : false;
  const dobMismatch =
    input.expectedDateOfBirth && merged.dateOfBirth
      ? input.expectedDateOfBirth.slice(0, 10) !== merged.dateOfBirth
      : false;

  const documentNumberHash = merged.documentNumber
    ? await hashDocumentNumber(merged.documentNumber)
    : null;

  let duplicateDocument = false;
  if (documentNumberHash) {
    const { data: existing } = await supabase
      .from('identity_verifications')
      .select('id, subject_email_hash')
      .eq('document_number_hash', documentNumberHash)
      .in('verdict', ['verified', 'partially_verified', 'unverified'])
      .neq('subject_email_hash', session.subject_email_hash ?? '')
      .limit(1);
    duplicateDocument = Array.isArray(existing) && existing.length > 0;
  }

  const faceMatchVerdict: IdentityFaceMatchVerdict = selfieImage
    ? (ai?.faceComparison ?? 'unclear')
    : 'skipped';

  const signals: IdentitySignals = {
    method,
    signatureValid: deterministic?.signatureValid ?? false,
    signatureInvalid: deterministic?.signatureInvalid ?? false,
    livenessPassed: livenessCheck.passed,
    livenessGrade: livenessCheck.passed === null ? null : ('clientside' satisfies IdentityLivenessGrade),
    faceMatchVerdict,
    fieldsRead,
    documentExpired,
    ageUnder18,
    nameMismatch,
    dobMismatch,
    duplicateDocument,
    lowQuality: (payload.quality?.score ?? 1) < 0.4,
    screenCaptureSuspected: ai?.screenOrPhotocopySuspected ?? false,
    aiUnavailable: ai ? ai.status !== 'ok' : false,
    hasDocumentImage: Boolean(documentImage),
  };

  const verdict = resolveVerdict(signals);
  const now = new Date();
  const expiresAt = computeIdentityExpiry(now, merged.documentExpiry);

  // 5. Supersede any earlier live verdict for the same account or booking slot.
  if (session.owner_user_id) {
    await supabase
      .from('identity_verifications')
      .update({ verdict: 'expired' })
      .eq('owner_user_id', session.owner_user_id)
      .in('verdict', ['verified', 'partially_verified']);
  }
  if (session.guest_user_id) {
    await supabase
      .from('identity_verifications')
      .update({ verdict: 'expired' })
      .eq('guest_user_id', session.guest_user_id)
      .in('verdict', ['verified', 'partially_verified']);
  }
  if (session.booking_id) {
    await supabase
      .from('identity_verifications')
      .update({ verdict: 'expired' })
      .eq('booking_id', session.booking_id)
      .eq('guest_slot', session.guest_slot ?? 1)
      .in('verdict', ['verified', 'partially_verified']);
  }

  // 6. Persist.
  const { data: inserted, error } = await supabase
    .from('identity_verifications')
    .insert({
      subject_kind: session.subject_kind,
      guest_user_id: session.guest_user_id,
      owner_user_id: session.owner_user_id,
      organization_id: session.organization_id,
      booking_id: session.booking_id,
      guest_slot: session.guest_slot,
      subject_email_hash: session.subject_email_hash,
      verdict: verdict.verdict,
      method,
      provider: ai?.status === 'ok' ? 'gemini' : null,
      document_type: merged.documentType,
      document_number_hash: documentNumberHash,
      document_expiry: merged.documentExpiry,
      full_name: merged.fullName,
      date_of_birth: merged.dateOfBirth,
      sex: merged.sex,
      nationality: merged.nationality,
      signature_valid: signals.signatureValid,
      liveness_passed: signals.livenessPassed,
      liveness_grade: signals.livenessGrade,
      face_match_verdict: faceMatchVerdict,
      face_match_source: ai?.status === 'ok' && selfieImage ? 'gemini' : null,
      quality_score: payload.quality?.score ?? null,
      flags: verdict.flags,
      document_front_path: frontPath,
      selfie_path: selfiePath,
      verified_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single();
  if (error || !inserted) throw new Error(error?.message ?? 'Could not save the verification');

  return {
    verificationId: (inserted as { id: string }).id,
    verdict: verdict.verdict,
    flags: verdict.flags,
    fields: {
      documentType: merged.documentType,
      fullName: merged.fullName === null ? null : redactName(merged.fullName),
      dateOfBirth: merged.dateOfBirth,
      documentNumberHash,
    },
  };
}

/**
 * The client only ever needs a masked name back. Full PII stays server-side and is read
 * through the admin/guest read endpoints.
 */
export function redactName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .map((part, index) => (index === 0 ? part : `${part.charAt(0).toUpperCase()}.`))
    .join(' ');
}

/** Final step: mark the session completed and link the verdict. Safe to call once. */
export async function completeSession(
  supabase: SupabaseClient,
  session: IdentitySessionRow,
  verificationId: string
): Promise<void> {
  await supabase
    .from('identity_verification_sessions')
    .update({ status: 'completed', result_id: verificationId, step: 'done' })
    .eq('id', session.id)
    .in('status', ['pending', 'in_progress', 'captured', 'submitted']);
}

export type MicroView = {
  sessionId: string;
  /** Set once `completed`; the booking form stores this value. */
  verificationId: string | null;
  status: IdentitySessionStatus;
  step: string | null;
  expiresAt: string;
  verdict: IdentityVerdict | null;
  flags: IdentityFlag[];
  documentType: string | null;
  maskedName: string | null;
};

/** Public projection — no internal ids, no paths, no raw PII. */
export function toMicroView(session: IdentitySessionRow, verdict?: {
  verdict: IdentityVerdict;
  flags: IdentityFlag[];
  document_type: string | null;
  full_name: string | null;
} | null): MicroView {
  return {
    sessionId: session.id,
    verificationId: session.result_id,
    status: session.status,
    step: session.step,
    expiresAt: session.expires_at,
    verdict: verdict?.verdict ?? null,
    flags: verdict?.flags ?? [],
    documentType: verdict?.document_type ?? null,
    maskedName: verdict?.full_name ? redactName(verdict.full_name) : null,
  };
}

/** Retention cutoff for the purge cron. */
export function captureRetentionCutoff(now = new Date()): Date {
  return new Date(now.getTime() - identityCaptureRetentionDays() * 24 * 60 * 60 * 1000);
}

/** Extra flags a reviewer might want surfaced when the capture quality was poor. */
export function qualityFlag(score: number | null | undefined): IdentityFlag | null {
  return typeof score === 'number' && score < 0.4 ? makeFlag('low_quality') : null;
}
