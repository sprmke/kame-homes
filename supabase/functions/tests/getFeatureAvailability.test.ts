/**
 * get-feature-availability — the pure entry-builder `index.ts` delegates to.
 * `index.ts` isn't imported directly: it calls `serve()` at module scope via
 * `serveAuthenticated`, which binds a port and never returns (see
 * `authWrapperRejection.test.ts`'s note).
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import type { AuthenticatedUser } from '../_shared/orgAuth.ts';
import { buildFeatureAvailabilityEntries } from '../_shared/featureAvailabilityPublicEntries.ts';
import type { FeatureAvailabilityOverrideRow } from '../_shared/featureAvailabilityResolve.ts';

const NOW = new Date('2026-10-25T12:00:00.000Z');

function row(overrides: Partial<FeatureAvailabilityOverrideRow>): FeatureAvailabilityOverrideRow {
  return {
    feature_key: 'inbox.meta',
    is_enabled: false,
    reason: 'maintenance',
    message: null,
    expected_back_at: null,
    auto_restore: false,
    show_banner: false,
    super_admin_bypass: true,
    updated_at: '2026-10-25T10:00:00.000Z',
    ...overrides,
  };
}

function user(email: string): AuthenticatedUser {
  return { id: 'u1', email } as AuthenticatedUser;
}

Deno.test('no rows → empty entries (everything available, nothing to report)', () => {
  const entries = buildFeatureAvailabilityEntries([], NOW, undefined);
  assertEquals(entries, []);
});

Deno.test('an off key is reported unavailable for a regular host', () => {
  const entries = buildFeatureAvailabilityEntries([row({})], NOW, user('host@kame.test'));
  const entry = entries.find((e) => e.key === 'inbox.meta')!;
  assertEquals(entry.available, false);
  assertEquals(entry.bypassed, false);
  assertEquals(entry.reason, 'maintenance');
  assertEquals(entry.updatedAt, '2026-10-25T10:00:00.000Z');
});

Deno.test('a cascaded child reports the parent reason and the parent sourceKey updatedAt', () => {
  const entries = buildFeatureAvailabilityEntries(
    [row({ feature_key: 'inbox.meta', updated_at: '2026-10-25T09:00:00.000Z' })],
    NOW,
    undefined
  );
  const child = entries.find((e) => e.key === 'inbox.meta.reply')!;
  assertEquals(child.source, 'parent');
  assertEquals(child.reason, 'maintenance');
  assertEquals(child.updatedAt, '2026-10-25T09:00:00.000Z');
});

Deno.test('super admin with bypass sees available: true but bypassed: true', async () => {
  const previous = Deno.env.get('SUPER_ADMIN_EMAILS');
  Deno.env.set('SUPER_ADMIN_EMAILS', 'super@kame.test');
  try {
    const entries = buildFeatureAvailabilityEntries(
      [row({ super_admin_bypass: true })],
      NOW,
      user('super@kame.test')
    );
    const entry = entries.find((e) => e.key === 'inbox.meta')!;
    assertEquals(entry.available, true);
    assertEquals(entry.bypassed, true);
  } finally {
    if (previous === undefined) Deno.env.delete('SUPER_ADMIN_EMAILS');
    else Deno.env.set('SUPER_ADMIN_EMAILS', previous);
  }
});

Deno.test('available keys never appear in the entries list', () => {
  const entries = buildFeatureAvailabilityEntries(
    [row({ feature_key: 'inbox.meta.reply' })],
    NOW,
    undefined
  );
  const parent = entries.find((e) => e.key === 'inbox.meta');
  assertEquals(parent, undefined);
  const unrelated = entries.find((e) => e.key === 'pricing.channel_sync');
  assertEquals(unrelated, undefined);
});
