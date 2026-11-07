/**
 * Master Telegram kill switch per property/parking.
 *
 * Fail-open by design: a missing row, a read error, or a timeout must never stop
 * guest-facing alerts. Only an explicit `enabled = false` row pauses delivery.
 */

import { createServiceClient } from './orgAuth.ts';
import { normalizeTelegramScope, type TelegramScopeRef } from './telegramScope.ts';

export async function isTelegramDeliveryEnabled(
  scope?: TelegramScopeRef | string | null
): Promise<boolean> {
  const { propertyId, parkingId } = normalizeTelegramScope(scope);
  if (!propertyId && !parkingId) return true;

  try {
    const sb = createServiceClient();
    const query = propertyId
      ? sb
          .from('telegram_delivery_control')
          .select('enabled')
          .eq('property_id', propertyId)
          .maybeSingle()
      : sb
          .from('telegram_delivery_control')
          .select('enabled')
          .eq('parking_id', parkingId as string)
          .maybeSingle();

    const { data, error } = await query;
    if (error) {
      console.warn('[telegram-delivery] control read failed, allowing send:', error.message);
      return true;
    }
    if (!data) return true;
    return data.enabled !== false;
  } catch (error) {
    console.warn(
      '[telegram-delivery] control read threw, allowing send:',
      error instanceof Error ? error.message : error
    );
    return true;
  }
}
