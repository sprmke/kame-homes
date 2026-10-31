import { AlertTriangle, Info, Megaphone, ShieldAlert } from 'lucide-react';

import type { HostAnnouncementSummary } from '@/features/dashboard/announcements/lib/hostAnnouncementPresentation';

import { StatCard } from '@/components/shared/StatCard';

type HostAnnouncementStatCardsProps = {
  summary: HostAnnouncementSummary;
};

export function HostAnnouncementStatCards({ summary }: HostAnnouncementStatCardsProps) {
  return (
    <section aria-label="Announcement summary">
      <div className="native-stagger grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard title="Active" value={String(summary.total)} icon={Megaphone} />
        <StatCard title="Action required" value={String(summary.critical)} icon={ShieldAlert} />
        <StatCard title="Attention" value={String(summary.warning)} icon={AlertTriangle} />
        <StatCard title="Updates" value={String(summary.info)} icon={Info} />
      </div>
    </section>
  );
}
