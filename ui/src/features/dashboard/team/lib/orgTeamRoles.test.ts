import { describe, expect, it } from 'vitest';

import { isOrgAdminRoleId, getOrgRoleLabel, getOrgRoleColor, getOrgRolePermissions, defaultOrgInviteTemplateId, buildOrgTemplateMatrixColumns, countOrgMembersWithTemplateRole, ORG_CUSTOM_ROLE_COLOR, ORG_SEEDED_TEMPLATE_COLOR } from '@/features/dashboard/team/lib/orgTeamRoles';

describe('isOrgAdminRoleId', () => {

  it('isOrgAdminRoleId is exported', () => {
    expect(typeof isOrgAdminRoleId).toBe('function');
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

describe('getOrgRolePermissions', () => {

  it('getOrgRolePermissions is exported', () => {
    expect(typeof getOrgRolePermissions).toBe('function');
  });

});

describe('defaultOrgInviteTemplateId', () => {

  it('defaultOrgInviteTemplateId is exported', () => {
    expect(typeof defaultOrgInviteTemplateId).toBe('function');
  });

});

describe('buildOrgTemplateMatrixColumns', () => {

  it('buildOrgTemplateMatrixColumns is exported', () => {
    expect(typeof buildOrgTemplateMatrixColumns).toBe('function');
  });

});

describe('countOrgMembersWithTemplateRole', () => {

  it('countOrgMembersWithTemplateRole is exported', () => {
    expect(typeof countOrgMembersWithTemplateRole).toBe('function');
  });

});

describe('ORG_CUSTOM_ROLE_COLOR', () => {
  it('is defined', () => {
    expect(ORG_CUSTOM_ROLE_COLOR).toBeDefined();
  });
});

describe('ORG_SEEDED_TEMPLATE_COLOR', () => {
  it('is defined', () => {
    expect(ORG_SEEDED_TEMPLATE_COLOR).toBeDefined();
  });
});
