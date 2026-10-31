/**
 * Telegram module → team permission leaf mapping.
 * Kept out of telegramSettingsHttp so telegramAssetScope can import it
 * without a circular dependency.
 */

import { NOTIFICATION_MODULE_EDIT_IDS } from './accessPermissionExpansion.ts';
import type { TelegramChannel } from './propertyTelegramCredentials.ts';
import type { TeamPermissionId } from './propertyTeamPermissions.ts';

/** Property Telegram module → Phase 6 leaf (`admin` channel = Operations UI). */
export function telegramModuleEditPermission(channel: TelegramChannel): TeamPermissionId | null {
  switch (channel) {
    case 'chat':
      return 'notifications.chat:edit';
    case 'marketing':
      return 'notifications.marketing:edit';
    case 'staff':
      return 'notifications.staff:edit';
    case 'admin':
      return 'notifications.operations:edit';
    case 'finance':
      return 'notifications.finance:edit';
    case 'maintenance':
      return 'notifications.maintenance:edit';
    case 'parking':
      return null;
  }
}

export const TELEGRAM_ANY_MODULE_EDIT_IDS: readonly TeamPermissionId[] = [
  ...NOTIFICATION_MODULE_EDIT_IDS,
];
