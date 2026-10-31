import { ADMIN_LIST_VIEW_OPTIONS } from '@/features/dashboard/bookings/components/AdminListViewToggle';
import type { FinanceStaysView } from '@/features/dashboard/finance/lib/types';

import { AdminViewToggle } from '@/components/navigation/AdminViewToggle';

type Props = {
  value: FinanceStaysView;
  onChange: (next: FinanceStaysView) => void;
  hideTableView?: boolean;
  className?: string;
};

export function FinanceStaysViewToggle({
  value,
  onChange,
  hideTableView = false,
  className,
}: Props) {
  return (
    <AdminViewToggle
      value={value}
      onChange={onChange}
      options={ADMIN_LIST_VIEW_OPTIONS}
      hideValues={hideTableView ? ['table'] : []}
      className={className}
      ariaLabel="Choose stays view"
    />
  );
}
