import { AlertTriangle, Megaphone, Radio, ShieldAlert } from 'lucide-react';

import type { HostAnnouncementDraft } from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import { superAdminAnnouncementSummaryFromList } from '@/features/dashboard/super-admin/lib/superAdminAnnouncementFilters';

import { StatCard, StatCardGrid } from '@/components/shared/StatCard';

type Props = {
  announcements: HostAnnouncementDraft[];
};

export function SuperAdminAnnouncementSummaryCards({ announcements }: Props) {
  const summary = superAdminAnnouncementSummaryFromList(announcements);

  return (
    <StatCardGrid>
      <StatCard
        title="Total announcements"
        value={String(summary.total)}
        icon={Megaphone}
        iconClassName="text-sky-600 dark:text-sky-400"
        iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
      />
      <StatCard
        title="Active"
        value={String(summary.active)}
        icon={Radio}
        iconClassName="text-emerald-600 dark:text-emerald-400"
        iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
      />
      <StatCard
        title="Critical"
        value={String(summary.critical)}
        icon={ShieldAlert}
        iconClassName="text-rose-600 dark:text-rose-400"
        iconBgClassName="bg-rose-100 dark:bg-rose-900/30"
      />
      <StatCard
        title="Warning"
        value={String(summary.warning)}
        icon={AlertTriangle}
        iconClassName="text-amber-600 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
      />
    </StatCardGrid>
  );
}
