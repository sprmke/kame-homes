/**
 * Phase 7 — links a marketplace parking booking (`parking_id` row) back to the property
 * booking (`property_id` row) it was self-served from, so a successful parking payment can
 * auto-clear that property booking's `PENDING_PARKING_REQUEST` gate
 * (`parkingPaymentOrchestrator.ts#fulfillParkingPayment`) and its detail page can show live
 * match/host-contact status instead of legacy manual fields (`ParkingPanel.tsx`).
 */

import { createServiceClient } from './orgAuth.ts';
import { isBookingStatus, type BookingStatus } from './statusMachine.ts';

/**
 * A property booking becomes linkable once it's been confirmed past the initial guest-form
 * submission (`PENDING_DOCUMENTS` or later) — this deliberately excludes `PENDING_REVIEW`.
 * `transition-booking`'s same-status `document_completion_target: 'PENDING_PARKING_REQUEST'`
 * call (the only mechanism that sets `parking_completed_at`) only has an effect from
 * `PENDING_DOCUMENTS` or from a post-Pending-Documents status (`isPostPendingDocumentsStatus`,
 * the documented "late parking" rule) — never from `PENDING_REVIEW`, where there is no code
 * path that would apply it. Restricting linkability to the same set keeps every payment-time
 * auto-complete call (see `parkingPaymentOrchestrator.ts`) landing on a status the orchestrator
 * actually knows how to act on.
 *
 * `PENDING_GAF`/`PENDING_PARKING_REQUEST`/`PENDING_PET_REQUEST` are included for completeness
 * (pre-configurable-requirements legacy rows can still literally sit at one of these), but the
 * orchestrator has no same-status edge for any of the three (`TRANSITION_GRAPH` doesn't
 * self-loop them, and `isLatePendingParkingDocumentTransition` only covers post-Pending-Documents
 * statuses) — an auto-complete attempt from exactly one of these three literal statuses will be
 * caught and logged, not applied, same as it already was before this booking could self-serve
 * parking at all (an admin can still complete it manually via the same button).
 */
const PARKING_LINKABLE_STATUSES = new Set<BookingStatus>([
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
  'READY_FOR_CHECKOUT',
  'PENDING_SD_REFUND',
  'COMPLETED',
]);

export function isParkingLinkableStatus(status: string | null | undefined): boolean {
  const value = String(status ?? '').trim();
  return isBookingStatus(value) && PARKING_LINKABLE_STATUSES.has(value);
}

export type LinkableParkingBookingDto = {
  id: string;
  propertyName: string | null;
  propertySlug: string | null;
  checkInDate: string;
  checkOutDate: string;
  towerAndUnitNumber: string | null;
  carPlateNumber: string | null;
  carBrandModel: string | null;
  carColor: string | null;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
};

type BookingRow = {
  id: string;
  status: string;
  property_id: string | null;
  check_in_date: string;
  check_out_date: string;
  tower_and_unit_number: string | null;
  car_plate_number: string | null;
  car_brand_model: string | null;
  car_color: string | null;
  primary_guest_name: string | null;
  guest_email: string | null;
  guest_phone_number: string | null;
};

type PropertyRow = { id: string; slug: string; name: string };

/**
 * Property bookings this guest (by auth id, falling back to email — same identity match as
 * `guestProfileService.ts#listGuestTrips`, mirrored here rather than imported to keep this
 * marketplace-facing module decoupled from the guest-portal trips list) can still link a
 * marketplace parking booking to: `need_parking = true`, confirmed enough
 * (`isParkingLinkableStatus`), and not already linked by another parking booking.
 */
export async function listLinkableParkingBookingsForGuest(
  userId: string,
  email: string
): Promise<LinkableParkingBookingDto[]> {
  const supabase = createServiceClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: bookings, error } = await supabase
    .from('guest_submissions')
    .select(
      'id, status, property_id, check_in_date, check_out_date, tower_and_unit_number, car_plate_number, car_brand_model, car_color, primary_guest_name, guest_email, guest_phone_number'
    )
    .not('property_id', 'is', null)
    .eq('need_parking', true)
    .or(`guest_user_id.eq.${userId},and(guest_user_id.is.null,guest_email.eq.${normalizedEmail})`)
    .order('check_in_date', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[parkingPropertyLink] list bookings failed:', error.message);
    throw new Error('Failed to load bookings');
  }

  const eligible = ((bookings ?? []) as BookingRow[]).filter((row) =>
    isParkingLinkableStatus(row.status)
  );
  if (eligible.length === 0) return [];

  const { data: alreadyLinked } = await supabase
    .from('guest_submissions')
    .select('linked_property_booking_id')
    .in(
      'linked_property_booking_id',
      eligible.map((row) => row.id)
    )
    .not('linked_property_booking_id', 'is', null);
  const linkedIds = new Set(
    (alreadyLinked ?? []).map((row) => String(row.linked_property_booking_id))
  );
  const unlinked = eligible.filter((row) => !linkedIds.has(row.id));
  if (unlinked.length === 0) return [];

  const propertyIds = [...new Set(unlinked.map((row) => String(row.property_id)))];
  const { data: properties } = await supabase
    .from('properties')
    .select('id, slug, name')
    .in('id', propertyIds);
  const propertyMap = new Map<string, PropertyRow>();
  for (const property of (properties ?? []) as PropertyRow[]) {
    propertyMap.set(property.id, property);
  }

  return unlinked.map((row) => {
    const property = row.property_id ? propertyMap.get(row.property_id) : undefined;
    return {
      id: row.id,
      propertyName: property?.name ?? null,
      propertySlug: property?.slug ?? null,
      checkInDate: row.check_in_date,
      checkOutDate: row.check_out_date,
      towerAndUnitNumber: row.tower_and_unit_number,
      carPlateNumber: row.car_plate_number,
      carBrandModel: row.car_brand_model,
      carColor: row.car_color,
      guestName: row.primary_guest_name,
      guestEmail: row.guest_email,
      guestPhone: row.guest_phone_number,
    } satisfies LinkableParkingBookingDto;
  });
}

export class ParkingLinkError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Verifies `propertyBookingId` belongs to this guest, is still linkable, and isn't already
 * linked — throws `ParkingLinkError` otherwise. Called from `submit-parking-booking-request`
 * before stamping `linked_property_booking_id` onto the new marketplace booking row.
 */
export async function verifyLinkablePropertyBooking(
  propertyBookingId: string,
  userId: string,
  email: string
): Promise<void> {
  const supabase = createServiceClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: booking } = await supabase
    .from('guest_submissions')
    .select('id, status, property_id, guest_user_id, guest_email')
    .eq('id', propertyBookingId)
    .maybeSingle();

  if (!booking || !booking.property_id) {
    throw new ParkingLinkError('Property booking not found', 404);
  }
  const owns =
    (booking.guest_user_id && String(booking.guest_user_id) === userId) ||
    (!booking.guest_user_id && String(booking.guest_email ?? '').toLowerCase() === normalizedEmail);
  if (!owns) {
    throw new ParkingLinkError('Not your booking', 403);
  }
  if (!isParkingLinkableStatus(booking.status)) {
    throw new ParkingLinkError('This booking cannot be linked yet', 409);
  }

  const { data: existingLink } = await supabase
    .from('guest_submissions')
    .select('id')
    .eq('linked_property_booking_id', propertyBookingId)
    .maybeSingle();
  if (existingLink) {
    throw new ParkingLinkError('This booking is already linked to a parking request', 409);
  }
}
