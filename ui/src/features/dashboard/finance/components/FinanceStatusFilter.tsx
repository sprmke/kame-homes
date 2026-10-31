import { FINANCE_LEDGER_STATUS_OPTIONS } from '@/features/dashboard/finance/lib/financeLedger';
import type { FinanceLedgerStatus } from '@/features/dashboard/finance/lib/types';

import { AdminMultiSelectFilter } from '@/components/navigation/AdminMultiSelectFilter';

type Props = {
  value: FinanceLedgerStatus[];
  onChange: (next: FinanceLedgerStatus[]) => void;
};

export function FinanceStatusFilter({ value, onChange }: Props) {
  return (
    <AdminMultiSelectFilter
      options={FINANCE_LEDGER_STATUS_OPTIONS}
      value={value}
      onChange={onChange}
      emptyLabel="All Status"
      pluralUnit="statuses"
      ariaLabel="Status filter"
    />
  );
}
