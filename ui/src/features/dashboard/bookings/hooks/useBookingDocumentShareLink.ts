/**
 * Guest-safe share link for one booking's approved GAF or Pet PDF: the shareable
 * URL and the one-shot token issuance for bookings that don't have one yet.
 * Mirrors `useBookingStayGuideLink.ts` — no stay-dated eligibility window here,
 * approval proof is shareable any time the document exists.
 */

import { useEffect, useRef } from 'react';

import { guestBookingDocumentPath } from '@/features/guest/lib/guestPublicPaths';

import { useIssueBookingDocumentShareToken } from '@/features/dashboard/bookings/hooks/useTransitionBooking';
import { resolveBookingPropertySlug } from '@/features/dashboard/bookings/lib/bookingListNavigation';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';

export type BookingDocumentKind = 'gaf' | 'pet';

export type BookingDocumentShareLink = {
  /** Empty until the document exists on the booking and its token has been issued. */
  url: string;
  /** A token is being minted — the link exists but isn't shareable yet. */
  pending: boolean;
};

const DOCUMENT_URL_FIELD: Record<
  BookingDocumentKind,
  'approved_gaf_pdf_url' | 'approved_pet_pdf_url'
> = {
  gaf: 'approved_gaf_pdf_url',
  pet: 'approved_pet_pdf_url',
};

export function useBookingDocumentShareLink(
  booking: BookingRow | null | undefined,
  doc: BookingDocumentKind
): BookingDocumentShareLink {
  const orgContext = useOptionalOrgContext();
  const propertySlug = booking
    ? (resolveBookingPropertySlug(booking, orgContext?.propertySlug) ?? '')
    : '';

  const hasDocument = Boolean(booking?.[DOCUMENT_URL_FIELD[doc]]);
  const token = booking?.document_share_token?.trim() ?? '';
  const url =
    hasDocument && token && propertySlug
      ? `${window.location.origin}${guestBookingDocumentPath(propertySlug, token, doc)}`
      : '';

  const issueMut = useIssueBookingDocumentShareToken(booking?.id);
  /** Dedupes React Strict Mode's double invoke; re-arms per booking. */
  const autoIssuedForRef = useRef<string | null>(null);
  const { mutateAsync: issueToken, isPending } = issueMut;

  useEffect(() => {
    if (!booking || !hasDocument || token || isPending) return;
    if (autoIssuedForRef.current === booking.id) return;
    autoIssuedForRef.current = booking.id;
    void issueToken().catch(() => {});
  }, [booking, hasDocument, token, isPending, issueToken]);

  return { url, pending: isPending };
}
