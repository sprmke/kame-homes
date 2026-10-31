import type { BookingsSort } from '@/features/dashboard/bookings/lib/types';

export type BookingsSortOption = {
  value: BookingsSort;
  label: string;
  /** Shown under the label in the sort dropdown. */
  description?: string;
};

/** First item is the default (`status_priority:asc`). */
export const BOOKINGS_SORT_OPTIONS: BookingsSortOption[] = [
  {
    value: 'status_priority:asc',
    label: 'Priority',
    description: 'SD refund → review → docs → checkout → check-in → completed → cancelled',
  },
  { value: 'check_in_date:asc', label: 'Check-in ↑ (earliest first)' },
  { value: 'check_in_date:desc', label: 'Check-in ↓ (latest first)' },
  { value: 'created_at:desc', label: 'Submitted ↓ (newest first)' },
  { value: 'created_at:asc', label: 'Submitted ↑ (oldest first)' },
];

export function bookingsSortButtonLabel(sort: BookingsSort): string {
  if (sort === 'status_priority:asc') return 'Priority';
  const opt = BOOKINGS_SORT_OPTIONS.find((o) => o.value === sort);
  if (!opt) return 'Sort';
  const head = opt.label.split(' ')[0];
  const arrow = sort.endsWith(':asc') ? '↑' : '↓';
  return `${head} ${arrow}`;
}
