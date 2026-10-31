import { createClient } from '../_shared/supabaseJs.ts';
import { DatabaseService } from '../_shared/databaseService.ts';
import { signGuestFormDataStorageUrls } from '../_shared/storageSignedUrl.ts';
import { canGuestPublicUpdateForm } from '../_shared/statusMachine.ts';
import { extractRouteParam } from '../_shared/utils.ts';
import { authorizeGuestBookingAccess } from '../_shared/guestBookingAccessToken.ts';
import { jsonError, jsonResponse, requireHttpMethod } from '../_shared/httpResponse.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { servePublic } from '../_shared/serveEdge.ts';

servePublic('get-form', async (req) => {
  requireHttpMethod(req, 'GET');

  const limited = await publicGetRateLimitGate(req, 'get-form', { maxPerMin: 30 });
  if (limited) return limited;

  const url = new URL(req.url);
  const bookingId = extractRouteParam(url.pathname, '/get-form/');

  if (!bookingId) {
    throw new Error('bookingId is required');
  }

  const access = url.searchParams.get('access')?.trim() ?? null;
  const bookingRow = await DatabaseService.getBookingById(bookingId);
  const authz = await authorizeGuestBookingAccess({
    bookingIdFromPath: bookingId,
    accessTokenFromQuery: access,
    bookingCreatedAt: (bookingRow?.created_at as string | null | undefined) ?? null,
  });
  if (!authz.ok) {
    return jsonError(req, authz.message, authz.status);
  }

  let formData = await DatabaseService.getFormData(bookingId);

  if (!formData) {
    return jsonResponse(
      req,
      {
        success: false,
        error: 'Booking not found',
        message: 'No booking found with the provided ID',
      },
      404
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    formData = await signGuestFormDataStorageUrls(formData, supabase);
  }

  const guestCanUpdate = canGuestPublicUpdateForm(bookingRow?.status);

  return jsonResponse(req, {
    success: true,
    data: formData,
    status: bookingRow?.status ?? null,
    guestCanUpdate,
    message: 'Form data retrieved successfully.',
  });
});
