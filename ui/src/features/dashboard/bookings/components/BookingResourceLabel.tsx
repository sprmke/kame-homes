import type { BookingKind, BookingRow } from '@/features/dashboard/bookings/lib/types';

import { resourceKindBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

export function isParkingBooking(row: Pick<BookingRow, 'booking_kind' | 'parking_id'>): boolean {
  return row.booking_kind === 'parking' || Boolean(row.parking_id);
}

export function bookingResourceName(row: BookingRow): string | null {
  if (isParkingBooking(row)) {
    return row.parking_name?.trim() || null;
  }
  return row.property_name?.trim() || null;
}

type Props = {
  row: Pick<BookingRow, 'booking_kind' | 'parking_id' | 'property_name' | 'parking_name'>;
  /** Optional Property / Parking badge (org lists show name only by default). */
  showKindBadge?: boolean;
  className?: string;
};

/** Property or parking name for org-scoped booking list views. */
export function BookingResourceLabel({ row, showKindBadge = false, className }: Props) {
  const name = bookingResourceName(row as BookingRow);
  if (!name) return null;

  const kind: BookingKind = isParkingBooking(row) ? 'parking' : 'property';

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      {showKindBadge ? (
        <span className={resourceKindBadgeClasses(kind)}>
          {kind === 'parking' ? 'Parking' : 'Property'}
        </span>
      ) : null}
      <p className="text-caption text-muted-foreground truncate" title={name}>
        {name}
      </p>
    </div>
  );
}

/** @deprecated Use BookingResourceLabel */
export function BookingPropertyLabel({
  name,
  className,
}: {
  name: string | null | undefined;
  className?: string;
}) {
  if (!name?.trim()) return null;
  return (
    <p className={cn('text-caption text-muted-foreground truncate', className)} title={name}>
      {name}
    </p>
  );
}
