import {
  financeDisplayNet,
  type BookingFinancials,
} from '@/features/dashboard/bookings/lib/bookingFinance';
import type { FinanceBookingLedgerRow } from '@/features/dashboard/finance/lib/types';

import { pdfMoney } from '@/lib/pdf/pdfFormatters';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type StayTableTotals = {
  bookingRate: number;
  otherFees: number;
  completedNet: number;
  pipelineNet: number;
};

/** Sum columns from the stays rows actually rendered in the PDF table. */
export function computeStayTableTotals(stays: FinanceBookingLedgerRow[]): StayTableTotals {
  let bookingRate = 0;
  let otherFees = 0;
  let completedNet = 0;
  let pipelineNet = 0;

  for (const row of stays) {
    const fin = row.financials;
    bookingRate += fin.bookingRate ?? 0;
    otherFees += fin.otherFees;
    if (fin.isCompleted) {
      completedNet += fin.hostNet;
    } else {
      pipelineNet += fin.projectedNet ?? 0;
    }
  }

  return {
    bookingRate: roundMoney(bookingRate),
    otherFees: roundMoney(otherFees),
    completedNet: roundMoney(completedNet),
    pipelineNet: roundMoney(pipelineNet),
  };
}

export function stayRowDisplayNet(fin: BookingFinancials): number {
  return financeDisplayNet(fin) ?? 0;
}

export function formatStayHostNetCell(fin: BookingFinancials): string {
  const net = stayRowDisplayNet(fin);
  return fin.isCompleted ? pdfMoney(net) : `${pdfMoney(net)} est`;
}

/** Footer host-net — single combined total; est when any pipeline stays remain. */
export function formatStayHostNetFoot(completedNet: number, pipelineNet: number): string {
  const total = roundMoney(completedNet + pipelineNet);
  if (pipelineNet !== 0) {
    return `${pdfMoney(total)} est`;
  }
  return pdfMoney(completedNet);
}

export function stayHostNetFootTotal(completedNet: number, pipelineNet: number): number {
  return roundMoney(completedNet + pipelineNet);
}

export function stayHostNetFootIsEstimate(_completedNet: number, pipelineNet: number): boolean {
  return pipelineNet !== 0;
}
