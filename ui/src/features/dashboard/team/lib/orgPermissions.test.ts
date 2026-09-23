import { describe, expect, it } from 'vitest';

import { hasOrgPermission, orgSectionPath, canAccessOrgScope, ORG_SECTION_VIEW_PERMISSION } from '@/features/dashboard/team/lib/orgPermissions';

describe('hasOrgPermission', () => {

  it('hasOrgPermission is exported', () => {
    expect(typeof hasOrgPermission).toBe('function');
  });

});

describe('orgSectionPath', () => {

  it('orgSectionPath is exported', () => {
    expect(typeof orgSectionPath).toBe('function');
  });

});

describe('canAccessOrgScope', () => {

  it('canAccessOrgScope is exported', () => {
    expect(typeof canAccessOrgScope).toBe('function');
  });

});

describe('ORG_SECTION_VIEW_PERMISSION', () => {
  it('is defined', () => {
    expect(ORG_SECTION_VIEW_PERMISSION).toBeDefined();
  });
});
