import { describe, expect, it } from 'vitest';

import {
  clearOrgRenewalAutoShownForUser,
  markOrgRenewalAutoShownThisLogin,
  readOrgRenewalAutoShownThisLogin,
} from './listingContractRenewalSession';

describe('listingContractRenewalSession sign-out hygiene', () => {
  it('clears in-memory auto-shown keys for the signed-out user only', () => {
    markOrgRenewalAutoShownThisLogin('user-a', 'org-1', '2026-09-21');
    markOrgRenewalAutoShownThisLogin('user-b', 'org-1', '2026-09-21');

    clearOrgRenewalAutoShownForUser('user-a');

    expect(readOrgRenewalAutoShownThisLogin('user-a', 'org-1', '2026-09-21')).toBe(false);
    expect(readOrgRenewalAutoShownThisLogin('user-b', 'org-1', '2026-09-21')).toBe(true);
  });
});
