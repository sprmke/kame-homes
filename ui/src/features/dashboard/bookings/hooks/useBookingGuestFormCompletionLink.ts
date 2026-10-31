/**
 * Guest-form completion link for an OTA-ingested booking (calendar sync Phase 2, §6.5).
 *
 * The host copies this link and forwards it to their Airbnb guest (via the Airbnb message
 * thread) so the guest fills in the normal check-in form against this existing reservation —
 * dates locked. Unlike the stay-guide link this is minted on demand (not auto-issued), since
 * most bookings never need it.
 */

import { useCallback } from 'react';

import { toast } from 'sonner';

import { useIssueGuestFormCompletionToken } from '@/features/dashboard/bookings/hooks/useTransitionBooking';
import { resolveBookingPropertySlug } from '@/features/dashboard/bookings/lib/bookingListNavigation';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';

export type BookingGuestFormCompletionLink = {
  /** True when this booking can use the completion link (OTA source + still pending review). */
  eligible: boolean;
  /** A token exists — the link is ready to copy without another round-trip. */
  ready: boolean;
  pending: boolean;
  /** Mints the token if needed, then copies the URL to the clipboard. */
  copy: () => void;
};

function isCompletionEligible(booking: BookingRow | null | undefined): boolean {
  if (!booking) return false;
  const external =
    !!booking.external_source || (booking.booking_source ?? '').trim().toLowerCase() === 'airbnb';
  if (!external) return false;
  if (booking.status !== 'PENDING_REVIEW') return false;
  return true;
}

export function useBookingGuestFormCompletionLink(
  booking: BookingRow | null | undefined
): BookingGuestFormCompletionLink {
  const orgContext = useOptionalOrgContext();
  const propertySlug = booking
    ? (resolveBookingPropertySlug(booking, orgContext?.propertySlug) ?? '')
    : '';

  const eligible = isCompletionEligible(booking);
  const token = booking?.guest_form_token?.trim() ?? '';
  const readyUrl =
    eligible && token
      ? `${window.location.origin}/form?complete=${encodeURIComponent(token)}${
          propertySlug ? `&property=${encodeURIComponent(propertySlug)}` : ''
        }`
      : '';

  const { mutateAsync: issueToken, isPending } = useIssueGuestFormCompletionToken(booking?.id);

  const copy = useCallback(() => {
    const write = (url: string) =>
      navigator.clipboard
        .writeText(url)
        .then(() => toast.success('Guest form link copied. Send it to your Airbnb guest'))
        .catch(() => toast.error('Could not copy link'));

    if (readyUrl) {
      void write(readyUrl);
      return;
    }
    void issueToken()
      .then((res) => {
        const url = res.data?.completionUrl;
        if (url) void write(url);
        else toast.error('Could not create the guest form link');
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Could not create the guest form link');
      });
  }, [readyUrl, issueToken]);

  return { eligible, ready: !!readyUrl, pending: isPending, copy };
}
