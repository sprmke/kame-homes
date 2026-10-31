import type { FinanceLedgerSort } from '@/features/dashboard/finance/lib/types';

import { AdminSortMenu } from '@/components/navigation/AdminSortMenu';

const SORT_OPTIONS = [
  { value: 'date:desc' as const, label: 'Newest first' },
  { value: 'date:asc' as const, label: 'Oldest first' },
  { value: 'amount:desc' as const, label: 'Amount ↓' },
  { value: 'amount:asc' as const, label: 'Amount ↑' },
];

type Props = {
  sort: FinanceLedgerSort;
  onChange: (sort: FinanceLedgerSort) => void;
  fullWidth?: boolean;
};

export function FinanceLedgerSortMenu({ sort, onChange, fullWidth = false }: Props) {
  return (
    <AdminSortMenu
      sort={sort}
      onChange={onChange}
      options={SORT_OPTIONS}
      ariaLabel="Sort ledger"
      fullWidth={fullWidth}
      menuWidthClass="w-[min(calc(100vw-24px),12rem)]"
    />
  );
}
