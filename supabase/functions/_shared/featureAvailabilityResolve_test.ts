/**
 * featureAvailabilityResolve — pure-helper coverage (no Supabase / network).
 * Run: deno test --no-check --allow-env --allow-net supabase/functions/_shared/featureAvailabilityResolve_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { FEATURE_AVAILABILITY_CATALOG } from './featureAvailabilityCatalog.ts';
import {
  resolveFeatureAvailability,
  type FeatureAvailabilityOverrideRow,
} from './featureAvailabilityResolve.ts';

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
    ...overrides,
  };
}

Deno.test('no row for a key → available everywhere', () => {
  const resolved = resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, [], NOW);
  for (const entry of FEATURE_AVAILABILITY_CATALOG) {
    const r = resolved.get(entry.key)!;
    assertEquals(r.available, true, entry.key);
    assertEquals(r.source, null, entry.key);
  }
});

Deno.test('self off → unavailable with source self and its own reason', () => {
  const rows = [row({ feature_key: 'inbox.meta.sync', reason: 'paused' })];
  const resolved = resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, NOW);
  const r = resolved.get('inbox.meta.sync')!;
  assertEquals(r.available, false);
  assertEquals(r.source, 'self');
  assertEquals(r.sourceKey, 'inbox.meta.sync');
  assertEquals(r.reason, 'paused');
});

Deno.test('parent off cascades to child, reporting the parent reason', () => {
  const rows = [row({ feature_key: 'inbox.meta', reason: 'maintenance' })];
  const resolved = resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, NOW);

  const child = resolved.get('inbox.meta.reply')!;
  assertEquals(child.available, false);
  assertEquals(child.source, 'parent');
  assertEquals(child.sourceKey, 'inbox.meta');
  assertEquals(child.reason, 'maintenance');

  const parent = resolved.get('inbox.meta')!;
  assertEquals(parent.available, false);
  assertEquals(parent.source, 'self');
});

Deno.test('child off with parent on → only the child is unavailable', () => {
  const rows = [row({ feature_key: 'inbox.meta.reply', reason: 'paused' })];
  const resolved = resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, NOW);

  assertEquals(resolved.get('inbox.meta.reply')!.available, false);
  assertEquals(resolved.get('inbox.meta')!.available, true);
  assertEquals(resolved.get('inbox.meta.connect')!.available, true);
});

Deno.test('auto restore: future expected_back_at → still off; past → available', () => {
  const future = new Date(NOW.getTime() + 60_000).toISOString();
  const past = new Date(NOW.getTime() - 60_000).toISOString();

  const stillOff = resolveFeatureAvailability(
    FEATURE_AVAILABILITY_CATALOG,
    [row({ feature_key: 'inbox.meta', auto_restore: true, expected_back_at: future })],
    NOW
  ).get('inbox.meta')!;
  assertEquals(stillOff.available, false);

  const restored = resolveFeatureAvailability(
    FEATURE_AVAILABILITY_CATALOG,
    [row({ feature_key: 'inbox.meta', auto_restore: true, expected_back_at: past })],
    NOW
  ).get('inbox.meta')!;
  assertEquals(restored.available, true);
  assertEquals(restored.restoredAutomatically, true);
});

Deno.test(
  'overdue: expected_back_at passed without auto restore → still off, flagged overdue',
  () => {
    const past = new Date(NOW.getTime() - 60_000).toISOString();
    const resolved = resolveFeatureAvailability(
      FEATURE_AVAILABILITY_CATALOG,
      [row({ feature_key: 'inbox.meta', auto_restore: false, expected_back_at: past })],
      NOW
    ).get('inbox.meta')!;
    assertEquals(resolved.available, false);
    assertEquals(resolved.overdue, true);
  }
);

Deno.test('not overdue when expected_back_at is still in the future', () => {
  const future = new Date(NOW.getTime() + 60_000).toISOString();
  const resolved = resolveFeatureAvailability(
    FEATURE_AVAILABILITY_CATALOG,
    [row({ feature_key: 'inbox.meta', auto_restore: false, expected_back_at: future })],
    NOW
  ).get('inbox.meta')!;
  assertEquals(resolved.available, false);
  assertEquals(resolved.overdue, false);
});

Deno.test('unknown key in the override table is ignored by the resolver', () => {
  const rows = [row({ feature_key: 'not.a.real.key' })];
  const resolved = resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, NOW);
  for (const entry of FEATURE_AVAILABILITY_CATALOG) {
    assertEquals(resolved.get(entry.key)!.available, true, entry.key);
  }
});

Deno.test('re-enabled row (is_enabled true) with stale reason fields → available', () => {
  const rows = [row({ feature_key: 'inbox.meta', is_enabled: true, reason: 'maintenance' })];
  const resolved = resolveFeatureAvailability(FEATURE_AVAILABILITY_CATALOG, rows, NOW).get(
    'inbox.meta'
  )!;
  assertEquals(resolved.available, true);
  assertEquals(resolved.reason, null);
});
