import { useMutation } from '@tanstack/react-query';

import { guestEdgeAuthHeaders } from '@/features/guest/auth/lib/guestEdgeAuthHeaders';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function createParkingPaymentCheckout(bookingId: string): Promise<{ checkoutUrl: string }> {
  const authHeaders = await guestEdgeAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/create-parking-payment-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ bookingId }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { checkoutUrl: string };
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Could not start payment');
  }
  return json.data;
}

/** Guest "Pay now" — creates/reuses a PayMongo checkout link, then the caller redirects to it. */
export function useCreateParkingPaymentCheckout() {
  return useMutation({ mutationFn: createParkingPaymentCheckout });
}
