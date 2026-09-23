import { describe, expect, it } from 'vitest';

import { teamInvitePhoneError, canSubmitTeamInvite } from '@/features/dashboard/team/lib/teamInviteContact';

describe('teamInvitePhoneError', () => {

  it('teamInvitePhoneError is exported', () => {
    expect(typeof teamInvitePhoneError).toBe('function');
  });

});

describe('canSubmitTeamInvite', () => {

  it('canSubmitTeamInvite is exported', () => {
    expect(typeof canSubmitTeamInvite).toBe('function');
  });

});
