/**
 * Resolve the property slug for a legacy guest link that carries only a
 * `bookingId` (emails sent from the legacy app before the multi-tenant
 * property-scoped URLs existed — cutover plan Phase 5.2).
 */

import { guestEdgeGetUrl } from '@/features/guest/form/lib/guestBookingAccess';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

export async function resolveBookingPropertySlug(bookingId: string): Promise<string | null> {
  const id = bookingId.trim();
  if (!UUID_RE.test(id)) return null;
  try {
    const res = await fetch(guestEdgeGetUrl(FUNCTIONS_URL, 'resolve-booking-property', id));
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: { property_slug?: string | null };
    };
    const slug = json.data?.property_slug?.trim();
    return res.ok && json.success && slug ? slug : null;
  } catch {
    return null;
  }
}
