/**
 * featureAvailability — pure-helper coverage (no live Supabase client).
 * Run: deno test --no-check --allow-env --allow-net supabase/functions/_shared/featureAvailability_test.ts
 *
 * No SUPABASE_* env vars are set in the test runner, so `createServiceClient()` throws
 * inside `loadOverrideRows`'s try/catch — exercising the real fail-open path, same
 * pattern as `activityLog_test.ts`'s "never throw when the client cannot be built".
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { AuthenticatedUser } from './orgAuth.ts';
import {
  FeatureUnavailableError,
  catchFeatureUnavailableError,
  featureUnavailableResponse,
  isBypassedByUser,
  isFeatureAvailable,
  mapTelegramSendErrorToNotifySkip,
  resetFeatureAvailabilityCacheForTests,
  resolveFeatureUnavailableMessage,
} from './featureAvailability.ts';
import type { ResolvedFeatureAvailability } from './featureAvailabilityResolve.ts';

function user(email: string): AuthenticatedUser {
  return { id: 'u1', email } as AuthenticatedUser;
}

function unavailable(
  overrides: Partial<ResolvedFeatureAvailability> = {}
): ResolvedFeatureAvailability {
  return {
    key: 'inbox.meta',
    available: false,
    source: 'self',
    sourceKey: 'inbox.meta',
    reason: 'maintenance',
    message: null,
    expectedBackAt: null,
    autoRestore: false,
    showBanner: false,
    superAdminBypass: true,
    overdue: false,
    restoredAutomatically: false,
    ...overrides,
  };
}

Deno.test('isBypassedByUser — only with a user, bypass flag, and allow-listed email', () => {
  const previous = Deno.env.get('SUPER_ADMIN_EMAILS');
  Deno.env.set('SUPER_ADMIN_EMAILS', 'super@kame.test');
  try {
    const resolved = unavailable({ superAdminBypass: true });
    assertEquals(isBypassedByUser(resolved, user('super@kame.test')), true);
    assertEquals(isBypassedByUser(resolved, user('host@kame.test')), false);
    assertEquals(isBypassedByUser(resolved, undefined), false);
    assertEquals(
      isBypassedByUser({ ...resolved, superAdminBypass: false }, user('super@kame.test')),
      false
    );
  } finally {
    if (previous === undefined) Deno.env.delete('SUPER_ADMIN_EMAILS');
    else Deno.env.set('SUPER_ADMIN_EMAILS', previous);
  }
});

Deno.test('background jobs never bypass — no user means no bypass regardless of flags', () => {
  const resolved = unavailable({ superAdminBypass: true });
  assertEquals(isBypassedByUser(resolved, undefined), false);
});

Deno.test(
  'resolveFeatureUnavailableMessage — custom message wins; default substitutes {provider}',
  () => {
    const custom = unavailable({ message: 'Back by 3pm.' });
    assertEquals(resolveFeatureUnavailableMessage(custom), 'Back by 3pm.');

    const providerIssue = unavailable({
      reason: 'provider_issue',
      sourceKey: 'inbox.meta',
      message: null,
    });
    assert(resolveFeatureUnavailableMessage(providerIssue).includes('Meta'));
  }
);

Deno.test(
  'FeatureUnavailableError / catchFeatureUnavailableError round-trip into a 503',
  async () => {
    const err = new FeatureUnavailableError(unavailable({ reason: 'paused' }));
    const req = new Request('https://x.test/');
    const res = catchFeatureUnavailableError(req, err);
    assert(res);
    assertEquals(res!.status, 503);
    const body = await res!.json();
    assertEquals(body.code, 'FEATURE_UNAVAILABLE');
    assertEquals(body.feature, 'inbox.meta');

    assertEquals(catchFeatureUnavailableError(req, new Error('other')), null);
  }
);

Deno.test(
  'read error fails open: isFeatureAvailable / featureUnavailableResponse → available',
  async () => {
    resetFeatureAvailabilityCacheForTests();
    const available = await isFeatureAvailable('inbox.meta');
    assertEquals(available, true);

    const req = new Request('https://x.test/');
    const res = await featureUnavailableResponse(req, 'inbox.meta');
    assertEquals(res, null);
  }
);

Deno.test(
  'cache: resetFeatureAvailabilityCacheForTests clears the isolate cache between tests',
  async () => {
    resetFeatureAvailabilityCacheForTests();
    const first = await isFeatureAvailable('pricing.channel_sync');
    const second = await isFeatureAvailable('pricing.channel_sync');
    assertEquals(first, true);
    assertEquals(second, true);
    resetFeatureAvailabilityCacheForTests();
  }
);

Deno.test('mapTelegramSendErrorToNotifySkip maps delivery pause to feature_unavailable', () => {
  assertEquals(mapTelegramSendErrorToNotifySkip('feature_unavailable'), 'feature_unavailable');
  assertEquals(mapTelegramSendErrorToNotifySkip('missing_env'), 'missing_env');
  assertEquals(mapTelegramSendErrorToNotifySkip('network'), 'send_failed');
});
