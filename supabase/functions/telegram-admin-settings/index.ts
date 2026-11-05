/**
 * telegram-admin-settings — Admin GET/PATCH/POST for admin ops Telegram config.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import {
  renderAdminDraftPreview,
  sendAdminDraftPreview,
  serializeAdminSettings,
  verifyAdminTelegramEnv,
  type AdminHourlyNotificationType,
  type TelegramAdminSettings,
} from '../_shared/telegramAdmin.ts';
import { normalizeTelegramTemplateText } from '../_shared/telegramTemplateNormalize.ts';
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
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
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

const ADMIN_DRAFT_SCENARIOS = [
  'new_booking',
  'pending_docs',
  'balance_receipt',
  'balance_receipt_uploaded',
  'sd_form_submitted',
  'sd_refund_pending',
] as const;

type AdminDraftScenario = (typeof ADMIN_DRAFT_SCENARIOS)[number] | AdminHourlyNotificationType;

function asAdminDraftScenario(scenario: string): AdminDraftScenario {
  return scenario as AdminDraftScenario;
}

serveAuthenticated('telegram-admin-settings', async (req, user) => {
  const asset = await resolveTelegramAssetAccess(req, 'admin');
  const scope = telegramDbScope(asset);

  if (req.method === 'GET') {
    try {
      const data = await loadTelegramSettingsGetPayload(
        asset,
        'admin',
        () => DatabaseService.getTelegramAdminSettings(scope.propertyId, scope.parkingId),
        (row) => serializeAdminSettings(row as unknown as TelegramAdminSettings)
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
    let syncCron = false;

    if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
    if (typeof body.notifyOnNewBooking === 'boolean') {
      patch.notify_on_new_booking = body.notifyOnNewBooking;
      syncCron = true;
    }
    if (typeof body.notifyOnSdFormSubmitted === 'boolean') {
      patch.notify_on_sd_form_submitted = body.notifyOnSdFormSubmitted;
    }
    if (typeof body.notifyOnBalanceReceiptUploaded === 'boolean') {
      patch.notify_on_balance_receipt_uploaded = body.notifyOnBalanceReceiptUploaded;
    }
    if (typeof body.notifyPendingDocsHourly === 'boolean') {
      patch.notify_pending_docs_hourly = body.notifyPendingDocsHourly;
      syncCron = true;
    }
    if (typeof body.notifyBalanceReceiptHourly === 'boolean') {
      patch.notify_balance_receipt_hourly = body.notifyBalanceReceiptHourly;
      syncCron = true;
    }
    if (typeof body.notifySdRefundPendingHourly === 'boolean') {
      patch.notify_sd_refund_pending_hourly = body.notifySdRefundPendingHourly;
      syncCron = true;
    }

    const templateMap: Record<string, string> = {
      newBookingTemplate: 'new_booking_template',
      pendingDocsTemplate: 'pending_docs_template',
      balanceReceiptTemplate: 'balance_receipt_template',
      balanceReceiptUploadedTemplate: 'balance_receipt_uploaded_template',
      sdFormSubmittedTemplate: 'sd_form_submitted_template',
      sdRefundPendingTemplate: 'sd_refund_pending_template',
    };
    for (const [bodyKey, dbKey] of Object.entries(templateMap)) {
      if (typeof body[bodyKey] === 'string') {
        patch[dbKey] = normalizeTelegramTemplateText((body[bodyKey] as string).slice(0, 8000));
      }
    }

    if (body.resyncHourlyCron === true) syncCron = true;

    let finalPatch: Record<string, unknown>;
    try {
      finalPatch = await mergeTelegramCredentialsPatch(body, patch);
    } catch (e) {
      return jsonError(req, e instanceof Error ? e.message : 'Invalid credentials');
    }

    if (Object.keys(finalPatch).length === 0 && !syncCron) {
      return telegramPatchNoFields(req);
    }

    let updated: Record<string, unknown>;
    if (Object.keys(finalPatch).length > 0) {
      updated = await DatabaseService.updateTelegramAdminSettings(
        finalPatch,
        scope.propertyId,
        scope.parkingId
      );
    } else {
      await ensureTelegramAssetSettings(asset);
      updated =
        (await DatabaseService.getTelegramAdminSettings(scope.propertyId, scope.parkingId)) ?? {};
    }

    const cronSync = syncCron ? await DatabaseService.syncTelegramAdminHourlyCronJob() : undefined;

    return telegramPatchSuccessResponse(
      req,
      {
        ...serializeAdminSettings(updated as unknown as TelegramAdminSettings),
        credentials: await telegramCredentialsDto('admin', scope),
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
    const draftOptions = {
      requireScenario: true,
      allowedScenarios: [...ADMIN_DRAFT_SCENARIOS],
    };

    if (action === 'verify_admin_telegram_env') {
      const overrides = parseTelegramVerifyOverrides(body);
      return telegramVerifyResponse(req, await verifyAdminTelegramEnv(scope, overrides));
    }

    if (action === 'send_draft_preview') {
      return handleTelegramSendDraftPreview(
        req,
        body,
        (text, scenario) =>
          sendAdminDraftPreview(text, asAdminDraftScenario(scenario), scope.propertyId, scope),
        draftOptions
      );
    }

    if (action === 'render_draft_preview') {
      return handleTelegramRenderDraftPreview(
        req,
        body,
        (text, scenario) => renderAdminDraftPreview(text, asAdminDraftScenario(scenario)),
        draftOptions
      );
    }

    return telegramUnknownAction(
      req,
      action,
      'Use verify_admin_telegram_env | send_draft_preview | render_draft_preview'
    );
  }

  throw new Error(`Method ${req.method} not allowed`);
});
