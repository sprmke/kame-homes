import { CheckCircle2, Clock, LifeBuoy, MessageSquare } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import type { AdminSupportTicket } from '@/features/dashboard/super-admin/hooks/useSupportTicketsAdmin';
import { superAdminSupportSummaryFromList } from '@/features/dashboard/super-admin/lib/superAdminSupportFilters';

type Props = {
  tickets: AdminSupportTicket[];
  /** Server-computed platform-wide counts; falls back to the current page when omitted. */
  summary?: { total: number; open: number; inProgress: number; resolved: number };
};

export function SuperAdminSupportSummaryCards({ tickets, summary: serverSummary }: Props) {
  const summary = serverSummary ?? superAdminSupportSummaryFromList(tickets);

  return (
    <section
      aria-label="Support ticket summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard
        title="Total tickets"
        value={String(summary.total)}
        icon={LifeBuoy}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
      />
      <AdminMetricCard
        title="Open"
        value={String(summary.open)}
        icon={MessageSquare}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
      <AdminMetricCard
        title="In progress"
        value={String(summary.inProgress)}
        icon={Clock}
        iconClassName="text-violet-600 dark:text-violet-400"
        iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
      />
      <AdminMetricCard
        title="Resolved"
        value={String(summary.resolved)}
        icon={CheckCircle2}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />
    </section>
  );
}
