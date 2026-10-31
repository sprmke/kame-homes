import type { ReactNode } from 'react';

import { AdminSectionGroupHeading } from '@/features/dashboard/bookings/components/AdminSectionNavLayout';
import { TelegramNotificationsSettingsProvider } from '@/features/dashboard/bookings/components/telegram-notifications/TelegramNotificationsSettingsContext';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

import { FeatureUnavailableNotice } from '@/components/feature-availability/FeatureUnavailableNotice';
import { FeatureUnavailablePanel } from '@/components/feature-availability/FeatureUnavailablePanel';
import { useFeatureAvailability } from '@/lib/featureAvailability/useFeatureAvailability';

type Props = {
  moduleCount: number;
  helpAction: ReactNode;
  children: ReactNode;
};

export function TelegramNotificationsTelegramSection({ moduleCount, helpAction, children }: Props) {
  const telegram = useFeatureAvailability('notifications.telegram');
  const delivery = useFeatureAvailability('notifications.telegram.delivery');
  const settings = useFeatureAvailability('notifications.telegram.settings');

  const showTierBadge = telegram.available && !telegram.isLoading;
  const settingsEditable = settings.available || settings.isLoading;

  if (!telegram.available && !telegram.isLoading) {
    return (
      <>
        <AdminSectionGroupHeading title="Telegram notifications" count={moduleCount} />
        <FeatureUnavailablePanel
          label={telegram.label}
          message={telegram.message}
          expectedBackLabel={telegram.expectedBackLabel}
          reason={telegram.reason}
          tone={telegram.tone}
        />
      </>
    );
  }

  return (
    <TelegramNotificationsSettingsProvider settingsEditable={settingsEditable}>
      <AdminSectionGroupHeading
        title="Telegram notifications"
        count={moduleCount}
        badge={showTierBadge ? <TierBadge feature="telegramNotifications" /> : undefined}
        action={helpAction}
      />

      {!delivery.available && !delivery.isLoading ? (
        <FeatureUnavailableNotice
          title="Delivery paused"
          label={delivery.message}
          expectedBackLabel={delivery.expectedBackLabel}
          tone={delivery.tone}
        />
      ) : null}

      {children}
    </TelegramNotificationsSettingsProvider>
  );
}
