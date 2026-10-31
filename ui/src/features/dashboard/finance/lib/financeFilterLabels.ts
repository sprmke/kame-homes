import { format, parseISO } from 'date-fns';

import { detectPreset } from '@/features/dashboard/finance/lib/financePeriod';
import type { FinancePeriodBasis, FinanceQuery } from '@/features/dashboard/finance/lib/types';

const BASIS_LABELS: Record<FinancePeriodBasis, string> = {
  check_in: 'Check-in date',
  check_out: 'Check-out date',
  completed: 'Completion date (completed stays)',
};

export function financeBasisLabel(basis: FinancePeriodBasis): string {
  return BASIS_LABELS[basis];
}

function formatIsoDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

export function financePeriodRangeLabel(from: string | null, to: string | null): string {
  if (!from && !to) return 'All dates';
  if (from && to) return `${formatIsoDate(from)} – ${formatIsoDate(to)}`;
  if (from) return `From ${formatIsoDate(from)}`;
  return `Through ${formatIsoDate(to)}`;
}

export function financePresetLabel(query: FinanceQuery): string | null {
  const preset = detectPreset(query.from, query.to);
  if (preset === 'custom') return null;
  const labels = {
    this_month: 'This month',
    last_month: 'Last month',
    ytd: 'Year to date',
    all: 'All time',
  } as const;
  return labels[preset];
}
