import { describe, expect, it } from 'vitest';

import {
  getCatalogPageNodes,
  getCatalogChildren,
  getCatalogLeafIds,
  getDescendantLeafIds,
} from '@/features/dashboard/team/lib/propertyPermissionCatalog';

describe('getCatalogPageNodes', () => {
  it('getCatalogPageNodes is exported', () => {
    expect(typeof getCatalogPageNodes).toBe('function');
  });
});

describe('getCatalogChildren', () => {
  it('getCatalogChildren is exported', () => {
    expect(typeof getCatalogChildren).toBe('function');
  });
});

describe('getCatalogLeafIds', () => {
  it('getCatalogLeafIds is exported', () => {
    expect(typeof getCatalogLeafIds).toBe('function');
  });
});

describe('getDescendantLeafIds', () => {
  it('getDescendantLeafIds is exported', () => {
    expect(typeof getDescendantLeafIds).toBe('function');
  });
});

describe('property catalog tree reaches every leaf', () => {
  it('every permission leaf hangs off a page node, including Assistant and Activity', async () => {
    const { PROPERTY_PERMISSION_CATALOG } =
      await import('@/features/dashboard/team/lib/propertyPermissionCatalog');
    const { TEAM_PERMISSIONS } =
      await import('@/features/dashboard/team/lib/propertyTeamConstants');
    const pages = getCatalogPageNodes().map((node) => node.key);
    expect(pages).toEqual(expect.arrayContaining(['assistant', 'activity', 'analytics']));

    const reachable = new Set(pages.flatMap((page) => getDescendantLeafIds(page)));
    for (const permission of TEAM_PERMISSIONS) {
      expect(reachable.has(permission.id), permission.id).toBe(true);
    }
    expect(PROPERTY_PERMISSION_CATALOG.length).toBeGreaterThan(0);
  });
});
