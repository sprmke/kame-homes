/**
 * Server mirror of ui/src/features/dashboard/finance/lib/financeCategoryColors.ts
 * (`getFinanceCategoryLabel`) — keep canonical labels in sync.
 */

const FINANCE_CATEGORY_CANONICAL_LABELS: Record<string, string> = {
  rent: 'Rent',
  'base rate': 'Base rate',
  amortization: 'Amortization',
  utilities: 'Utilities',
  utility: 'Utilities',
  supplies: 'Supplies',
  maintenance: 'Maintenance',
  marketing: 'Marketing',
  staff: 'Staff',
  commission: 'Commission',
  cleaning: 'Cleaning',
  'cleaning fee': 'Cleaning',
  parking: 'Parking',
  'parking fee': 'Parking',
  pet: 'Pet',
  'pet fee': 'Pet',
  'security deposit': 'Security deposit',
  damage: 'Damage',
  'damage fee': 'Damage',
  refund: 'Refund',
  other: 'Other',
  'stay net': 'Stay net',
  'stay revenue': 'Stay revenue',
  income: 'Income',
};

function titleCaseWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function getFinanceCategoryLabel(category: string | null | undefined): string {
  const raw = (category ?? '').trim();
  if (!raw) return 'Other';
  const key = raw.toLowerCase();
  return FINANCE_CATEGORY_CANONICAL_LABELS[key] ?? titleCaseWords(raw);
}
