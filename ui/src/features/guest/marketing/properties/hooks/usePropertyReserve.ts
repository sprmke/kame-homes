import { useCallback } from 'react';

import { useNavigate } from 'react-router-dom';

import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';
import { guestFormPath } from '@/features/guest/lib/guestPublicPaths';

import { dateToString } from '@/utils/format/dates';

export type UsePropertyReserveOptions = {
  propertySlug: string;
  checkIn: Date | null;
  checkOut: Date | null;
  adults?: number;
  children?: number;
  /** Called when Reserve is tapped without a complete date range. */
  onNeedDates?: () => void;
  /**
   * When set, opens the booking form in-place (e.g. listing modal) instead of
   * navigating to `/properties/:slug/form`. Requires guest auth before opening.
   */
  onOpenForm?: (dates: { checkIn: Date; checkOut: Date }) => void;
};

export function usePropertyReserve({
  propertySlug,
  checkIn,
  checkOut,
  adults,
  children,
  onNeedDates,
  onOpenForm,
}: UsePropertyReserveOptions) {
  const navigate = useNavigate();
  const { requireGuestAuth } = useGuestAuth();

  const reserve = useCallback(() => {
    const slug = propertySlug.trim();
    if (!slug) return;

    if (!checkIn || !checkOut) {
      onNeedDates?.();
      return;
    }

    if (onOpenForm) {
      const open = () => onOpenForm({ checkIn, checkOut });
      requireGuestAuth(open, {
        resume: {
          type: 'booking_form_modal',
          propertySlug: slug,
          checkInDate: dateToString(checkIn),
          checkOutDate: dateToString(checkOut),
          ...(adults != null && adults >= 1 ? { adults } : {}),
          ...(children != null && children >= 0 ? { children } : {}),
        },
      });
      return;
    }

    const next = new URLSearchParams();
    next.set('checkInDate', dateToString(checkIn));
    next.set('checkOutDate', dateToString(checkOut));
    if (adults != null && adults >= 1) next.set('adults', String(adults));
    if (children != null && children >= 0) next.set('children', String(children));
    next.delete('bookingId');

    const target = guestFormPath(slug, next);
    requireGuestAuth(() => navigate(target), {
      resume: { type: 'navigate', to: target },
    });
  }, [
    propertySlug,
    checkIn,
    checkOut,
    adults,
    children,
    onNeedDates,
    onOpenForm,
    navigate,
    requireGuestAuth,
  ]);

  return { reserve, hasDates: Boolean(checkIn && checkOut) };
}
