/**
 * Team permissions plan-coverage leaves (no network).
 * Run: deno test supabase/functions/_shared/teamPermissionLeaves_test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { ORG_PERMISSION_IDS, ORG_ROLE_PERMISSIONS } from './orgTeamPermissions.ts';
import {
  BUILTIN_PARKING_ROLE_PERMISSIONS,
  PARKING_TEAM_PERMISSION_IDS,
} from './parkingTeamPermissions.ts';
import { allTeamPermissions, normalizePermissionIds } from './propertyTeamPermissions.ts';
import { SEEDED_TEMPLATE_PERMISSIONS } from './propertyTeamTemplates.ts';

const NEW_PROPERTY_LEAVES = [
  'marketing.generate.image:add',
  'pricing.smartPricing:edit',
  'analytics.aiReview:add',
  'assistant:view',
  'activity:view',
] as const;

Deno.test('new property leaves are in the catalog and implicit full access', () => {
  const all = allTeamPermissions();
  for (const leaf of NEW_PROPERTY_LEAVES) assertEquals(all.includes(leaf), true, leaf);
});

Deno.test(
  'text generation does not imply image generation (leaves stay individually revocable)',
  () => {
    const out = normalizePermissionIds(['marketing:view', 'marketing.generate:add']);
    assertEquals(out.includes('marketing.generate:add'), true);
    assertEquals(out.includes('marketing.generate.image:add'), false);
  }
);

Deno.test('pricing rates do not imply smart pricing', () => {
  assertEquals(
    normalizePermissionIds(['pricing.rates:edit']).includes('pricing.smartPricing:edit'),
    false
  );
});

Deno.test('Operations keeps text generation but gets no AI-spend leaves', () => {
  const ops = SEEDED_TEMPLATE_PERMISSIONS.OPERATIONS as readonly string[];
  assertEquals(ops.includes('marketing.generate:add'), true);
  for (const leaf of [
    'marketing.generate.image:add',
    'marketing.generate.video:add',
    'analytics.aiReview:add',
    'pricing.smartPricing:edit',
  ]) {
    assertEquals(ops.includes(leaf), false, leaf);
  }
});

Deno.test('Full Access holds every leaf; Read Only holds only view leaves', () => {
  assertEquals(SEEDED_TEMPLATE_PERMISSIONS.FULL_ACCESS.length, allTeamPermissions().length);
  for (const id of SEEDED_TEMPLATE_PERMISSIONS.READ_ONLY) {
    assertEquals(id.endsWith(':view'), true, id);
  }
});

Deno.test("parking and org activity leaves exist and default roles keep today's access", () => {
  assertEquals((PARKING_TEAM_PERMISSION_IDS as readonly string[]).includes('activity:view'), true);
  assertEquals(BUILTIN_PARKING_ROLE_PERMISSIONS.VIEWER.includes('activity:view'), true);
  assertEquals((ORG_PERMISSION_IDS as readonly string[]).includes('org.activity:view'), true);
  assertEquals(ORG_ROLE_PERMISSIONS.ADMIN.includes('org.activity:view'), true);
});
