/**
 * Per-listing authorization tier gates + legacy org-leg fallback.
 * Run: deno test --allow-env supabase/functions/_shared/listingAuthorization_test.ts
 */

import { assert, assertEquals, assertFalse } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  applyListingAssetPath,
  assetTypeToPathKey,
  canSubmitBaseListingAuthorization,
  canSubmitListingRenewal,
  canSubmitRecommendedListingAuthorization,
  emptyListingAuthorizationState,
  isListingAuthorizationChangesRequested,
  isListingAuthorizationHardRejected,
  isListingRecommendedBadge,
  isListingRenewEligible,
  listingAuthorizationUsesLegacyFallback,
  listingTableForKind,
  mergeListingAuthorizationIntoSettings,
  missingListingDocs,
  readListingAuthorizationFromSettings,
  resolveListingAuthorization,
  type ListingAuthorizationState,
} from './listingAuthorization.ts';
import { emptyContractLegLifecycle } from './contractLifecycle.ts';

function ownerWithProof(): ListingAuthorizationState {
  return {
    ...emptyListingAuthorizationState(),
    relationship: 'property_owner',
    assets: {
      proofPath: 'org/property/id/proof/a.pdf',
      additionalProofPath: null,
      azurePmoConfirmationPath: null,
    },
  };
}

Deno.test('Tier 1 submit needs rights only (proof files upload in listing modal)', () => {
  const empty = emptyListingAuthorizationState();
  assertFalse(canSubmitBaseListingAuthorization(empty));

  // Proof without rights is not enough.
  assertFalse(
    canSubmitBaseListingAuthorization({
      ...empty,
      assets: { ...empty.assets, proofPath: 'p.pdf' },
    })
  );

  assert(canSubmitBaseListingAuthorization({ ...empty, relationship: 'property_owner' }));
  assert(canSubmitBaseListingAuthorization(ownerWithProof()));
});

Deno.test('Tier 1 requires contract end for auth rep and sublessee only', () => {
  const base = ownerWithProof();

  for (const rights of ['authorized_representative', 'sublessee'] as const) {
    assertFalse(canSubmitBaseListingAuthorization({ ...base, relationship: rights }));
    assert(
      canSubmitBaseListingAuthorization({
        ...base,
        relationship: rights,
        contractEndDate: '2027-01-01',
      })
    );
  }

  for (const rights of ['property_owner', 'property_admin'] as const) {
    assert(canSubmitBaseListingAuthorization({ ...base, relationship: rights }));
  }
});

Deno.test('Tier 1 blocked while pending or hard rejected, open on changes requested', () => {
  const base = ownerWithProof();

  assertFalse(canSubmitBaseListingAuthorization({ ...base, baseStatus: 'pending' }));

  const hardRejected: ListingAuthorizationState = {
    ...base,
    baseStatus: 'rejected',
    baseRejectionKind: 'rejected',
  };
  assert(isListingAuthorizationHardRejected(hardRejected));
  assertFalse(canSubmitBaseListingAuthorization(hardRejected));

  const changes: ListingAuthorizationState = {
    ...base,
    baseStatus: 'rejected',
    baseRejectionKind: 'changes',
  };
  assert(isListingAuthorizationChangesRequested(changes));
  assert(canSubmitBaseListingAuthorization(changes));
});

Deno.test('Tier 2 requires approved Tier 1 plus additional proof and Azure PMO', () => {
  const withDocs: ListingAuthorizationState = {
    ...ownerWithProof(),
    assets: {
      proofPath: 'proof.pdf',
      additionalProofPath: 'extra.pdf',
      azurePmoConfirmationPath: 'pmo.pdf',
    },
  };

  // Tier 1 not approved yet.
  assertFalse(canSubmitRecommendedListingAuthorization(withDocs));

  const approved: ListingAuthorizationState = { ...withDocs, baseStatus: 'approved' };
  assert(canSubmitRecommendedListingAuthorization(approved));

  // Primary proof is listing Tier 1 — not required to submit Recommended.
  assert(
    canSubmitRecommendedListingAuthorization({
      ...approved,
      assets: { ...approved.assets, proofPath: null },
    })
  );

  // Missing either remaining Tier 2 doc blocks submit.
  assertFalse(
    canSubmitRecommendedListingAuthorization({
      ...approved,
      assets: { ...approved.assets, additionalProofPath: null },
    })
  );
  assertFalse(
    canSubmitRecommendedListingAuthorization({
      ...approved,
      assets: { ...approved.assets, azurePmoConfirmationPath: null },
    })
  );

  // Already pending or approved is a no-op.
  assertFalse(
    canSubmitRecommendedListingAuthorization({ ...approved, recommendedStatus: 'pending' })
  );
  assertFalse(
    canSubmitRecommendedListingAuthorization({ ...approved, recommendedStatus: 'approved' })
  );
});

Deno.test('org tier status never gates the listing tiers', () => {
  // Nothing in the listing state references org verification, so a listing with an
  // approved Tier 1 is authorized even when the host is still pending review.
  const approved: ListingAuthorizationState = { ...ownerWithProof(), baseStatus: 'approved' };
  assert(canSubmitBaseListingAuthorization({ ...ownerWithProof(), baseStatus: 'none' }));
  assertEquals(approved.baseStatus, 'approved');
});

Deno.test('Recommended badge only when recommended tier approved', () => {
  const base = ownerWithProof();
  assertFalse(isListingRecommendedBadge(base));
  assertFalse(isListingRecommendedBadge({ ...base, baseStatus: 'approved' }));
  assert(isListingRecommendedBadge({ ...base, recommendedStatus: 'approved' }));
});

