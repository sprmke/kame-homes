import type { FinanceLedgerTypeFilter } from '@/features/dashboard/finance/lib/types';

import { AdminSingleSelectFilter } from '@/components/navigation/AdminSingleSelectFilter';

const TYPE_OPTIONS: { value: FinanceLedgerTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
];

type Props = {
  value: FinanceLedgerTypeFilter;
  onChange: (next: FinanceLedgerTypeFilter) => void;
  /** Nested under desktop Filters — local open + full-width panel. */
  nestedInPopover?: boolean;
};

export function FinanceTypeFilter({ value, onChange, nestedInPopover = false }: Props) {
  return (
    <AdminSingleSelectFilter
      options={TYPE_OPTIONS}
      value={value}
      onChange={onChange}
      ariaLabel="Type filter"
      triggerWidthClassName={nestedInPopover ? 'w-full' : 'sm:w-[8.75rem]'}
      panelAlign={nestedInPopover ? 'left' : 'right'}
      panelWidthClassName={nestedInPopover ? 'w-full' : 'w-[min(calc(100vw-24px),12rem)]'}
      toolbarExclusive={!nestedInPopover}
    />
  );
}
