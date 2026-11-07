import {
  ageFromDateOfBirth,
  computeIdentityExpiry,
  hashDocumentNumber,
  hashIdentityEmail,
  identityVerdictLabel,
  isActiveIdentityVerdict,
  namesLikelyMatch,
  normalizeDocumentNumber,
  resolveVerdict,
  type IdentitySignals,
} from './identityVerification.ts';

const BASE: IdentitySignals = {
  method: 'document_ai',
  signatureValid: false,
  livenessPassed: true,
  livenessGrade: 'clientside',
  faceMatchVerdict: 'match',
  fieldsRead: true,
};

function verdict(overrides: Partial<IdentitySignals>) {
  return resolveVerdict({ ...BASE, ...overrides });
}

Deno.test('verified needs a signature, liveness, a face match, and readable fields', () => {
  const result = verdict({ method: 'philsys_qr', signatureValid: true });
  if (result.verdict !== 'verified') throw new Error(`expected verified, got ${result.verdict}`);
});

Deno.test('a genuine document without liveness is not verified', () => {
  const result = verdict({ method: 'philsys_qr', signatureValid: true, livenessPassed: null });
  if (result.verdict === 'verified') throw new Error('must not verify without liveness');
  if (result.verdict !== 'unverified') throw new Error(`expected unverified, got ${result.verdict}`);
});

Deno.test('a genuine document with a failed liveness is not verified', () => {
  const result = verdict({ method: 'philsys_qr', signatureValid: true, livenessPassed: false });
  if (result.verdict === 'verified') throw new Error('must not verify on liveness failure');
  if (!result.flags.some((f) => f.code === 'liveness_failed')) throw new Error('missing liveness_failed');
});

Deno.test('MRZ with checksums + liveness is partially verified', () => {
  const result = verdict({ method: 'mrz', signatureValid: false, faceMatchVerdict: 'unclear' });
  if (result.verdict !== 'partially_verified') {
    throw new Error(`expected partially_verified, got ${result.verdict}`);
  }
});

Deno.test('a confident AI read + liveness is partially verified', () => {
  const result = verdict({ method: 'document_ai', signatureValid: false, faceMatchVerdict: 'likely_match' });
  if (result.verdict !== 'partially_verified') {
    throw new Error(`expected partially_verified, got ${result.verdict}`);
  }
});

Deno.test('an active verdict also needs security or a checksum', () => {
  const result = verdict({ method: 'mrz', signatureValid: false, livenessPassed: true });
  const resultB = resolveVerdict({ ...BASE, method: 'mrz', livenessPassed: true });
  if (resultB.verdict !== 'partially_verified') throw new Error('mrz checksum path should pass');
  if (result.verdict !== 'partially_verified') throw new Error('mrz checksum path should pass');
});

Deno.test('no liveness at all downgrades MRZ and AI reads to unverified', () => {
  const mrz = verdict({ method: 'mrz', livenessPassed: null });
  if (mrz.verdict !== 'unverified') throw new Error(`expected unverified, got ${mrz.verdict}`);
  if (!mrz.flags.some((f) => f.code === 'liveness_unavailable')) {
    throw new Error('missing liveness_unavailable');
  }
  const ai = verdict({ method: 'document_ai', livenessPassed: null });
  if (ai.verdict !== 'unverified') throw new Error(`expected unverified, got ${ai.verdict}`);
});

Deno.test('an expired document is rejected', () => {
  const result = verdict({ documentExpired: true, method: 'mrz' });
  if (result.verdict !== 'rejected') throw new Error('expired document must be rejected');
  if (!result.flags.some((f) => f.code === 'document_expired')) throw new Error('missing flag');
});

Deno.test('an under-18 document is rejected', () => {
  const result = verdict({ ageUnder18: true });
  if (result.verdict !== 'rejected') throw new Error('under-18 must be rejected');
});

Deno.test('a duplicate document number is rejected', () => {
  const result = verdict({ duplicateDocument: true, method: 'philsys_qr', signatureValid: true });
  if (result.verdict !== 'rejected') throw new Error('duplicate must be rejected');
});

Deno.test('a face mismatch is rejected even with a valid signature', () => {
  const result = verdict({
    method: 'philsys_qr',
    signatureValid: true,
    faceMatchVerdict: 'mismatch',
  });
  if (result.verdict !== 'rejected') throw new Error('face mismatch must be rejected');
});

Deno.test('a reviewer rejection always wins', () => {
  const result = verdict({ reviewerRejected: true, method: 'philsys_qr', signatureValid: true });
  if (result.verdict !== 'rejected') throw new Error('reviewer rejection must win');
});

Deno.test('an unverified signature is only blocking when a check actually ran', () => {
  const notChecked = verdict({ signatureValid: false, signatureInvalid: false, method: 'philsys_qr' });
  if (notChecked.verdict === 'rejected') throw new Error('an unchecked key must not reject');

  const checkedAndFailed = verdict({ signatureValid: false, signatureInvalid: true });
  if (checkedAndFailed.verdict !== 'rejected') throw new Error('a failed signature must reject');
  if (!checkedAndFailed.flags.some((f) => f.code === 'signature_invalid')) throw new Error('missing flag');
});

