import { describe, expect, it } from 'vitest';

import { isOrgOwnerRoleId, resolveOrgMemberTemplateRoleId, getOrgMemberRoleLabel, getOrgMemberRoleColor, listSeededOrgRoleFilters, ORG_OWNER_ROLE_ID, ORG_LEGACY_ADMIN_ROLE_ID } from '@/features/dashboard/team/lib/orgMemberRoleDisplay';

describe('isOrgOwnerRoleId', () => {

  it('isOrgOwnerRoleId is exported', () => {
    expect(typeof isOrgOwnerRoleId).toBe('function');
  });

});

describe('resolveOrgMemberTemplateRoleId', () => {

  it('resolveOrgMemberTemplateRoleId is exported', () => {
    expect(typeof resolveOrgMemberTemplateRoleId).toBe('function');
  });

});

describe('getOrgMemberRoleLabel', () => {

  it('getOrgMemberRoleLabel is exported', () => {
    expect(typeof getOrgMemberRoleLabel).toBe('function');
  });

});

describe('getOrgMemberRoleColor', () => {

  it('getOrgMemberRoleColor is exported', () => {
    expect(typeof getOrgMemberRoleColor).toBe('function');
  });

});

describe('listSeededOrgRoleFilters', () => {

  it('listSeededOrgRoleFilters is exported', () => {
    expect(typeof listSeededOrgRoleFilters).toBe('function');
  });

});

describe('ORG_OWNER_ROLE_ID', () => {
  it('is defined', () => {
    expect(ORG_OWNER_ROLE_ID).toBeDefined();
  });
});

describe('ORG_LEGACY_ADMIN_ROLE_ID', () => {
  it('is defined', () => {
    expect(ORG_LEGACY_ADMIN_ROLE_ID).toBeDefined();
  });
});
