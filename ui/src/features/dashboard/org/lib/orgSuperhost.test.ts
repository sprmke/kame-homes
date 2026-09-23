import { describe, expect, it } from 'vitest';

import { readOrgSuperhostFromSettings, isOrgSuperhostEarned } from '@/features/dashboard/org/lib/orgSuperhost';

describe('readOrgSuperhostFromSettings', () => {

  it('readOrgSuperhostFromSettings is exported', () => {
    expect(typeof readOrgSuperhostFromSettings).toBe('function');
  });

});

describe('isOrgSuperhostEarned', () => {

  it('isOrgSuperhostEarned is exported', () => {
    expect(typeof isOrgSuperhostEarned).toBe('function');
  });

});
