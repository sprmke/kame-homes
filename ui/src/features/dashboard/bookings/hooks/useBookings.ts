/**
 * useBookings — Admin hook for the paginated booking list.
 *
 * Phase 3: calls the `list-bookings` edge function (admin JWT required) which
 * handles server-side check_in_date sorting (converting MM-DD-YYYY → YYYY-MM-DD
 * in the service layer), default COMPLETED hiding, and accurate pagination.
 *
 * Falls back to a direct PostgREST read when the user's session JWT is unavailable
 * (shouldn't happen inside RequireAdmin, but prevents a hard crash during hydration).
 *
 * Plan: docs/planning/NEW_FLOW_PLAN.md §6.1 Q5.1, Q5.2
 */

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { BookingsListScope } from '@/features/dashboard/bookings/lib/bookingListNavigation';
import {
  compareBookingsForListSort,
  manilaTodayIso,
  matchesDefaultBookingsListVisibility,
  passesListCheckInDateRangeFilter,
} from '@/features/dashboard/bookings/lib/bookingsListSort';
import { buildBookingsListStatusOrFilter } from '@/features/dashboard/bookings/lib/bookingsStatusFilter';
import type { BookingRow, BookingsQuery } from '@/features/dashboard/bookings/lib/types';
import {
  appendOrgId,
  appendParkingId,
  appendPropertyId,
  useOrgScopeKey,
  useOrgSlugParam,
  useParkingIdParam,
  usePropertyIdParam,
} from '@/features/dashboard/org/lib/adminApiScope';

import { readE2EAdminAccessToken } from '@/lib/e2e/adminSession';
import { supabase } from '@/lib/supabase/client';

import type { Query, QueryClient } from '@tanstack/react-query';

export const BOOKINGS_QUERY_KEY = ['bookings'] as const;

type BookingsResult = {
  rows: BookingRow[];
  total: number;
};

/** Query key layout: `['bookings', scope, orgSlug, orgId, propertyId, parkingId, query]` (see `useBookings` below). */
const BOOKINGS_PROPERTY_ID_KEY_INDEX = 4;

/**
 * Matches cached bookings-list queries for a single property, instead of every cached
 * org/property/parking/filter/page combo. Falls back to matching all bookings-list queries
 * when `propertyId` is unknown (mutation ran outside a property-scoped route) so callers
 * never silently under-invalidate.
 */
function bookingsListPredicate(propertyId: string | null) {
  return (query: Query) => {
    if (query.queryKey[0] !== BOOKINGS_QUERY_KEY[0]) return false;
    if (!propertyId) return true;
    return query.queryKey[BOOKINGS_PROPERTY_ID_KEY_INDEX] === propertyId;
  };
}

/** Scoped replacement for `invalidateQueries({ queryKey: BOOKINGS_QUERY_KEY })`. */
export function invalidateBookingsListForProperty(qc: QueryClient, propertyId: string | null) {
  return qc.invalidateQueries({ predicate: bookingsListPredicate(propertyId) });
}

/** Optimistically patches the matching row (by booking id) across all cached list pages for this property. */
export function patchBookingsListRow(
  qc: QueryClient,
  propertyId: string | null,
  bookingId: string,
  patch: Partial<BookingRow>
) {
  qc.setQueriesData<BookingsResult>({ predicate: bookingsListPredicate(propertyId) }, (old) => {
    if (!old || !Array.isArray(old.rows)) return old;
    return {
      ...old,
      rows: old.rows.map((row) => (row.id === bookingId ? { ...row, ...patch } : row)),
    };
  });
}

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

const GENERIC_BOOKINGS_ERROR = 'We could not load bookings. Please try again in a moment.';

type FetchScope = {
  scope: BookingsListScope;
  propertyId: string | null;
  parkingId: string | null;
  orgSlug: string | null;
  orgId: string | null;
};

