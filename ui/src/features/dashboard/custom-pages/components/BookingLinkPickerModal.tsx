import { useMemo } from 'react';

import { Copy, Wallet, Star } from 'lucide-react';

import {
  absoluteGuestPath,
  guestReviewPath,
  guestSdFormPath,
} from '@/features/guest/lib/guestPublicPaths';

import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import { useBookings } from '@/features/dashboard/bookings/hooks/useBookings';
import {
  GUEST_REVIEW_LINK_STATUSES,
  SD_REFUND_LINK_STATUSES,
  isGuestReviewLinkEligible,
  isSdRefundLinkEligible,
} from '@/features/dashboard/bookings/lib/guestShareLinkEligibility';
import { DEFAULT_BOOKINGS_QUERY } from '@/features/dashboard/bookings/lib/types';
import { copyGuestLink } from '@/features/dashboard/custom-pages/lib/copyGuestLink';

import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBookingDate } from '@/utils/format/bookingDisplay';

export type BookingLinkKind = 'sd-refund' | 'guest-review';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertySlug: string;
  kind: BookingLinkKind;
};

const COPY: Record<BookingLinkKind, { title: string; description: string; toast: string }> = {
  'sd-refund': {
    title: 'Copy SD refund link',
    description: 'Stays from check-out through SD refund.',
    toast: 'SD refund',
  },
  'guest-review': {
    title: 'Copy guest review link',
    description: 'Stays from check-out through SD refund.',
    toast: 'Guest review',
  },
};

/** Pick a valid booking before copying a booking-scoped guest link. */
export function BookingLinkPickerModal({ open, onOpenChange, propertySlug, kind }: Props) {
  const copy = COPY[kind];
  const query = useMemo(
    () => ({
      ...DEFAULT_BOOKINGS_QUERY,
      status: kind === 'sd-refund' ? [...SD_REFUND_LINK_STATUSES] : [...GUEST_REVIEW_LINK_STATUSES],
      sort: 'check_in_date:desc' as const,
      limit: 100,
      showCompletedBookings: true,
    }),
    [kind]
  );

  const { data, isLoading, error, refetch, isFetching } = useBookings(query, { enabled: open });

  const rows = useMemo(() => {
    const eligible = kind === 'sd-refund' ? isSdRefundLinkEligible : isGuestReviewLinkEligible;
    return (data?.rows ?? []).filter((row) => eligible(row.status));
  }, [data?.rows, kind]);

  const copyRow = (bookingId: string) => {
    const path =
      kind === 'sd-refund'
        ? guestSdFormPath(propertySlug, bookingId)
        : guestReviewPath(propertySlug, bookingId);
    void copyGuestLink(absoluteGuestPath(path), copy.toast).then(() => onOpenChange(false));
  };

  const Icon = kind === 'sd-refund' ? Wallet : Star;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        className="flex max-h-[min(92dvh,44rem)] w-full max-w-[min(calc(100vw-1.5rem),36rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <ResponsiveModalHeader className="border-separator shrink-0 space-y-1 border-b px-4 pb-3 pt-1 sm:px-5">
          <ResponsiveModalTitle className="text-left">{copy.title}</ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-muted-foreground text-xs">
            {copy.description}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-5">
          {isLoading ? (
            <ul className="space-y-3 py-2" aria-label="Loading bookings">
              {[0, 1, 2].map((index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </li>
              ))}
            </ul>
          ) : error ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-muted-foreground text-sm">Could not load bookings.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={isFetching}
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-full">
                <Icon className="size-5" aria-hidden />
              </span>
              <p className="text-muted-foreground text-sm">No stays are ready for this link yet.</p>
            </div>
          ) : (
            <ul className="divide-border/60 list-none divide-y p-0">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-3 first:pt-2 last:pb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                      {row.primary_guest_name || row.guest_facebook_name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <StatusBadge status={row.status} />
                      <span className="text-muted-foreground text-xs">
                        {formatBookingDate(row.check_in_date)} →{' '}
                        {formatBookingDate(row.check_out_date)}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline-primary"
                    size="sm"
                    className="h-9 shrink-0 gap-1.5"
                    onClick={() => copyRow(row.id)}
                    aria-label={`Copy ${copy.toast} link for ${row.primary_guest_name || row.guest_facebook_name}`}
                  >
                    <Copy className="size-3.5" aria-hidden />
                    Copy
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
