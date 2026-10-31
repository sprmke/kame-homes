import { useCallback } from 'react';

import { useNavigate } from 'react-router-dom';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { guestParkingFormPath } from '@/features/guest/lib/guestPublicPaths';

import type { GuestNavState } from '@/layouts/guest/navState';
import { dateToString } from '@/utils/format/dates';

export type UseParkingReserveOptions = {
  parkingSlug: string;
  checkIn: Date | null;
  checkOut: Date | null;
  onNeedDates?: () => void;
  /**
   * When set, opens the booking form in-place (e.g. listing modal) instead of
   * navigating to `/parkings/:slug/form`. Requires guest auth before opening.
   */
  onOpenForm?: (dates: { checkIn: Date; checkOut: Date }) => void;
};

export function useParkingReserve({
  parkingSlug,
  checkIn,
  checkOut,
  onNeedDates,
  onOpenForm,
}: UseParkingReserveOptions) {
  const navigate = useNavigate();
  const { requireGuestAuth } = useGuestAuth();

  const reserve = useCallback(() => {
    const slug = parkingSlug.trim();
    if (!slug) return;

    if (!checkIn || !checkOut) {
      onNeedDates?.();
      return;
    }

    if (onOpenForm) {
      const open = () => onOpenForm({ checkIn, checkOut });
      requireGuestAuth(open, {
        resume: {
          type: 'parking_booking_form_modal',
          parkingSlug: slug,
          checkInDate: dateToString(checkIn),
          checkOutDate: dateToString(checkOut),
        },
      });
      return;
    }

    const next = new URLSearchParams();
    next.set('checkInDate', dateToString(checkIn));
    next.set('checkOutDate', dateToString(checkOut));

    const target = guestParkingFormPath(slug, next);
    const navState = { guestEnter: 'forward' } satisfies GuestNavState;

    requireGuestAuth(() => navigate(target, { state: navState }), {
      resume: { type: 'navigate', to: target, navState },
    });
  }, [parkingSlug, checkIn, checkOut, onNeedDates, onOpenForm, navigate, requireGuestAuth]);

  return { reserve, hasDates: Boolean(checkIn && checkOut) };
}
