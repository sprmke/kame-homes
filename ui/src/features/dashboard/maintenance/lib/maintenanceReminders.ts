import type {
  MaintenanceItem,
  MaintenanceQuery,
  MaintenanceReminderStatus,
  MaintenanceRemindersSort,
} from '@/features/dashboard/maintenance/lib/types';

export const MAINTENANCE_STATUS_OPTIONS: {
  value: MaintenanceReminderStatus;
  label: string;
}[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];

export const MAINTENANCE_SORT_OPTIONS: {
  value: MaintenanceRemindersSort;
  label: string;
}[] = [
  { value: 'date:desc', label: 'Newest scheduled' },
  { value: 'date:asc', label: 'Oldest scheduled' },
  { value: 'label:asc', label: 'Label A–Z' },
  { value: 'label:desc', label: 'Label Z–A' },
];

export function maintenanceReminderStatus(item: MaintenanceItem): MaintenanceReminderStatus {
  return item.completed_at ? 'completed' : 'pending';
}

export function collectMaintenanceCategories(items: MaintenanceItem[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    const category = item.category?.trim();
    if (category) set.add(category);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function filterMaintenanceItems(
  items: MaintenanceItem[],
  query: MaintenanceQuery
): MaintenanceItem[] {
  return items.filter((item) => {
    if (query.statusFilter.length > 0) {
      const status = maintenanceReminderStatus(item);
      if (!query.statusFilter.includes(status)) return false;
    }
    if (query.categoryFilter.length > 0) {
      const category = item.category?.trim() ?? '';
      if (!query.categoryFilter.includes(category)) return false;
    }
    if (query.telegramFilter === 'enabled' && !item.telegram_reminder_enabled) {
      return false;
    }
    if (query.telegramFilter === 'disabled' && item.telegram_reminder_enabled) {
      return false;
    }
    return true;
  });
}

export function sortMaintenanceItems(
  items: MaintenanceItem[],
  sort: MaintenanceRemindersSort
): MaintenanceItem[] {
  const rows = [...items];
  rows.sort((a, b) => {
    switch (sort) {
      case 'date:asc':
        return a.scheduled_on.localeCompare(b.scheduled_on);
      case 'date:desc':
        return b.scheduled_on.localeCompare(a.scheduled_on);
      case 'label:asc':
        return a.label.localeCompare(b.label);
      case 'label:desc':
        return b.label.localeCompare(a.label);
      default:
        return 0;
    }
  });
  return rows;
}

export function paginateMaintenanceItems(
  items: MaintenanceItem[],
  page: number,
  limit: number
): { rows: MaintenanceItem[]; total: number } {
  const total = items.length;
  const start = (page - 1) * limit;
  return { rows: items.slice(start, start + limit), total };
}
