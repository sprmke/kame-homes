/**
 * Resolve org-owned parking defaults for a property stay — prefer the host's own
 * available slot when arranging parking for a property booking.
 */

import { createServiceClient } from './orgAuth.ts';
import { findParkingBroadcastCandidates } from './parkingBroadcast.ts';
import { parkingDatesOverlap } from './parkingDateOverlap.ts';
import { selectInIdChunks } from './postgrestInChunks.ts';
import {
  ownerDefaultDateToYmd,
  rankOwnerDefaultParkingSlots,
  type OwnerDefaultParkingSlot,
} from './ownerDefaultParkingRank.ts';

export type { OwnerDefaultParkingSlot };
export { ownerDefaultDateToYmd, rankOwnerDefaultParkingSlots };

/** `properties.settings.preferredOwnerParkingId` — UUID of preferred org listing. */
export function readPreferredOwnerParkingId(settings: unknown): string | null {
  if (!settings || typeof settings !== 'object') return null;
  const raw = (settings as Record<string, unknown>).preferredOwnerParkingId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

/** `properties.settings.complimentaryOwnerParking` — skip PayMongo for same-org own pins. */
export function readComplimentaryOwnerParking(settings: unknown): boolean {
  if (!settings || typeof settings !== 'object') return false;
  return (settings as Record<string, unknown>).complimentaryOwnerParking === true;
}

export type OwnerDefaultParkingResult = {
  hasOrgParkings: boolean;
  available: OwnerDefaultParkingSlot[];
  defaultParking: OwnerDefaultParkingSlot | null;
  unavailableReason: 'none_owned' | 'all_conflicted' | 'none_active' | null;
  checkInDate: string;
  checkOutDate: string;
};

/**
 * List ACTIVE org parkings available for the property stay window, ranked for default pick.
 * Dates may be MM-DD-YYYY (guest_submissions) or YYYY-MM-DD.
 */
export async function resolveOwnerDefaultParking(input: {
  organizationId: string;
  propertyResidenceName?: string | null;
  checkInDate: string;
  checkOutDate: string;
  /** Prefer slots that accept this type; default `car` when unknown. */
  vehicleType?: 'car' | 'motorcycle';
  /** Property setting — pin this listing first when still available. */
  preferredParkingId?: string | null;
}): Promise<OwnerDefaultParkingResult> {
  const supabase = createServiceClient();
  const checkInDate = ownerDefaultDateToYmd(input.checkInDate);
  const checkOutDate = ownerDefaultDateToYmd(input.checkOutDate);
  const vehicleType = input.vehicleType === 'motorcycle' ? 'motorcycle' : 'car';

  const empty = (
    reason: OwnerDefaultParkingResult['unavailableReason']
  ): OwnerDefaultParkingResult => ({
    hasOrgParkings: false,
    available: [],
    defaultParking: null,
    unavailableReason: reason,
    checkInDate,
    checkOutDate,
  });

  if (!input.organizationId || !checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
    return empty('none_owned');
  }

  const { data: orgParkings, error } = await supabase
    .from('parkings')
    .select('id, slug, name, residence_name, status, created_at')
    .eq('organization_id', input.organizationId);

  if (error) {
    throw new Error(`resolveOwnerDefaultParking: ${error.message}`);
  }

  const rows = orgParkings ?? [];
  if (rows.length === 0) {
    return empty('none_owned');
  }

  const active = rows.filter((r) => r.status === 'ACTIVE');
  if (active.length === 0) {
    return {
      hasOrgParkings: true,
      available: [],
      defaultParking: null,
      unavailableReason: 'none_active',
      checkInDate,
      checkOutDate,
    };
  }

  // findParkingBroadcastCandidates expects DB-format dates (MM-DD-YYYY) for overlap vs stored rows.
  const checkInDb = `${checkInDate.slice(5, 7)}-${checkInDate.slice(8, 10)}-${checkInDate.slice(0, 4)}`;
  const checkOutDb = `${checkOutDate.slice(5, 7)}-${checkOutDate.slice(8, 10)}-${checkOutDate.slice(0, 4)}`;

  const candidates = await findParkingBroadcastCandidates({
    organizationId: input.organizationId,
    requestedVehicleType: vehicleType,
    checkInDate: checkInDb,
    checkOutDate: checkOutDb,
  });

  // Also exclude slots with an in-flight pinned request (parking_id still null until claim).
  const activeIds = active.map((r) => String(r.id));
  const pinnedPending = await selectInIdChunks(activeIds, (chunk) =>
    supabase
      .from('guest_submissions')
      .select(
        'parking_pinned_id, parking_check_in_date, parking_check_out_date, check_in_date, check_out_date'
      )
      .in('parking_pinned_id', chunk)
      .in('status', ['PENDING_HOST_ACCEPTANCE', 'PENDING_PAYMENT'])
  );

  const pinnedBusy = new Set<string>();
  for (const row of pinnedPending) {
    const pinId = row.parking_pinned_id as string | null;
    if (!pinId) continue;
    const existingCheckIn = String(row.parking_check_in_date ?? row.check_in_date ?? '');
    const existingCheckOut = String(row.parking_check_out_date ?? row.check_out_date ?? '');
    if (!existingCheckIn || !existingCheckOut) continue;
    if (parkingDatesOverlap(checkInDb, checkOutDb, existingCheckIn, existingCheckOut)) {
      pinnedBusy.add(pinId);
    }
  }

  const byId = new Map(active.map((r) => [String(r.id), r]));
  const available: OwnerDefaultParkingSlot[] = [];
  for (const c of candidates) {
    if (pinnedBusy.has(c.id)) continue;
    const row = byId.get(c.id);
    if (!row?.slug) continue;
    available.push({
      id: c.id,
      slug: String(row.slug),
      name: String(row.name ?? c.name),
      residenceName: (row.residence_name as string | null) ?? c.residence_name ?? null,
      createdAt: (row.created_at as string | null) ?? null,
    });
  }

  const ranked = rankOwnerDefaultParkingSlots(
    available,
    input.propertyResidenceName ?? null,
    input.preferredParkingId
  );

  return {
    hasOrgParkings: true,
    available: ranked,
    defaultParking: ranked[0] ?? null,
    unavailableReason: ranked.length === 0 ? 'all_conflicted' : null,
    checkInDate,
    checkOutDate,
  };
}

/** True when a pinned parking + linked property stay share the same organization. */
export async function isSameOrgOwnerOwnedPin(input: {
  pinnedParkingId: string;
  linkedPropertyBookingId: string;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const [{ data: parking }, { data: propertyBooking }] = await Promise.all([
    supabase
      .from('parkings')
      .select('organization_id')
      .eq('id', input.pinnedParkingId)
      .maybeSingle(),
    supabase
      .from('guest_submissions')
      .select('property_id')
      .eq('id', input.linkedPropertyBookingId)
      .maybeSingle(),
  ]);

  if (!parking?.organization_id || !propertyBooking?.property_id) return false;

  const { data: property } = await supabase
    .from('properties')
    .select('organization_id')
    .eq('id', propertyBooking.property_id)
    .maybeSingle();

  if (!property?.organization_id) return false;
  return String(parking.organization_id) === String(property.organization_id);
}

/**
 * Absolute guest CTA for property-stay parking emails/reminders:
 * own-default form when an org slot is available, else stay-scoped marketplace find.
 */
export async function resolveGuestParkingCtaAbsoluteUrl(input: {
  propertyBookingId: string;
  publicGuestAppOrigin: string;
}): Promise<string> {
  const origin = input.publicGuestAppOrigin.replace(/\/+$/, '');
  const bookingId = input.propertyBookingId.trim();
  if (!bookingId) return `${origin}/parkings`;

  const findUrl = `${origin}/parkings?linkStay=${encodeURIComponent(bookingId)}`;

  const supabase = createServiceClient();
  const { data: booking } = await supabase
    .from('guest_submissions')
    .select('id, property_id, check_in_date, check_out_date')
    .eq('id', bookingId)
    .maybeSingle();

  if (!booking?.property_id) return findUrl;

  const { data: property } = await supabase
    .from('properties')
    .select('organization_id, residence_name, settings')
    .eq('id', booking.property_id)
    .maybeSingle();

  if (!property?.organization_id) return findUrl;

  const resolved = await resolveOwnerDefaultParking({
    organizationId: String(property.organization_id),
    propertyResidenceName:
      typeof property.residence_name === 'string' ? property.residence_name : null,
    checkInDate: String(booking.check_in_date ?? ''),
    checkOutDate: String(booking.check_out_date ?? ''),
    preferredParkingId: readPreferredOwnerParkingId(property.settings),
  });

  const slot = resolved.defaultParking;
  if (!slot?.slug) return findUrl;

  const params = new URLSearchParams();
  params.set('linkStay', bookingId);
  if (resolved.checkInDate && resolved.checkOutDate) {
    params.set('checkInDate', resolved.checkInDate);
    params.set('checkOutDate', resolved.checkOutDate);
  }
  return `${origin}/parkings/${encodeURIComponent(slot.slug)}/form?${params.toString()}`;
}
