/**
 * upload-org-verification-asset — Owner upload for host verification proofs.
 * Auth: verifyOrgOwner via orgId. Private bucket; returns signed preview URL.
 */

import { verifyOrgOwner, createServiceClient } from '../_shared/orgAuth.ts';
import {
  ORG_VERIFICATION_ASSET_TYPES,
  ORG_VERIFICATION_BUCKET,
  type OrgVerificationAssetType,
} from '../_shared/orgVerification.ts';
import { applyOrgVerificationAssetFromBytes } from '../_shared/orgVerificationAssetUpload.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { assertWithinUploadLimit } from '../_shared/uploadLimits.ts';
import { formatPublicUrl } from '../_shared/utils.ts';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

/** Upload-only proofs for contract consideration (not stored on verification.assets). */
const CONSIDERATION_PROOF_ASSET_TYPES = [
  'property_consideration_proof',
  'parking_consideration_proof',
] as const;
type ConsiderationProofAssetType = (typeof CONSIDERATION_PROOF_ASSET_TYPES)[number];

function isConsiderationProofType(value: string): value is ConsiderationProofAssetType {
  return (CONSIDERATION_PROOF_ASSET_TYPES as readonly string[]).includes(value);
}

serveAuthenticated('upload-org-verification-asset', async (req) => {
  requireHttpMethod(req, 'POST');

  const formData = await req.formData();
  const orgId =
    typeof formData.get('orgId') === 'string' ? String(formData.get('orgId')).trim() : '';
  const assetTypeRaw =
    typeof formData.get('assetType') === 'string' ? String(formData.get('assetType')).trim() : '';
  const file = formData.get('file');

  if (!orgId) return jsonError(req, 'orgId is required');
  const considerationProof = isConsiderationProofType(assetTypeRaw);
  if (
    !considerationProof &&
    !ORG_VERIFICATION_ASSET_TYPES.includes(assetTypeRaw as OrgVerificationAssetType)
  ) {
    return jsonError(req, 'Invalid assetType');
  }
  if (!(file instanceof File)) return jsonError(req, 'file is required');

  const mime = (file.type || '').toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return jsonError(req, 'File must be JPEG, PNG, WebP, or PDF');
  }
  assertWithinUploadLimit(file, mime === 'application/pdf' ? 'pdf' : 'document');

  await verifyOrgOwner(req, orgId);

  if (considerationProof) {
    const supabase = createServiceClient();
    const ext =
      mime === 'application/pdf'
        ? '.pdf'
        : mime === 'image/png'
          ? '.png'
          : mime === 'image/webp'
            ? '.webp'
            : '.jpg';
    const storagePath = `org/${orgId}/${assetTypeRaw}/${crypto.randomUUID()}${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(ORG_VERIFICATION_BUCKET)
      .upload(storagePath, file, { upsert: false, contentType: mime, cacheControl: '31536000' });

    if (uploadError) {
      console.error('[upload-org-verification-asset]', uploadError.message);
      return jsonError(req, 'Upload failed', 500);
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(ORG_VERIFICATION_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);

    if (signedError) {
      console.error('[upload-org-verification-asset] signed url', signedError.message);
    }

    return jsonSuccess(req, {
      path: storagePath,
      previewUrl: signed?.signedUrl ? formatPublicUrl(signed.signedUrl) : null,
      assetType: assetTypeRaw,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await applyOrgVerificationAssetFromBytes({
    organizationId: orgId,
    assetType: assetTypeRaw as OrgVerificationAssetType,
    bytes,
    mimeType: mime,
    fileName: file.name || 'proof.jpg',
  });

  return jsonSuccess(req, {
    path: result.path,
    previewUrl: result.previewUrl,
    assetType: result.assetType,
    verification: result.verification,
  });
});
