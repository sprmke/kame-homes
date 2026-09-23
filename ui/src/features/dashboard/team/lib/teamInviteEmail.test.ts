import { describe, expect, it } from 'vitest';

import { isAllowedTeamInviteEmail, teamInviteEmailLooksInvalid, TEAM_INVITE_GMAIL_ONLY_MESSAGE } from '@/features/dashboard/team/lib/teamInviteEmail';

describe('isAllowedTeamInviteEmail', () => {

  it('isAllowedTeamInviteEmail is exported', () => {
    expect(typeof isAllowedTeamInviteEmail).toBe('function');
  });

});

describe('teamInviteEmailLooksInvalid', () => {

  it('teamInviteEmailLooksInvalid is exported', () => {
    expect(typeof teamInviteEmailLooksInvalid).toBe('function');
  });

});

describe('TEAM_INVITE_GMAIL_ONLY_MESSAGE', () => {
  it('is defined', () => {
    expect(TEAM_INVITE_GMAIL_ONLY_MESSAGE).toBeDefined();
  });
});
