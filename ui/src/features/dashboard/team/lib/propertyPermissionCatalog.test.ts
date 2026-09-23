import { describe, expect, it } from 'vitest';

import { getCatalogPageNodes, getCatalogChildren, getCatalogLeafIds, getDescendantLeafIds } from '@/features/dashboard/team/lib/propertyPermissionCatalog';

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
