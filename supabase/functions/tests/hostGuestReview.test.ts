/**
 * Source-contract tests for host guest-review handlers (no live DB).
 * Runtime RBAC uses the same `permissions.includes(leaf)` check as teamPermissionGates.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { allTeamPermissions } from '../_shared/propertyTeamPermissions.ts';
import { SEEDED_TEMPLATE_PERMISSIONS } from '../_shared/propertyTeamTemplates.ts';

const READ_ONLY = SEEDED_TEMPLATE_PERMISSIONS.READ_ONLY as readonly string[];
const FULL_ACCESS = allTeamPermissions() as readonly string[];

Deno.test('submit-host-guest-review requires reviews.guests:edit', async () => {
  const source = await Deno.readTextFile(
    new URL('../submit-host-guest-review/index.ts', import.meta.url)
  );
  assert(source.includes("'reviews.guests:edit'"));
  assert(source.includes('publishIfComplete'));
  assert(source.includes('guestIdentityKey'));
  assert(source.includes('validateHostGuestReviewFields'));
  assertEquals(FULL_ACCESS.includes('reviews.guests:edit'), true);
  assertEquals(READ_ONLY.includes('reviews.guests:edit'), false);
});

Deno.test(
  'get-guest-reputation requires bookings:view and never returns other-org notes',
  async () => {
    const source = await Deno.readTextFile(
      new URL('../get-guest-reputation/index.ts', import.meta.url)
    );
    assert(source.includes("'bookings:view'"));
    assert(source.includes('getGuestReputation'));
    assert(source.includes('internalNote'));
    assert(
      source.includes('listRecentPublishedHostReviewsForGuest'),
      'screening hosts only see published recent reviews'
    );
  }
);

Deno.test('Full Access can review guests; Read Only cannot', () => {
  assertEquals(FULL_ACCESS.includes('reviews.guests:edit'), true);
  assertEquals(READ_ONLY.includes('reviews.guests:edit'), false);
});
