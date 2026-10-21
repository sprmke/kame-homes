import { guestEdgeAuthHeaders } from '@/features/guest/auth/lib/guestEdgeAuthHeaders';
import {
  readGuestBookingAccessToken,
  storeGuestBookingAccessToken,
} from '@/features/guest/form/lib/guestBookingAccess';

const FUNCTIONS_URL = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');

export type GuestTripDocument = {
  id: string;
  label: string;
  kind: 'gaf' | 'pet' | 'parking' | 'other';
  status: 'ready' | 'pending';
  /** Relative app path (`/properties/…/document?…`) or absolute file URL. */
  href: string | null;
};

/** Mirrors `GuestTripDetailDto` in `supabase/functions/_shared/guestTrip.ts`. */
export type GuestTrip = {
  bookingId: string;
  status: string;
  statusUpdatedAt: string | null;
  createdAt: string | null;
  bookingSource: string | null;
  property: { id: string; slug: string; name: string; imageUrl: string | null };
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
    findPath: string | null;
  };
  payment: {
    /** False while pending review: the host sets rates during review. */
    ratesConfirmed: boolean;
    bookingRate: number | null;
    downPayment: number | null;
    securityDeposit: number | null;
    petFee: number | null;
    additionalFee: number | null;
    /** Total guest balance (stay balance + deposit + fees), same as emails. */
    totalBalance: number | null;
    /** Balance payments the host has recorded. */
    balancePaid: number;
    /** Still unpaid, never below 0. */
    amountDue: number | null;
    isAirbnb: boolean;
  };
  refund: { amount: number | null; settledAt: string | null };
  documents: GuestTripDocument[];
  actions: {
    canEditBooking: boolean;
    sdFormAvailable: boolean;
    reviewAvailable: boolean;
    reviewSubmitted: boolean;
  };
  review: {
    state: 'open' | 'submitted' | 'published' | 'closed' | 'unavailable';
    closesAt: string | null;
    hostReviewed: boolean;
    guestRating?: number | null;
    guestText?: string | null;
    hostRating?: number | null;
    hostText?: string | null;
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
  accessToken: string | null;
};

export type GuestTripErrorCode = 'sign_in_required' | 'not_found' | 'unknown';

export class GuestTripError extends Error {
  readonly code: GuestTripErrorCode;

  constructor(code: GuestTripErrorCode, message: string) {
    super(message);
    this.name = 'GuestTripError';
    this.code = code;
  }
}

export const GUEST_TRIP_QUERY_KEY = ['guest-trip'] as const;

export async function fetchGuestTrip(bookingId: string, propertySlug: string): Promise<GuestTrip> {
  const id = bookingId.trim();
  const params = new URLSearchParams({ bookingId: id });
  if (propertySlug.trim()) params.set('property', propertySlug.trim());
  const access = readGuestBookingAccessToken(id);
  if (access) params.set('access', access);

  const res = await fetch(`${FUNCTIONS_URL}/get-guest-trip?${params.toString()}`, {
    headers: await guestEdgeAuthHeaders(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    message?: string;
    data?: GuestTrip;
  };

  if (!res.ok || !json.success || !json.data) {
    const message = json.message ?? "We couldn't load this booking.";
    if (res.status === 401 || json.error === 'sign_in_required') {
      throw new GuestTripError('sign_in_required', message);
    }
    if (res.status === 404) throw new GuestTripError('not_found', message);
    throw new GuestTripError('unknown', message);
  }

  // Signed-in owners get a token so SD form / review / edit links work in this tab.
  if (json.data.accessToken) storeGuestBookingAccessToken(id, json.data.accessToken);
  return json.data;
}
