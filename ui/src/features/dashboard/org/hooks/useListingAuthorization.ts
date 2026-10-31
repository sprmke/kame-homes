import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ORGANIZATIONS_QUERY_KEY } from '@/features/dashboard/org/hooks/useOrganizations';
import { PARKINGS_QUERY_KEY } from '@/features/dashboard/org/hooks/useParkings';
import type {
  ListingAuthorizationAssetType,
  ListingKind,
} from '@/features/dashboard/org/lib/listingAuthorization';
import {
  fetchListingAuthorizationAssets,
  fetchOrgListingVerifications,
  submitListingAuthorization,
  submitListingRecommended,
  uploadListingAuthorizationAsset,
} from '@/features/dashboard/org/lib/listingAuthorizationApi';
import type { OrgVerificationRights } from '@/features/dashboard/org/lib/orgVerification';

export function listingAuthorizationAssetsQueryKey(listingKind: ListingKind, listingId: string) {
  return ['listing', 'authorization-assets', listingKind, listingId] as const;
}

export function orgListingVerificationsQueryKey(orgId: string) {
  return ['org', 'listing-verifications', orgId] as const;
}

export function useListingAuthorizationAssets(
  listingKind: ListingKind | undefined,
  listingId: string | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: listingAuthorizationAssetsQueryKey(listingKind ?? 'property', listingId ?? ''),
    enabled: Boolean(listingKind && listingId) && enabled,
    staleTime: 5 * 60_000,
    queryFn: () => fetchListingAuthorizationAssets(listingKind!, listingId!),
  });
}

export function useOrgListingVerifications(orgId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: orgListingVerificationsQueryKey(orgId ?? ''),
    enabled: Boolean(orgId) && enabled,
    staleTime: 30_000,
    queryFn: () => fetchOrgListingVerifications(orgId!),
  });
}

type MutationScope = {
  listingKind: ListingKind;
  listingId: string;
  orgId?: string;
  orgSlug?: string;
};

function invalidateListingQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: MutationScope
) {
  void queryClient.invalidateQueries({
    queryKey: listingAuthorizationAssetsQueryKey(scope.listingKind, scope.listingId),
  });
  void queryClient.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY });
  if (scope.orgId) {
    void queryClient.invalidateQueries({
      queryKey: orgListingVerificationsQueryKey(scope.orgId),
    });
  }
  if (scope.orgSlug) {
    void queryClient.invalidateQueries({
      queryKey: scope.listingKind === 'parking' ? PARKINGS_QUERY_KEY : ['properties'],
    });
  }
}

export function useListingAuthorizationMutations(scope: MutationScope) {
  const queryClient = useQueryClient();

  const upload = useMutation({
    mutationFn: (params: { assetType: ListingAuthorizationAssetType; file: File }) =>
      uploadListingAuthorizationAsset({
        listingKind: scope.listingKind,
        listingId: scope.listingId,
        assetType: params.assetType,
        file: params.file,
      }),
    onSuccess: () => invalidateListingQueries(queryClient, scope),
  });

  const submitBase = useMutation({
    mutationFn: (params: { relationship: OrgVerificationRights; contractEndDate?: string }) =>
      submitListingAuthorization({
        listingKind: scope.listingKind,
        listingId: scope.listingId,
        relationship: params.relationship,
        ...(params.contractEndDate ? { contractEndDate: params.contractEndDate } : {}),
      }),
    onSuccess: () => invalidateListingQueries(queryClient, scope),
  });

  const submitRecommended = useMutation({
    mutationFn: () =>
      submitListingRecommended({
        listingKind: scope.listingKind,
        listingId: scope.listingId,
      }),
    onSuccess: () => invalidateListingQueries(queryClient, scope),
  });

  return { upload, submitBase, submitRecommended };
}
