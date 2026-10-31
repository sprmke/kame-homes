import {
  useTelegramMaintenanceSettings,
  useTelegramMaintenanceTestSend,
  useUpdateTelegramMaintenanceSettings,
} from '@/features/dashboard/bookings/hooks/useTelegramMaintenanceSettings';
import { MAINTENANCE_TEMPLATE_DEFAULTS } from '@/features/dashboard/bookings/lib/telegramNotificationDefaults';
import { TELEGRAM_MAINTENANCE_PLACEHOLDER_KEYS } from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';

import { TelegramSingleTemplateSettingsCard } from './telegram-notifications/TelegramSingleTemplateSettingsCard';

export function TelegramMaintenanceSettingsCard({
  embedded: _embedded = true,
}: {
  embedded?: boolean;
}) {
  return (
    <TelegramSingleTemplateSettingsCard
      embedded={_embedded}
      moduleId="maintenance"
      enableLabel="Send maintenance reminders"
      manageSummary="Default upkeep template"
      editorId="maintenance-tg-template"
      previewSampleSet="maintenance"
      previewContextBot="maintenance"
      sendPreviewTitle="Send test with live reminder data."
      placeholderKeys={TELEGRAM_MAINTENANCE_PLACEHOLDER_KEYS}
      templateDefaults={MAINTENANCE_TEMPLATE_DEFAULTS}
      loadErrorFallback="Could not load reminder settings"
      skeletonAriaLabel="Loading maintenance notification settings"
      useSettings={useTelegramMaintenanceSettings}
      useUpdate={useUpdateTelegramMaintenanceSettings}
      useTestSend={useTelegramMaintenanceTestSend}
      verify={{ action: 'verify_maintenance_telegram_env', groupLabel: 'Maintenance group' }}
    />
  );
}
