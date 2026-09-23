import { describe, expect, it } from 'vitest';

import {
  canInviteTeamMember,
  countPropertyTeamSlotsUsed,
  DEFAULT_PLAN_FEATURES,
  isFeatureEnabled,
} from '@/features/dashboard/plans/lib/planFeatures';

const proFeatures = {
  ...DEFAULT_PLAN_FEATURES,
  calendarSync: true,
  teamManagement: { enabled: true, maxMembers: 5 },
};

describe('isFeatureEnabled', () => {
  it('reads boolean feature flags', () => {
    expect(isFeatureEnabled(proFeatures, 'calendarSync')).toBe(true);
    expect(isFeatureEnabled(DEFAULT_PLAN_FEATURES, 'calendarSync')).toBe(false);
  });

  it('treats teamManagement as enabled flag', () => {
    expect(isFeatureEnabled(proFeatures, 'teamManagement')).toBe(true);
    expect(isFeatureEnabled(DEFAULT_PLAN_FEATURES, 'teamManagement')).toBe(false);
  });
});

describe('countPropertyTeamSlotsUsed', () => {
  it('counts active members and pending invitations', () => {
    expect(
      countPropertyTeamSlotsUsed(
        [{ status: 'active' }, { status: 'inactive' }, { status: 'active' }],
        [{ status: 'pending' }, { status: 'accepted' }]
      )
    ).toBe(3);
  });
});

describe('canInviteTeamMember', () => {
  it('blocks when team management disabled', () => {
    expect(canInviteTeamMember(DEFAULT_PLAN_FEATURES, 0)).toBe(false);
  });

  it('allows invite under maxMembers', () => {
    expect(canInviteTeamMember(proFeatures, 4)).toBe(true);
    expect(canInviteTeamMember(proFeatures, 5)).toBe(false);
  });
});
