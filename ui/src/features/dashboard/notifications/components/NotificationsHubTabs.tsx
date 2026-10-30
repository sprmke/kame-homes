import type { ReactNode } from 'react';

import { Bell, Send } from 'lucide-react';

import {
  NOTIFICATIONS_HUB_VIEWS,
  type NotificationsHubView,
} from '@/features/dashboard/notifications/lib/notificationsPaths';

import { FeatureStatusDot } from '@/components/feature-availability/FeatureStatusDot';
import { SlidingTabsList, SlidingTabsTrigger } from '@/components/ui/sliding-tabs';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

const VIEW_META: Record<NotificationsHubView, { label: string; icon: LucideIcon }> = {
  activity: { label: 'Activity', icon: Bell },
  telegram: { label: 'Telegram', icon: Send },
};

/** Panel id a trigger drives — paired with `NotificationsHubPanel`. */
function notificationsHubPanelId(view: NotificationsHubView): string {
  return `notifications-view-${view}`;
}

function notificationsHubTabId(view: NotificationsHubView): string {
  return `notifications-tab-${view}`;
}

type Props = {
  /** Unread in-app items — shown on the Activity tab. */
  unreadCount: number;
  /** Amber dot on Telegram when the module is off. */
  telegramUnavailable?: boolean;
  /** Contextual action for the current view (Mark all as read, Get Help). */
  action?: ReactNode;
  /** Match the active view's content width so the action lines up with it. */
  className?: string;
};

/**
 * Top-level switch between the in-app activity feed and Telegram delivery
 * setup. Sits above the scrollport so it stays reachable while either view
 * scrolls. Wrap in `SlidingTabs` so the active pill and `onValueChange` work.
 */
export function NotificationsHubTabs({
  unreadCount,
  telegramUnavailable = false,
  action,
  className,
}: Props) {
  return (
    <div className={cn('flex shrink-0 items-center justify-between gap-2', className)}>
      <SlidingTabsList size="primary" aria-label="Notifications" remeasureDeps={[unreadCount]}>
        {NOTIFICATIONS_HUB_VIEWS.map((value) => {
          const { label, icon: Icon } = VIEW_META[value];
          const showCount = value === 'activity' && unreadCount > 0;
          return (
            <SlidingTabsTrigger
              key={value}
              value={value}
              id={notificationsHubTabId(value)}
              aria-controls={notificationsHubPanelId(value)}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
              {value === 'telegram' && telegramUnavailable ? (
                <FeatureStatusDot className="ml-0.5" />
              ) : null}
              {showCount ? (
                <span
                  className="bg-primary-strong text-primary-foreground ml-0.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums leading-[1.125rem]"
                  aria-label={`${unreadCount} unread`}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </SlidingTabsTrigger>
          );
        })}
      </SlidingTabsList>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

type PanelProps = {
  view: NotificationsHubView;
  className?: string;
  children: ReactNode;
};

/** Tab panel for one hub view — fills the remaining height so its view owns scroll. */
export function NotificationsHubPanel({ view, className, children }: PanelProps) {
  return (
    <div
      role="tabpanel"
      id={notificationsHubPanelId(view)}
      aria-labelledby={notificationsHubTabId(view)}
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}
    >
      {children}
    </div>
  );
}
