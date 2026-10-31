import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useListingAuthorizationAssets } from '@/features/dashboard/org/hooks/useListingAuthorization';
import {
  orgVerificationAssetsQueryKey,
  useOrgVerificationAssets,
} from '@/features/dashboard/org/hooks/useOrgVerificationAssets';
import { callEdgeFunction } from '@/features/dashboard/org/lib/edgeClient';
import type {
  ListingAuthorizationRejectionKind,
  ListingAuthorizationStatus,
  ListingAuthorizationTier,
  ListingKind,
} from '@/features/dashboard/org/lib/listingAuthorization';
import type { SuperAdminApprovalsFilterStatus } from '@/features/dashboard/super-admin/lib/superAdminApprovalsFilters';
import type {
  ApprovalQueueItem,
  ExternalReviewApprovalSummary,
  ListingVerificationApprovalSummary,
  OrgApprovalSummary,
  ReportedReviewApprovalSummary,
  SuperAdminApprovalTypeFilter,
} from '@/features/dashboard/super-admin/types/approval';

export const APPROVALS_QUERY_KEY = ['super-admin', 'approvals'] as const;

export function approvalAssetsQueryKey(orgId: string) {
  return orgVerificationAssetsQueryKey(orgId);
}

export { useOrgVerificationAssets, useListingAuthorizationAssets };

function normalizeListingVerificationApproval(
  row: Omit<ListingVerificationApprovalSummary, 'type'>
): ListingVerificationApprovalSummary {
  return {
    type: 'listing_verification',
    listingKind: row.listingKind === 'parking' ? 'parking' : 'property',
    listingId: row.listingId,
    listingName: row.listingName,
    listingSlug: row.listingSlug,
    listingStatus: row.listingStatus ?? '',
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    organizationSlug: row.organizationSlug,
    ownerName: row.ownerName,
    ownerEmail: row.ownerEmail,
    relationship: row.relationship ?? null,
    contractEndDate: row.contractEndDate ?? null,
    baseStatus: normalizeListingStatus(row.baseStatus),
    baseSubmittedAt: row.baseSubmittedAt ?? null,
    baseRejectionReason: row.baseRejectionReason ?? null,
    baseRejectionKind: normalizeListingRejectionKind(row.baseRejectionKind),
    recommendedStatus: normalizeListingStatus(row.recommendedStatus),
    recommendedSubmittedAt: row.recommendedSubmittedAt ?? null,
    recommendedRejectionReason: row.recommendedRejectionReason ?? null,
    recommendedRejectionKind: normalizeListingRejectionKind(row.recommendedRejectionKind),
    tower: row.tower ?? null,
    unitNumber: row.unitNumber ?? null,
    unitConflicts: Array.isArray(row.unitConflicts) ? row.unitConflicts : [],
    hasActiveUnitConflict:
      row.hasActiveUnitConflict === true || (row.unitConflicts?.length ?? 0) > 0,
  };
}

function normalizeListingStatus(value: unknown): ListingAuthorizationStatus {
  if (value === 'pending' || value === 'approved' || value === 'rejected') return value;
  return 'none';
}

function normalizeListingRejectionKind(value: unknown): ListingAuthorizationRejectionKind | null {
  if (value === 'changes' || value === 'rejected') return value;
  return null;
}

function normalizeOrgApproval(row: Omit<OrgApprovalSummary, 'type'>): OrgApprovalSummary {
  return {
    type: 'org_verification',
    ...row,
    unitConflicts: Array.isArray(row.unitConflicts) ? row.unitConflicts : [],
    hasActiveUnitConflict: row.hasActiveUnitConflict === true,
    propertyConsiderationStatus: row.propertyConsiderationStatus ?? 'none',
    parkingConsiderationStatus: row.parkingConsiderationStatus ?? 'none',
    hasPendingConsideration: row.hasPendingConsideration === true,
    propertyAccessLocked: row.propertyAccessLocked === true,
    parkingAccessLocked: row.parkingAccessLocked === true,
  };
}

function normalizeExternalReviewApproval(
  row: ExternalReviewApprovalSummary
): ExternalReviewApprovalSummary {
  return {
    type: 'external_review',
    propertyId: row.propertyId,
    propertyName: row.propertyName,
    propertySlug: row.propertySlug,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    organizationSlug: row.organizationSlug,
    reviewId: row.reviewId,
    source: row.source === 'facebook' ? 'facebook' : 'airbnb',
    reviewText: row.reviewText ?? '',
    reviewerName: row.reviewerName ?? '',
    starRating: row.starRating ?? null,
    moderationStatus:
      row.moderationStatus === 'approved' || row.moderationStatus === 'rejected'
        ? row.moderationStatus
        : 'pending',
    submittedAt: row.submittedAt ?? null,
    imageUrl: row.imageUrl ?? null,
    stayPhotoUrls: Array.isArray(row.stayPhotoUrls)
      ? row.stayPhotoUrls.filter(
          (url): url is string => typeof url === 'string' && url.trim().length > 0
        )
      : [],
    imagePath: row.imagePath ?? null,
  };
}

export type ApprovalsFilters = {
  search: string;
  status: SuperAdminApprovalsFilterStatus;
  type: SuperAdminApprovalTypeFilter;
};

