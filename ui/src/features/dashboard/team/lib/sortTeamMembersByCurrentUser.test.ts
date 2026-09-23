import { describe, expect, it } from 'vitest';

import { normalizeTeamMemberEmail, isCurrentTeamMember, currentTeamMemberRowClassName } from '@/features/dashboard/team/lib/sortTeamMembersByCurrentUser';

describe('normalizeTeamMemberEmail', () => {

  it('normalizeTeamMemberEmail is exported', () => {
    expect(typeof normalizeTeamMemberEmail).toBe('function');
  });

});

describe('isCurrentTeamMember', () => {

  it('isCurrentTeamMember is exported', () => {
    expect(typeof isCurrentTeamMember).toBe('function');
  });

});

describe('currentTeamMemberRowClassName', () => {
  it('is defined', () => {
    expect(currentTeamMemberRowClassName).toBeDefined();
  });
});
