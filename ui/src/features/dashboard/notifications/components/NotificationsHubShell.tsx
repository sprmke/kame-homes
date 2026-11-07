import type { ReactNode } from 'react';

import { NotificationsActivityView } from '@/features/dashboard/notifications/components/NotificationsActivityView';
import { NotificationsHubSummaryCards } from '@/features/dashboard/notifications/components/NotificationsHubSummaryCards';
import {
  NotificationsHubPanel,
  NotificationsHubTabs,
} from '@/features/dashboard/notifications/components/NotificationsHubTabs';
import { useNotificationsList } from '@/features/dashboard/notifications/hooks/useNotifications';
import type { NotificationsHubController } from '@/features/dashboard/notifications/hooks/useNotificationsHubView';
import type { TelegramHubStats } from '@/features/dashboard/notifications/hooks/useTelegramHubStats';
import type { NotificationsHubView } from '@/features/dashboard/notifications/lib/notificationsPaths';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { SlidingTabs } from '@/components/ui/sliding-tabs';
import { useGuardedViewSwitch } from '@/hooks/useGuardedViewSwitch';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';

type Props = {
  hub: NotificationsHubController;
  /** Live Telegram module counts for hub KPIs (from the page's module set). */
  telegramStats: TelegramHubStats;
  /** Telegram view body — the section nav layout and its module cards. */
  children: ReactNode;
};

/**
 * Notifications hub frame shared by the property and parking pages: the KPI
 * cards, the Activity / Telegram switch, and the activity feed. Each page
 * supplies only its own Telegram modules.
 *
 * Switching views unmounts the outgoing one, so the switch goes through
 * `useGuardedViewSwitch` — a half-typed bot token must not vanish silently.
 */
export function NotificationsHubShell({ hub, telegramStats, children }: Props) {
  /* Same query the bell holds, so the tab count is already cached. */
  const { data, isLoading: activityLoading } = useNotificationsList('preview');
  const firstPage = data?.pages[0];
  const unreadCount = firstPage?.unreadCount ?? 0;
  const telegramAvailability = useFeatureAvailability('notifications.telegram');
  const telegramUnavailable = !telegramAvailability.available && !telegramAvailability.isLoading;
  const { requestSwitch, dialogProps } = useGuardedViewSwitch<NotificationsHubView>({
    onCommit: hub.setView,
  });

  return (
    <SlidingTabs
      value={hub.view}
      onValueChange={(next) => requestSwitch(next as NotificationsHubView)}
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 sm:gap-4"
    >
      <NotificationsHubSummaryCards
        unreadCount={unreadCount}
        summary={firstPage?.unreadSummary}
        activityLoading={activityLoading}
        telegram={telegramStats}
        onFocusActivity={() => requestSwitch('activity')}
        onFocusTelegram={() => requestSwitch('telegram')}
      />
      <NotificationsHubTabs unreadCount={unreadCount} telegramUnavailable={telegramUnavailable} />

      {hub.view === 'activity' ? (
        <NotificationsHubPanel view="activity">
          <NotificationsActivityView />
        </NotificationsHubPanel>
      ) : (
        <NotificationsHubPanel view="telegram">{children}</NotificationsHubPanel>
      )}

      <UnsavedChangesDialog {...dialogProps} />
    </SlidingTabs>
  );
}
