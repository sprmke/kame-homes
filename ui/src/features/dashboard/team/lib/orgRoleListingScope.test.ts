import { describe, expect, it } from 'vitest';

import { orgListingAssignmentsFromPayload, orgListingScopeSummary, orgRoleListingDefaults, findOrgRoleById } from '@/features/dashboard/team/lib/orgRoleListingScope';

describe('orgListingAssignmentsFromPayload', () => {

  it('orgListingAssignmentsFromPayload is exported', () => {
    expect(typeof orgListingAssignmentsFromPayload).toBe('function');
  });

});

describe('orgListingScopeSummary', () => {

  it('orgListingScopeSummary is exported', () => {
    expect(typeof orgListingScopeSummary).toBe('function');
  });

});

describe('orgRoleListingDefaults', () => {

  it('orgRoleListingDefaults is exported', () => {
    expect(typeof orgRoleListingDefaults).toBe('function');
  });

});

describe('findOrgRoleById', () => {

  it('findOrgRoleById is exported', () => {
    expect(typeof findOrgRoleById).toBe('function');
  });

});
