import { voucherLiabilityPhp } from '@/features/guest/sd-form/lib/voucher';

import {
  computeTotalGuestBalance,
  guestBalancePaidRecorded,
} from '@/features/dashboard/bookings/lib/totalGuestBalance';
import type { BookingRow, SdSettlementLineItem } from '@/features/dashboard/bookings/lib/types';

/** Minimum booking columns for pricing / P&amp;L math (full row or finance snapshot). */
export type BookingFinanceInput = Pick<
  BookingRow,
  | 'status'
  | 'booking_source'
  | 'booking_rate'
  | 'down_payment'
  | 'balance'
  | 'security_deposit'
  | 'has_pets'
  | 'pet_fee'
  | 'need_parking'
  | 'parking_rate_guest'
  | 'parking_rate_paid'
  | 'guest_additional_fee'
  | 'guest_balance_paid_amount'
  | 'sd_refund_amount'
  | 'sd_additional_expense_items'
  | 'sd_additional_profit_items'
  | 'sd_additional_expenses'
  | 'sd_additional_profits'
  | 'next_stay_voucher_code'
  | 'next_stay_voucher_amount'
>;

export type BookingFinancials = {
  /** Down payment + guest balance (rate − down, or recorded balance). */
  bookingRate: number | null;
  /** Pet + parking margin + additional guest fee (SD pass-through excluded). */
  otherFees: number;
  totalGuestBalance: number | null;
  guestCollected: number;
  guestUnpaid: number | null;
  /** Balance paid minus security deposit — host stay fees only (COMPLETED). */
  stayRevenue: number | null;
  parkingMargin: number | null;
  sdExpenseTotal: number;
  sdProfitTotal: number;
  voucherCost: number;
  hostProfit: number;
  hostExpenses: number;
  hostNet: number;
  projectedNet: number | null;
  isCompleted: boolean;
  isRealized: boolean;
};

function bookingFlagTrue(value: boolean | string | null | undefined): boolean {
  return value === true || value === 'true';
}

function petFeeForHostNet(booking: BookingFinanceInput): number {
  return bookingFlagTrue(booking.has_pets) ? toMoneyNumber(booking.pet_fee) : 0;
}

function parkingFeeForHostNet(booking: BookingFinanceInput): number {
  return bookingFlagTrue(booking.need_parking) ? toMoneyNumber(booking.parking_rate_guest) : 0;
}

export type HostNetBreakdownLine = {
  key: string;
  label: string;
  amount: number;
  indent?: boolean;
};

export type HostNetBreakdownSdLine = HostNetBreakdownLine & {
  variant: 'collected' | 'adjustment-expense' | 'adjustment-profit';
};

export type HostNetBreakdownSd = {
  lines: HostNetBreakdownSdLine[];
};

export type HostNetBreakdown = {
  income: HostNetBreakdownLine[];
  expenses: HostNetBreakdownLine[];
  sd: HostNetBreakdownSd | null;
  net: number;
  isEstimate: boolean;
};

function guestBalanceForStayDisplay(booking: BookingFinanceInput): number | null {
  if (booking.booking_rate != null && booking.booking_rate !== '') {
    return roundMoney(toMoneyNumber(booking.booking_rate) - toMoneyNumber(booking.down_payment));
  }
  if (booking.balance != null && booking.balance !== '') {
    return roundMoney(toMoneyNumber(booking.balance));
  }
  return null;
}

function bookingRateForDisplay(booking: BookingFinanceInput): number | null {
  const guestBalance = guestBalanceForStayDisplay(booking);
  if (guestBalance == null) return null;
  return roundMoney(toMoneyNumber(booking.down_payment) + guestBalance);
}

function otherFeesForDisplay(booking: BookingFinanceInput): number {
  const pet = petFeeForHostNet(booking);
  const parkingMargin = bookingFlagTrue(booking.need_parking)
    ? roundMoney(parkingFeeForHostNet(booking) - toMoneyNumber(booking.parking_rate_paid))
    : 0;
  const additional = toMoneyNumber(booking.guest_additional_fee);
  return roundMoney(pet + parkingMargin + additional);
}

function guestBalanceForHostNet(booking: BookingFinanceInput): number | null {
  return guestBalanceForStayDisplay(booking);
}

