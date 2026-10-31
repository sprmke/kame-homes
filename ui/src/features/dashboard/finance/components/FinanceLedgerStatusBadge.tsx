import type { FinanceLedgerStatus } from '@/features/dashboard/finance/lib/types';

import { compactStatusBadgeClasses } from '@/lib/statusToneColors';
import { cn } from '@/lib/utils';

const STATUS_VARIANT: Record<
  FinanceLedgerStatus,
  { label: string; variant: 'success' | 'pending' | 'danger' }
> = {
  completed: { label: 'Completed', variant: 'success' },
  pending: { label: 'Pending', variant: 'pending' },
  canceled: { label: 'Canceled', variant: 'danger' },
};

type Props = {
  status: FinanceLedgerStatus;
  className?: string;
};

export function FinanceLedgerStatusBadge({ status, className }: Props) {
  const config = STATUS_VARIANT[status];
  return (
    <span className={cn(compactStatusBadgeClasses(config.variant), className)}>{config.label}</span>
  );
}
