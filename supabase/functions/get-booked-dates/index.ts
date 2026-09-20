import { createClient } from '../_shared/supabaseJs.ts';
import { jsonError, jsonResponse } from '../_shared/httpResponse.ts';
import { publicGetRateLimitGate } from '../_shared/publicEndpointRateLimit.ts';
import { loadBlockedRanges } from '../_shared/propertyBlockedDates.ts';
import { resolvePublicPropertyId } from '../_shared/propertyScope.ts';
import { servePublic } from '../_shared/serveEdge.ts';

servePublic('get-booked-dates', async (req) => {
  if (req.method !== 'GET') {
    throw new Error(`Method ${req.method} not allowed`);
  }

  const limited = await publicGetRateLimitGate(req, 'get-booked-dates');
  if (limited) return limited;

  const url = new URL(req.url);
  const propertyId = await resolvePublicPropertyId(url);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const today = new Date();

  const { data: bookings, error } = await supabase
    .from('guest_submissions')
    .select('id, check_in_date, check_out_date, check_in_time, check_out_time, status')
    .eq('property_id', propertyId)
    .neq('status', 'CANCELLED')
    // IMPORTED bookings are historical records — they must not block live availability.
    // Treat them the same as CANCELLED for date-blocking purposes.
    .neq('status', 'IMPORTED');

  if (error) {
    console.error('Database error:', error);
    throw new Error('Failed to fetch bookings');
  }

  const parseMMDDYYYY = (dateStr: string): Date | null => {
    try {
      const [month, day, year] = dateStr.split('-');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } catch {
      return null;
    }
  };

  const normalizeDate = (dateStr: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
      const [month, day, year] = dateStr.split('-');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
  };

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const bookedDateRanges =
    bookings
      ?.filter((booking) => {
        // CANCELLED and IMPORTED are already excluded by the DB query above;
        // this guard handles any future statuses that slip through.
        if (booking.status === 'CANCELLED' || booking.status === 'IMPORTED') {
          return false;
        }

        const checkOutDate = parseMMDDYYYY(booking.check_out_date);
        if (!checkOutDate) {
          console.warn(`Invalid date format for booking ${booking.id}: ${booking.check_out_date}`);
          return false;
        }
        return checkOutDate >= todayStart;
      })
      .map((booking) => ({
        id: booking.id,
        checkInDate: normalizeDate(booking.check_in_date),
        checkOutDate: normalizeDate(booking.check_out_date),
        checkInTime: booking.check_in_time || undefined,
        checkOutTime: booking.check_out_time || undefined,
      })) ?? [];

  // Owner-managed blocks are unavailable to guests the same way booked nights are.
  const parseYMD = (dateStr: string): Date | null => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!match) return null;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  };

  const blockedRanges = await loadBlockedRanges(propertyId);
  const blockedDateRanges = blockedRanges
    .filter((range) => {
      const end = parseYMD(range.end_date);
      return !!end && end >= todayStart;
    })
    .map((range) => ({
      id: `blocked-${range.id}`,
      checkInDate: normalizeDate(range.start_date),
      checkOutDate: normalizeDate(range.end_date),
    }));

  // Availability data — short TTL, no stale-while-revalidate: stale availability
  // here means a guest sees a night as free that's actually booked.
  return jsonResponse(
    req,
    {
      success: true,
      data: [...bookedDateRanges, ...blockedDateRanges],
      message: 'Future booked dates retrieved successfully.',
    },
    200,
    'publicAvailability'
  );
});