function includeSdSettlementInOperatingNet(booking: BookingFinanceInput): boolean {
  return booking.status === 'COMPLETED';
}

/**
 * Host net = lodging + fees − parking owner rate (+ SD settlement when COMPLETED).
 * Security deposit collection, SD refund payout, and SD settlement are omitted until COMPLETED.
 */
function computeOperatingHostNet(booking: BookingFinanceInput): number {
  const down = toMoneyNumber(booking.down_payment);
  const guestBalance = guestBalanceForHostNet(booking) ?? 0;
  const pet = petFeeForHostNet(booking);
  const additional = toMoneyNumber(booking.guest_additional_fee);
  const parkingGuest = parkingFeeForHostNet(booking);
  const parkingPaid = toMoneyNumber(booking.parking_rate_paid);

  let sdProfitTotal = 0;
  let sdExpenseTotal = 0;
  if (includeSdSettlementInOperatingNet(booking)) {
    const { expenses, profits } = buildSdExpenseProfitRows(booking);
    sdExpenseTotal = roundMoney(sumSdLineAmounts(expenses));
    sdProfitTotal = roundMoney(sumSdLineAmounts(profits));
  }

  return roundMoney(
    down +
      guestBalance +
      parkingGuest +
      pet +
      additional -
      parkingPaid +
      sdProfitTotal -
      sdExpenseTotal
  );
}

export function buildHostNetBreakdown(
  booking: BookingFinanceInput,
  isCompleted: boolean
): HostNetBreakdown {
  const down = toMoneyNumber(booking.down_payment);
  const guestBalance = guestBalanceForHostNet(booking);
  const pet = petFeeForHostNet(booking);
  const additional = toMoneyNumber(booking.guest_additional_fee);
  const parkingGuest = parkingFeeForHostNet(booking);
  const parkingPaid = toMoneyNumber(booking.parking_rate_paid);

  const income: HostNetBreakdownLine[] = [{ key: 'down', label: 'Down payment', amount: down }];

  if (guestBalance != null) {
    income.push({
      key: 'guest_balance',
      label: 'Guest balance',
      amount: guestBalance,
    });
  }

  if (bookingFlagTrue(booking.need_parking)) {
    income.push({
      key: 'parking_guest',
      label: 'Parking fee',
      amount: parkingGuest,
    });
  }

  if (bookingFlagTrue(booking.has_pets)) {
    income.push({ key: 'pet', label: 'Pet fee', amount: pet });
  }

  if (additional > 0) {
    income.push({
      key: 'additional',
      label: 'Additional guest fee',
      amount: additional,
    });
  }

  const expenses: HostNetBreakdownLine[] = [];

  if (bookingFlagTrue(booking.need_parking) || parkingPaid > 0) {
    expenses.push({
      key: 'parking_paid',
      label: 'Parking owner rate',
      amount: parkingPaid,
    });
  }

  const { expenses: sdExpenseLines, profits: sdProfitLines } = buildSdExpenseProfitRows(booking);

  if (isCompleted) {
    sdProfitLines.forEach((row, i) => {
      if (row.amount <= 0) return;
      const label = row.label?.trim();
      income.push({
        key: `sd_profit_${i}`,
        label: label ? `SD settlement: ${label}` : 'SD settlement profit',
        amount: row.amount,
      });
    });

    sdExpenseLines.forEach((row, i) => {
      if (row.amount <= 0) return;
      const label = row.label?.trim();
      expenses.push({
        key: `sd_expense_${i}`,
        label: label ? `SD settlement: ${label}` : 'SD settlement expense',
        amount: row.amount,
      });
    });
  }

  return {
    income,
    expenses,
    sd: null,
    net: computeOperatingHostNet(booking),
    isEstimate: !isCompleted,
  };
}

/** Net for tables/sorts: realized hostNet when completed, else projected estimate. */
export function financeDisplayNet(fin: BookingFinancials): number | null {
  if (fin.isCompleted) return fin.hostNet;
  return fin.projectedNet;
}

/** Tailwind text color for host-net display (tables, cards, calendar). */
export function hostNetToneClass(net: number | null, isRealized: boolean): string {
  if (net == null || net === 0) return 'text-muted-foreground';
  if (isRealized) {
    return net > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400';
  }
  return 'text-amber-700 dark:text-amber-300';
}

function toMoneyNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isNaN(n) ? 0 : n;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumSdLineAmounts(items: ReadonlyArray<{ amount: number }>): number {
  return items.reduce((acc, row) => {
    const a = row.amount;
    return acc + (Number.isFinite(a) ? a : 0);
  }, 0);
}

function parseSdLineItemsFromBooking(
  json: SdSettlementLineItem[] | null | undefined
): SdSettlementLineItem[] {
  if (!Array.isArray(json) || json.length === 0) return [];
  return json.map((row) => ({
    label: typeof row.label === 'string' ? row.label : '',
    amount: toMoneyNumber(row.amount),
  }));
}

function parseSdNumberArray(arr: number[] | null | undefined): number[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => toMoneyNumber(x));
}

function buildSdExpenseProfitRows(booking: BookingFinanceInput): {
  expenses: SdSettlementLineItem[];
  profits: SdSettlementLineItem[];
} {
  const expJson = parseSdLineItemsFromBooking(booking.sd_additional_expense_items);
  const profJson = parseSdLineItemsFromBooking(booking.sd_additional_profit_items);
  const expFallback = parseSdNumberArray(booking.sd_additional_expenses).map((amount, i) => ({
    label: `Expense line ${i + 1}`,
    amount,
  }));
  const profFallback = parseSdNumberArray(booking.sd_additional_profits).map((amount, i) => ({
    label: `Profit line ${i + 1}`,
    amount,
  }));
  return {
    expenses: expJson.length ? expJson : expFallback,
    profits: profJson.length ? profJson : profFallback,
  };
}

/**
 * Canonical per-booking financial breakdown for finance reports and pricing card.
 */
export function computeBookingFinancials(booking: BookingFinanceInput): BookingFinancials {
  const isCompleted = booking.status === 'COMPLETED';
  const totalGuestBalance = computeTotalGuestBalance(booking);
  const guestCollected = guestBalancePaidRecorded(booking);
  const guestUnpaid =
    totalGuestBalance != null ? roundMoney(totalGuestBalance - guestCollected) : null;

  const deposit = toMoneyNumber(booking.security_deposit);
  const parkingGuest = toMoneyNumber(booking.parking_rate_guest);
  const parkingPaid = toMoneyNumber(booking.parking_rate_paid);
  const parkingMargin = bookingFlagTrue(booking.need_parking)
    ? roundMoney(parkingGuest - parkingPaid)
    : null;

  const { expenses, profits } = buildSdExpenseProfitRows(booking);
  const sdExpenseTotal = roundMoney(sumSdLineAmounts(expenses));
  const sdProfitTotal = roundMoney(sumSdLineAmounts(profits));
  const voucherCost = voucherLiabilityPhp(
    booking.next_stay_voucher_code,
    booking.next_stay_voucher_amount
  );

  const stayRevenue = isCompleted ? roundMoney(guestCollected - deposit) : null;

  const hostInflows = roundMoney(
    toMoneyNumber(booking.down_payment) +
      (guestBalanceForHostNet(booking) ?? 0) +
      parkingFeeForHostNet(booking) +
      petFeeForHostNet(booking) +
      toMoneyNumber(booking.guest_additional_fee) +
      (isCompleted ? sdProfitTotal : 0)
  );

  let hostProfit = 0;
  let hostExpenses = 0;
  let hostNet = 0;

  const operatingNet = computeOperatingHostNet(booking);

  if (isCompleted) {
    hostProfit = hostInflows;
    hostExpenses = roundMoney(parkingPaid + sdExpenseTotal);
    hostNet = operatingNet;
  }

  let projectedNet: number | null = null;
  if (!isCompleted) {
    projectedNet = operatingNet;
  }

  return {
    bookingRate: bookingRateForDisplay(booking),
    otherFees: otherFeesForDisplay(booking),
    totalGuestBalance,
    guestCollected,
    guestUnpaid,
    stayRevenue,
    parkingMargin,
    sdExpenseTotal,
    sdProfitTotal,
    voucherCost,
    hostProfit,
    hostExpenses,
    hostNet,
    projectedNet,
    isCompleted,
    isRealized: isCompleted,
  };
}
