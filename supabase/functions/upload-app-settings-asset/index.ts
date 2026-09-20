/**
 * upload-app-settings-asset — Admin upload for operator-level assets (GCash QR, GAF signature, review proof).
 * Auth: verifyAdminJwt. Writes public URL to app_settings when configured.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '../_shared/supabaseJs.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleEdgeError } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import {
  applyAppSettingsAssetFromBytes,
  isAppSettingsApplyAssetType,
} from '../_shared/appSettingsAssetUpload.ts';
import { assertWithinUploadLimit } from '../_shared/uploadLimits.ts';
import { formatPublicUrl } from '../_shared/utils.ts';

const BUCKET = 'app-settings-assets';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    const formData = await req.formData();
    const assetType = String(formData.get('assetType') ?? '').trim();
    const file = formData.get('file') as File;
    const fileName = (formData.get('fileName') as string) || file?.name;
    const reviewId = (formData.get('reviewId') as string | null)?.trim() || undefined;
    const photoIndexRaw = formData.get('photoIndex');
    const photoIndex =
      photoIndexRaw == null || photoIndexRaw === '' ? undefined : Number(photoIndexRaw);

    if (!file) throw new Error('file is required');
    if (!fileName) throw new Error('fileName is required');

    if (assetType === 'gcash_qr') {
      const { property } = await resolveScopedPropertyAccess(req, 'settings.payment:edit');
      const propertyId = property.id;
      const mime = (file.type || '').toLowerCase();
      if (!ALLOWED_MIME.has(mime)) {
        throw new Error('File must be JPEG, PNG, or WebP');
      }
      assertWithinUploadLimit(file, 'image');
      const ext = fileName.includes('.')
        ? `.${fileName.split('.').pop()?.toLowerCase()}`
        : mime === 'image/png'
          ? '.png'
          : mime === 'image/webp'
            ? '.webp'
            : '.jpg';
      const storagePath = `gcash-qr/${propertyId}/${crypto.randomUUID()}${ext}`;
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { upsert: true, contentType: mime, cacheControl: '31536000' });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      const safePublicUrl = formatPublicUrl(publicUrl);
      console.log(`[upload-app-settings-asset] Uploaded gcash_qr: ${safePublicUrl}`);
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            url: safePublicUrl,
            bucket: BUCKET,
            path: storagePath,
            column: null,
          },
        }),
        { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    if (!isAppSettingsApplyAssetType(assetType)) {
      throw new Error(`Invalid assetType: "${assetType}"`);
    }

    const permission =
      assetType === 'gaf_unit_owner_signature'
        ? ('settings.buildingForms:edit' as const)
        : ('settings.socials:edit' as const);
    const { property } = await resolveScopedPropertyAccess(req, permission);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await applyAppSettingsAssetFromBytes({
      propertyId: property.id,
      assetType,
      bytes,
      mimeType: file.type || '',
      fileName,
      reviewId,
      photoIndex,
    });

    console.log(`[upload-app-settings-asset] Uploaded ${assetType}: ${result.url}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: result.url,
          bucket: result.bucket,
          path: result.path,
          column: result.column,
        },
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return await handleEdgeError(req, error, '[upload-app-settings-asset]');
  }
});
