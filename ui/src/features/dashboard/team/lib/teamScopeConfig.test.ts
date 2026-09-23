import { describe, expect, it } from 'vitest';

import { getTeamScopeConfig } from '@/features/dashboard/team/lib/teamScopeConfig';

describe('getTeamScopeConfig', () => {

  it('getTeamScopeConfig is exported', () => {
    expect(typeof getTeamScopeConfig).toBe('function');
  });

});
