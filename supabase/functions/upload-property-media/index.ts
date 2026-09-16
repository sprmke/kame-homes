/**
 * upload-property-media — Admin upload/delete for property gallery media.
 * Auth: JWT + resolveScopedPropertyAccess (`settings.media:edit`).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '../_shared/supabaseJs.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleEdgeError } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { PROPERTY_MEDIA_BUCKET, normalizePropertyMediaItems } from '../_shared/propertyMedia.ts';
import {
  applyPropertyMediaFromBytes,
  persistPropertyMedia,
  readPropertyMedia,
} from '../_shared/propertyMediaUpload.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const { property } = await resolveScopedPropertyAccess(req, 'settings.media:edit');
    const propertyId = property.id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'DELETE') {
      const body = (await req.json().catch(() => ({}))) as {
        storagePath?: string;
        mediaId?: string;
      };
      const storagePath = typeof body.storagePath === 'string' ? body.storagePath.trim() : '';
      const mediaId = typeof body.mediaId === 'string' ? body.mediaId.trim() : '';

      if (!storagePath && !mediaId) {
        throw new Error('storagePath or mediaId is required');
      }

      const current = await readPropertyMedia(propertyId);
      const next = current.filter((item) => {
        if (mediaId && item.id === mediaId) return false;
        if (storagePath && item.storagePath === storagePath) return false;
        return true;
      });

      const normalized = normalizePropertyMediaItems(next);
      await persistPropertyMedia(propertyId, normalized);

      if (storagePath) {
        const expectedPrefix = `${propertyId}/`;
        if (!storagePath.startsWith(expectedPrefix)) {
          throw new Error('Invalid storage path');
        }
        const { error: removeError } = await supabase.storage
          .from(PROPERTY_MEDIA_BUCKET)
          .remove([storagePath]);
        if (removeError) {
          console.warn('[upload-property-media] Storage delete failed:', removeError.message);
        }
      }

      return new Response(JSON.stringify({ success: true, data: { media: normalized } }), {
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
    const result = await applyPropertyMediaFromBytes({
      propertyId,
      bytes,
      mimeType: file.type || '',
      fileName,
    });

    console.log(
      `[upload-property-media] Uploaded ${result.item.type} for ${propertyId}: ${result.item.storagePath}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          item: result.item,
          media: result.media,
        },
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return await handleEdgeError(req, error, '[upload-property-media]');
  }
});
