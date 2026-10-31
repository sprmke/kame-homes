import { useMutation } from '@tanstack/react-query';

import { guestEdgeAuthHeaders } from '@/features/guest/auth/lib/guestEdgeAuthHeaders';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function cancelParkingBooking(bookingId: string): Promise<{ cancelled: boolean }> {
  const authHeaders = await guestEdgeAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/cancel-parking-booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ bookingId }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { cancelled: boolean };
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Could not cancel request');
  }
  return json.data;
}

/** Guest-initiated cancel — allowed while searching or awaiting payment, not after payment succeeds. */
export function useCancelParkingBooking() {
  return useMutation({ mutationFn: cancelParkingBooking });
}