async function fetchBookingsFromEdgeFunction(
  query: BookingsQuery,
  fetchScope: FetchScope
): Promise<BookingsResult> {
  const jwt =
    readE2EAdminAccessToken() ?? (await supabase.auth.getSession()).data.session?.access_token;
  if (!jwt) throw new Error('No admin session');

  const params = new URLSearchParams();
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.status.length > 0) query.status.forEach((s) => params.append('status', s));
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  if (query.hasPets !== null) params.set('has_pets', String(query.hasPets));
  if (query.needParking !== null) params.set('need_parking', String(query.needParking));
  if (query.bookingKind) params.set('booking_kind', query.bookingKind);
  params.set('sort', query.sort);
  params.set('page', String(query.page));
  params.set('limit', String(query.limit));
  if (query.showCompletedBookings) {
    params.set('show_completed_bookings', 'true');
  }
  if (query.expandImportedBatch) {
    params.set('expand_imported_batch', 'true');
  }

  if (fetchScope.scope === 'org') {
    appendOrgId(params, fetchScope.orgSlug, fetchScope.orgId);
  } else if (fetchScope.scope === 'parking') {
    appendParkingId(params, fetchScope.parkingId);
  } else {
    appendPropertyId(params, fetchScope.propertyId);
  }

  const res = await fetch(`${FUNCTIONS_URL}/list-bookings?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? GENERIC_BOOKINGS_ERROR);
  }

  return { rows: json.data as BookingRow[], total: json.total as number };
}

export function useBookings(
  query: BookingsQuery,
  options?: { scope?: BookingsListScope; enabled?: boolean }
) {
  const propertyId = usePropertyIdParam();
  const parkingId = useParkingIdParam();
  const { orgSlug, orgId } = useOrgScopeKey();
  const routeOrgSlug = useOrgSlugParam();

  const scope: BookingsListScope =
    options?.scope ??
    (parkingId ? 'parking' : propertyId ? 'property' : routeOrgSlug || orgId ? 'org' : 'property');

  const fetchScope: FetchScope = {
    scope,
    propertyId,
    parkingId,
    orgSlug: routeOrgSlug ?? orgSlug,
    orgId,
  };

  return useQuery<BookingsResult>({
    queryKey: [
      ...BOOKINGS_QUERY_KEY,
      scope,
      fetchScope.orgSlug,
      fetchScope.orgId,
      propertyId,
      parkingId,
      query,
    ] as const,
    queryFn: async () => {
      try {
        return await fetchBookingsFromEdgeFunction(query, fetchScope);
      } catch (err) {
        if (scope === 'org' || scope === 'parking') {
          console.error('[useBookings] Edge function failed:', err);
          throw err instanceof Error ? err : new Error(GENERIC_BOOKINGS_ERROR);
        }

        console.error('[useBookings] Edge function failed, falling back to PostgREST:', err);

        let request = supabase.from('guest_submissions').select('*');

        if (propertyId) {
          request = request.eq('property_id', propertyId);
        }

        if (query.q.trim()) {
          const needle = `%${query.q.trim()}%`;
          request = request.or(
            [
              `guest_facebook_name.ilike.${needle}`,
              `primary_guest_name.ilike.${needle}`,
              `guest_email.ilike.${needle}`,
              `guest_phone_number.ilike.${needle}`,
              `guest_address.ilike.${needle}`,
              `nationality.ilike.${needle}`,
              `guest2_name.ilike.${needle}`,
              `guest3_name.ilike.${needle}`,
              `guest4_name.ilike.${needle}`,
              `pet_name.ilike.${needle}`,
              `pet_type.ilike.${needle}`,
              `pet_breed.ilike.${needle}`,
              `car_plate_number.ilike.${needle}`,
              `car_brand_model.ilike.${needle}`,
              `car_color.ilike.${needle}`,
              `guest_special_requests.ilike.${needle}`,
              `find_us_details.ilike.${needle}`,
            ].join(',')
          );
        }

        if (query.status.length > 0) {
          const statusOr = buildBookingsListStatusOrFilter(
            query.status,
            query.expandImportedBatch ?? false
          );
          request = statusOr ? request.or(statusOr) : request.in('status', [...query.status]);
        }

        if (query.hasPets === true) request = request.eq('has_pets', true);
        if (query.hasPets === false) request = request.eq('has_pets', false);
        if (query.needParking === true) request = request.eq('need_parking', true);
        if (query.needParking === false) request = request.eq('need_parking', false);

        request = request.order('created_at', { ascending: false });

        const { data, error } = await request;
        if (error) {
          console.error('[useBookings] PostgREST fallback error', error);
          throw new Error(GENERIC_BOOKINGS_ERROR);
        }

        const today = manilaTodayIso();
        let rows = (data ?? []) as BookingRow[];

        if (query.from || query.to) {
          rows = rows.filter((r) => passesListCheckInDateRangeFilter(r, query.from, query.to));
        }

        rows = rows.filter((r) =>
          matchesDefaultBookingsListVisibility(r, query.showCompletedBookings)
        );

        rows.sort((a, b) => compareBookingsForListSort(a, b, query.sort, today));

        const total = rows.length;
        const fromIdx = (query.page - 1) * query.limit;
        const paged = rows.slice(fromIdx, fromIdx + query.limit);

        return { rows: paged, total };
      }
    },
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    enabled:
      options?.enabled === false
        ? false
        : scope === 'property'
          ? true
          : scope === 'parking'
            ? Boolean(parkingId)
            : Boolean(fetchScope.orgSlug || fetchScope.orgId),
  });
}
