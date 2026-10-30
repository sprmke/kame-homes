/**
 * telegram-maintenance-settings — Admin GET/PATCH/POST for maintenance Telegram config.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import {
  renderMaintenanceDraftPreview,
  runMaintenanceDueReminders,
  sanitizeMaintenanceReminderTemplate,
  sendMaintenanceDraftPreview,
  serializeMaintenanceSettings,
  verifyMaintenanceTelegramEnv,
  type TelegramMaintenanceSettings,
} from '../_shared/telegramMaintenance.ts';
import {
  handleTelegramRenderDraftPreview,
  handleTelegramSendDraftPreview,
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
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  ensureTelegramAssetSettings,
  resolveTelegramAssetAccess,
  telegramDbScope,
} from '../_shared/telegramAssetScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  parseTelegramVerifyOverrides,
  telegramCredentialsDto,
} from '../_shared/telegramCredentialsPatch.ts';

serveAuthenticated('telegram-maintenance-settings', async (req, user) => {
  const asset = await resolveTelegramAssetAccess(req, 'maintenance');
  const scope = telegramDbScope(asset);

  if (req.method === 'GET') {
    try {
      const data = await loadTelegramSettingsGetPayload(
        asset,
        'maintenance',
        () => DatabaseService.getTelegramMaintenanceSettings(scope.propertyId, scope.parkingId),
        (row) => serializeMaintenanceSettings(row as unknown as TelegramMaintenanceSettings)
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
    const patch: Record<string, unknown> = {};

    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;

    if (typeof body.defaultReminderTemplate === 'string') {
      patch.default_reminder_template = sanitizeMaintenanceReminderTemplate(
        body.defaultReminderTemplate.slice(0, 8000)
      );
    }

    let finalPatch: Record<string, unknown>;
    try {
      finalPatch = await mergeTelegramCredentialsPatch(body, patch);
    } catch (e) {
      return jsonError(req, e instanceof Error ? e.message : 'Invalid credentials');
    }

    if (Object.keys(finalPatch).length === 0) {
      return telegramPatchNoFields(req);
    }

    const updated = await DatabaseService.updateTelegramMaintenanceSettings(
      finalPatch,
      scope.propertyId,
      scope.parkingId
    );
    const cronSync = await DatabaseService.syncTelegramMaintenanceHourlyCronJob();

    return telegramPatchSuccessResponse(
      req,
      {
        ...serializeMaintenanceSettings(updated as unknown as TelegramMaintenanceSettings),
        credentials: await telegramCredentialsDto('maintenance', scope),
      },
      cronSync
    );
  }

  if (req.method === 'POST') {
    const settingsGate = await gateTelegramSettingsWrites(req, user);
    if (settingsGate) return settingsGate;
    await ensureTelegramAssetSettings(asset);
    const body = await readJsonBody(req);
    const action = parseAction(body);

    if (action === 'verify_maintenance_telegram_env') {
      const overrides = parseTelegramVerifyOverrides(body);
      return telegramVerifyResponse(req, await verifyMaintenanceTelegramEnv(scope, overrides));
    }

    if (action === 'send_test_due_reminders') {
      return jsonResponse(req, {
        success: true,
        result: await runMaintenanceDueReminders({ force: true, propertyId: scope.propertyId }),
      });
    }

    if (action === 'send_draft_preview') {
      return handleTelegramSendDraftPreview(req, body, (text) =>
        sendMaintenanceDraftPreview(text, scope)
      );
    }

    if (action === 'render_draft_preview') {
      return handleTelegramRenderDraftPreview(req, body, (text) =>
        renderMaintenanceDraftPreview(text)
      );
    }

    return telegramUnknownAction(
      req,
      action,
      'Use verify_maintenance_telegram_env | send_test_due_reminders | send_draft_preview | render_draft_preview'
    );
  }

  throw new Error(`Method ${req.method} not allowed`);
});
