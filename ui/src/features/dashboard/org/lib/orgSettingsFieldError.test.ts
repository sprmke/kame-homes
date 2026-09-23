import { describe, expect, it } from 'vitest';

import { resolveOrgSettingsFieldError } from '@/features/dashboard/org/lib/orgSettingsFieldError';

describe('resolveOrgSettingsFieldError', () => {

  it('resolveOrgSettingsFieldError is exported', () => {
    expect(typeof resolveOrgSettingsFieldError).toBe('function');
  });

});