Deno.test('a name mismatch is a warning, not a block', () => {
  const result = verdict({ nameMismatch: true, method: 'mrz' });
  if (result.verdict !== 'partially_verified') throw new Error('name mismatch should stay reviewable');
  if (!result.flags.some((f) => f.code === 'name_mismatch')) throw new Error('missing flag');
});

Deno.test('a screen-capture suspicion blocks the top verdict but stays reviewable', () => {
  const result = verdict({ method: 'philsys_qr', signatureValid: true, screenCaptureSuspected: true });
  if (result.verdict !== 'unverified') throw new Error(`expected unverified, got ${result.verdict}`);
});

Deno.test('missing fields downgrade to unverified', () => {
  const result = verdict({ fieldsRead: false, method: 'document_ai' });
  if (result.verdict !== 'unverified') throw new Error('unreadable fields must not verify');
  if (!result.flags.some((f) => f.code === 'extraction_incomplete')) throw new Error('missing flag');
});

Deno.test('active verdict helper matches the DB partial indexes', () => {
  if (!isActiveIdentityVerdict('verified')) throw new Error('verified is active');
  if (!isActiveIdentityVerdict('partially_verified')) throw new Error('partially_verified is active');
  if (isActiveIdentityVerdict('unverified')) throw new Error('unverified is not active');
  if (isActiveIdentityVerdict('expired')) throw new Error('expired is not active');
});

Deno.test('verdict labels never overclaim', () => {
  if (identityVerdictLabel('partially_verified') !== 'Partially verified') throw new Error('label');
  if (identityVerdictLabel('unverified') !== 'Needs review') throw new Error('label');
});

Deno.test('document number normalization strips separators and case', () => {
  if (normalizeDocumentNumber(' 12-34 56 AB ') !== '123456AB') throw new Error('normalize');
});

Deno.test('hashes are stable and require the pepper', async () => {
  Deno.env.set('IDENTITY_HASH_PEPPER', 'test-pepper');
  const a = await hashIdentityEmail(' Guest@Example.com ');
  const b = await hashIdentityEmail('guest@example.com');
  if (!a || a !== b) throw new Error('email hash must normalize case and spaces');
  const docA = await hashDocumentNumber('12-3456-789');
  const docB = await hashDocumentNumber('123456789');
  if (docA !== docB) throw new Error('document hash must normalize');

  Deno.env.delete('IDENTITY_HASH_PEPPER');
  let threw = false;
  try {
    await hashIdentityEmail('guest@example.com');
  } catch {
    threw = true;
  }
  if (!threw) throw new Error('missing pepper must throw');
  Deno.env.set('IDENTITY_HASH_PEPPER', 'test-pepper');
});

Deno.test('name matching tolerates order, initials and diacritics', () => {
  if (!namesLikelyMatch('Maria Santos Cruz', 'Cruz, Maria Santos')) throw new Error('order');
  if (!namesLikelyMatch('Jose Rizal', 'Jose P. Rizal')) throw new Error('initial');
  if (!namesLikelyMatch('José Rizal', 'Jose Rizal')) throw new Error('diacritics');
  if (namesLikelyMatch('Maria Santos', 'Juan Dela Cruz')) throw new Error('different people');
  if (!namesLikelyMatch(null, 'Anyone')) throw new Error('missing side is not a mismatch');
});

Deno.test('expiry prefers the document date when it comes first', () => {
  const verifiedAt = new Date('2026-01-01T00:00:00Z');
  const expiry = computeIdentityExpiry(verifiedAt, '2026-03-01', 365);
  if (expiry.toISOString().slice(0, 10) !== '2026-03-01') throw new Error('document expiry must win');
  const policy = computeIdentityExpiry(verifiedAt, null, 30);
  if (policy.toISOString().slice(0, 10) !== '2026-01-31') throw new Error('policy window');
  const laterDocument = computeIdentityExpiry(verifiedAt, '2030-01-01', 30);
  if (laterDocument.toISOString().slice(0, 10) !== '2026-01-31') {
    throw new Error('policy window must cap a long-lived document');
  }
});

Deno.test('ageFromDateOfBirth handles birthdays and invalid input', () => {
  const now = new Date('2026-11-07T12:00:00+08:00');
  if (ageFromDateOfBirth('2008-11-06', now) !== 18) throw new Error('just turned 18');
  if (ageFromDateOfBirth('2008-11-08', now) !== 17) throw new Error('turns 18 tomorrow');
  if (ageFromDateOfBirth(null, now) !== null) throw new Error('null dob');
  if (ageFromDateOfBirth('not-a-date', now) !== null) throw new Error('invalid dob');
});
