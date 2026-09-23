import { describe, expect, it } from 'vitest';

import { canEditOrgMemberContact, canEditPropertyMemberContact, memberContactLabel } from '@/features/dashboard/team/lib/teamMemberContact';

describe('canEditOrgMemberContact', () => {

  it('canEditOrgMemberContact is exported', () => {
    expect(typeof canEditOrgMemberContact).toBe('function');
  });

});

describe('canEditPropertyMemberContact', () => {

  it('canEditPropertyMemberContact is exported', () => {
    expect(typeof canEditPropertyMemberContact).toBe('function');
  });

});

describe('memberContactLabel', () => {

  it('memberContactLabel is exported', () => {
    expect(typeof memberContactLabel).toBe('function');
  });

});
