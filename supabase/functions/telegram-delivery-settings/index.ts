/**
 * telegram-delivery-settings — master Telegram kill switch per property/parking.
 *
 * GET returns the current state (default enabled when no row exists).
 * PATCH sets it. Turning it off stops every module for that asset without
 * touching the per-module `enabled` flags, so turning it back on restores the
 * previous setup exactly.
 *
 * Test sends and the Discover/verify actions are not affected: a host must still
 * be able to confirm a group while delivery is paused.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { resolveTelegramAssetAccess } from '../_shared/telegramAssetScope.ts';
import { logActivity } from '../_shared/activityLog.ts';
import { buildActorContext } from '../_shared/activityLog.ts';

type ControlRow = { enabled: boolean };

async function loadControl(
  sb: ReturnType<typeof createServiceClient>,
  asset: { kind: 'property' | 'parking'; id: string }
): Promise<ControlRow> {
  const column = asset.kind === 'property' ? 'property_id' : 'parking_id';
  const { data } = await sb
    .from('telegram_delivery_control')
    .select('enabled')
    .eq(column, asset.id)
    .maybeSingle();
  return { enabled: data?.enabled !== false };
}

async function organizationIdFor(
  sb: ReturnType<typeof createServiceClient>,
  asset: { kind: 'property' | 'parking'; id: string }
): Promise<string | null> {
  const { data } =
    asset.kind === 'property'
      ? await sb.from('properties').select('organization_id').eq('id', asset.id).maybeSingle()
      : await sb.from('parkings').select('organization_id').eq('id', asset.id).maybeSingle();
  return (data?.organization_id as string | undefined) ?? null;
}

serveAuthenticated('telegram-delivery-settings', async (req, user) => {
  const asset = await resolveTelegramAssetAccess(req);
  const sb = createServiceClient();

  if (req.method === 'GET') {
    const control = await loadControl(sb, asset);
    return jsonSuccess(req, control);
  }

  if (req.method !== 'PATCH') return jsonError(req, 'Method not allowed', 405);

  const body = (await readJsonBody(req)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== 'boolean') {
    return jsonError(req, 'enabled must be a boolean', 400);
  }
  const enabled = body.enabled;

  const scopeFilter = asset.kind === 'property' ? 'property_id' : 'parking_id';
  const { data: existing, error: readError } = await sb
    .from('telegram_delivery_control')
    .select('id')
    .eq(scopeFilter, asset.id)
    .maybeSingle();
  if (readError) return jsonError(req, readError.message, 500);

  const now = new Date().toISOString();
  const write = existing
    ? sb
        .from('telegram_delivery_control')
        .update({ enabled, updated_at: now, updated_by: user.id })
        .eq('id', existing.id)
    : sb.from('telegram_delivery_control').insert({
        property_id: asset.kind === 'property' ? asset.id : null,
        parking_id: asset.kind === 'parking' ? asset.id : null,
        enabled,
        updated_by: user.id,
      });

  const { error: writeError } = await write;
  if (writeError) return jsonError(req, writeError.message, 500);

  const organizationId = await organizationIdFor(sb, asset);
  if (organizationId) {
    await logActivity({
      action: 'settings.updated',
      organizationId,
      propertyId: asset.kind === 'property' ? asset.id : null,
      parkingId: asset.kind === 'parking' ? asset.id : null,
      actor: buildActorContext('dashboard', { authUser: user }, req),
      metadata: { area: 'Telegram delivery', enabled },
    });
  }

  return jsonSuccess(req, { enabled });
});
