import { describe, expect, it } from 'vitest';

import { planLimitedTeamBannerMessage, planLimitedAccessDeniedTitle, planLimitedAccessDeniedMessage } from '@/features/dashboard/team/lib/planLimitedTeamCopy';

describe('planLimitedTeamBannerMessage', () => {

  it('planLimitedTeamBannerMessage is exported', () => {
    expect(typeof planLimitedTeamBannerMessage).toBe('function');
  });

});

describe('planLimitedAccessDeniedTitle', () => {

  it('planLimitedAccessDeniedTitle is exported', () => {
    expect(typeof planLimitedAccessDeniedTitle).toBe('function');
  });

});

describe('planLimitedAccessDeniedMessage', () => {

  it('planLimitedAccessDeniedMessage is exported', () => {
    expect(typeof planLimitedAccessDeniedMessage).toBe('function');
  });

});
