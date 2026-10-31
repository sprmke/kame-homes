/**
 * telegram-staff-settings — Admin GET/PATCH/POST for staff Telegram config.
 */

import { DatabaseService } from '../_shared/databaseService.ts';
import {
  renderStaffDraftPreview,
  renderStaffNoBookingsDraftPreview,
  renderStaffSameDayCheckinDraftPreview,
  sanitizeStaffDailySummaryTemplate,
  sendStaffDraftPreview,
  sendStaffNoBookingsDraftPreview,
  sendStaffSameDayCheckinDraftPreview,
  serializeStaffSettings,
  verifyStaffTelegramEnv,
  type TelegramStaffSettings,
} from '../_shared/telegramStaff.ts';
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

function staffDraftByScenario<T>(
  scenario: string,
  text: string,
  handlers: {
    sameDayCheckin: (text: string) => Promise<T>;
    noBookings: (text: string) => Promise<T>;
    default: (text: string) => Promise<T>;
  }
): Promise<T> {
  if (scenario === 'same_day_checkin') return handlers.sameDayCheckin(text);
  if (scenario === 'daily_summary_no_bookings') return handlers.noBookings(text);
  return handlers.default(text);
}

serveAuthenticated('telegram-staff-settings', async (req, user) => {
  const asset = await resolveTelegramAssetAccess(req, 'staff');
  const scope = telegramDbScope(asset);

  if (req.method === 'GET') {
    try {
      const data = await loadTelegramSettingsGetPayload(
        asset,
        'staff',
        () => DatabaseService.getTelegramStaffSettings(scope.propertyId, scope.parkingId),
        (row) => serializeStaffSettings(row as unknown as TelegramStaffSettings)
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
    if (typeof body.notifyOnSameDayCheckin === 'boolean') {
      patch.notify_on_same_day_checkin = body.notifyOnSameDayCheckin;
    }
    if (typeof body.notifyOnDailySummary === 'boolean') {
      patch.notify_on_daily_summary = body.notifyOnDailySummary;
    }
    if (typeof body.notifyOnDailySummaryNoBookings === 'boolean') {
      patch.notify_on_daily_summary_no_bookings = body.notifyOnDailySummaryNoBookings;
    }

    if (typeof body.dailySummaryTemplate === 'string') {
      patch.daily_summary_template = sanitizeStaffDailySummaryTemplate(
        body.dailySummaryTemplate.slice(0, 8000)
      );
    }

    if (typeof body.dailySummaryNoBookingsTemplate === 'string') {
      patch.daily_summary_no_bookings_template = sanitizeStaffDailySummaryTemplate(
        body.dailySummaryNoBookingsTemplate.slice(0, 8000)
      );
    }

    if (typeof body.sameDayCheckinTemplate === 'string') {
      patch.same_day_checkin_template = sanitizeStaffDailySummaryTemplate(
        body.sameDayCheckinTemplate.slice(0, 8000)
      );
    }

    if (body.dailySummaryTimeManila !== undefined) {
      const parsed = parseManilaTimeSlotField(body, 'dailySummaryTimeManila');
      if (!parsed.ok) return jsonError(req, parsed.message);
      slotParsed = parsed.slot;
      patch.daily_summary_time_manila = slotParsed;
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

    const updated = await DatabaseService.updateTelegramStaffSettings(
      finalPatch,
      scope.propertyId,
      scope.parkingId
    );
    const cronSync = slotParsed
      ? await DatabaseService.ensureTelegramMultiPropertyCronDispatch()
      : undefined;

    return telegramPatchSuccessResponse(
      req,
      {
        ...serializeStaffSettings(updated as unknown as TelegramStaffSettings),
        credentials: await telegramCredentialsDto('staff', scope),
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

    if (action === 'verify_staff_telegram_env') {
      const overrides = parseTelegramVerifyOverrides(body);
      return telegramVerifyResponse(req, await verifyStaffTelegramEnv(scope, overrides));
    }

    if (action === 'send_draft_preview') {
      return handleTelegramSendDraftPreview(
        req,
        body,
        (text, scenario) =>
          staffDraftByScenario(scenario, text, {
            sameDayCheckin: (t) => sendStaffSameDayCheckinDraftPreview(t, scope.propertyId, scope),
            noBookings: (t) => sendStaffNoBookingsDraftPreview(t, scope.propertyId, scope),
            default: (t) => sendStaffDraftPreview(t, scope.propertyId, scope),
          }),
        { defaultScenario: 'daily_summary' }
      );
    }

    if (action === 'render_draft_preview') {
      return handleTelegramRenderDraftPreview(
        req,
        body,
        (text, scenario) =>
          staffDraftByScenario(scenario, text, {
            sameDayCheckin: (t) => renderStaffSameDayCheckinDraftPreview(t, scope.propertyId),
            noBookings: (t) => renderStaffNoBookingsDraftPreview(t, scope.propertyId),
            default: (t) => renderStaffDraftPreview(t, scope.propertyId),
          }),
        { defaultScenario: 'daily_summary' }
      );
    }

    return telegramUnknownAction(
      req,
      action,
      'Use verify_staff_telegram_env | send_draft_preview | render_draft_preview'
    );
  }

  throw new Error(`Method ${req.method} not allowed`);
});
