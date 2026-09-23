import { describe, expect, it } from 'vitest';

import { resolveOrgLandingPath, userOwnsOrganization, HOST_VERIFICATION_REJECTED_PATH } from '@/features/dashboard/org/lib/orgLanding';

describe('resolveOrgLandingPath', () => {

  it('resolveOrgLandingPath is exported', () => {
    expect(typeof resolveOrgLandingPath).toBe('function');
  });

});

describe('userOwnsOrganization', () => {

  it('userOwnsOrganization is exported', () => {
    expect(typeof userOwnsOrganization).toBe('function');
  });

});

describe('HOST_VERIFICATION_REJECTED_PATH', () => {
  it('is defined', () => {
    expect(HOST_VERIFICATION_REJECTED_PATH).toBeDefined();
  });
});
