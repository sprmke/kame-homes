import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { expandAccessPhase6PermissionIds } from '@/features/dashboard/team/lib/accessPermissionExpansion';
import { expandBookingsPhase3PermissionIds } from '@/features/dashboard/team/lib/bookingsPermissionExpansion';

const ROOT = resolve(import.meta.dirname, '../../../../../..');

/** Frozen expected expansions — update when edge `_shared/*PermissionExpansion.ts` changes. */
const ACCESS_UMBRELLA_EXPECTED: Record<string, readonly string[]> = {
  'notifications:edit': [
    'notifications.chat:edit',
    'notifications.marketing:edit',
    'notifications.staff:edit',
    'notifications.operations:edit',
    'notifications.finance:edit',
    'notifications.maintenance:edit',
  ],
  'inbox:reply': ['inbox.messages:edit'],
  'inbox:manage': [
    'inbox.channels:add',
    'inbox.channels:delete',
    'inbox.quickReplies:add',
    'inbox.quickReplies:edit',
    'inbox.quickReplies:delete',
    'inbox.automation:edit',
  ],
  'team:invite': ['team.invitations:add', 'team.invitations:edit', 'team.invitations:delete'],
  'team:manage': [
    'team.members:edit',
    'team.members:delete',
    'team.customRoles:add',
    'team.customRoles:edit',
    'team.customRoles:delete',
  ],
};

const BOOKINGS_UMBRELLA_EXPECTED: Record<string, readonly string[]> = {
  'bookings:edit': [
    'bookings.create:add',
    'bookings.detail.stay:edit',
    'bookings.detail.guests:edit',
    'bookings.detail.parking:edit',
    'bookings.detail.pets:edit',
    'bookings.detail.pricing:edit',
  ],
  'bookings:workflow': ['bookings.detail.workflow:edit'],
  'import:manage': ['bookings.import:add'],
};

function extractExpansionKeys(source: string, exportName: string): string[] {
  const re = new RegExp(`export const ${exportName}[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\n\\};`);
  const match = source.match(re);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)':/g)].map((m) => m[1]);
}

describe('permission expansion (doc 21)', () => {
  it('access umbrella keys match edge ACCESS_PHASE6_EXPANSION', () => {
    const edgeSource = readFileSync(
      resolve(ROOT, 'supabase/functions/_shared/accessPermissionExpansion.ts'),
      'utf8'
    );
    const edgeKeys = extractExpansionKeys(edgeSource, 'ACCESS_PHASE6_EXPANSION').sort();
    expect(Object.keys(ACCESS_UMBRELLA_EXPECTED).sort()).toEqual(edgeKeys);
  });

  it('expandAccessPhase6PermissionIds matches frozen umbrella table', () => {
    for (const [umbrella, expected] of Object.entries(ACCESS_UMBRELLA_EXPECTED)) {
      expect(expandAccessPhase6PermissionIds([umbrella])).toEqual([...expected]);
    }
  });

  it('bookings umbrella keys match edge BOOKINGS_PHASE3_EXPANSION', () => {
    const edgeSource = readFileSync(
      resolve(ROOT, 'supabase/functions/_shared/bookingsPermissionExpansion.ts'),
      'utf8'
    );
    const edgeKeys = extractExpansionKeys(edgeSource, 'BOOKINGS_PHASE3_EXPANSION').sort();
    expect(Object.keys(BOOKINGS_UMBRELLA_EXPECTED).sort()).toEqual(edgeKeys);
  });

  it('expandBookingsPhase3PermissionIds matches frozen umbrella table', () => {
    for (const [umbrella, expected] of Object.entries(BOOKINGS_UMBRELLA_EXPECTED)) {
      expect(expandBookingsPhase3PermissionIds([umbrella])).toEqual([...expected]);
    }
  });
});
