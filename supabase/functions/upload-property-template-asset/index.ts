/**
 * upload-property-template-asset — Admin upload for standard template images.
 * - section_image: persists section_image_url on property_template_contents
 * - inline_image: returns public URL for WYSIWYG editor embeds
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleEdgeError } from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { applyPropertyTemplateAssetFromBytes } from '../_shared/propertyTemplateAssetUpload.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    const { property } = await resolveScopedPropertyAccess(req, 'templates.standard:edit');
    const propertyId = property.id;

    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    const formData = await req.formData();
    const assetType = String(formData.get('assetType') ?? '').trim();
    const file = formData.get('file') as File;
    const templateKey = String(formData.get('templateKey') ?? '').trim();
    const fileName = (formData.get('fileName') as string) || file?.name;

    if (assetType !== 'section_image' && assetType !== 'inline_image') {
      throw new Error(`Invalid assetType: "${assetType}"`);
    }
    if (!file) throw new Error('file is required');
    if (!fileName) throw new Error('fileName is required');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await applyPropertyTemplateAssetFromBytes({
      propertyId,
      assetType,
      bytes,
      mimeType: file.type || '',
      fileName,
      templateKey: templateKey || undefined,
    });

    console.log(`[upload-property-template-asset] Uploaded ${assetType}: ${result.url}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          url: result.url,
          bucket: result.bucket,
          path: result.path,
          templateKey: result.templateKey,
        },
      }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return await handleEdgeError(req, error, '[upload-property-template-asset]');
  }
});
