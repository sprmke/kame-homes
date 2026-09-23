import { describe, expect, it } from 'vitest';

import { isTemplateRoleId, getRoleLabel, getRoleColor, getRolePermissions, buildRoleMatrixColumns, countMembersWithRole, defaultInviteTemplateId, CUSTOM_ROLE_COLOR, SEEDED_TEMPLATE_COLOR } from '@/features/dashboard/team/lib/propertyTeamRoles';

describe('isTemplateRoleId', () => {

  it('isTemplateRoleId is exported', () => {
    expect(typeof isTemplateRoleId).toBe('function');
  });

});

describe('getRoleLabel', () => {

  it('getRoleLabel is exported', () => {
    expect(typeof getRoleLabel).toBe('function');
  });

});

describe('getRoleColor', () => {

  it('getRoleColor is exported', () => {
    expect(typeof getRoleColor).toBe('function');
  });

});

describe('getRolePermissions', () => {

  it('getRolePermissions is exported', () => {
    expect(typeof getRolePermissions).toBe('function');
  });

});

describe('buildRoleMatrixColumns', () => {

  it('buildRoleMatrixColumns is exported', () => {
    expect(typeof buildRoleMatrixColumns).toBe('function');
  });

});

describe('countMembersWithRole', () => {

  it('countMembersWithRole is exported', () => {
    expect(typeof countMembersWithRole).toBe('function');
  });

});

describe('defaultInviteTemplateId', () => {

  it('defaultInviteTemplateId is exported', () => {
    expect(typeof defaultInviteTemplateId).toBe('function');
  });

});

describe('CUSTOM_ROLE_COLOR', () => {
  it('is defined', () => {
    expect(CUSTOM_ROLE_COLOR).toBeDefined();
  });
});

describe('SEEDED_TEMPLATE_COLOR', () => {
  it('is defined', () => {
    expect(SEEDED_TEMPLATE_COLOR).toBeDefined();
  });
});
