/**
 * Edge client for the identity capture flow.
 *
 * Two audiences:
 *   * The desktop / guest form — signed in or anonymous, calls `create`, `poll`, `cancel`.
 *   * The phone at `/verify/:token` — token only, calls `get`, `upload`, `submit`.
 *
 * Every call goes through `publicEdgeFetchJson`, which adds the anon key, a request id and
 * the platform's `{ success, data, error }` envelope handling.
 */

import { guestEdgeAuthHeaders } from '@/features/guest/auth/lib/guestEdgeAuthHeaders';

import { publicEdgeFetchJson } from '@/lib/api/publicEdgeFetch';

import type { IdentityCaptureMethod, IdentityDocumentType } from './documentTypes';
import type { IdentityFlag, IdentityVerdict } from './identityVerdict';

export type IdentitySubjectKind = 'guest' | 'org_owner';

export type IdentitySessionStatus =
  | 'pending'
  | 'in_progress'
  | 'captured'
  | 'submitted'
  | 'completed'
  | 'failed'
  | 'expired';

export type CreateIdentitySessionInput = {
  subjectKind?: IdentitySubjectKind;
  organizationId?: string;
  bookingId?: string;
  guestSlot?: number | null;
  email?: string;
  propertySlug?: string;
  originDevice?: 'desktop' | 'mobile';
};

export type CreatedIdentitySession = {
  sessionId: string;
  token: string;
  expiresAt: string;
  verifyUrl: string;
  qrPayload: string;
  subjectKind: IdentitySubjectKind;
  guestSlot: number | null;
};

export type IdentitySessionView = {
  sessionId: string;
  status: IdentitySessionStatus;
  step: string | null;
  expiresAt: string;
  verdict: IdentityVerdict | null;
  flags: IdentityFlag[];
  documentType: string | null;
  maskedName: string | null;
  subjectKind: IdentitySubjectKind;
  guestSlot: number | null;
  expired: boolean;
  /** Present once the session completed. */
  verificationId?: string | null;
};

export type IdentitySubmitPayload = {
  consentAccepted: boolean;
  documentFrontPath?: string | null;
  documentBackPath?: string | null;
  selfiePath?: string | null;
  livenessFramePaths?: string[];
  philsysQr?: string | null;
  mrz?: string | null;
  documentTypeHint?: IdentityDocumentType | IdentityCaptureMethod | null;
  liveness?: {
    passed: boolean | null;
    challenges: string[];
    frameCount: number;
    elapsedMs: number;
  } | null;
  quality?: { score?: number } | null;
};

export type IdentitySubmitResponse = {
  sessionId: string;
  verificationId: string;
  status: 'completed';
  verdict: IdentityVerdict;
  flags: IdentityFlag[];
  documentType: string | null;
  maskedName: string | null;
};

export type MyIdentityResponse = {
  hasIdentity: boolean;
  verification: {
    id: string;
    verdict: IdentityVerdict;
    method: string;
    documentType: string | null;
    maskedName: string | null;
    signatureValid: boolean;
    livenessGrade: string | null;
    faceMatchVerdict: string | null;
    flags: IdentityFlag[];
    verifiedAt: string | null;
    expiresAt: string | null;
  } | null;
};

async function postJson<T>(path: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  return publicEdgeFetchJson<T>(
    path,
    {
      method: 'POST',
      headers: { ...(await guestEdgeAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    fallback
  );
}

export async function createIdentitySession(
  input: CreateIdentitySessionInput
): Promise<CreatedIdentitySession> {
  return postJson<CreatedIdentitySession>(
    'identity-session-create',
    {
      ...input,
      appOrigin: typeof window === 'undefined' ? undefined : window.location.origin,
    },
    'Could not start the identity check'
  );
}

export async function getIdentitySession(
  token: string,
  options: { mobile?: boolean } = {}
): Promise<IdentitySessionView> {
  const query = new URLSearchParams({ t: token });
  if (options.mobile) query.set('device', 'mobile');
  return publicEdgeFetchJson<IdentitySessionView>(
    `identity-session-get?${query.toString()}`,
    { method: 'GET', headers: await guestEdgeAuthHeaders() },
    'Could not read the identity session'
  );
}

export async function uploadIdentityCapture(
  token: string,
  kind: 'document_front' | 'document_back' | 'selfie' | 'liveness_frame',
  file: File | Blob,
  index?: number
): Promise<{ path: string; kind: string }> {
  const formData = new FormData();
  formData.append('t', token);
  formData.append('kind', kind);
  if (index !== undefined) formData.append('index', String(index));
  const fileName = file instanceof File ? file.name : `${kind}.jpg`;
  formData.append('file', file, fileName);

  return publicEdgeFetchJson<{ path: string; kind: string }>(
    'identity-session-upload',
    { method: 'POST', headers: await guestEdgeAuthHeaders(), body: formData },
    'Upload failed. Check your connection and try again.'
  );
}

export async function submitIdentitySession(
  token: string,
  payload: IdentitySubmitPayload
): Promise<IdentitySubmitResponse> {
  return postJson<IdentitySubmitResponse>(
    'identity-session-submit',
    { t: token, ...payload },
    'We could not verify this document. Try again or upload a photo.'
  );
}

export async function cancelIdentitySession(sessionId: string): Promise<void> {
  await postJson<{ sessionId: string }>(
    'identity-session-cancel',
    { sessionId },
    'Could not cancel the identity check'
  );
}

export async function fetchMyIdentity(): Promise<MyIdentityResponse> {
  return publicEdgeFetchJson<MyIdentityResponse>(
    'identity-verification-mine',
    { method: 'GET', headers: await guestEdgeAuthHeaders(), quiet: true },
    'Could not read your identity'
  );
}

export async function deleteIdentityVerification(verificationId: string): Promise<void> {
  await postJson<{ verificationId: string; deleted: boolean }>(
    'identity-verification-delete',
    { verificationId },
    'Could not delete your verification'
  );
}
