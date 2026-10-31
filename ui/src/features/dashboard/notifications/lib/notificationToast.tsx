import { toast } from 'sonner';

import { PlatformLogo } from '@/features/dashboard/inbox/components/PlatformLogo';
import { NotificationInboxTitle } from '@/features/dashboard/notifications/components/NotificationInboxTitle';
import type { NotificationRealtimeRow } from '@/features/dashboard/notifications/lib/notificationsApi';
import {
  enrichRealtimeNotificationRow,
  formatNotificationGuestName,
  formatNotificationInboxPlatformLabel,
  formatNotificationStayLabel,
  notificationIconFor,
  notificationInboxPlatform,
} from '@/features/dashboard/notifications/lib/notificationsDisplay';

type ShowNotificationToastOptions = {
  onView?: (row: NotificationRealtimeRow) => void;
  /** Re-checked after the async enrich so unmounted channels stay silent. */
  isCancelled?: () => boolean;
};

/** Realtime toast: category glyph, guest name, latest body, stay range. */
export function showNotificationToast(
  row: NotificationRealtimeRow,
  { onView, isCancelled }: ShowNotificationToastOptions = {}
) {
  void enrichRealtimeNotificationRow(row).then((enriched) => {
    if (isCancelled?.()) return;

    const inboxPlatform = notificationInboxPlatform(enriched.metadata);
    const platformLabel = formatNotificationInboxPlatformLabel(enriched.metadata);
    const Icon = notificationIconFor(enriched.type);
    const stayLabel = formatNotificationStayLabel(enriched.metadata);
    const body = enriched.body?.trim();

    const guestName = formatNotificationGuestName(enriched);
    const toastTitle =
      enriched.type === 'inbox_new_message' && platformLabel ? (
        <NotificationInboxTitle name={guestName} platformLabel={platformLabel} />
      ) : (
        guestName
      );

    toast.message(toastTitle, {
      // Coalesced inbox rows fire an UPDATE per message — replace the toast instead of stacking.
      id: row.id,
      icon:
        enriched.type === 'inbox_new_message' && inboxPlatform ? (
          <span
            data-notification-toast-icon
            className="flex size-8 shrink-0 items-center justify-center"
          >
            <PlatformLogo platform={inboxPlatform} size="xs" className="size-8 rounded-full" />
          </span>
        ) : (
          <span
            data-notification-toast-icon
            className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full"
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ),
      description:
        body || stayLabel ? (
          <span className="flex min-w-0 flex-col gap-0.5">
            {body ? (
              <span className="text-foreground/80 line-clamp-2 text-[13px] font-medium">
                {body}
              </span>
            ) : null}
            {stayLabel ? (
              <span className="text-muted-foreground text-xs font-normal tabular-nums">
                {stayLabel}
              </span>
            ) : null}
          </span>
        ) : undefined,
      action: onView ? { label: 'View', onClick: () => onView(row) } : undefined,
    });
  });
}
