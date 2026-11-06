/**
 * submit-pay-parking — retired.
 *
 * Guest pay-parking links redirect into the marketplace. No UI calls this endpoint
 * anymore; it stays as a 410 stub for old links and cached bundles until it is
 * deleted after one release soak.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const RETIRED_MESSAGE =
  'This parking form is retired. Use Find parking from your stay or the link your host shared.';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: RETIRED_MESSAGE,
      code: 'PAY_PARKING_RETIRED',
    }),
    {
      status: 410,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    }
  );
});
