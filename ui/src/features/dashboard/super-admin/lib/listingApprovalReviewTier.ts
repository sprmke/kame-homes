import type { ListingAuthorizationAssetsPayload } from '@/features/dashboard/org/lib/listingAuthorizationApi';
import type { ListingVerificationApprovalSummary } from '@/features/dashboard/super-admin/types/approval';

export type ListingApprovalReviewTier = 'base' | 'recommended';

export function listingApprovalHasDualTierQueue(
  approval: ListingVerificationApprovalSummary
): boolean {
  return approval.baseStatus !== 'none' && approval.recommendedStatus !== 'none';
}

export function defaultListingApprovalReviewTier(
  approval: ListingVerificationApprovalSummary,
  detail?: ListingAuthorizationAssetsPayload | null
): ListingApprovalReviewTier {
  const base = detail?.authorization.baseStatus ?? approval.baseStatus;
  const recommended = detail?.authorization.recommendedStatus ?? approval.recommendedStatus;

  if (base === 'pending' && recommended === 'pending') {
    const recommendedAt =
      detail?.authorization.recommendedSubmittedAt ?? approval.recommendedSubmittedAt ?? '';
    const baseAt = detail?.authorization.baseSubmittedAt ?? approval.baseSubmittedAt ?? '';
    if (recommendedAt && baseAt) {
      return recommendedAt.localeCompare(baseAt) > 0 ? 'recommended' : 'base';
    }
    return 'base';
  }
  if (base === 'pending') return 'base';
  if (recommended === 'pending') return 'recommended';
  return 'base';
}

export function latestListingApprovalSubmittedAt(
  approval: ListingVerificationApprovalSummary
): string | null {
  const candidates = [approval.recommendedSubmittedAt, approval.baseSubmittedAt].filter(
    (value): value is string => Boolean(value)
  );
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) => b.localeCompare(a))[0] ?? null;
}

export function listingApprovalTierStatus(
  approval: ListingVerificationApprovalSummary,
  tier: ListingApprovalReviewTier,
  detail?: ListingAuthorizationAssetsPayload | null
): ListingVerificationApprovalSummary['baseStatus'] {
  if (tier === 'recommended') {
    return detail?.authorization.recommendedStatus ?? approval.recommendedStatus;
  }
  return detail?.authorization.baseStatus ?? approval.baseStatus;
}

export function listingApprovalTierRejectionKind(
  approval: ListingVerificationApprovalSummary,
  tier: ListingApprovalReviewTier,
  detail?: ListingAuthorizationAssetsPayload | null
): ListingVerificationApprovalSummary['baseRejectionKind'] {
  if (tier === 'recommended') {
    return (
      detail?.authorization.recommendedRejectionKind ?? approval.recommendedRejectionKind ?? null
    );
  }
  return detail?.authorization.baseRejectionKind ?? approval.baseRejectionKind ?? null;
}

export function listingApprovalTierRejectionReason(
  approval: ListingVerificationApprovalSummary,
  tier: ListingApprovalReviewTier,
  detail?: ListingAuthorizationAssetsPayload | null
): string | null {
  if (tier === 'recommended') {
    return (
      detail?.authorization.recommendedRejectionReason ??
      approval.recommendedRejectionReason ??
      null
    );
  }
  return detail?.authorization.baseRejectionReason ?? approval.baseRejectionReason ?? null;
}

export function listingApprovalTierSubmittedAt(
  approval: ListingVerificationApprovalSummary,
  tier: ListingApprovalReviewTier,
  detail?: ListingAuthorizationAssetsPayload | null
): string | null {
  if (tier === 'recommended') {
    return detail?.authorization.recommendedSubmittedAt ?? approval.recommendedSubmittedAt ?? null;
  }
  return detail?.authorization.baseSubmittedAt ?? approval.baseSubmittedAt ?? null;
}
