/**
 * upload-org-settings-asset — Admin upload for org-scoped team logo.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { handleEdgeError } from '../_shared/httpResponse.ts';
import { verifyAdminJwt } from '../_shared/auth.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { applyOrgTeamLogoFromBytes } from '../_shared/orgTeamLogoUpload.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  try {
    await verifyAdminJwt(req);
    const ctx = await resolveOrgAccessContext(req, 'org.settings.basic:edit');
    const organizationId = ctx.org.id;

    if (req.method !== 'POST') {
      throw new Error(`Method ${req.method} not allowed`);
    }

    const formData = await req.formData();
    const assetType = formData.get('assetType') as string;
    const file = formData.get('file') as File;
    const fileName = (formData.get('fileName') as string) || file?.name;

    if (assetType !== 'team_logo') {
      throw new Error(`Invalid assetType: "${assetType}"`);
    }
    if (!file) throw new Error('file is required');
    if (!fileName) throw new Error('fileName is required');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await applyOrgTeamLogoFromBytes({
      organizationId,
      bytes,
      mimeType: file.type || 'image/jpeg',
      fileName,
    });

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
    return await handleEdgeError(req, error, '[upload-org-settings-asset]');
  }
});
