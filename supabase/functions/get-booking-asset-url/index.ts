/**
 * get-booking-asset-url — Admin-only helper to return a browser-loadable URL for
 * Supabase Storage objects. Public buckets: normalized public URL. Private buckets
 * private buckets (guest docs + admin PDFs): short-lived signed URL.
 *
 * POST JSON: `{ "url": "<stored storage or kong URL>" }`
 * Auth: verifyAdminJwt (see admin-auth.mdc §6).
 */

import { createClient } from '../_shared/supabaseJs.ts';
import {
  DEFAULT_SIGNED_URL_TTL_SEC,
  parseStorageObjectUrl,
  PRIVATE_STORAGE_BUCKETS,
} from '../_shared/storageSignedUrl.ts';
import { formatPublicUrl } from '../_shared/utils.ts';
import {
  jsonResponse,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('get-booking-asset-url', async (req) => {
  await resolveScopedPropertyAccess(req, 'bookings:view');
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
  if (!rawUrl) throw new Error('url is required');

  const normalized = formatPublicUrl(rawUrl);
  const loc = parseStorageObjectUrl(normalized);

  if (!loc || !PRIVATE_STORAGE_BUCKETS.has(loc.bucket)) {
    return jsonSuccess(req, { url: normalized });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.storage
    .from(loc.bucket)
    .createSignedUrl(loc.path, DEFAULT_SIGNED_URL_TTL_SEC);

  if (error || !data?.signedUrl) {
    const msg = error?.message ?? 'Failed to create signed URL for storage object';
    if (/not found/i.test(msg)) {
      console.warn(`[get-booking-asset-url] Storage object missing: ${loc.bucket}/${loc.path}`);
      return jsonResponse(
        req,
        {
          success: false,
          error: 'Object not found',
          code: 'STORAGE_OBJECT_NOT_FOUND',
        },
        404
      );
    }
    throw new Error(msg);
  }

  return jsonSuccess(req, { url: formatPublicUrl(data.signedUrl) });
});
