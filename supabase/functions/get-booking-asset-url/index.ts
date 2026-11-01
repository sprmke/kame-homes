/**
 * get-booking-asset-url — Admin-only helper to return a browser-loadable URL for
 * Supabase Storage objects. Public buckets: normalized public URL. Private buckets
 * private buckets (guest docs + admin PDFs): short-lived signed URL.
 *
 * POST JSON: `{ "url": "<stored storage or kong URL>", "booking_id"?: "<uuid>" }` with `?property_id=` (RBAC scope).
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
import {
  bookingAssetUrlColumnList,
  bookingRowReferencesStorageObject,
} from '../_shared/bookingAssetUrlScope.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('get-booking-asset-url', async (req) => {
  const access = await resolveScopedPropertyAccess(req, 'bookings:view');
  const propertyId = access.property.id;
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);
  const rawUrl = typeof body.url === 'string' ? body.url.trim() : '';
  const bookingId = typeof body.booking_id === 'string' ? body.booking_id.trim() : '';
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

  // Cross-property guard: the resolved property must actually reference this
  // private object (via one of the guest_submissions storage columns). Without
  // this check an admin with bookings:view on property A could mint signed URLs
  // for property B's private guest documents.
  const supabase = createClient(supabaseUrl, serviceKey);

  let inScope = false;
  if (bookingId) {
    const { data: row, error: rowError } = await supabase
      .from('guest_submissions')
      .select(`id, ${bookingAssetUrlColumnList()}`)
      .eq('id', bookingId)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (rowError) throw new Error(rowError.message);
    inScope = Boolean(row && bookingRowReferencesStorageObject(row, loc));
  } else {
    const { data: rows, error: rowsError } = await supabase
      .from('guest_submissions')
      .select(`id, ${bookingAssetUrlColumnList()}`)
      .eq('property_id', propertyId)
      .limit(200);
    if (rowsError) throw new Error(rowsError.message);
    inScope = (rows ?? []).some((row) => bookingRowReferencesStorageObject(row, loc));
  }

  if (!inScope) {
    return jsonResponse(
      req,
      { success: false, error: 'Object not in scope for this property' },
      403
    );
  }

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
