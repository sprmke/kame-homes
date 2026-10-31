import type { BookingPricingSummarySource } from '@/features/dashboard/bookings/components/BookingPricingSummary';
import type { BookingFinancials } from '@/features/dashboard/bookings/lib/bookingFinance';
import type {
  RecurrenceInterval,
  FinanceReminderInterval,
} from '@/features/dashboard/finance/lib/recurrence';

export type FinancePeriodBasis = 'check_in' | 'check_out' | 'completed';

/** @deprecated Legacy tab URLs redirect to the unified finance page. */
export type FinanceTab = 'overview' | 'stays' | 'transactions';

import type { AdminListView } from '@/features/dashboard/bookings/lib/listView';

export type FinanceStaysView = AdminListView;

export type FinanceLedgerTypeFilter = 'all' | 'income' | 'expense';

export type FinanceLedgerStatus = 'completed' | 'pending' | 'canceled';

export type FinanceLedgerSort = 'date:desc' | 'date:asc' | 'amount:desc' | 'amount:asc';

export type FinanceQuery = {
  basis: FinancePeriodBasis;
  from: string | null;
  to: string | null;
  includeCancelled: boolean;
  completedOnly: boolean;
  q: string;
  page: number;
  limit: number;
  sort: FinanceLedgerSort;
  /** Unified ledger layout — table on desktop; card default on mobile. */
  view: FinanceStaysView;
  typeFilter: FinanceLedgerTypeFilter;
  /** Empty = all statuses. */
  statusFilter: FinanceLedgerStatus[];
  /** Empty = all categories. */
  categoryFilter: string[];
};

export const DEFAULT_FINANCE_QUERY: FinanceQuery = {
  basis: 'check_in',
  from: null,
  to: null,
  includeCancelled: true,
  completedOnly: false,
  q: '',
  page: 1,
  limit: 31,
  sort: 'date:desc',
  view: 'table',
  typeFilter: 'all',
  statusFilter: [],
  categoryFilter: [],
};

export type FinanceStaysSummary = {
  count: number;
  completedCount: number;
  bookingRate: number;
  otherFees: number;
  parkingMargin: number;
  sdExpenses: number;
  hostNetCompleted: number;
  projectedNetPipeline: number;
  outstandingGuestBalance: number;
};

export type FinanceOperatingSummary = {
  income: number;
  expenses: number;
  net: number;
};

export type FinanceSummary = {
  period: {
    basis: FinancePeriodBasis;
    from: string | null;
    to: string | null;
  };
  stays: FinanceStaysSummary;
  operating: FinanceOperatingSummary;
  grandNet: number;
};

export type FinanceBookingLedgerRow = {
  id: string;
  guest_facebook_name: string;
  primary_guest_name: string;
  guest_email: string;
  valid_id_url: string | null;
  need_parking: boolean;
  has_pets: boolean;
  guest_requests_surprise_decor: unknown;
  check_in_date: string;
  check_out_date: string;
  number_of_nights: number;
  status: string;
  status_updated_at?: string | null;
  /** Raw pricing / SD fields for `BookingPricingSummary` (same as booking detail). */
  pricing: Omit<BookingPricingSummarySource, 'status' | 'has_pets' | 'need_parking'>;
  financials: BookingFinancials;
};

export type FinanceLineItem = {
  id: string;
  kind: 'expense' | 'income';
  label: string;
  amount: number;
  category: string | null;
  occurred_on: string;
  notes: string | null;
  receipt_path: string | null;
  recurrence_series_id: string | null;
  recurrence_interval: Exclude<RecurrenceInterval, 'none'> | null;
  telegram_reminder_enabled: boolean;
  telegram_due_date: string | null;
  telegram_days_before: number;
  telegram_reminder_interval: FinanceReminderInterval;
  telegram_message_template: string | null;
  /** When set, Telegram reminders stop for every reminder interval. */
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type {
  RecurrenceEditScope,
  RecurrenceInterval,
  FinanceReminderInterval,
} from '@/features/dashboard/finance/lib/recurrence';

export type FinanceExportType = 'overview' | 'stays' | 'operating' | 'combined';
