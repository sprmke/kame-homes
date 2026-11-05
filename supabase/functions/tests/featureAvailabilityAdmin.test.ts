/**
 * feature-availability PUT handler logic — the validation `index.ts` delegates to, plus
 * the parent-conflict cascade it composes with (resolver cascade itself is covered in
 * `_shared/featureAvailabilityResolve_test.ts`). `index.ts` isn't imported directly: it
 * calls `serve()` at module scope via `serveSuperAdmin`, which binds a port and never
 * returns (see `authWrapperRejection.test.ts`'s note — none of this repo's handler
 * tests import a serve*-wrapped index.ts for that reason).
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { getFeatureAvailabilityCatalogEntry } from '../_shared/featureAvailabilityCatalog.ts';
import { resolveFeatureAvailability } from '../_shared/featureAvailabilityResolve.ts';
import { FEATURE_AVAILABILITY_CATALOG } from '../_shared/featureAvailabilityCatalog.ts';
import { validateFeatureAvailabilityOffPayload } from '../_shared/featureAvailabilityAdminValidation.ts';

const NOW = new Date('2026-10-25T12:00:00.000Z');
const META_REPLY = getFeatureAvailabilityCatalogEntry('inbox.meta.reply')!;
const AI_STUDIO = getFeatureAvailabilityCatalogEntry('marketing.ai_studio')!;

Deno.test('valid off payload (maintenance, no extras) passes', () => {
  const result = validateFeatureAvailabilityOffPayload({ reason: 'maintenance' }, META_REPLY, NOW);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.fields.reason, 'maintenance');
    assertEquals(result.fields.superAdminBypass, true);
    assertEquals(result.fields.autoRestore, false);
  }
});

Deno.test('missing/unknown reason is rejected', () => {
  assertEquals(validateFeatureAvailabilityOffPayload({}, META_REPLY, NOW).ok, false);
  assertEquals(
    validateFeatureAvailabilityOffPayload({ reason: 'not_a_reason' }, META_REPLY, NOW).ok,
    false
  );
});

Deno.test('reason "other" requires a message', () => {
  const noMessage = validateFeatureAvailabilityOffPayload({ reason: 'other' }, META_REPLY, NOW);
  assertEquals(noMessage.ok, false);
  const withMessage = validateFeatureAvailabilityOffPayload(
    { reason: 'other', message: 'Custom note' },
    META_REPLY,
    NOW
  );
  assertEquals(withMessage.ok, true);
});

Deno.test('message over 280 chars is rejected', () => {
  const result = validateFeatureAvailabilityOffPayload(
    { reason: 'paused', message: 'x'.repeat(281) },
    META_REPLY,
    NOW
  );
  assertEquals(result.ok, false);
});

Deno.test('provider_issue / under_review require a catalog entry with a provider', () => {
  // AI_STUDIO has no provider.
  assertEquals(
    validateFeatureAvailabilityOffPayload({ reason: 'provider_issue' }, AI_STUDIO, NOW).ok,
    false
  );
  assertEquals(
    validateFeatureAvailabilityOffPayload({ reason: 'under_review' }, AI_STUDIO, NOW).ok,
    false
  );
  // META_REPLY has a provider (Meta).
  assertEquals(
    validateFeatureAvailabilityOffPayload({ reason: 'provider_issue' }, META_REPLY, NOW).ok,
    true
  );
});

Deno.test('expectedBackAt must be a valid, future date', () => {
  assertEquals(
    validateFeatureAvailabilityOffPayload(
      { reason: 'maintenance', expectedBackAt: 'not-a-date' },
      META_REPLY,
      NOW
    ).ok,
    false
  );
  const past = new Date(NOW.getTime() - 60_000).toISOString();
  assertEquals(
    validateFeatureAvailabilityOffPayload(
      { reason: 'maintenance', expectedBackAt: past },
      META_REPLY,
      NOW
    ).ok,
    false
  );
  const future = new Date(NOW.getTime() + 60_000).toISOString();
  const ok = validateFeatureAvailabilityOffPayload(
    { reason: 'maintenance', expectedBackAt: future },
    META_REPLY,
    NOW
  );
  assertEquals(ok.ok, true);
});

Deno.test('autoRestore requires expectedBackAt', () => {
  assertEquals(
    validateFeatureAvailabilityOffPayload(
      { reason: 'maintenance', autoRestore: true },
      META_REPLY,
      NOW
    ).ok,
    false
  );
  const future = new Date(NOW.getTime() + 60_000).toISOString();
  assertEquals(
    validateFeatureAvailabilityOffPayload(
      { reason: 'maintenance', autoRestore: true, expectedBackAt: future },
      META_REPLY,
      NOW
    ).ok,
    true
  );
});

Deno.test('superAdminBypass defaults true unless explicitly false', () => {
  const defaulted = validateFeatureAvailabilityOffPayload(
    { reason: 'maintenance' },
    META_REPLY,
    NOW
  );
  assertEquals(defaulted.ok && defaulted.fields.superAdminBypass, true);
  const explicitFalse = validateFeatureAvailabilityOffPayload(
    { reason: 'maintenance', superAdminBypass: false },
    META_REPLY,
    NOW
  );
  assertEquals(explicitFalse.ok && explicitFalse.fields.superAdminBypass, false);
});

Deno.test('turning a child on while its parent is off is a conflict (mirrors index.ts 409)', () => {
  const rows = [
    {
      feature_key: 'inbox.meta' as const,
      is_enabled: false,
      reason: 'maintenance' as const,
      message: null,
      expected_back_at: null,
      auto_restore: false,
      show_banner: false,
      super_admin_bypass: true,
    },
  ];
  const resolvedParent = resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, NOW).get(
    META_REPLY.parent!
  );
  assertEquals(resolvedParent?.available, false); // index.ts turns this into a 409
});
