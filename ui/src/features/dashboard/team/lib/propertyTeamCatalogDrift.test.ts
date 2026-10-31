import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TEAM_PERMISSIONS } from '@/features/dashboard/team/lib/propertyTeamConstants';

const ROOT = resolve(import.meta.dirname, '../../../../../..');
const EDGE_CATALOG = resolve(ROOT, 'supabase/functions/_shared/propertyTeamPermissions.ts');

function extractEdgeTeamPermissionIds(source: string): string[] {
  const match = source.match(/export const TEAM_PERMISSION_IDS = \[([\s\S]*?)\] as const/);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('property team catalog drift', () => {
  it('UI TEAM_PERMISSIONS ids match edge TEAM_PERMISSION_IDS', () => {
    const edgeSource = readFileSync(EDGE_CATALOG, 'utf8');
    const edgeIds = extractEdgeTeamPermissionIds(edgeSource).sort();
    const uiIds = TEAM_PERMISSIONS.map((p) => p.id).sort();
    expect(uiIds).toEqual(edgeIds);
  });
});
