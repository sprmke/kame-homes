/**
 * Doc 21 / 29 — permission umbrella → leaf expansion (no network).
 * Run: deno test supabase/functions/_shared/permissionExpansion_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { expandAccessPhase6PermissionIds } from './accessPermissionExpansion.ts';
import { expandBookingsPhase3PermissionIds } from './bookingsPermissionExpansion.ts';
import { expandLegacyPropertyPermissionIds } from './legacyPermissionExpansion.ts';
import { expandOpsPhase4PermissionIds } from './opsPermissionExpansion.ts';
import { expandSettingsPhase5PermissionIds } from './settingsPermissionExpansion.ts';
import { expandLegacyOrgPermissionIds } from './orgLegacyPermissionExpansion.ts';

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

Deno.test('expandOpsPhase4 expands finance:edit transaction leaves', () => {
  const out = expandOpsPhase4PermissionIds(['finance:edit']);
  assertEquals(out.includes('finance.transactions:add'), true);
  assertEquals(out.length, 4);
});

Deno.test('expandSettingsPhase5 expands settings:view integrations leaf', () => {
  assertEquals(expandSettingsPhase5PermissionIds(['settings:view']), [
    'settings:view',
    'settings.integrations:view',
  ]);
});

Deno.test('expandLegacyOrgPermissionIds drops org:import:manage', () => {
  assertEquals(expandLegacyOrgPermissionIds(['org:import:manage']), []);
});

Deno.test('expandLegacyOrgPermissionIds expands org:team:manage', () => {
  const out = expandLegacyOrgPermissionIds(['org:team:manage']).sort();
  assertEquals(
    out,
    [
      'org.team.invitations:delete',
      'org.team.invitations:edit',
      'org.team.members:delete',
      'org.team.members:edit',
    ].sort()
  );
});
