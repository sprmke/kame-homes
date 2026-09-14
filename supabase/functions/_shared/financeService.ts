/**
 * Finance aggregations and finance_line_items CRUD.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { computeBookingFinancials, financeDisplayNet } from './bookingFinance.ts';
import { checkInDateToIso } from './bookingsListSort.ts';
import {
  isCancelledBooking,
  passesFinancePeriodFilter,
  type FinancePeriodBasis,
} from './financePeriodFilter.ts';
import {
  addDaysToIso,
  addRecurrenceInterval,
  daysBetweenIso,
  defaultRecurrenceUntilForInterval,
  generateRecurrenceDates,
  generateRecurrenceDatesBackward,
  isRecurrenceEditScope,
  isRecurrenceInterval,
  type RecurrenceEditScope,
  type RecurrenceInterval,
} from './financeRecurrence.ts';
import { rebuildMaterializedRecurrenceSeries } from './recurringSeriesScheduleRebuild.ts';
import {
  type FinanceTelegramReminderInput,
  normalizeFinanceReminderInterval,
  reminderFieldsForInsert,
  reminderFieldsForRecurringRow,
  reminderFieldsForUpdate,
} from './telegramFinance.ts';

export type FinanceLineItemKind = 'expense' | 'income';

export type FinanceLineItemRow = {
  id: string;
  kind: FinanceLineItemKind;
  label: string;
  amount: number;
  category: string | null;
  occurred_on: string;
  notes: string | null;
  receipt_path: string | null;
  recurrence_series_id: string | null;
  recurrence_interval: RecurrenceInterval | null;
  telegram_reminder_enabled: boolean;
  telegram_due_date: string | null;
  telegram_days_before: number;
  telegram_reminder_interval:
    'hourly' | 'every_2_hours' | 'every_4_hours' | 'every_12_hours' | 'daily_noon';
  telegram_message_template: string | null;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapFinanceLineItemRow(row: Record<string, unknown>): FinanceLineItemRow {
  const interval = row.recurrence_interval;
  return {
    id: String(row.id),
    kind: row.kind as FinanceLineItemKind,
    label: String(row.label),
    amount: Number(row.amount),
    category: row.category ? String(row.category) : null,
    occurred_on: String(row.occurred_on).slice(0, 10),
    notes: row.notes ? String(row.notes) : null,
    receipt_path: row.receipt_path ? String(row.receipt_path) : null,
    recurrence_series_id: row.recurrence_series_id ? String(row.recurrence_series_id) : null,
    recurrence_interval: isRecurrenceInterval(interval) ? interval : null,
    telegram_reminder_enabled: Boolean(row.telegram_reminder_enabled),
    telegram_due_date: row.telegram_due_date ? String(row.telegram_due_date).slice(0, 10) : null,
    telegram_days_before: Number(row.telegram_days_before ?? 3),
    telegram_reminder_interval: normalizeFinanceReminderInterval(row.telegram_reminder_interval),
    telegram_message_template: row.telegram_message_template
      ? String(row.telegram_message_template)
      : null,
    paid_at: row.paid_at ? String(row.paid_at) : null,
    created_by: row.created_by ? String(row.created_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export type FinanceStaysSummary = {
  count: number;
  completedCount: number;
  /** Σ booking rate (down + guest balance) for stays in period. */
  bookingRate: number;
  /** Σ additional fees (pet, parking margin, additional; SD net when completed or refund recorded) for stays in period. */
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

export type FinanceSummaryResult = {
  period: {
    basis: FinancePeriodBasis;
    from: string | null;
    to: string | null;
  };
  stays: FinanceStaysSummary;
  operating: FinanceOperatingSummary;
  grandNet: number;
};

