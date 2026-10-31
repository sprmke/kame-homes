import { MAINTENANCE_STATUS_OPTIONS } from '@/features/dashboard/maintenance/lib/maintenanceReminders';
import type { MaintenanceReminderStatus } from '@/features/dashboard/maintenance/lib/types';

import { AdminMultiSelectFilter } from '@/components/navigation/AdminMultiSelectFilter';

type Props = {
  value: MaintenanceReminderStatus[];
  onChange: (next: MaintenanceReminderStatus[]) => void;
};

export function MaintenanceStatusFilter({ value, onChange }: Props) {
  return (
    <AdminMultiSelectFilter
      options={MAINTENANCE_STATUS_OPTIONS}
      value={value}
      onChange={onChange}
      emptyLabel="All Status"
      pluralUnit="statuses"
      ariaLabel="Status filter"
    />
  );
}
