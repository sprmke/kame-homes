/**
 * Host-assist share links — own-default pinned form when available, else marketplace find.
 */

import { useCallback, useMemo } from 'react';

import { toast } from 'sonner';

import type { OwnerDefaultParkingResult } from '@/features/dashboard/bookings/hooks/useOwnerDefaultParking';
import {
  absoluteBookingParkingFindUrl,
  absoluteBookingParkingOwnDefaultUrl,
  propertyCityLocationSlug,
} from '@/features/dashboard/bookings/lib/parkingFindPathFromBooking';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';

export type BookingParkingShareLink = {
  /** Empty when this booking never signaled parking interest. */
  url: string;
  /** Marketplace browse URL (always stay-scoped when need_parking). */
  searchUrl: string;
  /** True when url points at an org-owned default slot. */
  isOwnDefault: boolean;
  open: () => void;
  copy: () => void;
  openSearch: () => void;
  copySearch: () => void;
};

export function useBookingParkingShareLink(
  booking: BookingRow | null | undefined,
  ownerDefault?: OwnerDefaultParkingResult | null
): BookingParkingShareLink {
  const orgCtx = useOptionalOrgContext();
  const locationSlug = useMemo(
    () => propertyCityLocationSlug(orgCtx?.property.settings ?? null),
    [orgCtx?.property.settings]
  );

  const searchUrl = useMemo(() => {
    if (!booking || booking.need_parking !== true) return '';
    return absoluteBookingParkingFindUrl(booking, locationSlug);
  }, [booking, locationSlug]);

  const ownSlug = ownerDefault?.defaultParking?.slug?.trim() ?? '';
  const isOwnDefault = Boolean(ownSlug && booking?.need_parking === true);

  const url = useMemo(() => {
    if (!booking || booking.need_parking !== true) return '';
    if (ownSlug) {
      return absoluteBookingParkingOwnDefaultUrl(booking, ownSlug);
    }
    return searchUrl;
  }, [booking, ownSlug, searchUrl]);

  const open = useCallback(() => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  const copy = useCallback(() => {
    if (!url) return;
    void navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Parking link copied'))
      .catch(() => toast.error('Could not copy link'));
  }, [url]);

  const openSearch = useCallback(() => {
    if (!searchUrl) return;
    window.open(searchUrl, '_blank', 'noopener,noreferrer');
  }, [searchUrl]);

  const copySearch = useCallback(() => {
    if (!searchUrl) return;
    void navigator.clipboard
      .writeText(searchUrl)
      .then(() => toast.success('Parking search link copied'))
      .catch(() => toast.error('Could not copy link'));
  }, [searchUrl]);

  return { url, searchUrl, isOwnDefault, open, copy, openSearch, copySearch };
}
