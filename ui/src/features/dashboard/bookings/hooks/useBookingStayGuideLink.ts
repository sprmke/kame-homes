/**
 * Guest stay-guide link for one booking: eligibility, the shareable URL, and the
 * one-shot token backfill for RFCI+ rows that predate auto-issue on transition.
 *
 * The link is a booking-scoped share action, not a pipeline stage, so it hangs
 * off the detail page's action menu instead of holding a permanent block in the
 * progress rail.
 */

import { useCallback, useEffect, useRef } from 'react';

import { toast } from 'sonner';

import { guestStayGuidePath } from '@/features/guest/lib/guestPublicPaths';

import { useIssueGuestStayGuideToken } from '@/features/dashboard/bookings/hooks/useTransitionBooking';
import { resolveBookingPropertySlug } from '@/features/dashboard/bookings/lib/bookingListNavigation';
import { isStayGuideEligibleStatus } from '@/features/dashboard/bookings/lib/bookingStatus';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

export type BookingStayGuideLink = {
  /** Empty until the booking is stay-guide eligible and its token has been issued. */
  url: string;
  /** A token is being minted — the link exists but isn't shareable yet. */
  pending: boolean;
  /** Eligible booking, but the plan lacks `propertyShowcase` (stay guide is Pro+). */
  locked: boolean;
  open: () => void;
  copy: () => void;
  /** Opens the upgrade modal for `propertyShowcase`. */
  upgrade: () => void;
};

export function useBookingStayGuideLink(
  booking: BookingRow | null | undefined
): BookingStayGuideLink {
  const orgContext = useOptionalOrgContext();
  const propertySlug = booking
    ? (resolveBookingPropertySlug(booking, orgContext?.propertySlug) ?? '')
    : '';

  const eligible = isStayGuideEligibleStatus(booking?.status);
  const { canUse, isLoading: entitlementsLoading } = useFeatureGate('propertyShowcase');
  const { open: openUpgradeModal } = useUpgradeModal();
  const locked = eligible && !canUse && !entitlementsLoading;
  const token = booking?.stay_guide_token?.trim() ?? '';
  const url =
    eligible && canUse && token && propertySlug
      ? `${window.location.origin}${guestStayGuidePath(propertySlug, token)}`
      : '';

  const issueMut = useIssueGuestStayGuideToken(booking?.id);
  /** Dedupes React Strict Mode's double invoke; re-arms per booking. */
  const autoIssuedForRef = useRef<string | null>(null);
  const { mutateAsync: issueToken, isPending } = issueMut;

  useEffect(() => {
    if (!booking || !eligible || !canUse || token || isPending) return;
    if (autoIssuedForRef.current === booking.id) return;
    autoIssuedForRef.current = booking.id;
    void issueToken().catch(() => {});
  }, [booking, eligible, canUse, token, isPending, issueToken]);

  const open = useCallback(() => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  const copy = useCallback(() => {
    if (!url) return;
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Stay guide link copied'))
      .catch(() => toast.error('Could not copy link'));
  }, [url]);

  const upgrade = useCallback(() => openUpgradeModal('propertyShowcase'), [openUpgradeModal]);

  return { url, pending: isPending, locked, open, copy, upgrade };
}
