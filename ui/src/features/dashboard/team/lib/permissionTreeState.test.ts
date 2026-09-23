import { describe, expect, it } from 'vitest';

import { permissionSetEqual, findMatchingTemplate, parentTriState, toggleLeafPermission, toggleParentPermissions, filterCatalogBySearch, filterPagesDifferingFromTemplate, catalogHasAnyVisible } from '@/features/dashboard/team/lib/permissionTreeState';

describe('permissionSetEqual', () => {

  it('permissionSetEqual is exported', () => {
    expect(typeof permissionSetEqual).toBe('function');
  });

});

describe('findMatchingTemplate', () => {

  it('findMatchingTemplate is exported', () => {
    expect(typeof findMatchingTemplate).toBe('function');
  });

});

describe('parentTriState', () => {

  it('parentTriState is exported', () => {
    expect(typeof parentTriState).toBe('function');
  });

});

describe('toggleLeafPermission', () => {

  it('toggleLeafPermission is exported', () => {
    expect(typeof toggleLeafPermission).toBe('function');
  });

});

describe('toggleParentPermissions', () => {

  it('toggleParentPermissions is exported', () => {
    expect(typeof toggleParentPermissions).toBe('function');
  });

});

describe('filterCatalogBySearch', () => {

  it('filterCatalogBySearch is exported', () => {
    expect(typeof filterCatalogBySearch).toBe('function');
  });

});

describe('filterPagesDifferingFromTemplate', () => {

  it('filterPagesDifferingFromTemplate is exported', () => {
    expect(typeof filterPagesDifferingFromTemplate).toBe('function');
  });

});

describe('catalogHasAnyVisible', () => {

  it('catalogHasAnyVisible is exported', () => {
    expect(typeof catalogHasAnyVisible).toBe('function');
  });

});
