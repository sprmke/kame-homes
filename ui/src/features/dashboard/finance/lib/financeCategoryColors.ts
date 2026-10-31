import { assignUniqueChartColors } from '@/lib/charts/chartPalette';
import { CHART_EXPENSE_COLOR, CHART_INCOME_COLOR } from '@/lib/charts/chartStyles';
import { STATUS_TONE_HEX } from '@/lib/statusToneColors';

/** Semantic category colors — may collide; charts run assignUniqueChartColors after. */
const CATEGORY_COLOR_MAP: Record<string, string> = {
  rent: CHART_INCOME_COLOR,
  'base rate': CHART_INCOME_COLOR,
  amortization: '#6366f1',
  utilities: STATUS_TONE_HEX.orange,
  utility: STATUS_TONE_HEX.orange,
  supplies: STATUS_TONE_HEX.purple,
  maintenance: '#84cc16',
  marketing: '#ec4899',
  staff: '#06b6d4',
  commission: '#d946ef',
  cleaning: '#a855f7',
  'cleaning fee': '#a855f7',
  parking: STATUS_TONE_HEX.blue,
  'parking fee': STATUS_TONE_HEX.blue,
  pet: STATUS_TONE_HEX.amber,
  'pet fee': STATUS_TONE_HEX.amber,
  'security deposit': STATUS_TONE_HEX.green,
  damage: CHART_EXPENSE_COLOR,
  'damage fee': CHART_EXPENSE_COLOR,
  refund: '#22c55e',
  other: STATUS_TONE_HEX.neutral,
  'stay net': CHART_INCOME_COLOR,
  'stay revenue': CHART_INCOME_COLOR,
  income: CHART_INCOME_COLOR,
};

function normalizeCategoryKey(category: string | null | undefined): string {
  return (category ?? 'Other').trim().toLowerCase() || 'other';
}

export function getFinanceCategoryLabel(category: string | null | undefined): string {
  const raw = (category ?? 'Other').trim();
  return raw || 'Other';
}

function getFinanceCategoryColor(category: string | null | undefined, index = 0): string {
  const key = normalizeCategoryKey(category);
  const mapped = CATEGORY_COLOR_MAP[key];
  if (mapped) return mapped;

  const palette = [
    CHART_INCOME_COLOR,
    STATUS_TONE_HEX.blue,
    STATUS_TONE_HEX.purple,
    STATUS_TONE_HEX.amber,
    '#06b6d4',
    CHART_EXPENSE_COLOR,
    STATUS_TONE_HEX.orange,
    '#ec4899',
    '#6366f1',
    STATUS_TONE_HEX.green,
    STATUS_TONE_HEX.neutral,
  ];
  return palette[index % palette.length] ?? STATUS_TONE_HEX.neutral;
}

/** Ensure each breakdown slice in one chart gets a distinct color. */
export function assignFinanceBreakdownColors<T extends { label: string; color?: string }>(
  slices: T[]
): T[] {
  if (slices.length === 0) return slices;

  const colors = assignUniqueChartColors(
    slices.map((slice) => slice.label),
    (label, index) => getFinanceCategoryColor(label, index)
  );

  return slices.map((slice, index) => ({
    ...slice,
    color: colors[index]!,
  }));
}
