import { Kanban } from 'lucide-react';

import { ADMIN_LIST_VIEW_OPTIONS } from '@/features/dashboard/bookings/components/AdminListViewToggle';
import type { AdminListView } from '@/features/dashboard/bookings/lib/listView';

import { AdminListViewMenu } from '@/components/navigation/AdminListViewMenu';
import {
  AdminViewToggle,
  type AdminViewToggleOption,
} from '@/components/navigation/AdminViewToggle';

export type BookingView = AdminListView | 'kanban';

export const BOOKING_VIEW_OPTIONS: AdminViewToggleOption<BookingView>[] = [
  ...ADMIN_LIST_VIEW_OPTIONS,
  { value: 'kanban', label: 'Kanban', Icon: Kanban },
];

type Props = {
  value: BookingView;
  onChange: (next: BookingView) => void;
  hideTableView?: boolean;
  hideKanbanView?: boolean;
  className?: string;
};

function bookingHideValues(hideTableView: boolean, hideKanbanView: boolean): BookingView[] {
  const hideValues: BookingView[] = [];
  if (hideTableView) hideValues.push('table');
  if (hideKanbanView) hideValues.push('kanban');
  return hideValues;
}

export function BookingViewToggle({
  value,
  onChange,
  hideTableView = false,
  hideKanbanView = false,
  className,
}: Props) {
  return (
    <AdminViewToggle
      value={value}
      onChange={onChange}
      options={BOOKING_VIEW_OPTIONS}
      hideValues={bookingHideValues(hideTableView, hideKanbanView)}
      className={className}
      ariaLabel="Choose booking view"
    />
  );
}

/** Desktop compact view control for booking lists. */
export function BookingViewMenu({
  value,
  onChange,
  hideTableView = false,
  hideKanbanView = false,
  className,
}: Props) {
  return (
    <AdminListViewMenu
      value={value}
      onChange={onChange}
      options={BOOKING_VIEW_OPTIONS}
      hideValues={bookingHideValues(hideTableView, hideKanbanView)}
      className={className}
      ariaLabel="Choose booking view"
    />
  );
}
