import { useTelegramAdminSettings } from '@/features/dashboard/bookings/hooks/useTelegramAdminSettings';
import { useTelegramChatSettings } from '@/features/dashboard/bookings/hooks/useTelegramChatSettings';
import { useTelegramFinanceSettings } from '@/features/dashboard/bookings/hooks/useTelegramFinanceSettings';
import { useTelegramMaintenanceSettings } from '@/features/dashboard/bookings/hooks/useTelegramMaintenanceSettings';
import { useTelegramMarketingSettings } from '@/features/dashboard/bookings/hooks/useTelegramMarketingSettings';
import { useTelegramStaffSettings } from '@/features/dashboard/bookings/hooks/useTelegramStaffSettings';

export type ConnectedTelegramModuleToken = {
  token: string;
  moduleLabel: string;
};

/**
 * Finds the first module that already has a saved bot token, in the same
 * order the modules appear on the Notifications page. Reuses each module's
 * existing settings query (already mounted by its own card on this page),
 * so this does not add extra network requests in the common case.
 */
export function useFirstConnectedTelegramModuleToken(): ConnectedTelegramModuleToken | null {
  const chat = useTelegramChatSettings();
  const marketing = useTelegramMarketingSettings();
  const staff = useTelegramStaffSettings();
  const admin = useTelegramAdminSettings();
  const finance = useTelegramFinanceSettings();
  const maintenance = useTelegramMaintenanceSettings();

  const candidates: Array<{ moduleLabel: string; token: string | null | undefined }> = [
    { moduleLabel: 'Chat', token: chat.data?.credentials?.botToken },
    { moduleLabel: 'Staff', token: staff.data?.credentials?.botToken },
    { moduleLabel: 'Finance', token: finance.data?.credentials?.botToken },
    { moduleLabel: 'Maintenance', token: maintenance.data?.credentials?.botToken },
    { moduleLabel: 'Marketing', token: marketing.data?.credentials?.botToken },
    { moduleLabel: 'Operations', token: admin.data?.credentials?.botToken },
  ];

  for (const candidate of candidates) {
    const token = candidate.token?.trim();
    if (token) {
      return { token, moduleLabel: candidate.moduleLabel };
    }
  }

  return null;
}
