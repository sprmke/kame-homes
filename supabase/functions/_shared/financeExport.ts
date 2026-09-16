/**
 * CSV builders for finance-export edge function.
 */

import { computeBookingFinancials } from './bookingFinance.ts';
import {
  computeFinanceSummary,
  listOperatingLineItems,
  type FinanceLineItemRow,
} from './financeService.ts';
import type { FinancePeriodBasis } from './financePeriodFilter.ts';
import { isCancelledBooking, passesFinancePeriodFilter } from './financePeriodFilter.ts';
import { createClient } from './supabaseJs.ts';

function escapeCsvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return lines.join('\r\n');
}

export type FinanceExportParams = {
  propertyId?: string;
  parkingId?: string;
  type: 'overview' | 'stays' | 'operating' | 'combined';
  from: string | null;
  to: string | null;
  basis: FinancePeriodBasis;
  includeCancelled: boolean;
  completedOnly: boolean;
  q?: string;
};

export async function buildFinanceExportCsv(params: FinanceExportParams): Promise<{
  filename: string;
  body: string;
}> {
  const periodLabel = `${params.basis}_${params.from ?? 'all'}_${params.to ?? 'all'}`;

  if (params.type === 'overview') {
    const summary = await computeFinanceSummary(params);
    const headers = ['metric', 'value'];
    const rows: (string | number)[][] = [
      ['period_basis', summary.period.basis],
      ['from', summary.period.from ?? ''],
      ['to', summary.period.to ?? ''],
      ['stays_count', summary.stays.count],
      ['completed_stays', summary.stays.completedCount],
      ['booking_rate', summary.stays.bookingRate],
      ['other_fees', summary.stays.otherFees],
      ['parking_margin', summary.stays.parkingMargin],
      ['sd_expenses', summary.stays.sdExpenses],
      ['host_net_completed', summary.stays.hostNetCompleted],
      ['projected_net_pipeline', summary.stays.projectedNetPipeline],
      ['outstanding_guest_balance', summary.stays.outstandingGuestBalance],
      ['operating_income', summary.operating.income],
      ['operating_expenses', summary.operating.expenses],
      ['operating_net', summary.operating.net],
      ['grand_net', summary.grandNet],
    ];
    const definitions = rowsToCsv(
      ['metric', 'formula'],
      [
        ['booking_rate', 'down_payment + guest_balance (booking_rate - down_payment)'],
        [
          'other_fees',
          'pet_fee + parking_margin + additional_guest_fee + (security_deposit - sd_refund)',
        ],
        ['host_net_completed', 'booking_rate + other_fees per completed stay (Breakdown net)'],
        ['grand_net', 'host_net_completed + operating_net'],
      ]
    );
    return {
      filename: `finance-overview-${periodLabel}.csv`,
      body: `${rowsToCsv(headers, rows)}\r\n\r\n# Definitions\r\n${definitions}`,
    };
  }

  if (params.type === 'operating') {
    const items = await listOperatingLineItems({
      propertyId: params.propertyId,
      parkingId: params.parkingId,
      from: params.from,
      to: params.to,
      q: params.q,
    });
    return {
      filename: `finance-transactions-${periodLabel}.csv`,
      body: operatingItemsToCsv(items),
    };
  }

  if (params.type === 'stays') {
    if (params.parkingId) {
      return {
        filename: `finance-stays-${periodLabel}.csv`,
        body: rowsToCsv(['note'], [['No stays ledger for parking slots']]),
      };
    }
    const body = await staysExportCsv(params);
    return { filename: `finance-stays-${periodLabel}.csv`, body };
  }

  // combined
  const summary = await computeFinanceSummary(params);
  const staysBody = await staysExportCsv(params);
  const operatingItems = await listOperatingLineItems({
    propertyId: params.propertyId,
    parkingId: params.parkingId,
    from: params.from,
    to: params.to,
  });
  const operatingBody = operatingItemsToCsv(operatingItems);
  const body = [
    '# Overview',
    rowsToCsv(
      ['metric', 'value'],
      [
        ['grand_net', summary.grandNet],
        ['host_net_completed', summary.stays.hostNetCompleted],
        ['booking_rate', summary.stays.bookingRate],
        ['other_fees', summary.stays.otherFees],
        ['outstanding_guest_balance', summary.stays.outstandingGuestBalance],
        ['stays_count', summary.stays.count],
        ['completed_stays', summary.stays.completedCount],
        ['operating_net', summary.operating.net],
        ['operating_income', summary.operating.income],
        ['operating_expenses', summary.operating.expenses],
      ]
    ),
    '',
    '# Definitions',
    rowsToCsv(
      ['metric', 'formula'],
      [
        ['booking_rate', 'down_payment + guest_balance (booking_rate - down_payment)'],
        [
          'other_fees',
          'pet_fee + parking_margin + additional_guest_fee + (security_deposit - sd_refund)',
        ],
        [
          'host_net_completed',
          'booking_rate + other_fees per completed stay (Breakdown net: income + SD lines - expenses)',
        ],
        ['grand_net', 'host_net_completed + operating_net'],
      ]
    ),
    '',
    '# Stays',
    staysBody,
    '',
    '# Transactions',
    operatingBody,
  ].join('\r\n');
  return { filename: `finance-combined-${periodLabel}.csv`, body };
}

