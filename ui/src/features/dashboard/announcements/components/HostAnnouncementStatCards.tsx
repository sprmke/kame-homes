import { AlertTriangle, Info, Megaphone, ShieldAlert } from 'lucide-react';

import { ANNOUNCEMENTS_HELP_COPY } from '@/features/dashboard/announcements/lib/announcementsHelpCopy';
import type { HostAnnouncementSummary } from '@/features/dashboard/announcements/lib/hostAnnouncementPresentation';

import { InfoHint } from '@/components/help/InfoHint';
import { StatCard } from '@/components/shared/StatCard';

type HostAnnouncementStatCardsProps = {
  summary: HostAnnouncementSummary;
};

export function HostAnnouncementStatCards({ summary }: HostAnnouncementStatCardsProps) {
  return (
    <section aria-label="Announcement summary">
      <div className="native-stagger grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard title="Active" value={String(summary.total)} icon={Megaphone} />
        <StatCard
          title="Action required"
          value={String(summary.critical)}
          icon={ShieldAlert}
          titleAdornment={
            <InfoHint
              label="Action required"
              text={ANNOUNCEMENTS_HELP_COPY.actionRequired.hint}
              variant="metric"
            />
          }
        />
        <StatCard
          title="Attention"
          value={String(summary.warning)}
          icon={AlertTriangle}
          titleAdornment={
            <InfoHint
              label="Attention"
              text={ANNOUNCEMENTS_HELP_COPY.attention.hint}
              variant="metric"
            />
          }
        />
        <StatCard
          title="Updates"
          value={String(summary.info)}
          icon={Info}
          titleAdornment={
            <InfoHint
              label="Updates"
              text={ANNOUNCEMENTS_HELP_COPY.updates.hint}
              variant="metric"
            />
          }
        />
      </div>
    </section>
  );
}
