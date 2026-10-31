import { addDays, eachDayOfInterval, format, parseISO, subDays } from 'date-fns';

import { parseOccupancyDate } from '@/features/dashboard/bookings/components/calendar/calendarDateUtils';
import { occupiedNightCount } from '@/features/dashboard/bookings/components/calendar/calendarStayAmounts';
import { financeDisplayNet } from '@/features/dashboard/bookings/lib/bookingFinance';
import { checkInDateToIso } from '@/features/dashboard/bookings/lib/bookingsListSort';
import {
  assignFinanceBreakdownColors,
  getFinanceCategoryLabel,
} from '@/features/dashboard/finance/lib/financeCategoryColors';
import { bookingDateForPeriod } from '@/features/dashboard/finance/lib/financePeriod';
import type {
  FinanceBookingLedgerRow,
  FinanceLineItem,
  FinancePeriodBasis,
} from '@/features/dashboard/finance/lib/types';

const STAY_NET_CATEGORY = 'Stay net';

export type FinanceCashFlowPoint = {
  date: string;
  income: number;
  expenses: number;
  net: number;
  /** Host net from stays bucketed to this day (already net of stay expenses). */
  stayNetIncome: number;
  /** Manual finance_line_items income on this day. */
  transactionIncome: number;
  stayNetExpense: number;
  transactionExpense: number;
};

export type FinanceCategoryBreakdown = {
  category: string;
  label: string;
  amount: number;
  color: string;
  percentage: number;
};

export type FinanceChartData = {
  cashFlowData: FinanceCashFlowPoint[];
  incomeBreakdown: FinanceCategoryBreakdown[];
  expenseBreakdown: FinanceCategoryBreakdown[];
};

function bookingChartDateIso(
  row: FinanceBookingLedgerRow,
  basis: FinancePeriodBasis
): string | null {
  const iso = bookingDateForPeriod(row, basis);
  return iso || null;
}

/** Occupied overnight dates [check-in, check-out) — same rule as admin calendar. */
function occupiedNightIsoDates(row: FinanceBookingLedgerRow): string[] {
  const start = parseOccupancyDate(row.check_in_date);
  const end = parseOccupancyDate(row.check_out_date);
  if (start && end && start < end) {
    const lastNight = subDays(end, 1);
    return eachDayOfInterval({ start, end: lastNight }).map((day) => format(day, 'yyyy-MM-dd'));
  }

  const checkInIso = checkInDateToIso(row.check_in_date);
  if (!checkInIso) return [];
  const nights = occupiedNightCount(row.number_of_nights);
  const anchor = parseISO(checkInIso);
  return Array.from({ length: nights }, (_, index) => format(addDays(anchor, index), 'yyyy-MM-dd'));
}

function distributeAmountAcrossDays(map: Map<string, number>, dayKeys: string[], total: number) {
  if (dayKeys.length === 0 || total === 0) return;

  const totalCents = Math.round(Math.abs(total) * 100);
  const baseCents = Math.floor(totalCents / dayKeys.length);
  let remainder = totalCents - baseCents * dayKeys.length;

  for (const key of dayKeys) {
    let cents = baseCents;
    if (remainder > 0) {
      cents += 1;
      remainder -= 1;
    }
    map.set(key, (map.get(key) ?? 0) + cents / 100);
  }
}

function bookingChartOccupiedDates(
  row: FinanceBookingLedgerRow,
  basis: FinancePeriodBasis
): string[] {
  const nights = occupiedNightIsoDates(row);
  if (nights.length > 0) return nights;
  const fallback = bookingChartDateIso(row, basis);
  return fallback ? [fallback] : [];
}

function resolveChartDateRange(
  items: FinanceLineItem[],
  bookings: FinanceBookingLedgerRow[],
  from: string | null,
  to: string | null,
  basis: FinancePeriodBasis
): { from: Date; to: Date } | null {
  if (from && to) {
    return { from: parseISO(from), to: parseISO(to) };
  }

  const isoDates: string[] = [];
  for (const item of items) isoDates.push(item.occurred_on);
  for (const row of bookings) {
    const iso = bookingChartDateIso(row, basis);
    if (iso) isoDates.push(iso);
    for (const nightIso of occupiedNightIsoDates(row)) {
      isoDates.push(nightIso);
    }
  }

  if (isoDates.length === 0) return null;
  isoDates.sort();
  return {
    from: parseISO(isoDates[0]!),
    to: parseISO(isoDates[isoDates.length - 1]!),
  };
}

