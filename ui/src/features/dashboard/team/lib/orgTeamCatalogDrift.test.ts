import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ORG_TEAM_PERMISSIONS } from '@/features/dashboard/team/lib/orgTeamConstants';

const ROOT = resolve(import.meta.dirname, '../../../../../..');
const EDGE_CATALOG = resolve(ROOT, 'supabase/functions/_shared/orgTeamPermissions.ts');

function extractEdgeOrgPermissionIds(source: string): string[] {
  const match = source.match(/export const ORG_PERMISSION_IDS = \[([\s\S]*?)\] as const/);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('org team catalog drift', () => {
  it('UI ORG_TEAM_PERMISSIONS ids match edge ORG_PERMISSION_IDS', () => {
    const edgeSource = readFileSync(EDGE_CATALOG, 'utf8');
    const edgeIds = extractEdgeOrgPermissionIds(edgeSource).sort();
    const uiIds = ORG_TEAM_PERMISSIONS.map((p) => p.id).sort();
    expect(uiIds).toEqual(edgeIds);
  });
});
