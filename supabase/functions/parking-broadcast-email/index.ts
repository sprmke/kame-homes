/**
 * parking-broadcast-email — retired (Phase 7 property-booking migration).
 *
 * Legacy BCC parking-owner emails for property bookings are removed. Hosts arrange parking
 * through Find parking / Use your parking / marketplace linkStay instead.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';

const RETIRED_MESSAGE =
  'Property parking broadcast emails are retired. Use Find parking or share the marketplace link from the booking detail page.';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: RETIRED_MESSAGE,
      code: 'PARKING_BROADCAST_RETIRED',
    }),
    {
      status: 410,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    }
  );
});
