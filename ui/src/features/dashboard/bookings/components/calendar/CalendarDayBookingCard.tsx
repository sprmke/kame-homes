import { ArrowUpRight, Car, Dog, PartyPopper } from 'lucide-react';

import { BookingResourceLabel } from '@/features/dashboard/bookings/components/BookingResourceLabel';
import { occupiedNightsFromStay } from '@/features/dashboard/bookings/components/calendar/calendarStayAmounts';
import { GuestAvatar } from '@/features/dashboard/bookings/components/GuestAvatar';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import { hostNetToneClass } from '@/features/dashboard/bookings/lib/bookingFinance';
import {
  bookingRequestsSurpriseDecor,
  bookingFlagIconChipClass,
} from '@/features/dashboard/bookings/lib/bookingFlags';

import { cn } from '@/lib/utils';
import { formatBookingDate } from '@/utils/format/bookingDisplay';
import { formatMoney } from '@/utils/format/currency';

type CalendarDayBookingCardSource = {
  id: string;
  primary_guest_name: string;
  guest_facebook_name: string;
  guest_email: string;
  valid_id_url: string | null;
  status: string;
  need_parking: boolean | null;
  has_pets: boolean | null;
  guest_requests_surprise_decor?: unknown;
  check_in_date: string;
  check_out_date: string;
  number_of_nights: number | null;
  property_name?: string | null;
  parking_name?: string | null;
  parking_id?: string | null;
  booking_kind?: 'property' | 'parking' | null;
};

type CalendarDayBookingCardAmount =
  | { mode: 'booking_rate'; amount: number | string | null | undefined }
  | {
      mode: 'host_net';
      amount: number | null;
      isRealized: boolean;
    };

type Props = {
  row: CalendarDayBookingCardSource;
  amount: CalendarDayBookingCardAmount;
  showProperty?: boolean;
  onOpen: () => void;
};

export function CalendarDayBookingCard({ row, amount, showProperty = false, onOpen }: Props) {
  const name = row.primary_guest_name || row.guest_facebook_name || row.guest_email || 'Guest';
  const nights = occupiedNightsFromStay(
    row.check_in_date,
    row.check_out_date,
    row.number_of_nights
  );

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open details for ${name}`}
      className={cn(
        'group flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors',
        'border-border/50 border',
        'hover:bg-muted/50 focus-visible:ring-sidebar-primary/40 outline-none focus-visible:ring-2'
      )}
    >
      <GuestAvatar name={name} validIdUrl={row.valid_id_url} size="md" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-[13px] font-bold">{name}</p>
            {showProperty ? (
              <BookingResourceLabel row={row} className="mt-0.5 font-medium" />
            ) : null}
          </div>
          <ArrowUpRight
            className="text-muted-foreground/50 group-hover:text-muted-foreground size-3.5 shrink-0 transition-colors"
            aria-hidden
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.need_parking === true && (
            <span
              title="Needs parking"
              className={cn('size-5 rounded', bookingFlagIconChipClass.parking)}
            >
              <Car className="size-3" aria-hidden />
            </span>
          )}
          {row.has_pets === true && (
            <span title="Has pets" className={cn('size-5 rounded', bookingFlagIconChipClass.pet)}>
              <Dog className="size-3" aria-hidden />
            </span>
          )}
          {bookingRequestsSurpriseDecor(row.guest_requests_surprise_decor) && (
            <span
              title="Surprise decor setup"
              className={cn('size-5 rounded', bookingFlagIconChipClass.decor)}
            >
              <PartyPopper className="size-3" aria-hidden />
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-1.5 truncate text-[11px]">
          {formatBookingDate(row.check_in_date)}
          <span className="text-muted-foreground/50 mx-1.5">→</span>
          {formatBookingDate(row.check_out_date)}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[11px]">
          {nights > 0 ? (
            <>
              {nights} {nights === 1 ? 'night' : 'nights'}
            </>
          ) : null}
          {amount.amount != null && (
            <>
              <span className="text-muted-foreground/50 mx-1.5">·</span>
              <CalendarDayAmount amount={amount} />
            </>
          )}
        </p>
      </div>
    </button>
  );
}

function CalendarDayAmount({ amount }: { amount: CalendarDayBookingCardAmount }) {
  if (amount.mode === 'booking_rate') {
    return (
      <span className="text-muted-foreground font-semibold">{formatMoney(amount.amount)}</span>
    );
  }

  const { amount: net, isRealized } = amount;
  const tone = hostNetToneClass(net, isRealized);

  return (
    <span className={cn('font-semibold tabular-nums', tone)}>
      {formatMoney(net)}
      {!isRealized && net != null ? (
        <span className="ml-1 align-middle text-[9px] font-medium uppercase tracking-wide text-amber-600/90 dark:text-amber-400/90">
          est
        </span>
      ) : null}
    </span>
  );
}
