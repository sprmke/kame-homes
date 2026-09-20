/**
 * Shared org verification asset upload — used by upload-org-verification-asset and AI assistant.
 */

import { createServiceClient } from './orgAuth.ts';
import {
  applyAssetPath,
  ORG_VERIFICATION_ASSET_TYPES,
  ORG_VERIFICATION_BUCKET,
  orgVerificationToSettingsValue,
  readOrgVerificationFromSettings,
  type OrgVerificationAssetType,
} from './orgVerification.ts';
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

export { ORG_VERIFICATION_ASSET_TYPES };
export type { OrgVerificationAssetType };

export function isOrgVerificationAssetType(v: string): v is OrgVerificationAssetType {
  return (ORG_VERIFICATION_ASSET_TYPES as readonly string[]).includes(v);
}

export const ORG_VERIFICATION_ASSET_LABELS: Partial<Record<OrgVerificationAssetType, string>> = {
  valid_id: 'Valid ID',
  social_proof: 'Social proof',
  selfie_with_id: 'Selfie with ID',
  platform_admin_proof: 'Platform admin proof',
  legitimacy_check_proof: 'Legitimacy check proof',
  business_permit_bir: 'Business permit / BIR',
};

/** Host-assistant allowlist — excludes deprecated listing-scoped types. */
export const ASSISTANT_ORG_VERIFICATION_ASSET_TYPES = [
  'valid_id',
  'social_proof',
  'selfie_with_id',
  'platform_admin_proof',
  'legitimacy_check_proof',
  'business_permit_bir',
] as const satisfies readonly OrgVerificationAssetType[];

export type AssistantOrgVerificationAssetType =
  (typeof ASSISTANT_ORG_VERIFICATION_ASSET_TYPES)[number];

export function isAssistantOrgVerificationAssetType(
  v: string
): v is AssistantOrgVerificationAssetType {
  return (ASSISTANT_ORG_VERIFICATION_ASSET_TYPES as readonly string[]).includes(v);
}

export type ApplyOrgVerificationAssetInput = {
  organizationId: string;
  assetType: OrgVerificationAssetType;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
};

export type ApplyOrgVerificationAssetResult = {
  path: string;
  previewUrl: string | null;
  assetType: OrgVerificationAssetType;
  replacedExisting: boolean;
  label: string;
  verification: {
    baseStatus: string;
    enhancedStatus: string;
    hasValidId: boolean;
    hasSocialProof: boolean;
    hasSelfieWithId: boolean;
    hasPlatformAdminProof: boolean;
    hasLegitimacyCheckProof: boolean;
    hasBusinessPermitOrBir: boolean;
  };
};

export async function applyOrgVerificationAssetFromBytes(
  input: ApplyOrgVerificationAssetInput
): Promise<ApplyOrgVerificationAssetResult> {
  const mime = (input.mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new Error('File must be JPEG, PNG, WebP, or PDF');
  }
  const file = new File([input.bytes], input.fileName || 'proof.jpg', { type: mime });
  assertWithinUploadLimit(file, mime === 'application/pdf' ? 'pdf' : 'document');

  const supabase = createServiceClient();
  const { data: orgRow, error: orgError } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', input.organizationId)
    .single();
  if (orgError || !orgRow) throw new Error('Organization not found');

  const currentSettings =
    orgRow.settings && typeof orgRow.settings === 'object' && !Array.isArray(orgRow.settings)
      ? (orgRow.settings as Record<string, unknown>)
      : {};
  const existingVerification = readOrgVerificationFromSettings(currentSettings);
  if (
    existingVerification.baseStatus === 'rejected' &&
    existingVerification.baseRejectionKind === 'rejected'
  ) {
    throw new Error('This verification was declined. Please start a new application.');
  }

  const previousPath = (() => {
    const a = existingVerification.assets;
    switch (input.assetType) {
      case 'valid_id':
        return a.validIdPath;
      case 'social_proof':
        return a.socialProofPath;
      case 'selfie_with_id':
        return a.selfieWithIdPath;
      case 'platform_admin_proof':
        return a.platformAdminProofPath;
      case 'legitimacy_check_proof':
        return a.legitimacyCheckProofPath;
      case 'business_permit_bir':
        return a.businessPermitOrBirPath;
      default:
        return null;
    }
  })();
  const replacedExisting = Boolean(previousPath);

  const ext =
    mime === 'application/pdf'
      ? '.pdf'
      : mime === 'image/png'
        ? '.png'
        : mime === 'image/webp'
          ? '.webp'
          : '.jpg';
  const storagePath = `org/${input.organizationId}/${input.assetType}/${crypto.randomUUID()}${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(ORG_VERIFICATION_BUCKET)
    .upload(storagePath, file, { upsert: false, contentType: mime, cacheControl: '31536000' });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const verification = applyAssetPath(existingVerification, input.assetType, storagePath);
  const { error: updateError } = await supabase
    .from('organizations')
    .update({
      settings: {
        ...currentSettings,
        verification: orgVerificationToSettingsValue(verification),
      },
    })
    .eq('id', input.organizationId);
  if (updateError) throw new Error('Failed to save verification asset');

  const { data: signed } = await supabase.storage
    .from(ORG_VERIFICATION_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  return {
    path: storagePath,
    previewUrl: signed?.signedUrl ? formatPublicUrl(signed.signedUrl) : null,
    assetType: input.assetType,
    replacedExisting,
    label: ORG_VERIFICATION_ASSET_LABELS[input.assetType] ?? input.assetType,
    verification: {
      baseStatus: verification.baseStatus,
      enhancedStatus: verification.enhancedStatus,
      hasValidId: Boolean(verification.assets.validIdPath),
      hasSocialProof: Boolean(verification.assets.socialProofPath),
      hasSelfieWithId: Boolean(verification.assets.selfieWithIdPath),
      hasPlatformAdminProof: Boolean(verification.assets.platformAdminProofPath),
      hasLegitimacyCheckProof: Boolean(verification.assets.legitimacyCheckProofPath),
      hasBusinessPermitOrBir: Boolean(verification.assets.businessPermitOrBirPath),
    },
  };
}
