import {
  captureRetentionCutoff,
  evaluateLivenessTimeline,
  identityCapturePrefix,
  identityCaptureStorageKey,
  isCapturePathOwnedBySession,
  isSubmittable,
  isTerminal,
  redactName,
  toMicroView,
  type IdentitySessionRow,
} from './identitySessionService.ts';

function session(overrides: Partial<IdentitySessionRow> = {}): IdentitySessionRow {
  return {
    id: 'session-1',
    token_hash: 'hash',
    subject_kind: 'guest',
    guest_user_id: null,
    owner_user_id: null,
    organization_id: null,
    booking_id: null,
    guest_slot: 1,
    subject_email_hash: 'email-hash',
    property_id: null,
    status: 'pending',
    step: null,
    origin_device: 'desktop',
    failure_reason: null,
    attempt_count: 0,
    claimed_at: null,
    result_id: null,
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

Deno.test('only open statuses accept a submit', () => {
  for (const status of ['pending', 'in_progress', 'captured'] as const) {
    if (!isSubmittable(status)) throw new Error(`${status} must be submittable`);
  }
  for (const status of ['submitted', 'completed', 'failed', 'expired'] as const) {
    if (isSubmittable(status)) throw new Error(`${status} must not accept a second submit`);
  }
});

Deno.test('terminal statuses are terminal', () => {
  if (!isTerminal('completed') || !isTerminal('failed') || !isTerminal('expired')) {
    throw new Error('terminal set');
  }
  if (isTerminal('captured')) throw new Error('captured is not terminal');
});

Deno.test('liveness timeline rejects implausible payloads', () => {
  const tooFast = evaluateLivenessTimeline({
    passed: true,
    challenges: ['blink', 'turn_head'],
    frameCount: 10,
    elapsedMs: 400,
  });
  if (tooFast.ok || tooFast.passed !== false) throw new Error('a 400ms challenge is impossible');

  const noChallenges = evaluateLivenessTimeline({
    passed: true,
    challenges: ['blink'],
    frameCount: 10,
    elapsedMs: 5000,
  });
  if (noChallenges.ok) throw new Error('one challenge is not the two we asked for');

  const noFrames = evaluateLivenessTimeline({
    passed: true,
    challenges: ['blink', 'turn_head'],
    frameCount: 0,
    elapsedMs: 5000,
  });
  if (noFrames.ok) throw new Error('zero frames is impossible');

  const good = evaluateLivenessTimeline({
    passed: true,
    challenges: ['blink', 'turn_head'],
    frameCount: 12,
    elapsedMs: 6000,
  });
  if (!good.ok || good.passed !== true) throw new Error('a plausible pass must be accepted');

  const absent = evaluateLivenessTimeline(null);
  if (!absent.ok || absent.passed !== null) throw new Error('no liveness is null, not a failure');

  const unknown = evaluateLivenessTimeline({ passed: null, elapsedMs: 0 });
  if (!unknown.ok || unknown.passed !== null) throw new Error('null pass stays null');
});

Deno.test('capture paths stay inside the session prefix', () => {
  const guest = session({ guest_user_id: 'user-1' });
  const key = identityCaptureStorageKey({
    session: guest,
    kind: 'document_front',
    extension: 'jpg',
  });
  if (key !== 'guest/user-1/session-1/document_front.jpg') throw new Error(key);
  if (!isCapturePathOwnedBySession(guest, key)) throw new Error('own path must be accepted');
  if (isCapturePathOwnedBySession(guest, 'guest/other-user/session-1/document_front.jpg')) {
    throw new Error('another subject path must be rejected');
  }
  if (isCapturePathOwnedBySession(guest, 'guest/user-1/other-session/document_front.jpg')) {
    throw new Error('another session path must be rejected');
  }

  const indexed = identityCaptureStorageKey({
    session: guest,
    kind: 'liveness_frame',
    index: 3,
    extension: 'png',
  });
  if (!indexed.endsWith('liveness_frame_3.png')) throw new Error(indexed);
});

Deno.test('org sessions scope captures under the organization', () => {
  const org = session({
    subject_kind: 'org_owner',
    guest_user_id: null,
    owner_user_id: 'owner-1',
    organization_id: 'org-9',
    guest_slot: null,
  });
  if (identityCapturePrefix(org) !== 'org_owner/org-9/session-1') {
    throw new Error(identityCapturePrefix(org));
  }
});

Deno.test('registration sessions key captures to the host account before the org exists', () => {
  const preOrg = session({
    subject_kind: 'org_owner',
    guest_user_id: null,
    owner_user_id: 'owner-1',
    organization_id: null,
    guest_slot: null,
  });
  if (identityCapturePrefix(preOrg) !== 'org_owner/owner-1/session-1') {
    throw new Error(identityCapturePrefix(preOrg));
  }
  const key = identityCaptureStorageKey({ session: preOrg, kind: 'document_front', extension: 'jpg' });
  if (!isCapturePathOwnedBySession(preOrg, key)) throw new Error('own path must be accepted');
  if (isCapturePathOwnedBySession(preOrg, 'org_owner/owner-2/session-1/document_front.jpg')) {
    throw new Error('another host path must be rejected');
  }
});

Deno.test('redactName keeps the first name and initials only', () => {
  if (redactName('Maria Santos Cruz') !== 'Maria S. C.') throw new Error(redactName('Maria Santos Cruz'));
  if (redactName('Juan') !== 'Juan') throw new Error('single name');
  if (redactName('   ') !== '') throw new Error('blank');
});

Deno.test('micro view exposes no paths and no full name', () => {
  const view = toMicroView(session({ result_id: 'v-1' }), {
    verdict: 'partially_verified',
    flags: [],
    document_type: 'philid',
    full_name: 'Maria Santos Cruz',
  });
  if (view.verificationId !== 'v-1') throw new Error('verification id');
  if (view.maskedName !== 'Maria S. C.') throw new Error(view.maskedName ?? 'masked name');
  const serialized = JSON.stringify(view);
  if (serialized.includes('document_front') || serialized.includes('identity-captures')) {
    throw new Error('micro view must not leak capture paths');
  }
});

Deno.test('retention cutoff honours the env override', () => {
  Deno.env.set('IDENTITY_CAPTURE_RETENTION_DAYS', '3');
  const now = new Date('2026-11-07T00:00:00Z');
  const cutoff = captureRetentionCutoff(now);
  if (cutoff.toISOString().slice(0, 10) !== '2026-11-04') throw new Error(cutoff.toISOString());
  Deno.env.delete('IDENTITY_CAPTURE_RETENTION_DAYS');
});