/** Same card math as the Finance page (`computeFinanceSummaryCardStats` in the UI). */
export type HostFacingFinanceKpis = {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  pendingPayments: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function positiveStayIncome(summary: FinanceSummaryResult): number {
  const completed = Math.max(0, summary.stays.hostNetCompleted);
  const pipeline = Math.max(0, summary.stays.projectedNetPipeline);
  return completed + pipeline;
}

function stayExpenseTotal(summary: FinanceSummaryResult): number {
  const loss = summary.stays.hostNetCompleted < 0 ? Math.abs(summary.stays.hostNetCompleted) : 0;
  return summary.stays.sdExpenses + loss;
}

/**
 * Host-facing KPIs matching the Finance page summary cards.
 * Do not use `grandNet` for "profit this month" answers — that excludes in-progress stays.
 */
export function toHostFacingFinanceKpis(
  summary: FinanceSummaryResult,
  pendingManualAmount = 0
): HostFacingFinanceKpis {
  const totalIncome = roundMoney(summary.operating.income + positiveStayIncome(summary));
  const totalExpenses = roundMoney(summary.operating.expenses + stayExpenseTotal(summary));
  const netProfit = roundMoney(totalIncome - totalExpenses);
  const pendingPayments = roundMoney(
    summary.stays.outstandingGuestBalance + Math.max(0, pendingManualAmount)
  );
  return { totalIncome, totalExpenses, netProfit, pendingPayments };
}

export function formatFinancePhp(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Calendar month containing `todayIso` (YYYY-MM-DD), Asia/Manila parts already in the string. */
export function financeThisMonthRange(todayIso: string): { from: string; to: string } {
  const [yRaw, mRaw] = todayIso.slice(0, 10).split('-');
  const y = Number(yRaw);
  const m = Number(mRaw);
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(lastDay)}`,
  };
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

/**
 * Pushes the two status filters that `filterBookings` would otherwise apply in JS down
 * into SQL — safe because both are exact `status` equality checks with no date-format
 * parsing involved (unlike the `from`/`to` period filters, which stay client-side since
 * `check_in_date`/`check_out_date` are `MM-DD-YYYY` text and would sort incorrectly under
 * a plain SQL `>=`/`<=` comparison). Cuts rows transferred for the common case where
 * cancelled bookings are excluded, without changing which rows the caller sees.
 */
async function fetchAllBookingsForFinance(
  propertyId: string | undefined,
  statusFilter: { includeCancelled: boolean; completedOnly: boolean }
): Promise<Record<string, unknown>[]> {
  const supabase = getSupabase();
  let query = supabase.from('guest_submissions').select('*');
  if (propertyId) query = query.eq('property_id', propertyId);
  if (statusFilter.completedOnly) {
    query = query.eq('status', 'COMPLETED');
  } else if (!statusFilter.includeCancelled) {
    query = query.neq('status', 'CANCELLED');
  }
  const { data, error } = await query;
  if (error) throw new Error(`finance bookings query failed: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

function filterBookings(
  rows: Record<string, unknown>[],
  params: {
    from: string | null;
    to: string | null;
    basis: FinancePeriodBasis;
    includeCancelled: boolean;
    completedOnly: boolean;
    q?: string;
  }
): Record<string, unknown>[] {
  const needle = params.q?.trim().toLowerCase() ?? '';
  return rows.filter((row) => {
    if (!params.includeCancelled && isCancelledBooking(row)) return false;
    if (params.completedOnly && row.status !== 'COMPLETED') return false;
    if (!passesFinancePeriodFilter(row, params.from, params.to, params.basis)) {
      return false;
    }
    if (needle) {
      const hay = [row.guest_facebook_name, row.primary_guest_name, row.guest_email]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ');
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

function summarizeStays(rows: Record<string, unknown>[]): FinanceStaysSummary {
  let bookingRate = 0;
  let otherFees = 0;
  let parkingMargin = 0;
  let sdExpenses = 0;
  let hostNetCompleted = 0;
  let projectedNetPipeline = 0;
  let outstandingGuestBalance = 0;
  let completedCount = 0;

  for (const row of rows) {
    const fin = computeBookingFinancials(row);
    if (fin.bookingRate != null) bookingRate += fin.bookingRate;
    otherFees += fin.otherFees;
    if (fin.isCompleted) {
      completedCount += 1;
      hostNetCompleted += fin.hostNet;
      if (fin.parkingMargin != null) parkingMargin += fin.parkingMargin;
      sdExpenses += fin.sdExpenseTotal;
    } else if (fin.projectedNet != null) {
      projectedNetPipeline += fin.projectedNet;
    }
    if (fin.guestUnpaid != null && fin.guestUnpaid > 0) {
      outstandingGuestBalance += fin.guestUnpaid;
    }
  }

  return {
    count: rows.length,
    completedCount,
    bookingRate: roundMoney(bookingRate),
    otherFees: roundMoney(otherFees),
    parkingMargin: roundMoney(parkingMargin),
    sdExpenses: roundMoney(sdExpenses),
    hostNetCompleted: roundMoney(hostNetCompleted),
    projectedNetPipeline: roundMoney(projectedNetPipeline),
    outstandingGuestBalance: roundMoney(outstandingGuestBalance),
  };
}

function filterOperatingLineItems(items: FinanceLineItemRow[], q?: string): FinanceLineItemRow[] {
  const needle = q?.trim().toLowerCase() ?? '';
  if (!needle) return items;
  return items.filter((item) => {
    const hay = [item.label, item.category, item.notes, item.kind]
      .map((v) => String(v ?? '').toLowerCase())
      .join(' ');
    return hay.includes(needle);
  });
}

function applyFinanceAssetScope<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  scope: { propertyId?: string; parkingId?: string }
): T {
  if (scope.parkingId) return query.eq('parking_id', scope.parkingId);
  if (scope.propertyId) return query.eq('property_id', scope.propertyId);
  return query;
}

export async function listOperatingLineItems(params: {
  propertyId?: string;
  parkingId?: string;
  from: string | null;
  to: string | null;
  q?: string;
  /** Also return rows whose telegram_due_date falls in range (merged, deduped). */
  includeDueInRange?: boolean;
}): Promise<FinanceLineItemRow[]> {
  const supabase = getSupabase();
  let query = supabase.from('finance_line_items').select('*').order('occurred_on', {
    ascending: false,
  });
  query = applyFinanceAssetScope(query, params);
  if (params.from) query = query.gte('occurred_on', params.from);
  if (params.to) query = query.lte('occurred_on', params.to);
  const { data, error } = await query;
  if (error) throw new Error(`finance_line_items query failed: ${error.message}`);
  const byOccurred = (data ?? []).map((row) =>
    mapFinanceLineItemRow(row as Record<string, unknown>)
  );

  if (!params.includeDueInRange || !params.from || !params.to) {
    return filterOperatingLineItems(byOccurred, params.q);
  }

  const { data: dueData, error: dueError } = await (() => {
    let dueQuery = supabase
      .from('finance_line_items')
      .select('*')
      .gte('telegram_due_date', params.from)
      .lte('telegram_due_date', params.to)
      .order('telegram_due_date', { ascending: true });
    dueQuery = applyFinanceAssetScope(dueQuery, params);
    return dueQuery;
  })();
  if (dueError) {
    throw new Error(`finance_line_items due query failed: ${dueError.message}`);
  }

  const merged = new Map<string, FinanceLineItemRow>();
  for (const row of byOccurred) merged.set(row.id, row);
  for (const raw of dueData ?? []) {
    const row = mapFinanceLineItemRow(raw as Record<string, unknown>);
    merged.set(row.id, row);
  }

  return filterOperatingLineItems([...merged.values()], params.q);
}

export async function listRecurringSeriesItems(seriesId: string): Promise<FinanceLineItemRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('finance_line_items')
    .select('*')
    .eq('recurrence_series_id', seriesId)
    .order('occurred_on', { ascending: true });
  if (error) {
    throw new Error(`finance_line_items series query failed: ${error.message}`);
  }
  return (data ?? []).map((row) => mapFinanceLineItemRow(row as Record<string, unknown>));
}

export async function extendRecurringSeries(
  seriesId: string,
  direction: 'before' | 'after',
  extendUntil: string,
  createdBy: string
): Promise<{ rows: FinanceLineItemRow[]; created_count: number }> {
  const supabase = getSupabase();
  const existing = await listRecurringSeriesItems(seriesId);
  if (existing.length === 0) throw new Error('recurrence_series_not_found');

  const template = existing[0];
  const { data: scopeRow } = await supabase
    .from('finance_line_items')
    .select('property_id, parking_id')
    .eq('recurrence_series_id', seriesId)
    .limit(1)
    .maybeSingle();
  const property_id =
    scopeRow && typeof scopeRow.property_id === 'string' ? scopeRow.property_id : null;
  const parking_id =
    scopeRow && typeof scopeRow.parking_id === 'string' ? scopeRow.parking_id : null;
  const interval = template.recurrence_interval;
  if (!interval || !isRecurrenceInterval(interval)) {
    throw new Error('recurrence_series_not_recurring');
  }

  const existingDates = new Set(existing.map((r) => r.occurred_on));
  const minDate = existing[0].occurred_on;
  const maxDate = existing[existing.length - 1].occurred_on;
  const until = extendUntil.slice(0, 10);
  const primaryDay = Number(minDate.slice(8, 10));

  let candidateDates: string[] = [];
  if (direction === 'after') {
    if (until <= maxDate) throw new Error('extend_until_must_be_after_series_end');
    const firstNew = addRecurrenceInterval(maxDate, interval, primaryDay);
    candidateDates = generateRecurrenceDates(firstNew, interval, until, 500, primaryDay);
  } else {
    if (until >= minDate) throw new Error('extend_until_must_be_before_series_start');
    candidateDates = generateRecurrenceDatesBackward(minDate, interval, until, 500, primaryDay);
  }

  const newDates = candidateDates.filter((d) => !existingDates.has(d));
  if (newDates.length === 0) {
    return { rows: existing, created_count: 0 };
  }

  const now = new Date().toISOString();
  const seriesReminderInput = template.telegram_reminder_enabled
    ? {
        telegram_reminder_enabled: true as const,
        telegram_days_before: template.telegram_days_before,
        telegram_reminder_interval: template.telegram_reminder_interval,
        telegram_message_template: template.telegram_message_template,
      }
    : { telegram_reminder_enabled: false as const };
  const rows = newDates.map((occurred_on) => ({
    property_id,
    parking_id,
    kind: template.kind,
    label: template.label,
    amount: template.amount,
    category: template.category,
    notes: template.notes,
    receipt_path: template.receipt_path,
    occurred_on,
    recurrence_series_id: seriesId,
    recurrence_interval: interval,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
    ...reminderFieldsForRecurringRow(seriesReminderInput, occurred_on),
  }));

  const { data, error } = await supabase.from('finance_line_items').insert(rows).select('*');
  if (error) {
    throw new Error(`extend recurring finance_line_items failed: ${error.message}`);
  }

  const inserted = ((data ?? []) as Record<string, unknown>[]).map(mapFinanceLineItemRow);
  const merged = [...existing, ...inserted].sort((a, b) =>
    a.occurred_on.localeCompare(b.occurred_on)
  );
  return { rows: merged, created_count: inserted.length };
}

function summarizeOperating(items: FinanceLineItemRow[]): FinanceOperatingSummary {
  let income = 0;
  let expenses = 0;
  for (const item of items) {
    if (item.kind === 'income') income += item.amount;
    else expenses += item.amount;
  }
  return {
    income: roundMoney(income),
    expenses: roundMoney(expenses),
    net: roundMoney(income - expenses),
  };
}

export async function computeFinanceSummary(params: {
  propertyId?: string;
  parkingId?: string;
  from: string | null;
  to: string | null;
  basis: FinancePeriodBasis;
  includeCancelled: boolean;
  completedOnly: boolean;
  q?: string;
}): Promise<FinanceSummaryResult> {
  const all = params.parkingId
    ? []
    : await fetchAllBookingsForFinance(params.propertyId, {
        includeCancelled: params.includeCancelled,
        completedOnly: params.completedOnly,
      });
  const stayRows = filterBookings(all, params);
  const stays = summarizeStays(stayRows);
  const operatingItems = await listOperatingLineItems({
    propertyId: params.propertyId,
    parkingId: params.parkingId,
    from: params.from,
    to: params.to,
  });
  const operating = summarizeOperating(operatingItems);
  const grandNet = roundMoney(stays.hostNetCompleted + operating.net);

  return {
    period: {
      basis: params.basis,
      from: params.from,
      to: params.to,
    },
    stays,
    operating,
    grandNet,
  };
}

export type FinanceBookingPricingSnapshot = {
  booking_rate: unknown;
  down_payment: unknown;
  balance: unknown;
  security_deposit: unknown;
  pet_fee: unknown;
  parking_rate_guest: unknown;
  parking_rate_paid: unknown;
  guest_additional_fee: unknown;
  guest_balance_paid_amount: unknown;
  sd_refund_amount: unknown;
  sd_refund_method: unknown;
  sd_refund_bank: unknown;
  sd_refund_account_name: unknown;
  sd_refund_account_number: unknown;
  sd_refund_phone_confirmed: unknown;
  sd_refund_guest_feedback: unknown;
  sd_refund_form_emailed_at: unknown;
  sd_refund_form_submitted_at: unknown;
  settled_at: unknown;
  sd_additional_expense_items: unknown;
  sd_additional_profit_items: unknown;
  sd_additional_expenses: unknown;
  sd_additional_profits: unknown;
  next_stay_voucher_code: unknown;
  next_stay_voucher_amount: unknown;
};

export type FinanceBookingRow = {
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
  pricing: FinanceBookingPricingSnapshot;
  status_updated_at: string | null;
  financials: ReturnType<typeof computeBookingFinancials>;
};

function pricingSnapshotFromRow(row: Record<string, unknown>): FinanceBookingPricingSnapshot {
  return {
    booking_rate: row.booking_rate ?? null,
    down_payment: row.down_payment ?? null,
    balance: row.balance ?? null,
    security_deposit: row.security_deposit ?? null,
    pet_fee: row.pet_fee ?? null,
    parking_rate_guest: row.parking_rate_guest ?? null,
    parking_rate_paid: row.parking_rate_paid ?? null,
    guest_additional_fee: row.guest_additional_fee ?? null,
    guest_balance_paid_amount: row.guest_balance_paid_amount ?? null,
    sd_refund_amount: row.sd_refund_amount ?? null,
    sd_refund_method: row.sd_refund_method ?? null,
    sd_refund_bank: row.sd_refund_bank ?? null,
    sd_refund_account_name: row.sd_refund_account_name ?? null,
    sd_refund_account_number: row.sd_refund_account_number ?? null,
    sd_refund_phone_confirmed: row.sd_refund_phone_confirmed ?? null,
    sd_refund_guest_feedback: row.sd_refund_guest_feedback ?? null,
    sd_refund_form_emailed_at: row.sd_refund_form_emailed_at ?? null,
    sd_refund_form_submitted_at: row.sd_refund_form_submitted_at ?? null,
    settled_at: row.settled_at ?? null,
    sd_additional_expense_items: row.sd_additional_expense_items ?? null,
    sd_additional_profit_items: row.sd_additional_profit_items ?? null,
    sd_additional_expenses: row.sd_additional_expenses ?? null,
    sd_additional_profits: row.sd_additional_profits ?? null,
    next_stay_voucher_code: row.next_stay_voucher_code ?? null,
    next_stay_voucher_amount: row.next_stay_voucher_amount ?? null,
  };
}

export async function listFinanceBookings(params: {
  propertyId?: string;
  from: string | null;
  to: string | null;
  basis: FinancePeriodBasis;
  includeCancelled: boolean;
  completedOnly: boolean;
  q?: string;
  page: number;
  limit: number;
  sort: 'check_in_date:asc' | 'check_in_date:desc' | 'host_net:desc' | 'host_net:asc';
}): Promise<{ rows: FinanceBookingRow[]; total: number }> {
  const all = await fetchAllBookingsForFinance(params.propertyId, {
    includeCancelled: params.includeCancelled,
    completedOnly: params.completedOnly,
  });
  let filtered = filterBookings(all, params);

  filtered.sort((a, b) => {
    if (params.sort === 'host_net:desc' || params.sort === 'host_net:asc') {
      const na = financeDisplayNet(computeBookingFinancials(a)) ?? -Infinity;
      const nb = financeDisplayNet(computeBookingFinancials(b)) ?? -Infinity;
      return params.sort === 'host_net:desc' ? nb - na : na - nb;
    }
    const ia = checkInDateToIso(String(a.check_in_date ?? ''));
    const ib = checkInDateToIso(String(b.check_in_date ?? ''));
    return params.sort === 'check_in_date:desc' ? ib.localeCompare(ia) : ia.localeCompare(ib);
  });

  const total = filtered.length;
  const start = (params.page - 1) * params.limit;
  const pageRows = filtered.slice(start, start + params.limit);

  const rows: FinanceBookingRow[] = pageRows.map((row) => ({
    id: String(row.id),
    guest_facebook_name: String(row.guest_facebook_name ?? ''),
    primary_guest_name: String(row.primary_guest_name ?? ''),
    guest_email: String(row.guest_email ?? ''),
    valid_id_url:
      typeof row.valid_id_url === 'string' && row.valid_id_url.trim() ? row.valid_id_url : null,
    need_parking: row.need_parking === true,
    has_pets: row.has_pets === true,
    guest_requests_surprise_decor: row.guest_requests_surprise_decor,
    check_in_date: String(row.check_in_date ?? ''),
    check_out_date: String(row.check_out_date ?? ''),
    number_of_nights: Math.max(1, Number(row.number_of_nights) || 1),
    status: String(row.status ?? ''),
    status_updated_at: typeof row.status_updated_at === 'string' ? row.status_updated_at : null,
    pricing: pricingSnapshotFromRow(row),
    financials: computeBookingFinancials(row),
  }));

  return { rows, total };
}

export async function createFinanceLineItem(
  input: {
    propertyId?: string;
    parkingId?: string;
    kind: FinanceLineItemKind;
    label: string;
    amount: number;
    category?: string | null;
    occurred_on: string;
    notes?: string | null;
    receipt_path?: string | null;
    recurrence_interval?: RecurrenceInterval | null;
    recurrence_until?: string | null;
    telegramReminder?: FinanceTelegramReminderInput;
  },
  createdBy: string
): Promise<{ row: FinanceLineItemRow; created_count: number }> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const base = {
    property_id: input.propertyId ?? null,
    parking_id: input.parkingId ?? null,
    kind: input.kind,
    label: input.label.slice(0, 200),
    amount: input.amount,
    category: input.category?.slice(0, 80) ?? null,
    notes: input.notes?.slice(0, 2000) ?? null,
    receipt_path: input.receipt_path ?? null,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
  };

  const interval = input.recurrence_interval;
  if (!interval || !isRecurrenceInterval(interval)) {
    const { data, error } = await supabase
      .from('finance_line_items')
      .insert({
        ...base,
        occurred_on: input.occurred_on,
        recurrence_series_id: null,
        recurrence_interval: null,
        ...reminderFieldsForInsert(input.telegramReminder, input.occurred_on),
      })
      .select('*')
      .single();
    if (error) throw new Error(`create finance_line_item failed: ${error.message}`);
    const row = mapFinanceLineItemRow(data as Record<string, unknown>);
    return { row, created_count: 1 };
  }

  const until =
    input.recurrence_until && input.recurrence_until >= input.occurred_on
      ? input.recurrence_until.slice(0, 10)
      : defaultRecurrenceUntilForInterval(input.occurred_on, interval);
  const dates = generateRecurrenceDates(input.occurred_on, interval, until);
  if (dates.length === 0) {
    throw new Error('recurrence_generated_no_dates');
  }

  const seriesId = crypto.randomUUID();
  const rows = dates.map((occurred_on) => ({
    ...base,
    occurred_on,
    recurrence_series_id: seriesId,
    recurrence_interval: interval,
    ...reminderFieldsForRecurringRow(input.telegramReminder, occurred_on),
  }));

  const { data, error } = await supabase.from('finance_line_items').insert(rows).select('*');
  if (error) throw new Error(`create recurring finance_line_items failed: ${error.message}`);
  const inserted = ((data ?? []) as Record<string, unknown>[]).sort((a, b) =>
    String(a.occurred_on).localeCompare(String(b.occurred_on))
  );
  if (inserted.length === 0) throw new Error('create recurring finance_line_items empty');
  return {
    row: mapFinanceLineItemRow(inserted[0]),
    created_count: inserted.length,
  };
}

export async function updateFinanceLineItem(
  id: string,
  patch: Partial<{
    kind: FinanceLineItemKind;
    label: string;
    amount: number;
    category: string | null;
    occurred_on: string;
    notes: string | null;
    receipt_path: string | null;
    recurrence_interval: RecurrenceInterval;
    recurrence_until: string;
    telegramReminder?: FinanceTelegramReminderInput;
  }>,
  scope: RecurrenceEditScope = 'this'
): Promise<{ row: FinanceLineItemRow; updated_count: number }> {
  const supabase = getSupabase();
  const { data: existing, error: fetchErr } = await supabase
    .from('finance_line_items')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw new Error(`fetch finance_line_item failed: ${fetchErr.message}`);
  if (!existing) throw new Error('finance_line_item_not_found');

  const row = mapFinanceLineItemRow(existing as Record<string, unknown>);
  const seriesId = row.recurrence_series_id;
  const now = new Date().toISOString();

  const contentUpdate: Record<string, unknown> = { updated_at: now };
  if (patch.kind) contentUpdate.kind = patch.kind;
  if (patch.label != null) contentUpdate.label = patch.label.slice(0, 200);
  if (patch.amount != null) contentUpdate.amount = patch.amount;
  if (patch.category !== undefined) {
    contentUpdate.category = patch.category?.slice(0, 80) ?? null;
  }
  if (patch.notes !== undefined) {
    contentUpdate.notes = patch.notes?.slice(0, 2000) ?? null;
  }
  if (patch.receipt_path !== undefined) {
    contentUpdate.receipt_path = patch.receipt_path;
  }
  const reminderUpdate = reminderFieldsForUpdate(patch.telegramReminder);
  if (reminderUpdate) {
    delete reminderUpdate.telegram_due_date;
    Object.assign(contentUpdate, reminderUpdate);
  }

  if (seriesId && row.recurrence_interval) {
    const intervalCandidate = patch.recurrence_interval ?? row.recurrence_interval;
    if (!isRecurrenceInterval(intervalCandidate)) {
      throw new Error('invalid_recurrence_interval');
    }

    let seriesEnd = row.occurred_on;
    const { data: endRow, error: endErr } = await supabase
      .from('finance_line_items')
      .select('occurred_on')
      .eq('recurrence_series_id', seriesId)
      .order('occurred_on', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (endErr) {
      throw new Error(`fetch finance_line_items series end failed: ${endErr.message}`);
    }
    if (endRow?.occurred_on) {
      seriesEnd = String(endRow.occurred_on).slice(0, 10);
    }

    const untilCandidate = patch.recurrence_until?.slice(0, 10) ?? seriesEnd;
    const intervalChanged = intervalCandidate !== row.recurrence_interval;
    const untilChanged = untilCandidate !== seriesEnd;

    if (intervalChanged || untilChanged) {
      const reminderInput = patch.telegramReminder;
      return await rebuildMaterializedRecurrenceSeries({
        supabase,
        table: 'finance_line_items',
        dateColumn: 'occurred_on',
        seriesId,
        anchorId: id,
        newInterval: intervalCandidate,
        newUntil: untilCandidate,
        mapRow: mapFinanceLineItemRow,
        buildRowPatch: (existingRow, dateYmd, updatedAt) => {
          const rowPatch: Record<string, unknown> = {
            ...contentUpdate,
            occurred_on: dateYmd,
            recurrence_interval: intervalCandidate,
            updated_at: updatedAt,
          };
          if (reminderInput) {
            Object.assign(rowPatch, reminderFieldsForRecurringRow(reminderInput, dateYmd));
          } else if (existingRow.telegram_reminder_enabled) {
            rowPatch.telegram_due_date = dateYmd;
          }
          return rowPatch;
        },
        buildInsertRow: (template, dateYmd, updatedAt) => ({
          kind: contentUpdate.kind ?? template.kind,
          label: contentUpdate.label ?? template.label,
          amount: contentUpdate.amount ?? template.amount,
          category: contentUpdate.category ?? template.category,
          notes: contentUpdate.notes ?? template.notes,
          receipt_path: contentUpdate.receipt_path ?? template.receipt_path,
          occurred_on: dateYmd,
          recurrence_series_id: seriesId,
          recurrence_interval: intervalCandidate,
          created_by: template.created_by,
          created_at: updatedAt,
          updated_at: updatedAt,
          ...(reminderInput
            ? reminderFieldsForRecurringRow(reminderInput, dateYmd)
            : template.telegram_reminder_enabled
              ? {
                  telegram_reminder_enabled: true,
                  telegram_due_date: dateYmd,
                  telegram_days_before: template.telegram_days_before,
                  telegram_reminder_interval: template.telegram_reminder_interval,
                  telegram_message_template: template.telegram_message_template,
                }
              : {
                  telegram_reminder_enabled: false,
                  telegram_due_date: null,
                  telegram_days_before: 3,
                  telegram_reminder_interval: 'daily_noon',
                  telegram_message_template: null,
                }),
        }),
      });
    }
  }

  const effectiveScope = row.recurrence_series_id && isRecurrenceEditScope(scope) ? scope : 'this';

  const update: Record<string, unknown> = { ...contentUpdate };

  if (effectiveScope === 'this') {
    if (patch.occurred_on) update.occurred_on = patch.occurred_on;
    const { data, error } = await supabase
      .from('finance_line_items')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(`update finance_line_item failed: ${error.message}`);
    return {
      row: mapFinanceLineItemRow(data as Record<string, unknown>),
      updated_count: 1,
    };
  }

  const dateChanged = Boolean(patch.occurred_on) && patch.occurred_on !== row.occurred_on;
  const interval = row.recurrence_interval;

  if (dateChanged && interval) {
    return await reshiftRecurringSeriesDates({
      supabase,
      id,
      row,
      patch,
      update,
      effectiveScope,
      interval,
    });
  }

  let q = supabase
    .from('finance_line_items')
    .update(update)
    .eq('recurrence_series_id', row.recurrence_series_id);
  if (effectiveScope === 'this_and_future') {
    q = q.gte('occurred_on', row.occurred_on);
  }

  const { data, error } = await q.select('*');
  if (error) throw new Error(`update finance_line_items series failed: ${error.message}`);
  const updated = (data ?? []) as Record<string, unknown>[];
  const anchor = updated.find((r) => String(r.id) === id) ?? updated[0] ?? existing;
  return {
    row: mapFinanceLineItemRow(anchor as Record<string, unknown>),
    updated_count: updated.length,
  };
}

async function reshiftRecurringSeriesDates(params: {
  supabase: ReturnType<typeof getSupabase>;
  id: string;
  row: FinanceLineItemRow;
  patch: Partial<{ occurred_on: string }>;
  update: Record<string, unknown>;
  effectiveScope: RecurrenceEditScope;
  interval: RecurrenceInterval;
}): Promise<{ row: FinanceLineItemRow; updated_count: number }> {
  const { supabase, id, row, patch, update, effectiveScope, interval } = params;
  const seriesId = row.recurrence_series_id;
  if (!seriesId || !patch.occurred_on) {
    throw new Error('invalid_recurring_date_shift');
  }

  let seriesQuery = supabase
    .from('finance_line_items')
    .select('*')
    .eq('recurrence_series_id', seriesId)
    .order('occurred_on', { ascending: true });
  if (effectiveScope === 'this_and_future') {
    seriesQuery = seriesQuery.gte('occurred_on', row.occurred_on);
  }

  const { data: scopedRows, error: fetchErr } = await seriesQuery;
  if (fetchErr) {
    throw new Error(`fetch finance_line_items series failed: ${fetchErr.message}`);
  }

  const rows = (scopedRows ?? []) as Record<string, unknown>[];
  if (rows.length === 0) throw new Error('finance_line_item_not_found');

  let newDates: string[];
  if (effectiveScope === 'all') {
    const delta = daysBetweenIso(row.occurred_on, patch.occurred_on);
    newDates = rows.map((r) => addDaysToIso(String(r.occurred_on).slice(0, 10), delta));
  } else {
    const { data: allSeriesRows, error: allErr } = await supabase
      .from('finance_line_items')
      .select('occurred_on')
      .eq('recurrence_series_id', seriesId)
      .order('occurred_on', { ascending: false })
      .limit(1);
    if (allErr) {
      throw new Error(`fetch finance_line_items series end failed: ${allErr.message}`);
    }
    const seriesEnd = String(allSeriesRows?.[0]?.occurred_on ?? row.occurred_on).slice(0, 10);
    newDates = generateRecurrenceDates(patch.occurred_on, interval, seriesEnd);
    if (newDates.length === 0) throw new Error('recurrence_generated_no_dates');
  }

  const now = String(update.updated_at);
  let anchor: Record<string, unknown> | null = null;
  const idsToDelete: string[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const existingRow = rows[i];
    const rowId = String(existingRow.id);
    const newDate = newDates[i];

    if (!newDate) {
      idsToDelete.push(rowId);
      continue;
    }

    const rowUpdate = {
      ...update,
      occurred_on: newDate,
      updated_at: now,
    };
    const { data, error } = await supabase
      .from('finance_line_items')
      .update(rowUpdate)
      .eq('id', rowId)
      .select('*')
      .single();
    if (error) {
      throw new Error(`update finance_line_item date shift failed: ${error.message}`);
    }
    if (rowId === id) anchor = data as Record<string, unknown>;
  }

  if (idsToDelete.length > 0) {
    const { error: deleteErr } = await supabase
      .from('finance_line_items')
      .delete()
      .in('id', idsToDelete);
    if (deleteErr) {
      throw new Error(`delete finance_line_items after date shift failed: ${deleteErr.message}`);
    }
  }

  const updatedCount = rows.length - idsToDelete.length;
  if (!anchor) {
    const { data: refetched, error: refetchErr } = await supabase
      .from('finance_line_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (refetchErr) {
      throw new Error(`fetch finance_line_item anchor failed: ${refetchErr.message}`);
    }
    anchor = (refetched as Record<string, unknown> | null) ?? rows[0];
  }

  return {
    row: mapFinanceLineItemRow(anchor as Record<string, unknown>),
    updated_count: updatedCount,
  };
}

export async function deleteFinanceLineItem(
  id: string,
  scope: RecurrenceEditScope = 'this'
): Promise<{ deleted_count: number }> {
  const supabase = getSupabase();
  const { data: existing, error: fetchErr } = await supabase
    .from('finance_line_items')
    .select('id, recurrence_series_id, occurred_on')
    .eq('id', id)
    .maybeSingle();
  if (fetchErr) throw new Error(`fetch finance_line_item failed: ${fetchErr.message}`);
  if (!existing) throw new Error('finance_line_item_not_found');

  const seriesId = existing.recurrence_series_id ? String(existing.recurrence_series_id) : null;
  const occurredOn = String(existing.occurred_on).slice(0, 10);
  const effectiveScope = seriesId && isRecurrenceEditScope(scope) ? scope : 'this';

  if (effectiveScope === 'this' || !seriesId) {
    const { error } = await supabase.from('finance_line_items').delete().eq('id', id);
    if (error) throw new Error(`delete finance_line_item failed: ${error.message}`);
    return { deleted_count: 1 };
  }

  let q = supabase.from('finance_line_items').delete().eq('recurrence_series_id', seriesId);
  if (effectiveScope === 'this_and_future') {
    q = q.gte('occurred_on', occurredOn);
  }

  const { data, error } = await q.select('id');
  if (error) throw new Error(`delete finance_line_items series failed: ${error.message}`);
  return { deleted_count: (data ?? []).length };
}
