import type { AdminListView } from '@/features/dashboard/bookings/lib/listView';
import type {
  RecurrenceInterval,
  FinanceReminderInterval,
} from '@/features/dashboard/finance/lib/recurrence';

export type MaintenanceReminderStatus = 'pending' | 'completed';

export type MaintenanceTelegramFilter = 'all' | 'enabled' | 'disabled';

export type MaintenanceRemindersSort = 'date:desc' | 'date:asc' | 'label:asc' | 'label:desc';

export type MaintenanceQuery = {
  from: string | null;
  to: string | null;
  q: string;
  page: number;
  limit: number;
  view: AdminListView;
  sort: MaintenanceRemindersSort;
  /** Empty = all statuses. */
  statusFilter: MaintenanceReminderStatus[];
  /** Empty = all categories. */
  categoryFilter: string[];
  telegramFilter: MaintenanceTelegramFilter;
};

export const DEFAULT_MAINTENANCE_QUERY: MaintenanceQuery = {
  from: null,
  to: null,
  q: '',
  page: 1,
  limit: 31,
  view: 'table',
  sort: 'date:desc',
  statusFilter: [],
  categoryFilter: [],
  telegramFilter: 'all',
};

export type MaintenanceSummary = {
  period: {
    from: string | null;
    to: string | null;
  };
  total: number;
  telegramEnabled: number;
  completed: number;
  pending: number;
  byCategory: { category: string; count: number }[];
};

export type MaintenanceItem = {
  id: string;
  label: string;
  category: string | null;
  scheduled_on: string;
  notes: string | null;
  recurrence_series_id: string | null;
  recurrence_interval: Exclude<RecurrenceInterval, 'none'> | null;
  telegram_reminder_enabled: boolean;
  telegram_due_date: string | null;
  telegram_days_before: number;
  telegram_reminder_interval: FinanceReminderInterval;
  telegram_message_template: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceExportType = 'overview' | 'reminders' | 'combined';

export type {
  RecurrenceEditScope,
  RecurrenceInterval,
} from '@/features/dashboard/finance/lib/recurrence';
