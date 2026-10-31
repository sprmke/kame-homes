import {
  BOOKINGS_SORT_OPTIONS,
  bookingsSortButtonLabel,
} from '@/features/dashboard/bookings/lib/bookingsSortOptions';
import type { BookingsSort } from '@/features/dashboard/bookings/lib/types';

import { AdminSortMenu } from '@/components/navigation/AdminSortMenu';

type Props = {
  sort: BookingsSort;
  onChange: (sort: BookingsSort) => void;
  fullWidth?: boolean;
};

export function BookingsSortMenu({ sort, onChange, fullWidth = false }: Props) {
  return (
    <AdminSortMenu
      sort={sort}
      onChange={onChange}
      options={BOOKINGS_SORT_OPTIONS}
      ariaLabel="Sort bookings"
      fullWidth={fullWidth}
      menuWidthClass="w-[min(calc(100vw-24px),18rem)]"
      resolveLabel={(value) => bookingsSortButtonLabel(value)}
    />
  );
}
