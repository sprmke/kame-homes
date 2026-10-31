/**
 * upload-parking-media — Admin upload/delete for parking cover photo (single image).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '../_shared/supabaseJs.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleEdgeError } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolveScopedParkingAccess } from '../_shared/parkingScope.ts';
import { PROPERTY_MEDIA_BUCKET } from '../_shared/propertyMedia.ts';
import { applyParkingCoverFromBytes } from '../_shared/parkingMediaUpload.ts';

async function readParkingSettings(parkingId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('parkings')
    .select('settings')
    .eq('id', parkingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const settings = data?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {};
  }
  return settings as Record<string, unknown>;
}

async function persistCover(
  parkingId: string,
  coverImage: string | null,
  coverImageStoragePath: string | null
): Promise<{ coverImage: string | null; coverImageStoragePath: string | null }> {
  const supabase = createServiceClient();
  const current = await readParkingSettings(parkingId);
  const nextSettings = { ...current, coverImage, coverImageStoragePath };
  const { error } = await supabase
    .from('parkings')
    .update({ settings: nextSettings, updated_at: new Date().toISOString() })
    .eq('id', parkingId);
  if (error) throw new Error(error.message);
  return { coverImage, coverImageStoragePath };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const { parkingRow } = await resolveScopedParkingAccess(req, 'org.parkings:manage');
    const parkingId = parkingRow.id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'DELETE') {
      const current = await readParkingSettings(parkingId);
      const storagePath =
        typeof current.coverImageStoragePath === 'string'
          ? current.coverImageStoragePath.trim()
          : '';

      const saved = await persistCover(parkingId, null, null);

      if (storagePath && storagePath.startsWith(`parking/${parkingId}/`)) {
        const { error: removeError } = await supabase.storage
          .from(PROPERTY_MEDIA_BUCKET)
          .remove([storagePath]);
        if (removeError) {
          console.warn('[upload-parking-media] Storage delete failed:', removeError.message);
        }
      }

      return new Response(JSON.stringify({ success: true, data: saved }), {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const fileName = (formData.get('fileName') as string) || file?.name || '';

    if (!file) throw new Error('file is required');
    if (!fileName) throw new Error('fileName is required');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await applyParkingCoverFromBytes({
      parkingId,
      bytes,
      mimeType: file.type || '',
      fileName,
    });

    console.log(`[upload-parking-media] Uploaded cover for ${parkingId}: ${result.coverImageStoragePath}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          coverImage: result.coverImage,
          coverImageStoragePath: result.coverImageStoragePath,
        },
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return await handleEdgeError(req, error, '[upload-parking-media]');
  }
});
