/**
 * Shared listing authorization asset upload — used by upload-listing-authorization-asset and AI assistant.
 */

import { createServiceClient } from './orgAuth.ts';
import {
  applyListingAssetPath,
  isListingAuthorizationHardRejected,
  LISTING_AUTHORIZATION_ASSET_TYPES,
  LISTING_AUTHORIZATION_BUCKET,
  type ListingAuthorizationAssetType,
} from './listingAuthorization.ts';
import {
  parseListingKind,
  saveListingAuthorization,
  serializeListingAuthorization,
  verifyListingOwner,
} from './listingAuthorizationService.ts';
import type { ListingKind } from './listingAuthorization.ts';
import { assertWithinUploadLimit } from './uploadLimits.ts';
import { formatPublicUrl } from './utils.ts';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

export { LISTING_AUTHORIZATION_ASSET_TYPES };
export type { ListingAuthorizationAssetType, ListingKind };

export function isListingAuthorizationAssetType(v: string): v is ListingAuthorizationAssetType {
  return (LISTING_AUTHORIZATION_ASSET_TYPES as readonly string[]).includes(v);
}

export const LISTING_AUTHORIZATION_ASSET_LABELS: Record<ListingAuthorizationAssetType, string> = {
  proof: 'Ownership / authorization proof',
  additional_proof: 'Additional proof',
  azure_pmo_confirmation: 'Azure PMO confirmation',
};

function extensionFor(mime: string): string {
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  if (mime === 'image/heic' || mime === 'image/heif') return '.heic';
  return '.jpg';
}

export type ApplyListingAuthorizationAssetInput = {
  req: Request;
  listingKind: ListingKind;
  listingId: string;
  assetType: ListingAuthorizationAssetType;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
};

export type ApplyListingAuthorizationAssetResult = {
  path: string;
  previewUrl: string | null;
  assetType: ListingAuthorizationAssetType;
  replacedExisting: boolean;
  label: string;
  organizationId: string;
  serialized: Record<string, unknown>;
};

export async function applyListingAuthorizationAssetFromBytes(
  input: ApplyListingAuthorizationAssetInput
): Promise<ApplyListingAuthorizationAssetResult> {
  const mime = (input.mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('File must be JPEG, PNG, WebP, or PDF');
  }
  const file = new File([input.bytes], input.fileName || 'proof.jpg', { type: mime });
  assertWithinUploadLimit(file, mime === 'application/pdf' ? 'pdf' : 'document');

  const context = await verifyListingOwner(input.req, input.listingKind, input.listingId);
  if (isListingAuthorizationHardRejected(context.authorization)) {
    throw new Error('This listing was declined. Please start a new application.');
  }

  const previousPath = (() => {
    const a = context.authorization.assets;
    if (input.assetType === 'proof') return a.proofPath;
    if (input.assetType === 'additional_proof') return a.additionalProofPath;
    return a.azurePmoConfirmationPath;
  })();

  const supabase = createServiceClient();
  const storagePath = `org/${context.org.id}/${input.listingKind}/${input.listingId}/${input.assetType}/${crypto.randomUUID()}${extensionFor(mime)}`;

  const { error: uploadError } = await supabase.storage
    .from(LISTING_AUTHORIZATION_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: mime, cacheControl: '31536000' });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const next = applyListingAssetPath(context.authorization, input.assetType, storagePath);
  const listing = await saveListingAuthorization(supabase, context, next);

  const { data: signed } = await supabase.storage
    .from(LISTING_AUTHORIZATION_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  return {
    path: storagePath,
    previewUrl: signed?.signedUrl ? formatPublicUrl(signed.signedUrl) : null,
    assetType: input.assetType,
    replacedExisting: Boolean(previousPath),
    label: LISTING_AUTHORIZATION_ASSET_LABELS[input.assetType],
    organizationId: context.org.id,
    serialized: serializeListingAuthorization(context, next, listing) as Record<string, unknown>,
  };
}

export { parseListingKind };
