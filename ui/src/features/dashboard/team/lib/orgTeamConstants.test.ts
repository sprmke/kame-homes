import { describe, expect, it } from 'vitest';

import { orgRoleConfig, getOrgRoleLabel, getOrgRoleColor, ORG_ROLES, ORG_PERMISSION_CATEGORIES } from '@/features/dashboard/team/lib/orgTeamConstants';

describe('orgRoleConfig', () => {

  it('orgRoleConfig is exported', () => {
    expect(typeof orgRoleConfig).toBe('function');
  });

});

describe('getOrgRoleLabel', () => {

  it('getOrgRoleLabel is exported', () => {
    expect(typeof getOrgRoleLabel).toBe('function');
  });

});

describe('getOrgRoleColor', () => {

  it('getOrgRoleColor is exported', () => {
    expect(typeof getOrgRoleColor).toBe('function');
  });

});

describe('ORG_ROLES', () => {
  it('is defined', () => {
    expect(ORG_ROLES).toBeDefined();
  });
});

describe('ORG_PERMISSION_CATEGORIES', () => {
  it('is defined', () => {
    expect(ORG_PERMISSION_CATEGORIES).toBeDefined();
  });
});
