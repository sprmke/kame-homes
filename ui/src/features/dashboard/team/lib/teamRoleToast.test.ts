import { describe, expect, it } from 'vitest';

import { teamRoleToastMessage } from '@/features/dashboard/team/lib/teamRoleToast';

describe('teamRoleToastMessage', () => {

  it('teamRoleToastMessage is exported', () => {
    expect(typeof teamRoleToastMessage).toBe('function');
  });

});
