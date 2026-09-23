import { describe, expect, it } from 'vitest';

import { isBuiltinRoleIdForScope, getRoleLabelForScope, getRoleColorForScope, getRolePermissionsForScope, buildRoleMatrixColumnsForScope, countMembersWithRole, CUSTOM_ROLE_COLOR } from '@/features/dashboard/team/lib/teamRoleHelpers';

describe('isBuiltinRoleIdForScope', () => {

  it('isBuiltinRoleIdForScope is exported', () => {
    expect(typeof isBuiltinRoleIdForScope).toBe('function');
  });

});

describe('getRoleLabelForScope', () => {

  it('getRoleLabelForScope is exported', () => {
    expect(typeof getRoleLabelForScope).toBe('function');
  });

});

describe('getRoleColorForScope', () => {

  it('getRoleColorForScope is exported', () => {
    expect(typeof getRoleColorForScope).toBe('function');
  });

});

describe('getRolePermissionsForScope', () => {

  it('getRolePermissionsForScope is exported', () => {
    expect(typeof getRolePermissionsForScope).toBe('function');
  });

});

describe('buildRoleMatrixColumnsForScope', () => {

  it('buildRoleMatrixColumnsForScope is exported', () => {
    expect(typeof buildRoleMatrixColumnsForScope).toBe('function');
  });

});

describe('countMembersWithRole', () => {

  it('countMembersWithRole is exported', () => {
    expect(typeof countMembersWithRole).toBe('function');
  });

});

describe('CUSTOM_ROLE_COLOR', () => {
  it('is defined', () => {
    expect(CUSTOM_ROLE_COLOR).toBeDefined();
  });
});
