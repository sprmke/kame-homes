import { describe, expect, it } from 'vitest';

import { isPropertyAdminRoleId, normalizeClientPermissionIds, PROPERTY_ADMIN_ROLE_ID, PERMISSION_CATEGORIES } from '@/features/dashboard/team/lib/propertyTeamConstants';

describe('isPropertyAdminRoleId', () => {

  it('isPropertyAdminRoleId is exported', () => {
    expect(typeof isPropertyAdminRoleId).toBe('function');
  });

});

describe('normalizeClientPermissionIds', () => {

  it('normalizeClientPermissionIds is exported', () => {
    expect(typeof normalizeClientPermissionIds).toBe('function');
  });

});

describe('PROPERTY_ADMIN_ROLE_ID', () => {
  it('is defined', () => {
    expect(PROPERTY_ADMIN_ROLE_ID).toBeDefined();
  });
});

describe('PERMISSION_CATEGORIES', () => {
  it('is defined', () => {
    expect(PERMISSION_CATEGORIES).toBeDefined();
  });
});
