import { Link } from 'react-router-dom';

import { ExternalLink } from 'lucide-react';

import {
  BookingPricingSummary,
  type BookingPricingSummarySource,
} from '@/features/dashboard/bookings/components/BookingPricingSummary';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import { bookingListDisplayName } from '@/features/dashboard/bookings/lib/bookingListDisplay';
import type { FinanceBookingLedgerRow } from '@/features/dashboard/finance/lib/types';

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';
import { formatBookingDate, formatBookingDateShort } from '@/utils/format/bookingDisplay';

type Props = {
  row: FinanceBookingLedgerRow | null;
  onClose: () => void;
};

function toPricingSource(row: FinanceBookingLedgerRow): BookingPricingSummarySource {
  return {
    status: row.status,
    has_pets: row.has_pets,
    need_parking: row.need_parking,
    ...row.pricing,
  };
}

function StayFinanceModalMeta({ row }: { row: FinanceBookingLedgerRow }) {
  const nights =
    row.number_of_nights != null &&
    Number.isFinite(row.number_of_nights) &&
    row.number_of_nights > 0
      ? row.number_of_nights
      : null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-2">
      <p className="text-foreground text-sm font-semibold leading-snug">
        <span className="whitespace-nowrap">{formatBookingDateShort(row.check_in_date)}</span>
        {row.check_out_date ? (
          <>
            <span className="text-muted-foreground/50 mx-1.5 font-light">→</span>
            <span className="whitespace-nowrap">{formatBookingDate(row.check_out_date)}</span>
          </>
        ) : null}
      </p>
      {nights != null ? (
        <p className="text-muted-foreground text-xs font-normal leading-snug sm:text-sm">
          {nights} {nights === 1 ? 'night' : 'nights'}
        </p>
      ) : null}
      <StatusBadge status={row.status} className="w-fit shrink-0" />
    </div>
  );
}

export function StayFinanceModal({ row, onClose }: Props) {
  const guestLabel = row ? bookingListDisplayName(row) : '';

  return (
    <ResponsiveModal
      open={row != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ResponsiveModalContent
        sheetLayout="split"
        className={cn(
          'flex w-full max-w-[min(calc(100vw-1.5rem),36rem)] flex-col gap-0 overflow-hidden p-0',
          'max-h-[min(92dvh,100%)] max-lg:h-[min(92dvh,max-content)] sm:max-w-[36rem]'
        )}
        aria-describedby={undefined}
      >
        {row ? (
          <>
            <ResponsiveModalHeader className="border-separator shrink-0 gap-2 border-b px-4 pb-4 pr-14 pt-4 sm:gap-2.5 sm:px-5 sm:pt-5">
              <ResponsiveModalTitle className="text-foreground truncate text-base font-bold leading-snug tracking-tight sm:text-lg">
                {guestLabel}
              </ResponsiveModalTitle>
              <StayFinanceModalMeta row={row} />
            </ResponsiveModalHeader>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-5">
              <BookingPricingSummary
                booking={toPricingSource(row)}
                layout="modal"
                showProjectedEstimate
              />
            </div>

            <div className="border-separator shrink-0 border-t px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
              <Link
                to={`/bookings/${row.id}`}
                className={cn(
                  'flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg',
                  'gradient-primary text-primary-foreground shadow-soft text-[13px] font-semibold',
                  'hover:shadow-primary-glow transition-all duration-200'
                )}
              >
                <ExternalLink className="size-4" aria-hidden />
                Open booking
              </Link>
            </div>
          </>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
