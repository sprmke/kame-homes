/**
 * Doc 21 / 29 — permission umbrella → leaf expansion (no network).
 * Run: deno test supabase/functions/_shared/permissionExpansion_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { expandAccessPhase6PermissionIds } from './accessPermissionExpansion.ts';
import { expandBookingsPhase3PermissionIds } from './bookingsPermissionExpansion.ts';
import { expandLegacyPropertyPermissionIds } from './legacyPermissionExpansion.ts';

Deno.test('expandAccessPhase6 expands team:manage to member + custom-role leaves', () => {
  const out = expandAccessPhase6PermissionIds(['team:manage']);
  assertEquals(out.includes('team.members:edit'), true);
  assertEquals(out.includes('team.customRoles:add'), true);
  assertEquals(out.length, 5);
});

Deno.test('expandAccessPhase6 dedupes overlapping expansions', () => {
  const out = expandAccessPhase6PermissionIds(['team:invite', 'team.invitations:add']);
  assertEquals(out.filter((id) => id === 'team.invitations:add').length, 1);
});

Deno.test('expandAccessPhase6 passes through unknown ids unchanged', () => {
  assertEquals(expandAccessPhase6PermissionIds(['bookings.create:add']), ['bookings.create:add']);
});

Deno.test('expandBookingsPhase3 expands bookings:edit workflow leaves', () => {
  const out = expandBookingsPhase3PermissionIds(['bookings:edit']);
  assertEquals(out.includes('bookings.detail.workflow:edit'), false);
  assertEquals(out.includes('bookings.detail.stay:edit'), true);
  assertEquals(out.length, 6);
});

Deno.test('expandLegacyPropertyPermissionIds chains bookings then access', () => {
  const out = expandLegacyPropertyPermissionIds(['bookings:workflow', 'inbox:reply']);
  assertEquals(out.includes('bookings.detail.workflow:edit'), true);
  assertEquals(out.includes('inbox.messages:edit'), true);
});
