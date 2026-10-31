import type { ListingAuthorizationAssetsPayload } from '@/features/dashboard/org/lib/listingAuthorizationApi';
import { LISTING_VERIFICATION_DOC_LABELS } from '@/features/dashboard/org/lib/listingVerificationCopy';
import type { ListingApprovalReviewTier } from '@/features/dashboard/super-admin/lib/listingApprovalReviewTier';

export type ListingChangeDocId = 'proof' | 'additionalProof' | 'azurePmoConfirmation';

export type ListingChangeDocOption = {
  id: ListingChangeDocId;
  label: string;
  url: string | null;
};

export function buildListingChangeDocOptions(
  detail: ListingAuthorizationAssetsPayload,
  tier: ListingApprovalReviewTier
): ListingChangeDocOption[] {
  if (tier === 'base') {
    return [
      {
        id: 'proof',
        label: LISTING_VERIFICATION_DOC_LABELS.proof,
        url: detail.assetUrls.proofUrl,
      },
    ];
  }
  return [
    {
      id: 'additionalProof',
      label: LISTING_VERIFICATION_DOC_LABELS.additionalProof,
      url: detail.assetUrls.additionalProofUrl,
    },
    {
      id: 'azurePmoConfirmation',
      label: LISTING_VERIFICATION_DOC_LABELS.azurePmoConfirmation,
      url: detail.assetUrls.azurePmoConfirmationUrl,
    },
  ];
}