function operatingItemsToCsv(items: FinanceLineItemRow[]): string {
  const headers = [
    'id',
    'kind',
    'label',
    'amount',
    'category',
    'occurred_on',
    'recurrence_series_id',
    'recurrence_interval',
    'notes',
    'created_by',
  ];
  const rows = items.map((i) => [
    i.id,
    i.kind,
    i.label,
    i.amount,
    i.category ?? '',
    i.occurred_on,
    i.recurrence_series_id ?? '',
    i.recurrence_interval ?? '',
    i.notes ?? '',
    i.created_by ?? '',
  ]);
  return rowsToCsv(headers, rows);
}

async function staysExportCsv(params: FinanceExportParams): Promise<string> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data } = await supabase.from('guest_submissions').select('*');
  const scoped = params.propertyId
    ? (data ?? []).filter((row) => row.property_id === params.propertyId)
    : (data ?? []);
  const all = scoped as Record<string, unknown>[];
  const filtered = all.filter((row) => {
    if (!params.includeCancelled && isCancelledBooking(row)) return false;
    if (params.completedOnly && row.status !== 'COMPLETED') return false;
    if (!passesFinancePeriodFilter(row, params.from, params.to, params.basis)) {
      return false;
    }
    const needle = params.q?.trim().toLowerCase() ?? '';
    if (needle) {
      const hay = [row.guest_facebook_name, row.primary_guest_name, row.guest_email]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ');
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const headers = [
    'booking_id',
    'guest',
    'check_in',
    'check_out',
    'status',
    'booking_rate',
    'other_fees',
    'guest_unpaid',
    'parking_margin',
    'host_net',
    'projected_net',
  ];
  let bookingRateTotal = 0;
  let otherFeesTotal = 0;
  let hostNetCompletedTotal = 0;

  const rows = filtered.map((row) => {
    const fin = computeBookingFinancials(row);
    if (fin.bookingRate != null) bookingRateTotal += fin.bookingRate;
    otherFeesTotal += fin.otherFees;
    if (fin.isCompleted) hostNetCompletedTotal += fin.hostNet;
    return [
      String(row.id),
      String(row.guest_facebook_name ?? row.primary_guest_name ?? ''),
      String(row.check_in_date ?? ''),
      String(row.check_out_date ?? ''),
      String(row.status ?? ''),
      fin.bookingRate ?? '',
      fin.otherFees,
      fin.guestUnpaid ?? '',
      fin.parkingMargin ?? '',
      fin.isCompleted ? fin.hostNet : '',
      fin.projectedNet ?? '',
    ];
  });

  if (rows.length > 0) {
    rows.push([
      'TOTALS',
      '',
      '',
      '',
      '',
      Math.round(bookingRateTotal * 100) / 100,
      Math.round(otherFeesTotal * 100) / 100,
      '',
      '',
      Math.round(hostNetCompletedTotal * 100) / 100,
      '',
    ]);
  }

  return rowsToCsv(headers, rows);
}
