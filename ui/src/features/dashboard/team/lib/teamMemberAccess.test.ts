import { describe, expect, it } from 'vitest';

import { isTeamMemberActive, deactivateTeamMember, activateTeamMember } from '@/features/dashboard/team/lib/teamMemberAccess';

describe('isTeamMemberActive', () => {

  it('isTeamMemberActive is exported', () => {
    expect(typeof isTeamMemberActive).toBe('function');
  });

});

describe('deactivateTeamMember', () => {

  it('deactivateTeamMember is exported', () => {
    expect(typeof deactivateTeamMember).toBe('function');
  });

});

describe('activateTeamMember', () => {

  it('activateTeamMember is exported', () => {
    expect(typeof activateTeamMember).toBe('function');
  });

});
