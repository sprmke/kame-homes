import type { PropertyTelegramCredentialsStatus } from '@/features/dashboard/bookings/hooks/useAppSettings';
import { useTelegramAdminSettings } from '@/features/dashboard/bookings/hooks/useTelegramAdminSettings';
import { useTelegramChatSettings } from '@/features/dashboard/bookings/hooks/useTelegramChatSettings';
import { useTelegramFinanceSettings } from '@/features/dashboard/bookings/hooks/useTelegramFinanceSettings';
import { useTelegramMaintenanceSettings } from '@/features/dashboard/bookings/hooks/useTelegramMaintenanceSettings';
import { useTelegramMarketingSettings } from '@/features/dashboard/bookings/hooks/useTelegramMarketingSettings';
import { useTelegramStaffSettings } from '@/features/dashboard/bookings/hooks/useTelegramStaffSettings';
import { useTelegramParkingSettings } from '@/features/dashboard/parking/hooks/useTelegramParkingSettings';

import type { UseQueryResult } from '@tanstack/react-query';

type TelegramModuleSettings = {
  enabled?: boolean;
  credentials?: PropertyTelegramCredentialsStatus;
};

function telegramModuleConnected(settings: TelegramModuleSettings | undefined): boolean {
  const credentials = settings?.credentials;
  if (!credentials) return false;
  if (credentials.tokenConfigured && credentials.chatIdConfigured) return true;
  return Boolean(credentials.botToken?.trim() && credentials.chatId?.trim());
}

function aggregateTelegramHubStats(
  moduleCount: number,
  queries: Array<UseQueryResult<TelegramModuleSettings | undefined>>
): TelegramHubStats {
  const enabledCount = queries.filter((q) => q.data?.enabled).length;
  const connectedCount = queries.filter((q) => telegramModuleConnected(q.data)).length;
  const isLoading = queries.some((q) => q.isLoading && q.data === undefined);

  return {
    moduleCount,
    enabledCount,
    connectedCount,
    isLoading,
  };
}

export type TelegramHubStats = {
  moduleCount: number;
  enabledCount: number;
  connectedCount: number;
  isLoading: boolean;
};

export function usePropertyTelegramHubStats(): TelegramHubStats {
  const chat = useTelegramChatSettings();
  const marketing = useTelegramMarketingSettings();
  const staff = useTelegramStaffSettings();
  const operations = useTelegramAdminSettings();
  const finance = useTelegramFinanceSettings();
  const maintenance = useTelegramMaintenanceSettings();

  return aggregateTelegramHubStats(6, [chat, marketing, staff, operations, finance, maintenance]);
}

export function useParkingTelegramHubStats(): TelegramHubStats {
  const chat = useTelegramChatSettings();
  const parking = useTelegramParkingSettings();
  const finance = useTelegramFinanceSettings();

  return aggregateTelegramHubStats(3, [chat, parking, finance]);
}