export function useApprovals(
  filters: ApprovalsFilters,
  page: number,
  limit: number,
  organizationId?: string
) {
  return useQuery({
    queryKey: [...APPROVALS_QUERY_KEY, filters, page, limit, organizationId ?? null],
    placeholderData: keepPreviousData,
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.type !== 'all') params.set('type', filters.type);
      if (organizationId) params.set('organizationId', organizationId);
      params.set('page', String(page));
      params.set('limit', String(limit));

      return callEdgeFunction<{ approvals: ApprovalQueueItem[]; total: number }>(
        `list-super-admin-approvals?${params.toString()}`
      ).then((data) => ({
        rows: (data.approvals ?? []).map((row) => {
          if (row.type === 'external_review') {
            return normalizeExternalReviewApproval(row);
          }
          if (row.type === 'reported_review') {
            return row as ReportedReviewApprovalSummary;
          }
          if (row.type === 'listing_verification') {
            return normalizeListingVerificationApproval(row);
          }
          return normalizeOrgApproval(row as Omit<OrgApprovalSummary, 'type'>);
        }),
        total: data.total,
      }));
    },
  });
}

export type ApprovalsSummary = {
  total: number;
  pending: number;
  orgVerifications: number;
  listingVerifications: number;
  reviews: number;
};

/** Platform-wide (or org-scoped) approval counts for the summary cards — not page-scoped. */
export function useApprovalsSummary(organizationId?: string) {
  return useQuery({
    queryKey: [...APPROVALS_QUERY_KEY, 'summary', organizationId ?? null],
    queryFn: () => {
      const params = new URLSearchParams({ summary: 'true' });
      if (organizationId) params.set('organizationId', organizationId);
      return callEdgeFunction<{ summary: ApprovalsSummary }>(
        `list-super-admin-approvals?${params.toString()}`
      ).then((d) => d.summary);
    },
    staleTime: 30_000,
  });
}

export function useApproveOrgVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { orgId: string; tier?: 'base' | 'enhanced' }) =>
      callEdgeFunction('approve-org-verification', {
        method: 'POST',
        body: JSON.stringify({ orgId: input.orgId, tier: input.tier ?? 'base' }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
    },
  });
}

export function useRejectOrgVerification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      orgId: string;
      reason: string;
      kind: 'changes' | 'rejected';
      tier?: 'base' | 'enhanced';
      changesRequestedDocs?: Array<
        'validId' | 'socialProof' | 'propertyOwnership' | 'parkingProof'
      >;
    }) =>
      callEdgeFunction('reject-org-verification', {
        method: 'POST',
        body: JSON.stringify({
          orgId: input.orgId,
          reason: input.reason,
          kind: input.kind,
          tier: input.tier ?? 'base',
          ...(input.kind === 'changes' && input.changesRequestedDocs
            ? { changesRequestedDocs: input.changesRequestedDocs }
            : {}),
        }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
    },
  });
}

export function useDecideContractConsideration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      orgId: string;
      leg: 'property' | 'parking';
      decision: 'grant' | 'deny' | 'changes';
      note?: string;
      grantedUntil?: string;
      allowConsiderationOverride?: boolean;
    }) =>
      callEdgeFunction('decide-contract-consideration', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
    },
  });
}

export function externalReviewAssetsQueryKey(propertyId: string, reviewId: string) {
  return ['super-admin', 'external-review-assets', propertyId, reviewId] as const;
}

export function useExternalReviewAssets(propertyId: string | null, reviewId: string | null) {
  return useQuery({
    queryKey: externalReviewAssetsQueryKey(propertyId ?? '', reviewId ?? ''),
    enabled: Boolean(propertyId && reviewId),
    queryFn: () =>
      callEdgeFunction<{
        imageUrl: string | null;
        stayPhotoUrls: string[];
      }>(
        `get-external-review-assets?propertyId=${encodeURIComponent(propertyId!)}&reviewId=${encodeURIComponent(reviewId!)}`
      ),
  });
}

export function useModerateReviewReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reportId: string; decision: 'upheld' | 'rejected'; note?: string }) =>
      callEdgeFunction('moderate-review-report', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
    },
  });
}

export function useModerateExternalReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      propertyId: string;
      reviewId: string;
      decision: 'approved' | 'rejected';
    }) =>
      callEdgeFunction('moderate-external-review', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
    },
  });
}

export function listingAuthorizationAssetsQueryKey(listingKind: ListingKind, listingId: string) {
  return ['listing', 'authorization-assets', listingKind, listingId] as const;
}

export function useApproveListingAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { listingKind: ListingKind; listingId: string }) =>
      callEdgeFunction('approve-listing-authorization', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
    },
  });
}

export function useApproveListingRecommended() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { listingKind: ListingKind; listingId: string }) =>
      callEdgeFunction('approve-listing-recommended', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
    },
  });
}

export function useRejectListingAuthorization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      listingKind: ListingKind;
      listingId: string;
      tier: ListingAuthorizationTier;
      kind: 'changes' | 'rejected';
      reason: string;
    }) =>
      callEdgeFunction('reject-listing-authorization', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async (_data, variables) => {
      await qc.invalidateQueries({ queryKey: APPROVALS_QUERY_KEY });
      await qc.invalidateQueries({
        queryKey: listingAuthorizationAssetsQueryKey(variables.listingKind, variables.listingId),
      });
    },
  });
}
