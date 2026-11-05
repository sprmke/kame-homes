/**
 * telegram-finance-settings — Admin GET/PATCH/POST for finance Telegram config.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import {
  renderFinanceDraftPreview,
  runFinanceDueReminders,
  sanitizeFinanceReminderTemplate,
  sendFinanceDraftPreview,
  serializeFinanceSettings,
  verifyFinanceTelegramEnv,
  type TelegramFinanceSettings,
} from '../_shared/telegramFinance.ts';
import {
  handleTelegramRenderDraftPreview,
  handleTelegramSendDraftPreview,
  loadTelegramSettingsGetPayload,
  mergeTelegramCredentialsPatch,
  parseAction,
  parseManilaTimeSlotField,
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

serveAuthenticated('telegram-finance-settings', async (req, user) => {
  const asset = await resolveTelegramAssetAccess(req, 'finance');
  const scope = telegramDbScope(asset);

  if (req.method === 'GET') {
    try {
      const data = await loadTelegramSettingsGetPayload(
        asset,
        'finance',
        () => DatabaseService.getTelegramFinanceSettings(scope.propertyId, scope.parkingId),
        (row) => serializeFinanceSettings(row as unknown as TelegramFinanceSettings)
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
    let slotParsed: { hour: number; minute: number } | undefined;

    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;

    if (typeof body.defaultReminderTemplate === 'string') {
      patch.default_reminder_template = sanitizeFinanceReminderTemplate(
        body.defaultReminderTemplate.slice(0, 8000)
      );
    }

    if (body.dailyCheckTimeManila !== undefined) {
      const parsed = parseManilaTimeSlotField(body, 'dailyCheckTimeManila');
      if (!parsed.ok) return jsonError(req, parsed.message);
      slotParsed = parsed.slot;
      patch.daily_check_time_manila = slotParsed;
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

    const updated = await DatabaseService.updateTelegramFinanceSettings(
      finalPatch,
      scope.propertyId,
      scope.parkingId
    );
    const cronSync = slotParsed
      ? await DatabaseService.syncTelegramFinanceDailyCronJob(slotParsed)
      : undefined;

    return telegramPatchSuccessResponse(
      req,
      {
        ...serializeFinanceSettings(updated as unknown as TelegramFinanceSettings),
        credentials: await telegramCredentialsDto('finance', scope),
      },
      cronSync
    );
  }

  if (req.method === 'POST') {
    const settingsGate = await gateTelegramSettingsWrites(req, user);
    if (settingsGate) return settingsGate;
    await ensureTelegramAssetSettings(asset, 'finance');
    const body = await readJsonBody(req);
    const action = parseAction(body);

    if (action === 'verify_finance_telegram_env') {
      const overrides = parseTelegramVerifyOverrides(body);
      return telegramVerifyResponse(req, await verifyFinanceTelegramEnv(scope, overrides));
    }

    if (action === 'send_test_due_reminders') {
      return jsonResponse(req, {
        success: true,
        result: await runFinanceDueReminders({
          force: true,
          propertyId: scope.propertyId,
          parkingId: scope.parkingId,
        }),
      });
    }

    if (action === 'send_draft_preview') {
      return handleTelegramSendDraftPreview(req, body, (text) =>
        sendFinanceDraftPreview(text, scope)
      );
    }

    if (action === 'render_draft_preview') {
      return handleTelegramRenderDraftPreview(req, body, (text) =>
        renderFinanceDraftPreview(text, scope)
      );
    }

    return telegramUnknownAction(
      req,
      action,
      'Use verify_finance_telegram_env | send_test_due_reminders | send_draft_preview | render_draft_preview'
    );
  }

  throw new Error(`Method ${req.method} not allowed`);
});
