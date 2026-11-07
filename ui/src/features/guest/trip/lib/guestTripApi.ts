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
  cancellation: {
    policy: {
      title: string;
      description: string;
      shortLabel: string;
      timeline: Array<{ daysBefore: number; refundPercent: number; label: string }>;
      fallbackRefundPercent: number;
      needsReview: boolean;
      unset: boolean;
      capturedFrom: string | null;
    };
    nonRefundable: boolean;
    outcome: {
      mode:
        | 'computed'
        | 'host_decides'
        | 'external'
        | 'after_checkin'
        | 'not_cancellable';
      refundPercent: number | null;
      checkInInstantIso: string;
      cancellableUntilIso: string;
      deadlines: Array<{
        daysBefore: number;
        refundPercent: number;
        deadlineIso: string;
        label: string;
      }>;
      nextDeadline: {
        daysBefore: number;
        refundPercent: number;
        deadlineIso: string;
        label: string;
      } | null;
      amountPaidPhp: number;
      refundablePaidPhp: number;
      retainedPhp: number;
      refundDuePhp: number;
      appliedRule: { kind: string; label: string; deadlineIso?: string } | null;
      warnings: string[];
      lines: Array<{
        kind: string;
        label: string;
        amountPhp: number;
        note?: string;
      }>;
    };
    canCancel: boolean;
    canRequest: boolean;
    canWithdraw: boolean;
    request: {
      id: string;
      status: string;
      reasonCode: string;
      requestedAt: string;
      hostMessage: string | null;
    } | null;
    refund: {
      amountPhp: number;
      status: 'not_due' | 'awaiting_guest_details' | 'pending' | 'sent' | 'cancelled';
      sentAt: string | null;
      method: string | null;
      proofUrl: string | null;
    } | null;
  };
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
  /** HTTP status when the server answered; absent for a client-side failure. */
  readonly status?: number;

  constructor(code: GuestTripErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'GuestTripError';
    this.code = code;
    this.status = status;
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
    // Status lets `reportQueryError` treat a wrong/expired link as an outcome, not a fault.
    if (res.status === 401 || json.error === 'sign_in_required') {
      throw new GuestTripError('sign_in_required', message, res.status);
    }
    if (res.status === 404) throw new GuestTripError('not_found', message, res.status);
    throw new GuestTripError('unknown', message, res.status);
  }

  // Signed-in owners get a token so SD form / review / edit links work in this tab.
  if (json.data.accessToken) storeGuestBookingAccessToken(id, json.data.accessToken);
  return json.data;
}

// ─── Cancellation actions ────────────────────────────────────────────────────

export class GuestCancellationError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'GuestCancellationError';
    this.code = code;
    this.status = status;
  }
}

async function postGuestCancellation<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${FUNCTIONS_URL}/${functionName}`, {
    method: 'POST',
    headers: { ...(await guestEdgeAuthHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    message?: string;
    data?: T;
  };
  if (!res.ok || !json.success) {
    throw new GuestCancellationError(
      json.error ?? 'unknown',
      json.message ?? json.error ?? 'Something went wrong. Try again.',
      res.status
    );
  }
  return json.data as T;
}

export type CancellationActionInput = {
  bookingId: string;
  reasonCode: string;
  reasonNote?: string;
};

export async function cancelGuestBooking(input: CancellationActionInput) {
  return postGuestCancellation<{ cancelled: boolean; outcome: GuestTrip['cancellation']['outcome'] }>(
    'guest-cancel-booking',
    {
      bookingId: input.bookingId,
      accessToken: readGuestBookingAccessToken(input.bookingId) ?? undefined,
      reasonCode: input.reasonCode,
      reasonNote: input.reasonNote ?? '',
      confirm: true,
    }
  );
}

export async function requestGuestCancellation(input: CancellationActionInput) {
  return postGuestCancellation<{ request: { id: string } }>('guest-cancellation-request', {
    bookingId: input.bookingId,
    accessToken: readGuestBookingAccessToken(input.bookingId) ?? undefined,
    action: 'create',
    reasonCode: input.reasonCode,
    reasonNote: input.reasonNote ?? '',
  });
}

export async function withdrawGuestCancellationRequest(bookingId: string) {
  return postGuestCancellation<{ withdrawn: boolean }>('guest-cancellation-request', {
    bookingId,
    accessToken: readGuestBookingAccessToken(bookingId) ?? undefined,
    action: 'withdraw',
  });
}

export async function submitGuestRefundDetails(input: {
  bookingId: string;
  method: 'same_phone' | 'other_bank' | 'cash';
  bank?: string;
  accountName?: string;
  accountNumber?: string;
  phone?: string;
}) {
  return postGuestCancellation<{ refund: Record<string, unknown> }>('submit-guest-refund-details', {
    bookingId: input.bookingId,
    accessToken: readGuestBookingAccessToken(input.bookingId) ?? undefined,
    method: input.method,
    bank: input.bank,
    accountName: input.accountName,
    accountNumber: input.accountNumber,
    phone: input.phone,
  });
}
