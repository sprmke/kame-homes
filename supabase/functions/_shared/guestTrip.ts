/**
 * Guest trip hub — booking-scoped payload for `/properties/:slug/trip?bookingId=`.
 * Access rules live in `guestTripAccess.ts`.
 *
 * Property marketing data (address, rules, cancellation policy, host card) stays on
 * `get-public-property`; this payload only carries what is specific to the booking.
 */

import { resolveAppSettings } from './appSettings.ts';
import { ensureBookingDocumentShareToken } from './bookingDocumentShareToken.ts';
import { manilaTodayYmd, normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';
import { mintGuestBookingAccessToken } from './guestBookingAccessToken.ts';
import { loadGuestFacingContactInfo } from './guestContactInfo.ts';
import { canAccessGuestReview, resolveGuestReviewPath } from './guestReviewEligibility.ts';
import { guestReviewExistsForBooking } from './guestReviewService.ts';
import {
  ensureGuestStayGuideToken,
  isStayGuideAccessActive,
  isStayGuideEligibleStatus,
  propertyHasStayGuideAccess,
} from './guestStayGuide.ts';
import { createServiceClient } from './orgAuth.ts';
import { resolveGuestParkingCtaAbsoluteUrl } from './ownerDefaultParking.ts';
import { normalizePropertyMediaItems } from './propertyMedia.ts';
import { guestBookingDocumentPath, guestStayGuidePath } from './publicGuestPaths.ts';
import { canGuestPublicUpdateForm } from './statusMachine.ts';
import { buildStayGuideCheckInDocuments } from './stayGuideCheckInDocuments.ts';
import { resolveDocumentRequirements } from './documentRequirements.ts';
import { computeTotalGuestBalanceFromBooking } from './totalGuestBalance.ts';
import { countStayNights } from './utils.ts';
import type { GuestSubmission } from './types.ts';

type BookingRow = Record<string, unknown>;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type GuestTripDocumentDto = {
  id: string;
  label: string;
  kind: 'gaf' | 'pet' | 'parking' | 'other';
  status: 'ready' | 'pending';
  /** Relative app path (`/properties/…/document?…`) or absolute file URL. */
  href: string | null;
};

export type GuestTripDetailDto = {
  bookingId: string;
  status: string;
  /** Last workflow transition (e.g. when it was cancelled). */
  statusUpdatedAt: string | null;
  createdAt: string | null;
  bookingSource: string | null;
  property: {
    id: string;
    slug: string;
    name: string;
    imageUrl: string | null;
  };
  stay: {
    checkInDate: string;
    checkOutDate: string;
    checkInTime: string | null;
    checkOutTime: string | null;
    nights: number;
    adults: number;
    children: number;
    guestNames: string[];
    email: string;
    phone: string;
    specialRequests: string | null;
  };
  pet: { name: string; type: string | null } | null;
  parking: {
    requested: boolean;
    carPlate: string | null;
    linkedBookingId: string | null;
    linkedStatus: string | null;
    /** Relative marketplace path with `linkStay` (owner slot form when one fits). */
    findPath: string | null;
  };
  payment: {
    /** False while `PENDING_REVIEW` — rates are set by the host during review. */
    ratesConfirmed: boolean;
    bookingRate: number | null;
    downPayment: number | null;
    securityDeposit: number | null;
    petFee: number | null;
    additionalFee: number | null;
    /** Same formula as emails / admin (`computeTotalGuestBalanceFromBooking`). */
    totalBalance: number | null;
    /** `guest_balance_paid_amount` recorded by the host. */
    balancePaid: number;
    /** `totalBalance − balancePaid`, never below 0 (matches admin "Total unpaid"). */
    amountDue: number | null;
    isAirbnb: boolean;
  };
  refund: {
    amount: number | null;
    settledAt: string | null;
  };
  documents: GuestTripDocumentDto[];
  actions: {
    canEditBooking: boolean;
    sdFormAvailable: boolean;
    reviewAvailable: boolean;
    reviewSubmitted: boolean;
  };
  stayGuidePath: string | null;
  voucher: { code: string; amount: number | null; redeemed: boolean } | null;
  contact: {
    name: string;
    phone: string;
    email: string;
    facebookUrl: string;
    airbnbUrl: string;
  };
  /** Fresh access token for signed-in owners so SD / review / edit links work this session. */
  accessToken: string | null;
};

function guestNames(row: BookingRow): string[] {
  const names = [
    str(row.primary_guest_name) || str(row.guest_facebook_name),
    str(row.guest2_name),
    str(row.guest3_name),
    str(row.guest4_name),
    str(row.guest5_name),
  ];
  return names.filter(Boolean);
}

async function loadTripProperty(
  propertyId: string
): Promise<GuestTripDetailDto['property'] | null> {
  const { data, error } = await createServiceClient()
    .from('properties')
    .select('id, slug, name, settings')
    .eq('id', propertyId)
    .maybeSingle();
  if (error || !data) return null;
  const media = normalizePropertyMediaItems((data.settings ?? {}) as Record<string, unknown>);
  const image = media.find((item) => item.type === 'image');
  return {
    id: String(data.id),
    slug: String(data.slug ?? ''),
    name: String(data.name ?? ''),
    imageUrl: image?.url?.trim() || null,
  };
}

async function loadLinkedParking(
  bookingId: string
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await createServiceClient()
    .from('guest_submissions')
    .select('id, status')
    .eq('linked_property_booking_id', bookingId)
    .neq('status', 'CANCELLED')
    .maybeSingle();
  if (error || !data) return null;
  return { id: String(data.id), status: String(data.status ?? '') };
}

async function loadTripDocuments(
  booking: GuestSubmission,
  propertyId: string,
  propertySlug: string
): Promise<GuestTripDocumentDto[]> {
  if (String(booking.status ?? '') === 'CANCELLED') return [];
  const requirements = await resolveDocumentRequirements(propertyId);
  const docs = buildStayGuideCheckInDocuments(booking, requirements);
  if (docs.length === 0) return [];

  const needsShareToken = docs.some(
    (doc) => doc.status === 'ready' && (doc.kind === 'gaf' || doc.kind === 'pet')
  );
  let shareToken: string | null = null;
  if (needsShareToken) {
    try {
      shareToken = await ensureBookingDocumentShareToken(booking);
    } catch (err) {
      console.error('[guestTrip] document share token failed:', err);
    }
  }

  return docs.map((doc) => {
    let href: string | null = null;
    if (doc.status === 'ready') {
      if ((doc.kind === 'gaf' || doc.kind === 'pet') && shareToken) {
        href = guestBookingDocumentPath('', propertySlug, shareToken, doc.kind);
      } else if (doc.kind === 'parking' || doc.kind === 'other') {
        href = doc.url;
      }
    }
    return { id: doc.id, label: doc.label, kind: doc.kind, status: doc.status, href };
  });
}

async function resolveStayGuideRelativePath(
  booking: GuestSubmission,
  propertyId: string,
  propertySlug: string
): Promise<string | null> {
  if (!isStayGuideEligibleStatus(String(booking.status ?? ''))) return null;
  if (!(await propertyHasStayGuideAccess(propertyId))) return null;

  let token = str((booking as Record<string, unknown>).stay_guide_token);
  let row = booking as Record<string, unknown>;
  if (!token || !isStayGuideAccessActive(row)) {
    // RFCI rows that predate token issuance — same self-heal as the chat resume path.
    token = (await ensureGuestStayGuideToken(booking)) ?? token;
    if (!token) return null;
    const { data } = await createServiceClient()
      .from('guest_submissions')
      .select('status, stay_guide_valid_from, stay_guide_valid_until')
      .eq('id', String(booking.id))
      .maybeSingle();
    row = (data ?? {}) as Record<string, unknown>;
  }
  if (!isStayGuideAccessActive(row)) return null;
  return guestStayGuidePath('', propertySlug, token);
}

function guestBalanceAmounts(
  row: BookingRow
): Pick<GuestTripDetailDto['payment'], 'totalBalance' | 'balancePaid' | 'amountDue'> {
  const totalBalance = computeTotalGuestBalanceFromBooking(row);
  const paidRaw = numOrNull(row.guest_balance_paid_amount);
  const balancePaid = paidRaw != null && paidRaw > 0 ? Math.round(paidRaw * 100) / 100 : 0;
  const amountDue =
    totalBalance == null
      ? null
      : Math.max(0, Math.round(totalBalance * 100) - Math.round(balancePaid * 100)) / 100;
  return { totalBalance, balancePaid, amountDue };
}

export async function buildGuestTripPayload(input: {
  booking: BookingRow;
  issueAccessToken: boolean;
  /** `?property=` from the URL; mismatch returns null before any other work. */
  expectedPropertySlug?: string | null;
}): Promise<GuestTripDetailDto | null> {
  const row = input.booking;
  const booking = row as unknown as GuestSubmission;
  const bookingId = str(row.id);
  const propertyId = str(row.property_id);
  if (!bookingId || !propertyId) return null;

  const property = await loadTripProperty(propertyId);
  if (!property?.slug) return null;
  const expectedSlug = input.expectedPropertySlug?.trim();
  if (expectedSlug && expectedSlug !== property.slug) return null;

  const status = str(row.status);
  const isAirbnb = str(row.booking_source) === 'Airbnb';
  const cancelled = status === 'CANCELLED';
  const settings = await resolveAppSettings(propertyId);

  const [contact, linkedParking, documents, stayGuidePath, reviewSubmitted] = await Promise.all([
    loadGuestFacingContactInfo(propertyId, settings),
    loadLinkedParking(bookingId),
    loadTripDocuments(booking, propertyId, property.slug),
    cancelled
      ? Promise.resolve(null)
      : resolveStayGuideRelativePath(booking, propertyId, property.slug),
    guestReviewExistsForBooking(bookingId),
  ]);

  const needParking = row.need_parking === true;
  let findPath: string | null = null;
  if (needParking && !linkedParking && !cancelled) {
    try {
      findPath = await resolveGuestParkingCtaAbsoluteUrl({
        propertyBookingId: bookingId,
        publicGuestAppOrigin: '',
      });
    } catch (err) {
      console.error('[guestTrip] parking CTA resolve failed:', err);
      findPath = `/parkings?linkStay=${encodeURIComponent(bookingId)}`;
    }
  }

  const reviewPath = resolveGuestReviewPath(row);
  const sdFormAvailable = reviewPath === 'sd_refund' && canAccessGuestReview(row);
  const reviewAvailable = reviewPath === 'airbnb_post_stay' && canAccessGuestReview(row);

  const checkInDate = normalizeBookingDateToYmd(str(row.check_in_date)) ?? str(row.check_in_date);
  const checkOutDate =
    normalizeBookingDateToYmd(str(row.check_out_date)) ?? str(row.check_out_date);

  const voucherCode = str(row.next_stay_voucher_code);

  return {
    bookingId,
    status,
    statusUpdatedAt: str(row.status_updated_at) || null,
    createdAt: str(row.created_at) || null,
    bookingSource: str(row.booking_source) || null,
    property,
    stay: {
      checkInDate,
      checkOutDate,
      checkInTime: str(row.check_in_time) || null,
      checkOutTime: str(row.check_out_time) || null,
      nights:
        countStayNights(str(row.check_in_date), str(row.check_out_date)) ||
        Number(row.number_of_nights) ||
        1,
      adults: Number(row.number_of_adults) || 1,
      children: Number(row.number_of_children) || 0,
      guestNames: guestNames(row),
      email: str(row.guest_email),
      phone: str(row.guest_phone_number),
      specialRequests: str(row.guest_special_requests) || null,
    },
    pet:
      row.has_pets === true
        ? { name: str(row.pet_name) || 'Pet', type: str(row.pet_type) || null }
        : null,
    parking: {
      requested: needParking,
      carPlate: str(row.car_plate_number) || null,
      linkedBookingId: linkedParking?.id ?? null,
      linkedStatus: linkedParking?.status ?? null,
      findPath,
    },
    payment: {
      ratesConfirmed: status !== 'PENDING_REVIEW',
      bookingRate: numOrNull(row.booking_rate),
      downPayment: numOrNull(row.down_payment),
      securityDeposit: numOrNull(row.security_deposit),
      petFee: row.has_pets === true ? numOrNull(row.pet_fee) : null,
      additionalFee: numOrNull(row.guest_additional_fee),
      ...guestBalanceAmounts(row),
      isAirbnb,
    },
    refund: {
      amount: numOrNull(row.sd_refund_amount),
      settledAt: str(row.settled_at) || null,
    },
    documents,
    actions: {
      canEditBooking: canGuestPublicUpdateForm(status),
      sdFormAvailable,
      reviewAvailable,
      reviewSubmitted,
    },
    stayGuidePath,
    voucher: voucherCode
      ? {
          code: voucherCode,
          amount: numOrNull(row.next_stay_voucher_amount),
          redeemed: Boolean(str(row.next_stay_voucher_redeemed_at)),
        }
      : null,
    contact: {
      name: contact.contactName,
      phone: contact.contactPhone,
      email: contact.contactEmail,
      facebookUrl: contact.facebookPageUrl,
      airbnbUrl: contact.airbnbUrl,
    },
    accessToken: input.issueAccessToken ? await mintGuestBookingAccessToken(bookingId) : null,
  };
}

/**
 * Signed-in guest's most relevant trip at a property (chat resource hub): the current or next
 * non-cancelled stay, else the latest past one. Relative path, or null when none.
 */
export async function resolveGuestTripPathForProperty(
  user: { id: string; email: string },
  propertyId: string,
  propertySlug: string
): Promise<string | null> {
  const slug = propertySlug.trim();
  if (!propertyId.trim() || !slug) return null;
  const email = user.email.trim().toLowerCase();
  const { data, error } = await createServiceClient()
    .from('guest_submissions')
    .select('id, status, check_in_date, check_out_date')
    .eq('property_id', propertyId)
    .is('parking_id', null)
    .neq('status', 'CANCELLED')
    .or(`guest_user_id.eq.${user.id},and(guest_user_id.is.null,guest_email.eq.${email})`)
    .limit(50);
  if (error) {
    console.warn('[guestTrip] resolveGuestTripPathForProperty:', error.message);
    return null;
  }

  const today = manilaTodayYmd();
  const rows = (data ?? []).map((r) => ({
    id: String(r.id),
    checkIn: normalizeBookingDateToYmd(str(r.check_in_date)) ?? '',
    checkOut: normalizeBookingDateToYmd(str(r.check_out_date)) ?? '',
  }));
  const active = rows
    .filter((r) => r.checkOut >= today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
  const latest = rows.sort((a, b) => b.checkIn.localeCompare(a.checkIn))[0];
  const pick = active ?? latest;
  if (!pick) return null;
  return `/properties/${encodeURIComponent(slug)}/trip?bookingId=${encodeURIComponent(pick.id)}`;
}
