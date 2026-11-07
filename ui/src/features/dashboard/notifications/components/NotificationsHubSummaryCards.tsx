import { Bell, Link2, MessageCircle, Send } from 'lucide-react';

import type { TelegramHubStats } from '@/features/dashboard/notifications/hooks/useTelegramHubStats';
import type { NotificationsUnreadSummary } from '@/features/dashboard/notifications/lib/notificationsApi';
import { NOTIFICATIONS_HELP_COPY } from '@/features/dashboard/notifications/lib/notificationsHelpCopy';

import { InfoHint } from '@/components/help/InfoHint';
import { StatCard, StatCardGrid, StatCardSkeleton } from '@/components/shared/StatCard';

function ratioValue(numerator: number, denominator: number): string {
  return `${numerator}/${denominator}`;
}

type Props = {
  unreadCount: number;
  summary: NotificationsUnreadSummary | undefined;
  activityLoading?: boolean;
  telegram: TelegramHubStats;
  onFocusActivity?: () => void;
  onFocusTelegram?: () => void;
};

/** Same red icon well the other dashboard KPI cards use. */
const NOTIFICATION_ICON = {
  iconClassName: 'text-rose-600 dark:text-rose-400',
  iconBgClassName: 'bg-rose-100 dark:bg-rose-900/30',
} as const;

const NOTIFICATIONS_METRICS = [
  { title: 'Unread', icon: Bell, hasHint: false },
  { title: 'Messages', icon: MessageCircle, hasHint: false },
  { title: 'Telegram on', icon: Send, hasHint: true },
  { title: 'Connected', icon: Link2, hasHint: true },
];

export function NotificationsHubSummaryCardsSkeleton() {
  return (
    <StatCardGrid className="lg:grid-cols-2 xl:grid-cols-4">
      {NOTIFICATIONS_METRICS.map((metric) => (
        <StatCardSkeleton
          key={metric.title}
          title={metric.title}
          icon={metric.icon}
          titleAdornment={
            metric.hasHint ? <span aria-hidden className="h-4 w-6 shrink-0" /> : undefined
          }
        />
      ))}
    </StatCardGrid>
  );
}

export function NotificationsHubSummaryCards({
  unreadCount,
  summary,
  activityLoading,
  telegram,
  onFocusActivity,
  onFocusTelegram,
}: Props) {
  const activityPending = activityLoading && summary === undefined && unreadCount === 0;
  const telegramPending = telegram.isLoading;

  if (activityPending && telegramPending) {
    return <NotificationsHubSummaryCardsSkeleton />;
  }

  const inbox = summary?.inbox ?? 0;
  const { moduleCount, enabledCount, connectedCount } = telegram;

  const telegramNeedsSetup = enabledCount > connectedCount;

  return (
    <StatCardGrid className="lg:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Unread"
        value={String(unreadCount)}
        icon={Bell}
        {...NOTIFICATION_ICON}
        valueClassName={unreadCount > 0 ? 'text-rose-600 dark:text-rose-400' : undefined}
        onClick={onFocusActivity}
      />
      <StatCard
        title="Messages"
        value={String(inbox)}
        icon={MessageCircle}
        {...NOTIFICATION_ICON}
        onClick={onFocusActivity}
      />
      <StatCard
        title="Telegram on"
        value={ratioValue(enabledCount, moduleCount)}
        icon={Send}
        {...NOTIFICATION_ICON}
        onClick={onFocusTelegram}
        titleAdornment={
          <InfoHint
            label="Telegram on"
            text={NOTIFICATIONS_HELP_COPY.telegramOn.hint}
            variant="metric"
          />
        }
      />
      <StatCard
        title="Connected"
        value={ratioValue(connectedCount, moduleCount)}
        icon={Link2}
        {...NOTIFICATION_ICON}
        valueClassName={telegramNeedsSetup ? 'text-rose-600 dark:text-rose-400' : undefined}
        onClick={onFocusTelegram}
        titleAdornment={
          <InfoHint
            label="Connected"
            text={NOTIFICATIONS_HELP_COPY.connected.hint}
            variant="metric"
          />
        }
      />
    </StatCardGrid>
  );
}
