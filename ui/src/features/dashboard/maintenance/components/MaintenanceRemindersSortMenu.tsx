import { MAINTENANCE_SORT_OPTIONS } from '@/features/dashboard/maintenance/lib/maintenanceReminders';
import type { MaintenanceRemindersSort } from '@/features/dashboard/maintenance/lib/types';

import { AdminSortMenu } from '@/components/navigation/AdminSortMenu';

type Props = {
  sort: MaintenanceRemindersSort;
  onChange: (sort: MaintenanceRemindersSort) => void;
};

export function MaintenanceRemindersSortMenu({ sort, onChange }: Props) {
  return (
    <AdminSortMenu
      sort={sort}
      onChange={onChange}
      options={MAINTENANCE_SORT_OPTIONS}
      ariaLabel="Sort reminders"
      menuWidthClass="w-[min(calc(100vw-24px),14rem)]"
    />
  );
}
