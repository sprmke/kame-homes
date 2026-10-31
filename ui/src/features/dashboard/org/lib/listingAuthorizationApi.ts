import { callEdgeFunction, getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import type {
  ListingAuthorizationAssetType,
  ListingAuthorizationSummary,
  ListingKind,
} from '@/features/dashboard/org/lib/listingAuthorization';
import type { OrgVerificationRights } from '@/features/dashboard/org/lib/orgVerification';

import { prepareUpload } from '@/lib/media/prepareUpload';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

export type ListingAuthorizationAssetUrls = {
  proofUrl: string | null;
  additionalProofUrl: string | null;
  azurePmoConfirmationUrl: string | null;
};

export type ListingAuthorizationAssetsPayload = {
  authorization: ListingAuthorizationSummary;
  organization: { id: string; name: string; slug: string };
  assetUrls: ListingAuthorizationAssetUrls;
};

export type OrgListingVerificationRollupRow = {
  listingKind: ListingKind;
  listingId: string;
  name: string;
  slug: string;
  listingStatus: string;
  relationship: OrgVerificationRights | null;
  contractEndDate: string | null;
  baseStatus: ListingAuthorizationSummary['baseStatus'];
  recommendedStatus: ListingAuthorizationSummary['recommendedStatus'];
  baseRejectionKind: ListingAuthorizationSummary['baseRejectionKind'];
  recommendedRejectionKind: ListingAuthorizationSummary['recommendedRejectionKind'];
  recommendedBadge: boolean;
  hasProof: boolean;
  missingDocs: string[];
};

export type OrgListingVerificationsPayload = {
  organization: { id: string; name: string; slug: string };
  listings: OrgListingVerificationRollupRow[];
};

export async function uploadListingAuthorizationAsset(params: {
  listingKind: ListingKind;
  listingId: string;
  assetType: ListingAuthorizationAssetType;
  file: File;
}): Promise<{ path: string; previewUrl: string | null; assetType: ListingAuthorizationAssetType }> {
  const prepared = await prepareUpload(params.file, {
    imagePreset: 'DOCUMENT',
    surface: `listing-authorization-${params.assetType}`,
  });
  if (prepared.error) throw new Error(prepared.error);
  const file = prepared.file;

  const jwt = await getSessionJwt();
  const body = new FormData();
  body.append('listingKind', params.listingKind);
  body.append('listingId', params.listingId);
  body.append('assetType', params.assetType);
  body.append('file', file);
  body.append('fileName', file.name);

  const res = await fetch(`${FUNCTIONS_URL}/upload-listing-authorization-asset`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body,
  });
  const json = (await res.json()) as {
    success?: boolean;
    error?: string;
    data?: { path: string; previewUrl: string | null; assetType: ListingAuthorizationAssetType };
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Upload failed');
  }
  return json.data;
}

export async function submitListingAuthorization(params: {
  listingKind: ListingKind;
  listingId: string;
  relationship: OrgVerificationRights;
  contractEndDate?: string;
}): Promise<unknown> {
  return callEdgeFunction('submit-listing-authorization', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function submitListingRecommended(params: {
  listingKind: ListingKind;
  listingId: string;
}): Promise<unknown> {
  return callEdgeFunction('submit-listing-recommended', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchListingAuthorizationAssets(
  listingKind: ListingKind,
  listingId: string
): Promise<ListingAuthorizationAssetsPayload> {
  return callEdgeFunction<ListingAuthorizationAssetsPayload>(
    `get-listing-authorization-assets?listingKind=${encodeURIComponent(listingKind)}&listingId=${encodeURIComponent(listingId)}`
  );
}

export async function fetchOrgListingVerifications(
  orgId: string
): Promise<OrgListingVerificationsPayload> {
  return callEdgeFunction<OrgListingVerificationsPayload>(
    `list-org-listing-verifications?orgId=${encodeURIComponent(orgId)}`
  );
}
