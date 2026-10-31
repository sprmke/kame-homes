import { BookingsListPage } from '@/features/dashboard/bookings/pages/BookingsListPage';

/** Org-scoped bookings list — same UI as property bookings with property labels. */
export function OrgBookingsPage() {
  return <BookingsListPage scope="org" />;
}
