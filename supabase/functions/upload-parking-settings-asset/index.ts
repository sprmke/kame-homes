/**
 * upload-parking-settings-asset — Admin upload for parking operator assets (GCash QR).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '../_shared/supabaseJs.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleEdgeError } from '../_shared/httpResponse.ts';
import { resolveScopedParkingAccess } from '../_shared/parkingScope.ts';
import { assertWithinUploadLimit } from '../_shared/uploadLimits.ts';
import { formatPublicUrl } from '../_shared/utils.ts';

const BUCKET = 'app-settings-assets';
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

type AssetType = 'gcash_qr';

const ASSET_CONFIG: Record<AssetType, { storagePrefix: string }> = {
  gcash_qr: {
    storagePrefix: 'parking-gcash-qr',
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const { parkingRow } = await resolveScopedParkingAccess(req, 'org.parkings:manage');
    const parkingId = parkingRow.id;

    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    const formData = await req.formData();
    const assetType = formData.get('assetType') as AssetType;
    const file = formData.get('file') as File;
    const fileName = (formData.get('fileName') as string) || file?.name;

    if (!assetType || !ASSET_CONFIG[assetType]) {
      throw new Error(`Invalid assetType: "${assetType}"`);
    }
    if (!file) throw new Error('file is required');
    if (!fileName) throw new Error('fileName is required');

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
    // Unique path — staging only; parking_settings row updates on OTP-gated PATCH.
    const storagePath = `${ASSET_CONFIG[assetType].storagePrefix}/${parkingId}/${crypto.randomUUID()}${ext}`;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, file, { upsert: false, contentType: mime, cacheControl: '31536000' });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const safePublicUrl = formatPublicUrl(publicUrl);

    console.log(`[upload-parking-settings-asset] Staged ${assetType} for ${parkingId}`);

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
  } catch (error) {
    return await handleEdgeError(req, error, '[upload-parking-settings-asset]');
  }
});