Deno.test('round trip through settings preserves state', () => {
  const state: ListingAuthorizationState = {
    ...ownerWithProof(),
    relationship: 'sublessee',
    contractEndDate: '2027-03-15',
    baseStatus: 'approved',
    recommendedStatus: 'pending',
    baseSubmittedAt: '2026-08-01T00:00:00.000Z',
    recommendedSubmittedAt: '2026-08-05T00:00:00.000Z',
    assets: {
      proofPath: 'proof.pdf',
      additionalProofPath: 'extra.pdf',
      azurePmoConfirmationPath: 'pmo.pdf',
    },
  };

  const settings = mergeListingAuthorizationIntoSettings({ other: 'kept' }, state);
  assertEquals(settings.other, 'kept');

  const parsed = readListingAuthorizationFromSettings(settings);
  assertEquals(parsed.relationship, 'sublessee');
  assertEquals(parsed.contractEndDate, '2027-03-15');
  assertEquals(parsed.baseStatus, 'approved');
  assertEquals(parsed.recommendedStatus, 'pending');
  assertEquals(parsed.assets.additionalProofPath, 'extra.pdf');
  assertEquals(parsed.assets.azurePmoConfirmationPath, 'pmo.pdf');
});

Deno.test('rejection kind only surfaces when the tier is rejected', () => {
  const parsed = readListingAuthorizationFromSettings({
    listingAuthorization: {
      baseStatus: 'approved',
      baseRejectionKind: 'changes',
      recommendedStatus: 'rejected',
    },
  });
  assertEquals(parsed.baseRejectionKind, null);
  assertEquals(parsed.recommendedRejectionKind, 'rejected');
});

Deno.test('legacy org-leg fallback fills listings with no block yet', () => {
  const orgSettings = {
    verification: {
      baseStatus: 'approved',
      propertyRelationship: 'sublessee',
      propertyContractEndDate: '2027-05-01',
      parkingRelationship: 'property_owner',
      assets: {
        propertyOwnershipProofPath: 'legacy/property.pdf',
        parkingSocialProofPath: 'legacy/parking.pdf',
        ownershipProofPath: 'legacy/extra.pdf',
        azurePmoConfirmationPath: 'legacy/pmo.pdf',
      },
    },
  };

  assert(listingAuthorizationUsesLegacyFallback(null));
  assert(listingAuthorizationUsesLegacyFallback({}));

  const property = resolveListingAuthorization(null, orgSettings, 'property');
  assertEquals(property.relationship, 'sublessee');
  assertEquals(property.contractEndDate, '2027-05-01');
  assertEquals(property.baseStatus, 'approved');
  assertEquals(property.assets.proofPath, 'legacy/property.pdf');

  const parking = resolveListingAuthorization(null, orgSettings, 'parking');
  assertEquals(parking.relationship, 'property_owner');
  assertEquals(parking.assets.proofPath, 'legacy/parking.pdf');

  // Once the listing owns a block, the org leg is ignored.
  const own = mergeListingAuthorizationIntoSettings(null, {
    ...emptyListingAuthorizationState(),
    relationship: 'property_admin',
  });
  assertFalse(listingAuthorizationUsesLegacyFallback(own));
  assertEquals(
    resolveListingAuthorization(own, orgSettings, 'property').relationship,
    'property_admin'
  );
});

Deno.test('legacy rights aliases map forward', () => {
  const parsed = readListingAuthorizationFromSettings({
    listingAuthorization: { relationship: 'renter' },
  });
  assertEquals(parsed.relationship, 'authorized_representative');
});

Deno.test('asset type mapping and apply', () => {
  assertEquals(assetTypeToPathKey('proof'), 'proofPath');
  assertEquals(assetTypeToPathKey('additional_proof'), 'additionalProofPath');
  assertEquals(assetTypeToPathKey('azure_pmo_confirmation'), 'azurePmoConfirmationPath');

  const next = applyListingAssetPath(emptyListingAuthorizationState(), 'additional_proof', 'x.pdf');
  assertEquals(next.assets.additionalProofPath, 'x.pdf');
  assertEquals(next.assets.proofPath, null);
});

Deno.test('missing docs and table mapping', () => {
  assertEquals(missingListingDocs(emptyListingAuthorizationState()), ['rights']);
  assertEquals(missingListingDocs(ownerWithProof()), []);
  assertEquals(missingListingDocs({ ...ownerWithProof(), recommendedStatus: 'pending' }), [
    'additional_proof',
    'azure_pmo_confirmation',
  ]);

  assertEquals(listingTableForKind('property'), 'properties');
  assertEquals(listingTableForKind('parking'), 'parkings');
});

Deno.test('renew eligible when approved and in pre-expiry, grace, or locked', () => {
  const approved = {
    ...ownerWithProof(),
    baseStatus: 'approved' as const,
    contractEndDate: '2099-06-15',
    lifecycle: emptyContractLegLifecycle(),
  };

  assert(isListingRenewEligible(approved, '2099-06-01'));

  const grace = {
    ...approved,
    contractEndDate: '2099-06-01',
  };
  assert(isListingRenewEligible(grace, '2099-06-02'));

  const locked = {
    ...approved,
    contractEndDate: '2099-06-01',
    lifecycle: {
      ...emptyContractLegLifecycle(),
      accessLockedAt: '2099-06-06T00:00:00.000Z',
    },
  };
  assert(isListingRenewEligible(locked, '2099-06-06'));

  assertFalse(isListingRenewEligible({ ...approved, baseStatus: 'pending' }, '2099-06-01'));
  assert(canSubmitListingRenewal(approved, '2099-06-01'));
  assertFalse(
    canSubmitListingRenewal(
      { ...approved, assets: { ...approved.assets, proofPath: null } },
      '2099-06-01'
    )
  );
});