function groupBreakdown(
  items: FinanceLineItem[],
  kind: FinanceLineItem['kind']
): FinanceCategoryBreakdown[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.kind !== kind) continue;
    const key = getFinanceCategoryLabel(item.category);
    totals.set(key, (totals.get(key) ?? 0) + item.amount);
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, amount]) => sum + amount, 0);

  return assignFinanceBreakdownColors(
    sorted.map(([label, amount]) => ({
      category: label,
      label,
      amount,
      color: '',
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
  );
}

/** Merge income + expense slices by category label for the breakdown "All" view. */
export function combineFinanceCategoryBreakdown(
  income: FinanceCategoryBreakdown[],
  expense: FinanceCategoryBreakdown[]
): FinanceCategoryBreakdown[] {
  const totals = new Map<string, number>();
  for (const slice of [...income, ...expense]) {
    totals.set(slice.label, (totals.get(slice.label) ?? 0) + slice.amount);
  }

  const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, amount]) => sum + amount, 0);

  return assignFinanceBreakdownColors(
    sorted.map(([label, amount]) => ({
      category: label,
      label,
      amount,
      color: '',
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
  );
}

function mergeStayNetIncomeBreakdown(
  transactionBreakdown: FinanceCategoryBreakdown[],
  stayNetTotal: number
): FinanceCategoryBreakdown[] {
  if (stayNetTotal <= 0) return transactionBreakdown;

  const merged = [
    ...transactionBreakdown,
    {
      category: STAY_NET_CATEGORY,
      label: STAY_NET_CATEGORY,
      amount: stayNetTotal,
      color: '',
      percentage: 0,
    },
  ].sort((a, b) => b.amount - a.amount);

  const total = merged.reduce((sum, slice) => sum + slice.amount, 0);
  return assignFinanceBreakdownColors(
    merged.map((slice) => ({
      ...slice,
      percentage: total > 0 ? (slice.amount / total) * 100 : 0,
    }))
  );
}

function bucketStayNetByDay(
  bookings: FinanceBookingLedgerRow[],
  basis: FinancePeriodBasis
): {
  incomeByDay: Map<string, number>;
  expenseByDay: Map<string, number>;
  stayNetIncomeTotal: number;
} {
  const incomeByDay = new Map<string, number>();
  const expenseByDay = new Map<string, number>();
  let stayNetIncomeTotal = 0;

  for (const row of bookings) {
    const nightDates = bookingChartOccupiedDates(row, basis);
    if (nightDates.length === 0) continue;

    // Cash flow uses realized host net for completed stays; projected net only
    // when the period basis attributes an in-progress stay to that date.
    const net =
      basis === 'completed' || row.status === 'COMPLETED'
        ? (financeDisplayNet(row.financials) ?? 0)
        : (row.financials.projectedNet ?? 0);

    if (net > 0) {
      distributeAmountAcrossDays(incomeByDay, nightDates, net);
      stayNetIncomeTotal += net;
    } else if (net < 0) {
      distributeAmountAcrossDays(expenseByDay, nightDates, Math.abs(net));
    }
  }

  return { incomeByDay, expenseByDay, stayNetIncomeTotal };
}

export function buildFinanceChartData(
  items: FinanceLineItem[],
  bookings: FinanceBookingLedgerRow[],
  from: string | null,
  to: string | null,
  basis: FinancePeriodBasis = 'completed'
): FinanceChartData {
  const { incomeByDay, expenseByDay, stayNetIncomeTotal } = bucketStayNetByDay(bookings, basis);
  const range = resolveChartDateRange(items, bookings, from, to, basis);

  if (!range) {
    return {
      cashFlowData: [],
      incomeBreakdown: mergeStayNetIncomeBreakdown(
        groupBreakdown(items, 'income'),
        stayNetIncomeTotal
      ),
      expenseBreakdown: groupBreakdown(items, 'expense'),
    };
  }

  const days = eachDayOfInterval({ start: range.from, end: range.to });
  const cashFlowData = days.map((day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const dayItems = items.filter((item) => item.occurred_on === dayKey);
    const transactionIncome = dayItems
      .filter((item) => item.kind === 'income')
      .reduce((sum, item) => sum + item.amount, 0);
    const transactionExpense = dayItems
      .filter((item) => item.kind === 'expense')
      .reduce((sum, item) => sum + item.amount, 0);
    const stayNetIncome = incomeByDay.get(dayKey) ?? 0;
    const stayNetExpense = expenseByDay.get(dayKey) ?? 0;
    const income = transactionIncome + stayNetIncome;
    const expenses = transactionExpense + stayNetExpense;
    return {
      date: format(day, 'MMM d'),
      income,
      expenses,
      net: income - expenses,
      stayNetIncome,
      transactionIncome,
      stayNetExpense,
      transactionExpense,
    };
  });

  return {
    cashFlowData,
    incomeBreakdown: mergeStayNetIncomeBreakdown(
      groupBreakdown(items, 'income'),
      stayNetIncomeTotal
    ),
    expenseBreakdown: groupBreakdown(items, 'expense'),
  };
}
