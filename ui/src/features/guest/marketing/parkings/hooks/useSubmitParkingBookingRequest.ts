import { useMutation } from '@tanstack/react-query';

import { guestEdgeAuthHeaders } from '@/features/guest/auth/lib/guestEdgeAuthHeaders';

import { antiSpamErrorMessage, isAntiSpamFailure } from '@/lib/security/antiSpamResponse';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

export type SubmitParkingBookingRequestInput = {
  parkingId: string;
  checkInDate: string;
  checkOutDate: string;
  vehicleType: 'car' | 'motorcycle';
  primaryGuestName: string;
  guestEmail: string;
  guestPhone?: string;
  unitNumber: string;
  carPlateNumber: string;
  carBrandModel: string;
  carColor: string;
  notes?: string;
  /** Phase 7 — links this marketplace booking back to the property stay it's for. */
  linkedPropertyBookingId?: string;
  /** Phase 8 — the ?dl= token from a host's shared direct-booking link, if any. */
  directLinkToken?: string;
  /** Anti-spam heuristics (honeypot + form-load timestamp); server reads these off the body. */
  contact_time?: string;
  formLoadedAt?: string;
};

export type SubmitParkingBookingRequestResult = {
  bookingId: string;
  status: string;
  expiresAt: string | null;
};

async function submitParkingBookingRequest(
  input: SubmitParkingBookingRequestInput
): Promise<SubmitParkingBookingRequestResult> {
  const authHeaders = await guestEdgeAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/submit-parking-booking-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(input),
  });
  const json = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    data?: SubmitParkingBookingRequestResult;
    error?: string;
    rateLimited?: boolean;
    retryAfterSec?: number;
  };
  if (!res.ok || !json.success || !json.data) {
    if (isAntiSpamFailure(res.status, json)) {
      throw new Error(antiSpamErrorMessage(res.status, json));
    }
    throw new Error(json.error ?? 'Could not submit parking request');
  }
  return json.data;
}

export function useSubmitParkingBookingRequest() {
  return useMutation({ mutationFn: submitParkingBookingRequest });
}
