import {
  hashIdentitySessionToken,
  mintIdentitySessionToken,
  timingSafeEqual,
  verifyIdentitySessionToken,
} from './identitySessionToken.ts';

const SESSION_ID = '22222222-2222-2222-2222-222222222222';

Deno.env.set('IDENTITY_SESSION_SECRET', 'test-identity-session-secret');

Deno.test('mint + verify round-trip', async () => {
  const minted = await mintIdentitySessionToken(SESSION_ID);
  const verified = await verifyIdentitySessionToken(minted.token);
  if (!verified.ok || verified.sessionId !== SESSION_ID) {
    throw new Error('expected a valid token');
  }
  if (!minted.token.startsWith('v1.')) throw new Error('unexpected prefix');
});

Deno.test('token hash is stable and differs from the token', async () => {
  const minted = await mintIdentitySessionToken(SESSION_ID);
  const first = await hashIdentitySessionToken(minted.token);
  const second = await hashIdentitySessionToken(minted.token);
  if (first !== second) throw new Error('hash must be deterministic');
  if (first === minted.token) throw new Error('hash must not equal the token');
  if (minted.tokenHash !== first) throw new Error('minted tokenHash must match the hash helper');
});

Deno.test('rejects a tampered signature', async () => {
  const minted = await mintIdentitySessionToken(SESSION_ID);
  const parts = minted.token.split('.');
  parts[4] = `${parts[4]}x`;
  const verified = await verifyIdentitySessionToken(parts.join('.'));
  if (verified.ok || verified.reason !== 'invalid') throw new Error('expected invalid');
});

Deno.test('rejects a tampered session id', async () => {
  const minted = await mintIdentitySessionToken(SESSION_ID);
  const parts = minted.token.split('.');
  parts[1] = '33333333-3333-3333-3333-333333333333';
  const verified = await verifyIdentitySessionToken(parts.join('.'));
  if (verified.ok || verified.reason !== 'invalid') throw new Error('expected invalid');
});

Deno.test('rejects an expired token', async () => {
  const minted = await mintIdentitySessionToken(SESSION_ID, -1000);
  const verified = await verifyIdentitySessionToken(minted.token);
  if (verified.ok || verified.reason !== 'expired') throw new Error('expected expired');
});

Deno.test('rejects malformed and missing tokens', async () => {
  const missing = await verifyIdentitySessionToken('');
  if (missing.ok || missing.reason !== 'missing') throw new Error('expected missing');
  const malformed = await verifyIdentitySessionToken('not-a-token');
  if (malformed.ok || malformed.reason !== 'malformed') throw new Error('expected malformed');
});

Deno.test('token survives a reload — verification is not consumed on read', async () => {
  const minted = await mintIdentitySessionToken(SESSION_ID);
  const first = await verifyIdentitySessionToken(minted.token);
  const second = await verifyIdentitySessionToken(minted.token);
  if (!first.ok || !second.ok) throw new Error('token must be reusable until the session ends');
});

Deno.test('a token signed with a different secret is rejected', async () => {
  const minted = await mintIdentitySessionToken(SESSION_ID);
  Deno.env.set('IDENTITY_SESSION_SECRET', 'a-different-secret');
  const verified = await verifyIdentitySessionToken(minted.token);
  Deno.env.set('IDENTITY_SESSION_SECRET', 'test-identity-session-secret');
  if (verified.ok || verified.reason !== 'invalid') throw new Error('expected invalid');
});

Deno.test('timingSafeEqual compares without early exit', () => {
  if (!timingSafeEqual('abc', 'abc')) throw new Error('equal strings must match');
  if (timingSafeEqual('abc', 'abd')) throw new Error('different strings must not match');
  if (timingSafeEqual('abc', 'abcd')) throw new Error('different lengths must not match');
});
