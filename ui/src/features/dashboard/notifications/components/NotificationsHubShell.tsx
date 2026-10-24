import type { ReactNode } from 'react';

import { NotificationsActivityView } from '@/features/dashboard/notifications/components/NotificationsActivityView';
import { NotificationsHubSummaryCards } from '@/features/dashboard/notifications/components/NotificationsHubSummaryCards';
import {
  NotificationsHubPanel,
  NotificationsHubTabs,
} from '@/features/dashboard/notifications/components/NotificationsHubTabs';
import {
  useMarkAllNotificationsRead,
  useNotificationsList,
} from '@/features/dashboard/notifications/hooks/useNotifications';
import type { NotificationsHubController } from '@/features/dashboard/notifications/hooks/useNotificationsHubView';
import type { TelegramHubStats } from '@/features/dashboard/notifications/hooks/useTelegramHubStats';
import type { NotificationsHubView } from '@/features/dashboard/notifications/lib/notificationsPaths';

import { UnsavedChangesDialog } from '@/components/forms/UnsavedChangesDialog';
import { SlidingTabs } from '@/components/ui/sliding-tabs';
import { useGuardedViewSwitch } from '@/hooks/useGuardedViewSwitch';

type Props = {
  hub: NotificationsHubController;
  /** Live Telegram module counts for hub KPIs (from the page's module set). */
  telegramStats: TelegramHubStats;
  /** `TierBadge` for the Telegram plan gate — renders nothing when entitled. */
  telegramBadge?: ReactNode;
  /** Telegram-only header action (Get Help). */
  telegramAction?: ReactNode;
  /** Telegram view body — the section nav layout and its module cards. */
  children: ReactNode;
};

/**
 * Notifications hub frame shared by the property and parking pages: the
 * Activity / Telegram switch, the contextual action for the current view, and
 * the activity feed. Each page supplies only its own Telegram modules.
 *
 * Switching views unmounts the outgoing one, so the switch goes through
 * `useGuardedViewSwitch` — a half-typed bot token must not vanish silently.
 */
export function NotificationsHubShell({
  hub,
  telegramStats,
  telegramBadge,
  telegramAction,
  children,
}: Props) {
  /* Same query the bell holds, so the tab count is already cached. */
  const { data, isLoading: activityLoading } = useNotificationsList('preview');
  const firstPage = data?.pages[0];
  const unreadCount = firstPage?.unreadCount ?? 0;
  const markAllRead = useMarkAllNotificationsRead();
  const { requestSwitch, dialogProps } = useGuardedViewSwitch<NotificationsHubView>({
    onCommit: hub.setView,
  });

  const action =
    hub.view === 'activity' ? (
      unreadCount > 0 ? (
        <button
          type="button"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
          className="text-primary text-xs font-semibold hover:underline disabled:opacity-50"
        >
          Mark all as read
        </button>
      ) : null
    ) : (
      <>
        {telegramBadge}
        {telegramAction}
      </>
    );

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
      <NotificationsHubTabs unreadCount={unreadCount} action={action} />

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
