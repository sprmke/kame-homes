import { useMutation, useQueryClient } from '@tanstack/react-query';

import { guestEdgeAuthHeaders } from '@/features/guest/auth/lib/guestEdgeAuthHeaders';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function requestParkingEndorsement(bookingId: string): Promise<{ sent: boolean }> {
  const authHeaders = await guestEdgeAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/request-parking-endorsement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ bookingId }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { sent: boolean };
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Could not send endorsement');
  }
  return json.data;
}

/** Guest-triggered retry when the auto-send on payment success failed (Phase 5). */
export function useRequestParkingEndorsement(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => requestParkingEndorsement(bookingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['parking-booking-status', bookingId] });
    },
  });
}
