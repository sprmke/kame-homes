/**
 * Shared property app-settings asset upload (signature, review images).
 * GCash QR staging is intentionally excluded from the assistant apply path (OTP-parity Phase 3).
 */

import { createClient } from './supabaseJs.ts';
import { DatabaseService } from './databaseService.ts';
import { invalidateAppSettingsCache, loadAppSettingsRow } from './appSettings.ts';
import {
  applyExternalReviewAssetUpload,
  normalizeExternalReviewsDraft,
  type ExternalReviewAssetUploadType,
} from './propertyExternalReviews.ts';
import { assertWithinUploadLimit } from './uploadLimits.ts';
import { copyBytes, formatPublicUrl } from './utils.ts';

const BUCKET = 'app-settings-assets';

type AssetConfig = {
  column?: string;
  storagePrefix: string;
  allowedMime?: Set<string>;
};

const ASSET_CONFIG = {
  gaf_unit_owner_signature: {
    column: 'gaf_unit_owner_signature_url',
    storagePrefix: 'gaf-unit-owner-signature',
    allowedMime: new Set(['image/jpeg', 'image/png']),
  },
  external_review_image: {
    storagePrefix: 'external-review',
  },
  external_review_stay_photo: {
    storagePrefix: 'external-review-stay',
  },
} as Record<string, AssetConfig>;

export type AppSettingsApplyAssetType = keyof typeof ASSET_CONFIG;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const APP_SETTINGS_APPLY_ASSET_TYPES = Object.keys(
  ASSET_CONFIG
) as AppSettingsApplyAssetType[];

export function isAppSettingsApplyAssetType(v: string): v is AppSettingsApplyAssetType {
  return v in ASSET_CONFIG;
}

export const APP_SETTINGS_APPLY_LABELS: Record<AppSettingsApplyAssetType, string> = {
  gaf_unit_owner_signature: 'GAF unit owner signature',
  external_review_image: 'External review image',
  external_review_stay_photo: 'External review stay photo',
};

function storagePathForAsset(
  assetType: AppSettingsApplyAssetType,
  propertyId: string,
  ext: string,
  reviewId?: string,
  photoIndex?: number
): string {
  if (assetType === 'external_review_image') {
    if (!reviewId) throw new Error('reviewId is required for external_review_image');
    return `${ASSET_CONFIG.external_review_image.storagePrefix}/${propertyId}/${reviewId}${ext}`;
  }
  if (assetType === 'external_review_stay_photo') {
    if (!reviewId) throw new Error('reviewId is required for external_review_stay_photo');
    const idx = photoIndex ?? 0;
    if (idx < 0 || idx > 2) throw new Error('photoIndex must be 0, 1, or 2');
    return `${ASSET_CONFIG.external_review_stay_photo.storagePrefix}/${propertyId}/${reviewId}/${idx}${ext}`;
  }
  return `${ASSET_CONFIG[assetType].storagePrefix}/${propertyId}/current${ext}`;
}

export function appSettingsAssetPermission(
  assetType: AppSettingsApplyAssetType
): 'settings.buildingForms:edit' | 'settings.socials:edit' {
  return assetType === 'gaf_unit_owner_signature'
    ? 'settings.buildingForms:edit'
    : 'settings.socials:edit';
}

export type ApplyAppSettingsAssetInput = {
  propertyId: string;
  assetType: AppSettingsApplyAssetType;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  reviewId?: string;
  photoIndex?: number;
};

export type ApplyAppSettingsAssetResult = {
  url: string;
  bucket: string;
  path: string;
  column: string | null;
  replacedExisting: boolean;
  label: string;
};

export async function applyAppSettingsAssetFromBytes(
  input: ApplyAppSettingsAssetInput
): Promise<ApplyAppSettingsAssetResult> {
  const config = ASSET_CONFIG[input.assetType];
  const mime = (input.mimeType || '').toLowerCase();
  const allowedMime = config.allowedMime ?? ALLOWED_MIME;
  if (!allowedMime.has(mime)) {
    throw new Error(
      input.assetType === 'gaf_unit_owner_signature'
        ? 'Signature must be PNG or JPEG'
        : 'File must be JPEG, PNG, or WebP'
    );
  }

  const file = new File([copyBytes(input.bytes)], input.fileName || 'asset.jpg', { type: mime });
  assertWithinUploadLimit(file, 'image');

  let replacedExisting = false;
  if (input.assetType === 'gaf_unit_owner_signature') {
    const row = await loadAppSettingsRow(input.propertyId);
    replacedExisting = Boolean(
      typeof row?.gaf_unit_owner_signature_url === 'string' &&
      row.gaf_unit_owner_signature_url.trim()
    );
  } else if (input.reviewId) {
    const row = await loadAppSettingsRow(input.propertyId);
    const existing = normalizeExternalReviewsDraft(row?.external_reviews);
    const review = existing.find((r) => r.id === input.reviewId);
    if (review) {
      if (input.assetType === 'external_review_image') {
        replacedExisting = Boolean(review.imageUrl?.trim());
      } else {
        const idx = input.photoIndex ?? 0;
        replacedExisting = Boolean(review.stayPhotoUrls?.[idx]?.trim());
      }
    }
  }

  const ext = input.fileName.includes('.')
    ? `.${input.fileName.split('.').pop()?.toLowerCase()}`
    : mime === 'image/png'
      ? '.png'
      : mime === 'image/webp'
        ? '.webp'
        : '.jpg';
  const storagePath = storagePathForAsset(
    input.assetType,
    input.propertyId,
    ext,
    input.reviewId,
    input.photoIndex
  );

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { upsert: true, contentType: mime });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const safePublicUrl = formatPublicUrl(publicUrl);
  const persistedUrl =
    input.assetType === 'gaf_unit_owner_signature'
      ? `${safePublicUrl}${safePublicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`
      : safePublicUrl;

  let column: string | null = null;
  if (config.column) {
    column = config.column;
    await DatabaseService.updateAppSettings({ [config.column]: persistedUrl }, input.propertyId);
    invalidateAppSettingsCache(input.propertyId);
  } else if (
    input.assetType === 'external_review_image' ||
    input.assetType === 'external_review_stay_photo'
  ) {
    const currentRow = await loadAppSettingsRow(input.propertyId);
    const existing = normalizeExternalReviewsDraft(currentRow?.external_reviews);
    const nextReviews = applyExternalReviewAssetUpload(
      existing,
      input.reviewId ?? '',
      input.assetType as ExternalReviewAssetUploadType,
      safePublicUrl,
      input.photoIndex
    );
    if (nextReviews) {
      await DatabaseService.updateAppSettings({ external_reviews: nextReviews }, input.propertyId);
      invalidateAppSettingsCache(input.propertyId);
    }
  }

  return {
    url: persistedUrl,
    bucket: BUCKET,
    path: storagePath,
    column,
    replacedExisting,
    label: APP_SETTINGS_APPLY_LABELS[input.assetType],
  };
}
