import { describe, expect, it } from 'vitest';

import { handleRoleSelectChange, ADD_CUSTOM_ROLE_VALUE } from '@/features/dashboard/team/lib/roleSelectUtils';

describe('handleRoleSelectChange', () => {

  it('handleRoleSelectChange is exported', () => {
    expect(typeof handleRoleSelectChange).toBe('function');
  });

});

describe('ADD_CUSTOM_ROLE_VALUE', () => {
  it('is defined', () => {
    expect(ADD_CUSTOM_ROLE_VALUE).toBeDefined();
  });
});
