import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PARKING_ROLE_PERMISSIONS } from '@/features/dashboard/team/lib/parkingTeamConstants';
import { ORG_PERMISSION_CATALOG } from '@/features/dashboard/team/lib/orgPermissionCatalog';
import { ORG_TEAM_PERMISSIONS } from '@/features/dashboard/team/lib/orgTeamConstants';
import { SEEDED_TEMPLATE_PERMISSIONS } from '@/features/dashboard/team/lib/propertyTeamConstants';

const FUNCTIONS = resolve(import.meta.dirname, '../../../../../../supabase/functions/_shared');

/** Pull the quoted ids out of `KEY: [ ... ]` (or `KEY: [...ALL]` via `all`) in an edge source file. */
function edgeList(file: string, key: string, all: string[]): string[] {
  const source = readFileSync(resolve(FUNCTIONS, file), 'utf8');
  const match = source.match(new RegExp(`\\b${key}: \\[([\\s\\S]*?)\\],?\\n`));
  if (!match) throw new Error(`${key} not found in ${file}`);
  if (match[1].includes('...')) return all;
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const sorted = (ids: readonly string[]) => [...ids].sort();

describe('seeded team templates match between UI and edge', () => {
  it('property templates', () => {
    const all = SEEDED_TEMPLATE_PERMISSIONS['Full Access'];
    for (const [ui, edge] of [
      ['Operations', 'OPERATIONS'],
      ['Read Only', 'READ_ONLY'],
    ] as const) {
      expect(sorted(SEEDED_TEMPLATE_PERMISSIONS[ui]), ui).toEqual(
        sorted(edgeList('propertyTeamTemplates.ts', edge, all))
      );
    }
  });

  it('parking built-in roles', () => {
    const all = PARKING_ROLE_PERMISSIONS.MANAGER;
    for (const role of ['STAFF', 'VIEWER'] as const) {
      expect(sorted(PARKING_ROLE_PERMISSIONS[role]), role).toEqual(
        sorted(edgeList('parkingTeamPermissions.ts', role, all))
      );
    }
  });

  it('Operations gets no AI-spend leaves beyond text generation', () => {
    const ops = SEEDED_TEMPLATE_PERMISSIONS['Operations'];
    for (const leaf of [
      'marketing.generate.image:add',
      'marketing.generate.video:add',
      'analytics.aiReview:add',
      'pricing.smartPricing:edit',
    ]) {
      expect(ops).not.toContain(leaf);
    }
    expect(ops).toContain('marketing.generate:add');
  });
});

describe('org catalog renders every org permission', () => {
  it('each org leaf has a parent module node in the catalog', () => {
    const moduleKeys = new Set(
      ORG_PERMISSION_CATALOG.filter((node) => node.parentKey === null).map((node) => node.key)
    );
    const parentKeys = new Set(ORG_PERMISSION_CATALOG.map((node) => node.key));
    for (const permission of ORG_TEAM_PERMISSIONS) {
      const node = ORG_PERMISSION_CATALOG.find((n) => n.id === permission.id)!;
      const reachable =
        node.parentKey !== null &&
        (moduleKeys.has(node.parentKey) || parentKeys.has(node.parentKey));
      expect(reachable, `${permission.id} -> ${node.parentKey}`).toBe(true);
      // A leaf must hang off a real page node (directly or via a group), otherwise the role editor never shows it.
      const parent = ORG_PERMISSION_CATALOG.find((n) => n.key === node.parentKey);
      const page =
        parent?.parentKey === null
          ? parent
          : ORG_PERMISSION_CATALOG.find((n) => n.key === parent?.parentKey);
      expect(page?.parentKey ?? null, `${permission.id} has no page`).toBeNull();
    }
  });
});
