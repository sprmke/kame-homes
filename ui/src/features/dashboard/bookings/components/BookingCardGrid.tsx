import type { KeyboardEvent } from 'react';

import { useNavigate } from 'react-router-dom';

import { AdminTableFlagsCell } from '@/features/dashboard/bookings/components/AdminDataTable';
import { BookingResourceLabel } from '@/features/dashboard/bookings/components/BookingResourceLabel';
import { GuestAvatar } from '@/features/dashboard/bookings/components/GuestAvatar';
import { ParkingBroadcastCountdown } from '@/features/dashboard/bookings/components/ParkingBroadcastCountdown';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import {
  bookingHasInvalidReceiptAi,
  bookingRequestsSurpriseDecor,
} from '@/features/dashboard/bookings/lib/bookingFlags';
import type { BookingRow } from '@/features/dashboard/bookings/lib/types';

import { AdminCardGrid, AdminCardState } from '@/components/mobile/AdminCardGrid';
import { BookingsCardGridSkeleton } from '@/components/skeletons/AdminSkeletons';
import { cn } from '@/lib/utils';
import { formatBookingDate, formatBookingDateShort } from '@/utils/format/bookingDisplay';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  rows: BookingRow[];
  isLoading: boolean;
  error: string | null;
  isRefreshing?: boolean;
  showProperty?: boolean;
  resolveBookingHref?: (row: BookingRow) => string;
};

/**
 * Card / list view for the bookings dashboard.
 * Phone = single-column native list rows; tablet+ = multi-column cards.
 */
export function BookingCardGrid({
  rows,
  isLoading,
  error,
  isRefreshing,
  showProperty = false,
  resolveBookingHref,
}: Props) {
  const navigate = useNavigate();

  const openRow = (row: BookingRow) => {
    navigate(resolveBookingHref ? resolveBookingHref(row) : `/bookings/${row.id}`);
  };

  if (error) {
    return <AdminCardState variant="error" title="Could not load bookings" description={error} />;
  }

  if (isLoading) return <BookingsCardGridSkeleton />;

  if (rows.length === 0) {
    return (
      <AdminCardState
        title="No bookings found"
        description="Adjust your filters or clear the search."
      />
    );
  }

  return (
    <AdminCardGrid isRefreshing={isRefreshing}>
      {rows.map((row) => (
        <BookingCard
          key={row.id}
          row={row}
          showProperty={showProperty}
          onOpen={() => openRow(row)}
        />
      ))}
    </AdminCardGrid>
  );
}

function BookingCard({
  row,
  showProperty,
  onOpen,
}: {
  row: BookingRow;
  showProperty: boolean;
  onOpen: () => void;
}) {
  const name = row.primary_guest_name || row.guest_facebook_name || row.guest_email || 'Guest';
  const pax = (row.number_of_adults ?? 0) + (row.number_of_children ?? 0);
  const hasInvalidReceiptAi = bookingHasInvalidReceiptAi(row);
  const hasAnyFlags =
    Boolean(row.need_parking) ||
    Boolean(row.has_pets) ||
    bookingRequestsSurpriseDecor(row.guest_requests_surprise_decor) ||
    hasInvalidReceiptAi;

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKey}
      aria-label={`Open booking for ${name}${row.guest_email ? `, ${row.guest_email}` : ''}`}
      className={cn(
        'surface-card-interactive group relative cursor-pointer overflow-hidden',
        'outline-none',
        'focus-visible:ring-sidebar-primary/40 focus-visible:ring-2'
      )}
    >
      {/* Phone: name + amount; status; dates + flags. No chevron / Nn / Ng. */}
      <div className="flex items-start gap-2.5 px-3 py-2.5 sm:hidden">
        <GuestAvatar
          name={name}
          validIdUrl={row.valid_id_url}
          size="sm"
          className="mt-0.5 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-foreground min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">
              {name}
            </p>
            {row.booking_rate != null ? (
              <span className="text-foreground shrink-0 text-[13px] font-semibold tabular-nums leading-none">
                {formatMoney(row.booking_rate)}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <StatusBadge status={row.status} className="w-fit max-w-full shrink-0" />
            {row.status === 'PENDING_HOST_ACCEPTANCE' && row.parking_broadcast_expires_at ? (
              <ParkingBroadcastCountdown expiresAt={row.parking_broadcast_expires_at} />
            ) : null}
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-1.5">
            <p className="text-muted-foreground min-w-0 flex-1 truncate text-[11px] tabular-nums leading-tight">
              {formatBookingDateShort(row.check_in_date)}
              <span className="text-muted-foreground/40 mx-0.5 font-light">→</span>
              {formatBookingDate(row.check_out_date)}
            </p>
            {hasAnyFlags ? (
              <AdminTableFlagsCell
                need_parking={row.need_parking}
                has_pets={row.has_pets}
                guest_requests_surprise_decor={row.guest_requests_surprise_decor}
                has_invalid_receipt_ai={hasInvalidReceiptAi}
                hideEmpty
              />
            ) : null}
          </div>
          {showProperty ? (
            <BookingResourceLabel
              row={row}
              className="mt-1 min-w-0 truncate text-[11px] font-medium"
            />
          ) : null}
        </div>
      </div>

      {/* sm+: stacked card (unchanged hierarchy, more room) */}
      <div className="hidden sm:block">
        <div className="space-y-4 p-4 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={row.status} className="w-fit max-w-full" />
            {row.status === 'PENDING_HOST_ACCEPTANCE' && row.parking_broadcast_expires_at && (
              <ParkingBroadcastCountdown expiresAt={row.parking_broadcast_expires_at} />
            )}
          </div>
          <div className="flex items-center gap-3">
            <GuestAvatar name={name} validIdUrl={row.valid_id_url} size="lg" className="shrink-0" />
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-bold leading-tight">{name}</p>
              <p className="text-data-secondary mt-0.5 truncate">{row.guest_email}</p>
              {showProperty ? (
                <BookingResourceLabel row={row} className="mt-0.5 font-medium" />
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-4 pb-3">
          <p className="text-overline">Stay</p>
          <p className="text-data-primary mt-0.5 whitespace-nowrap">
            {formatBookingDateShort(row.check_in_date)}
            <span className="text-muted-foreground/50 mx-1.5 font-light">→</span>
            {formatBookingDate(row.check_out_date)}
          </p>
          <p className="text-data-secondary mt-0.5">
            {row.number_of_nights} {row.number_of_nights === 1 ? 'night' : 'nights'}
            <span className="text-muted-foreground/50 mx-1.5">·</span>
            {pax} {pax === 1 ? 'guest' : 'guests'}
          </p>
        </div>

        <div className="border-separator bg-muted/20 dark:bg-muted/30 flex items-center justify-between gap-2 border-t px-4 py-3">
          <div className="flex min-w-0 items-center gap-1.5">
            {hasAnyFlags ? (
              <AdminTableFlagsCell
                need_parking={row.need_parking}
                has_pets={row.has_pets}
                guest_requests_surprise_decor={row.guest_requests_surprise_decor}
                has_invalid_receipt_ai={hasInvalidReceiptAi}
              />
            ) : (
              <span className="text-caption text-muted-foreground/50">No flags</span>
            )}
          </div>
          {row.booking_rate != null && (
            <span className="text-table-amount shrink-0">{formatMoney(row.booking_rate)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
