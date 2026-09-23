import { describe, expect, it } from 'vitest';

import { computeOrgSettingsCompletion, ORG_NAME_MAX_LENGTH } from '@/features/dashboard/org/lib/orgSettingsCompletion';

describe('computeOrgSettingsCompletion', () => {

  it('computeOrgSettingsCompletion is exported', () => {
    expect(typeof computeOrgSettingsCompletion).toBe('function');
  });

});

describe('ORG_NAME_MAX_LENGTH', () => {
  it('is defined', () => {
    expect(ORG_NAME_MAX_LENGTH).toBeDefined();
  });
});
