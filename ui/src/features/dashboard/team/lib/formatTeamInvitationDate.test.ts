import { describe, expect, it } from 'vitest';

import { formatTeamInvitationDate } from '@/features/dashboard/team/lib/formatTeamInvitationDate';

describe('formatTeamInvitationDate', () => {

  it('formatTeamInvitationDate is exported', () => {
    expect(typeof formatTeamInvitationDate).toBe('function');
  });

});
