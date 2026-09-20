import { useNavigate } from 'react-router-dom';

import {
  AdminDataTable,
  AdminTableFlagsCell,
  AdminTableGuestCell,
  AdminTableHeadRow,
  AdminTableRowAffordance,
  AdminTableStatusBadge,
  AdminTableTh,
  adminTableBodyText,
  adminTableCell,
  adminTableMoneyClass,
  adminTableRowClass,
} from '@/features/dashboard/bookings/components/AdminDataTable';
import { BookingResourceLabel } from '@/features/dashboard/bookings/components/BookingResourceLabel';
import { BookingStayDatesCell } from '@/features/dashboard/bookings/components/BookingStayDatesCell';
import { BookingStaySortControl } from '@/features/dashboard/bookings/components/BookingStaySortControl';
import { bookingHasInvalidReceiptAi } from '@/features/dashboard/bookings/lib/bookingFlags';
import { bookingListDisplayName } from '@/features/dashboard/bookings/lib/bookingListDisplay';
import type { BookingRow, BookingsSort } from '@/features/dashboard/bookings/lib/types';

import { BookingsTableSkeleton } from '@/components/skeletons/AdminSkeletons';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/format/currency';

type Props = {
  rows: BookingRow[];
  isLoading: boolean;
  error: string | null;
  isRefreshing?: boolean;
  sort: BookingsSort;
  onStaySortChange: (next: BookingsSort) => void;
  /** Shown under the default empty hint when the list has no rows. */
  emptyExtraHint?: string | null;
  showProperty?: boolean;
  resolveBookingHref?: (row: BookingRow) => string;
};

export function BookingTable({
  rows,
  isLoading,
  error,
  isRefreshing,
  sort,
  onStaySortChange,
  emptyExtraHint,
  showProperty = false,
  resolveBookingHref,
}: Props) {
  const navigate = useNavigate();
  const showLoadingSkeleton = useDelayedLoading(isLoading);

  const openRow = (row: BookingRow) => {
    navigate(resolveBookingHref ? resolveBookingHref(row) : `/bookings/${row.id}`);
  };

  if (error) {
    return (
      <div className="surface-card flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="bg-destructive/10 flex size-9 items-center justify-center rounded-full">
          <span className="text-destructive text-base font-black leading-none">!</span>
        </div>
        <div>
          <p className="text-section-title text-foreground font-bold">Could not load bookings</p>
          <p className="text-caption mt-1 max-w-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    if (!showLoadingSkeleton) return null;
    return <BookingsTableSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="bg-muted flex size-9 items-center justify-center rounded-full">
          <span className="text-muted-foreground text-lg leading-none">∅</span>
        </div>
        <div>
          <p className="text-section-title text-foreground font-bold">No bookings found</p>
          <p className="text-caption mt-1">Adjust your filters or clear the search.</p>
          {emptyExtraHint ? <p className="text-caption mt-2 max-w-sm">{emptyExtraHint}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <AdminDataTable
      minWidth={560}
      className={cn('transition-opacity duration-300', isRefreshing && 'opacity-60')}
    >
      <AdminTableHeadRow>
        <AdminTableTh className="pl-4 pr-3 sm:pl-5">Status</AdminTableTh>
        {showProperty ? (
          <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Listing</AdminTableTh>
        ) : null}
        <AdminTableTh className="px-3 sm:px-4">Guest</AdminTableTh>
        <AdminTableTh className="px-3 sm:px-4">
          <BookingStaySortControl sort={sort} onChange={onStaySortChange} variant="header" />
        </AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:px-4 md:table-cell">Pax</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:table-cell sm:px-4">Flags</AdminTableTh>
        <AdminTableTh className="hidden px-3 sm:px-4 lg:table-cell">Amount</AdminTableTh>
        <AdminTableTh className="pl-2 pr-3 sm:pl-3 sm:pr-4">
          <span className="sr-only">View</span>
        </AdminTableTh>
      </AdminTableHeadRow>
      <tbody>
        {rows.map((row, i) => (
          <BookingTableRow
            key={row.id}
            row={row}
            index={i}
            showProperty={showProperty}
            onOpen={() => openRow(row)}
          />
        ))}
      </tbody>
    </AdminDataTable>
  );
}

function BookingTableRow({
  row,
  index,
  showProperty,
  onOpen,
}: {
  row: BookingRow;
  index: number;
  showProperty: boolean;
  onOpen: () => void;
}) {
  const name = bookingListDisplayName(row);
  const pax = (row.number_of_adults ?? 0) + (row.number_of_children ?? 0);

  const handleKey = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleKey}
      aria-label={`Open booking for ${name}`}
      className={adminTableRowClass(index)}
    >
      {/* Status */}
      <td className={adminTableCell.status}>
        <AdminTableStatusBadge
          status={row.status}
          parkingBroadcastExpiresAt={row.parking_broadcast_expires_at}
        />
      </td>

      {showProperty ? (
        <td className={cn('hidden sm:table-cell', adminTableCell.body)}>
          <BookingResourceLabel
            row={row}
            className="max-w-[10rem] text-xs font-medium sm:text-[13px]"
          />
        </td>
      ) : null}

      <td className={adminTableCell.body}>
        <AdminTableGuestCell
          primary_guest_name={row.primary_guest_name}
          guest_facebook_name={row.guest_facebook_name}
          guest_email={row.guest_email}
          valid_id_url={row.valid_id_url}
        />
      </td>

      {/* Stay */}
      <td className={adminTableCell.body}>
        <BookingStayDatesCell
          checkInDate={row.check_in_date}
          checkOutDate={row.check_out_date}
          numberOfNights={row.number_of_nights}
        />
      </td>

      {/* Pax */}
      <td className={cn('hidden tabular-nums md:table-cell', adminTableCell.money)}>
        <span className={adminTableBodyText.secondary}>{pax}</span>
      </td>

      {/* Flags — bigger, more legible icons */}
      <td className={cn('hidden sm:table-cell', adminTableCell.body)}>
        <AdminTableFlagsCell
          need_parking={row.need_parking}
          has_pets={row.has_pets}
          guest_requests_surprise_decor={row.guest_requests_surprise_decor}
          has_invalid_receipt_ai={bookingHasInvalidReceiptAi(row)}
        />
      </td>

      {/* Amount */}
      <td className={cn('hidden lg:table-cell', adminTableCell.money)}>
        <span
          className={adminTableMoneyClass(
            row.booking_rate == null ? 'text-muted-foreground/50' : undefined
          )}
        >
          {formatMoney(row.booking_rate)}
        </span>
      </td>

      {/* Action — chevron only, click is handled by the whole row */}
      <td className={adminTableCell.action}>
        <AdminTableRowAffordance />
      </td>
    </tr>
  );
}
