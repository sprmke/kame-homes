import { useQuery } from '@tanstack/react-query';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type ParkingBookingStatusValue =
  | 'PENDING_HOST_ACCEPTANCE'
  | 'PENDING_PAYMENT'
  | 'PENDING_REVIEW'
  | 'READY_FOR_CHECKIN'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_HOST_AVAILABLE';

export type ParkingHostContact = { name: string; email: string; phone: string | null };

export type ParkingBookingStatus = {
  status: ParkingBookingStatusValue;
  checkInDate: string;
  checkOutDate: string;
  expiresAt: string | null;
  /** Which ranked-dispatch batch is currently active (1 = first/cheapest). */
  batchNumber: number;
  parkingLabel: string | null;
  parkingSlug: string | null;
  parkingName: string | null;
  residenceName: string | null;
  coverImage: string | null;
  brandColor: string;
  logoUrl: string | null;
  endorsementNote: string | null;
  organizationName: string | null;
  /** Phase 5 — set once the auto/manual endorsement email send succeeds. */
  endorsementSentAt: string | null;
  endorsementSendError: string | null;
  /** Exact HTML that was sent, only populated once endorsementSentAt is set. */
  endorsementEmailSnapshot: string | null;
  /** Guest-facing host contact reveal — null until endorsementSentAt is set. */
  hostContact: ParkingHostContact | null;
  supportEscalationPhone: string | null;
};

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  'COMPLETED',
  'CANCELLED',
  'NO_HOST_AVAILABLE',
]);

/** Short-interval poll only while host acceptance or guest payment is in flight. */
const IN_FLIGHT_STATUSES: ReadonlySet<string> = new Set([
  'PENDING_HOST_ACCEPTANCE',
  'PENDING_PAYMENT',
]);

async function fetchParkingBookingStatus(bookingId: string): Promise<ParkingBookingStatus> {
  const res = await fetch(
    `${FUNCTIONS_URL}/get-parking-booking-status?bookingId=${encodeURIComponent(bookingId)}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  const json = (await res.json()) as {
    success?: boolean;
    data?: ParkingBookingStatus;
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Request not found');
  }
  return json.data;
}

/**
 * Polls every 4s while status is non-terminal — no Realtime subscription in v1 (deviation
 * from the original "locked" Realtime decision; kept as polling since it already meets the
 * spec's own ≤5s fallback bar — see docs/workflow/in-progress/parking-e2e-phase1-guest-request-realtime-status.md).
 * One retry so a transient network blip on first load doesn't read identically to a
 * genuine 404 — the query only gives up and shows "not found" after two failures.
 */
export function useParkingBookingStatus(bookingId: string) {
  return useQuery({
    queryKey: ['parking-booking-status', bookingId],
    queryFn: () => fetchParkingBookingStatus(bookingId),
    enabled: Boolean(bookingId),
    retry: 1,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status || TERMINAL_STATUSES.has(status)) return false;
      if (!IN_FLIGHT_STATUSES.has(status)) return false;
      return 4000;
    },
  });
}
