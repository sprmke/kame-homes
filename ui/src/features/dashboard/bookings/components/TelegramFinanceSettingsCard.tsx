import {
  useTelegramFinanceSettings,
  useTelegramFinanceTestSend,
  useUpdateTelegramFinanceSettings,
} from '@/features/dashboard/bookings/hooks/useTelegramFinanceSettings';
import { FINANCE_TEMPLATE_DEFAULTS } from '@/features/dashboard/bookings/lib/telegramNotificationDefaults';
import { TELEGRAM_FINANCE_PLACEHOLDER_KEYS } from '@/features/dashboard/bookings/lib/templatePlaceholderCatalog';

import { TelegramSingleTemplateSettingsCard } from './telegram-notifications/TelegramSingleTemplateSettingsCard';

export function TelegramFinanceSettingsCard({
  embedded: _embedded = true,
}: {
  embedded?: boolean;
}) {
  return (
    <TelegramSingleTemplateSettingsCard
      embedded={_embedded}
      moduleId="finance"
      enableLabel="Send payment due reminders"
      manageSummary="Default due-date template"
      editorId="finance-tg-template"
      previewSampleSet="finance"
      previewContextBot="finance"
      sendPreviewTitle="Send test with live transaction data."
      placeholderKeys={TELEGRAM_FINANCE_PLACEHOLDER_KEYS}
      templateDefaults={FINANCE_TEMPLATE_DEFAULTS}
      loadErrorFallback="Could not load reminder settings"
      skeletonAriaLabel="Loading finance notification settings"
      useSettings={useTelegramFinanceSettings}
      useUpdate={useUpdateTelegramFinanceSettings}
      useTestSend={useTelegramFinanceTestSend}
      verify={{ action: 'verify_finance_telegram_env', groupLabel: 'Finance group' }}
    />
  );
}
