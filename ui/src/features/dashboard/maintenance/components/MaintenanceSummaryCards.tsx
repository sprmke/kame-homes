import { Bell, CheckCircle2, Clock3, ListChecks } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import type { MaintenanceSummary } from '@/features/dashboard/maintenance/lib/types';

import { cn } from '@/lib/utils';

type Props = Pick<MaintenanceSummary, 'total' | 'telegramEnabled' | 'completed' | 'pending'>;

export function MaintenanceSummaryCards({ total, telegramEnabled, completed, pending }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
      <AdminMetricCard title="Total" value={String(total)} icon={ListChecks} />
      <AdminMetricCard title="Telegram enabled" value={String(telegramEnabled)} icon={Bell} />
      <AdminMetricCard
        title="Completed"
        value={String(completed)}
        icon={CheckCircle2}
        valueClassName="text-emerald-600 dark:text-emerald-400"
      />
      <AdminMetricCard
        title="Pending"
        value={String(pending)}
        icon={Clock3}
        valueClassName={cn(pending > 0 ? 'text-amber-600 dark:text-amber-400' : undefined)}
      />
    </div>
  );
}
