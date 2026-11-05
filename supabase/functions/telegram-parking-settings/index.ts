/**
 * telegram-parking-settings — Admin GET/PATCH/POST for parking Telegram config.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import { jsonError, jsonSuccess, parseDraftText, readJsonBody } from '../_shared/httpResponse.ts';
import { resolveTelegramAssetAccess, telegramDbScope } from '../_shared/telegramAssetScope.ts';
import {
  loadTelegramSettingsGetPayload,
  mergeTelegramCredentialsPatch,
  parseAction,
  gateTelegramEnabledPatch,
  gateTelegramSettingsWrites,
  telegramPatchNoFields,
  telegramPatchSuccessResponse,
  telegramUnknownAction,
  telegramVerifyResponse,
} from '../_shared/telegramSettingsHttp.ts';
import {
  parseTelegramVerifyOverrides,
  telegramCredentialsDto,
} from '../_shared/telegramCredentialsPatch.ts';
import {
  loadParkingTelegramSettingsRow,
  parkingTemplatePatchFromBody,
  renderParkingTemplatePreview,
  sendParkingDraftPreview,
  serializeParkingTelegramSettings,
  verifyParkingTelegramEnv,
} from '../_shared/telegramParking.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

serveAuthenticated('telegram-parking-settings', async (req, user) => {
  const asset = await resolveTelegramAssetAccess(req);
  if (asset.kind !== 'parking') {
    return jsonError(req, 'parking_id is required', 400);
  }
  const parkingId = asset.id;
  const scope = telegramDbScope(asset);

  if (req.method === 'GET') {
    try {
      const data = await loadTelegramSettingsGetPayload(
        asset,
        'parking',
        () => loadParkingTelegramSettingsRow(parkingId),
        (row) => serializeParkingTelegramSettings(row)
      );
      return jsonSuccess(req, data);
    } catch (e) {
      return jsonError(req, e instanceof Error ? e.message : 'Failed to load settings', 500);
    }
  }

  if (req.method === 'PATCH') {
    const settingsGate = await gateTelegramSettingsWrites(req, user);
    if (settingsGate) return settingsGate;
    const body = await readJsonBody(req);
    const gateResponse = await gateTelegramEnabledPatch(req, asset, body);
    if (gateResponse) return gateResponse;
    const patch = parkingTemplatePatchFromBody(body);

    let finalPatch: Record<string, unknown>;
    try {
      finalPatch = await mergeTelegramCredentialsPatch(body, patch);
    } catch (e) {
      return jsonError(req, e instanceof Error ? e.message : 'Invalid credentials');
    }

    if (Object.keys(finalPatch).length === 0) {
      return telegramPatchNoFields(req);
    }

    const updated = await DatabaseService.updateTelegramParkingSettings(finalPatch, parkingId);
    return telegramPatchSuccessResponse(req, {
      ...serializeParkingTelegramSettings(updated),
      credentials: await telegramCredentialsDto('parking', scope),
    });
  }

  if (req.method === 'POST') {
    const settingsGate = await gateTelegramSettingsWrites(req, user);
    if (settingsGate) return settingsGate;
    const body = await readJsonBody(req);
    const action = parseAction(body);

    if (action === 'verify_parking_telegram_env') {
      const overrides = parseTelegramVerifyOverrides(body);
      return telegramVerifyResponse(req, await verifyParkingTelegramEnv(parkingId, overrides));
    }

    if (action === 'send_draft_preview') {
      const text = parseDraftText(body);
      if (!text.trim()) {
        return jsonError(req, 'text is required');
      }
      const result = await sendParkingDraftPreview(text, parkingId);
      return jsonSuccess(req, result);
    }

    if (action === 'render_draft_preview') {
      const text = parseDraftText(body);
      return jsonSuccess(req, { renderedText: renderParkingTemplatePreview(text) });
    }

    return telegramUnknownAction(
      req,
      action,
      'Use verify_parking_telegram_env | send_draft_preview | render_draft_preview'
    );
  }

  return jsonError(req, `Method ${req.method} not allowed`, 405);
});
