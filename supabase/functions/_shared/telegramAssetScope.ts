/**
 * Resolve property or parking scope for Telegram admin edge handlers.
 */

import { resolveScopedParkingAccess, readParkingIdFromUrl } from './parkingScope.ts';
import { readPropertyIdFromUrl, resolveScopedPropertyAccess } from './propertyScope.ts';
import { ensureTelegramParkingSettings } from './parkingTelegramSettingsSeed.ts';
import { ensurePropertySettings } from './propertySettingsSeed.ts';
import { ensureTelegramFinanceSettings } from './telegramFinance.ts';
import { ensureTelegramChatSettings } from './telegramChat.ts';
import {
  TELEGRAM_ANY_MODULE_EDIT_IDS,
  telegramModuleEditPermission,
} from './telegramModulePermissions.ts';
import { hasPropertyPermission, type TeamPermissionId } from './propertyTeamPermissions.ts';
import type { TelegramChannel } from './propertyTelegramCredentials.ts';

export type TelegramAssetScope = { kind: 'property'; id: string } | { kind: 'parking'; id: string };

export type TelegramDbScope = {
  propertyId?: string;
  parkingId?: string;
};

export function telegramDbScope(scope: TelegramAssetScope): TelegramDbScope {
  if (scope.kind === 'property') return { propertyId: scope.id };
  return { parkingId: scope.id };
}

function forbiddenTelegram(): never {
  throw new Response(JSON.stringify({ success: false, error: 'Access restricted' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @param channel — when set, PATCH/POST require that module's edit leaf.
 *   Omit for telegram-global-settings (any one of the six module edits — Q3).
 */
export async function resolveTelegramAssetAccess(
  req: Request,
  channel?: TelegramChannel
): Promise<TelegramAssetScope> {
  const url = new URL(req.url);
  const parkingId = readParkingIdFromUrl(url);
  const propertyId = readPropertyIdFromUrl(url);

  if (parkingId && propertyId) {
    throw new Response(
      JSON.stringify({ success: false, error: 'Provide only one of property_id or parking_id' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (parkingId) {
    const permission = req.method === 'GET' ? 'org.parkings:view' : 'org.parkings:manage';
    const { parkingRow } = await resolveScopedParkingAccess(req, permission);
    return { kind: 'parking', id: parkingRow.id };
  }

  if (req.method === 'GET') {
    const { property } = await resolveScopedPropertyAccess(req, 'notifications:view');
    return { kind: 'property', id: property.id };
  }

  if (channel) {
    const leaf = telegramModuleEditPermission(channel);
    if (!leaf) forbiddenTelegram();
    const { property } = await resolveScopedPropertyAccess(req, leaf);
    return { kind: 'property', id: property.id };
  }

  // Global bot token: editable with any one module edit (Q3).
  const ctx = await resolveScopedPropertyAccess(req, 'notifications:view');
  const ok = TELEGRAM_ANY_MODULE_EDIT_IDS.some((id) =>
    hasPropertyPermission(ctx.permissions, id as TeamPermissionId)
  );
  if (!ok) forbiddenTelegram();
  return { kind: 'property', id: ctx.property.id };
}

export async function ensureTelegramAssetSettings(
  scope: TelegramAssetScope,
  channel?: import('./propertyTelegramCredentials.ts').TelegramChannel
): Promise<void> {
  if (scope.kind === 'property') {
    await ensurePropertySettings(scope.id);
    return;
  }
  await ensureTelegramParkingSettings(scope.id);
  if (channel === 'finance') {
    await ensureTelegramFinanceSettings({ parkingId: scope.id });
  }
  if (channel === 'chat') {
    await ensureTelegramChatSettings(undefined, scope.id);
  }
}
