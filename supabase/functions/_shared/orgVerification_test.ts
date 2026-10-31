/**
 * Host verification tier gates.
 * Run: deno test --allow-env supabase/functions/_shared/orgVerification_test.ts
 */

import { assert, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  canSubmitBaseVerification,
  canSubmitEnhancedVerification,
  emptyOrgVerificationState,
  type OrgVerificationState,
} from './orgVerification.ts';

function withValidId(): OrgVerificationState {
  return {
    ...emptyOrgVerificationState(),
    assets: {
      ...emptyOrgVerificationState().assets,
      validIdPath: 'org/id/valid_id/a.jpg',
    },
  };
}

function withHostBaseDocs(): OrgVerificationState {
  return {
    ...withValidId(),
    assets: {
      ...withValidId().assets,
      socialProofPath: 'org/id/social_proof/fb.jpg',
    },
  };
}

Deno.test('host base submit requires Valid ID and Facebook Page screenshot', () => {
  assertFalse(canSubmitBaseVerification(emptyOrgVerificationState()));
  assertFalse(canSubmitBaseVerification(withValidId()));
  assert(canSubmitBaseVerification(withHostBaseDocs()));
});

Deno.test('host Recommended requires selfie; Facebook and platform admin are optional', () => {
  const ready: OrgVerificationState = {
    ...withHostBaseDocs(),
    assets: {
      ...withHostBaseDocs().assets,
      selfieWithIdPath: 'org/id/selfie_with_id/s.jpg',
    },
  };

  assert(canSubmitEnhancedVerification(ready));
  assertFalse(
    canSubmitEnhancedVerification({
      ...ready,
      assets: { ...ready.assets, selfieWithIdPath: null },
    })
  );
  assert(
    canSubmitEnhancedVerification({
      ...ready,
      assets: { ...ready.assets, socialProofPath: null },
    })
  );
});
