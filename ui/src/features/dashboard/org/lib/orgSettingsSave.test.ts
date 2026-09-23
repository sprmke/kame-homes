import { describe, expect, it } from 'vitest';

import { planOrgSettingsSave } from '@/features/dashboard/org/lib/orgSettingsSave';

describe('planOrgSettingsSave', () => {

  it('planOrgSettingsSave is exported', () => {
    expect(typeof planOrgSettingsSave).toBe('function');
  });

});
