import { Building2, ClipboardCheck, Home, Star } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';
import { superAdminApprovalsSummaryFromList } from '@/features/dashboard/super-admin/lib/superAdminApprovalsFilters';
import type { ApprovalQueueItem } from '@/features/dashboard/super-admin/types/approval';

type Props = {
  approvals: ApprovalQueueItem[];
  /** Server-computed platform-wide counts; falls back to the current page when omitted. */
  summary?: {
    pending: number;
    orgVerifications: number;
    listingVerifications: number;
    reviews: number;
  };
};

export function SuperAdminApprovalsSummaryCards({ approvals, summary: serverSummary }: Props) {
  const summary = serverSummary ?? superAdminApprovalsSummaryFromList(approvals);

  return (
    <section
      aria-label="Approval summary"
      className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4"
    >
      <AdminMetricCard
        title="In review"
        value={String(summary.pending)}
        icon={ClipboardCheck}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
      <AdminMetricCard
        title="Org verifications"
        value={String(summary.orgVerifications)}
        icon={Building2}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
      />
      <AdminMetricCard
        title="Listing verifications"
        value={String(summary.listingVerifications)}
        icon={Home}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <AdminMetricCard
        title="Reviews"
        value={String(summary.reviews)}
        icon={Star}
        iconClassName="text-violet-600 dark:text-violet-400"
        iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
      />
    </section>
  );
}
