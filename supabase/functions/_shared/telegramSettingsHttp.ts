import {
  jsonError,
  jsonResponse,
  parseAction,
  parseDraftScenario,
  parseDraftText,
} from './httpResponse.ts';
import {
  catchPlanFeatureError,
  requireOrgFeature,
  requireTelegramNotificationsEnabled,
  resolveTelegramEntitlementPropertyId,
} from './planEntitlements.ts';
import { type AuthenticatedUser } from './orgAuth.ts';
import { resolveOrganizationIdForParking } from './parkingScope.ts';
import type { TelegramAssetScope } from './telegramAssetScope.ts';
import { ensurePropertySettings } from './propertySettingsSeed.ts';
import { ensureTelegramParkingSettings } from './parkingTelegramSettingsSeed.ts';
import { ensureTelegramFinanceSettings } from './telegramFinance.ts';
import { ensureTelegramChatSettings } from './telegramChat.ts';
import { telegramDbScope } from './telegramAssetScope.ts';
import {
  buildTelegramCredentialsPatch,
  telegramCredentialsDto,
} from './telegramCredentialsPatch.ts';
import type { TelegramChannel } from './propertyTelegramCredentials.ts';
import type { TeamPermissionId } from './propertyTeamPermissions.ts';
import {
  TELEGRAM_ANY_MODULE_EDIT_IDS,
  telegramModuleEditPermission,
} from './telegramModulePermissions.ts';

export { TELEGRAM_ANY_MODULE_EDIT_IDS, telegramModuleEditPermission };

export type ManilaTimeSlot = { hour: number; minute: number };

/** Property Telegram module → Phase 6 leaf (`admin` channel = Operations UI). */
export function telegramSettingsPermission(
  req: Request,
  channel?: TelegramChannel
): TeamPermissionId {
  if (req.method === 'GET') return 'notifications:view';
  if (!channel) {
    // Callers that need any-of-six for global bot must use resolveTelegramAssetAccess
    // without relying on a single leaf from this helper.
    return 'notifications:view';
  }
  const leaf = telegramModuleEditPermission(channel);
  if (!leaf) return 'notifications:view';
  return leaf;
}
/** Gate PATCH when enabling Telegram notifications (plan tier). */
export async function gateTelegramEnabledPatch(
  req: Request,
  asset: TelegramAssetScope,
  body: Record<string, unknown>
): Promise<Response | null> {
  if (body.enabled !== true) return null;
  try {
    if (asset.kind === 'parking') {
      // Property-independent org gate — parking has no property to resolve entitlements
      // through (see requireOrgFeature's doc comment / parking-property-parity.md).
      const organizationId = await resolveOrganizationIdForParking(asset.id);
      await requireOrgFeature(organizationId, 'telegramNotifications');
    } else {
      const propertyId = await resolveTelegramEntitlementPropertyId(asset);
      await requireTelegramNotificationsEnabled(propertyId);
    }
  } catch (err) {
    return catchPlanFeatureError(req, err);
  }
  return null;
}

/** Gate PATCH/POST on Telegram settings (verify, test send, discover chats, saves). GET stays open. */
export async function gateTelegramSettingsWrites(
  req: Request,
  user: AuthenticatedUser
): Promise<Response | null> {
  const { featureUnavailableResponse } = await import('./featureAvailability.ts');
  return featureUnavailableResponse(req, 'notifications.telegram.settings', { user });
}

export async function loadTelegramSettingsGetPayload<T>(
  asset: TelegramAssetScope,
  channel: TelegramChannel,
  loadRow: () => Promise<Record<string, unknown> | null>,
  serialize: (row: Record<string, unknown>) => T
): Promise<T & { credentials: Awaited<ReturnType<typeof telegramCredentialsDto>> }> {
  if (asset.kind === 'property') {
    await ensurePropertySettings(asset.id);
  } else {
    await ensureTelegramParkingSettings(asset.id);
    if (channel === 'finance') {
      await ensureTelegramFinanceSettings({ parkingId: asset.id });
    }
    if (channel === 'chat') {
      await ensureTelegramChatSettings(undefined, asset.id);
    }
  }
  const row = await loadRow();
  if (!row) {
    throw new Error('Settings row missing');
  }
  const credentials = await telegramCredentialsDto(channel, telegramDbScope(asset));
  return {
    ...serialize(row),
    credentials,
  };
}

export function parseManilaTimeSlotField(
  body: Record<string, unknown>,
  field: string
): { ok: true; slot: ManilaTimeSlot } | { ok: false; message: string } {
  const raw = body[field];
  if (raw === undefined) {
    return { ok: false, message: `${field} is required` };
  }
  if (
    raw &&
    typeof raw === 'object' &&
    typeof (raw as Record<string, unknown>).hour === 'number' &&
    typeof (raw as Record<string, unknown>).minute === 'number'
  ) {
    const s = raw as ManilaTimeSlot;
    return {
      ok: true,
      slot: {
        hour: Math.max(0, Math.min(23, Math.round(s.hour))),
        minute: Math.max(0, Math.min(59, Math.round(s.minute))),
      },
    };
  }
  return { ok: false, message: `${field} must be { hour, minute }` };
}

export async function mergeTelegramCredentialsPatch(
  body: Record<string, unknown>,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return { ...patch, ...(await buildTelegramCredentialsPatch(body)) };
}

export type TelegramDraftRenderResult = {
  renderedText?: string;
  placeholders?: unknown;
  previewGuestName?: string;
  todayBookingCount?: number;
  error?: string;
};

export type TelegramDraftSendResult = {
  sent: boolean;
  error?: string;
  messageCharCount?: number;
  previewGuestName?: string;
  todayBookingCount?: number;
};

export async function telegramSettingsGetResponse<T>(
  req: Request,
  ensureRow: () => Promise<void>,
  loadRow: () => Promise<Record<string, unknown> | null>,
  serialize: (row: Record<string, unknown>) => T
): Promise<Response> {
  await ensureRow();
  const row = await loadRow();
  if (!row) {
    return jsonError(req, 'Settings row missing', 500);
  }
  return jsonResponse(req, { success: true, data: serialize(row) });
}

export function telegramPatchSuccessResponse<T>(
  req: Request,
  data: T,
  cronSync?: Record<string, unknown>
): Response {
  return jsonResponse(req, {
    success: true,
    data,
    ...(cronSync !== undefined ? { cronSync } : {}),
  });
}

export function telegramPatchNoFields(req: Request): Response {
  return jsonError(req, 'No valid fields to update');
}

export function telegramVerifyResponse(req: Request, verify: unknown): Response {
  return jsonResponse(req, { success: true, verify });
}

export function telegramUnknownAction(req: Request, action: string, allowedHint: string): Response {
  return jsonError(req, `Unknown action: ${action || '(missing)'}. ${allowedHint}`);
}

export async function handleTelegramRenderDraftPreview(
  req: Request,
  body: Record<string, unknown>,
  render: (text: string, scenario: string) => Promise<TelegramDraftRenderResult>,
  options?: {
    maxLength?: number;
    defaultScenario?: string;
    requireScenario?: boolean;
    allowedScenarios?: string[];
    missingTextError?: string;
    missingScenarioError?: string;
  }
): Promise<Response> {
  const text = parseDraftText(body, options?.maxLength ?? 8000);
  if (!text) {
    return jsonError(req, options?.missingTextError ?? 'text is required');
  }

  const scenario = parseDraftScenario(body, options?.defaultScenario ?? '');
  if (options?.requireScenario && options.allowedScenarios) {
    if (!scenario || !options.allowedScenarios.includes(scenario)) {
      return jsonError(
        req,
        options?.missingScenarioError ?? 'text and valid scenario are required'
      );
    }
  }

  const rendered = await render(text, scenario);
  if (rendered.error || !rendered.renderedText) {
    return jsonError(req, rendered.error ?? 'render_failed');
  }

  const payload: Record<string, unknown> = {
    success: true,
    renderedText: rendered.renderedText,
    placeholders: rendered.placeholders,
  };
  if (rendered.previewGuestName !== undefined) {
    payload.previewGuestName = rendered.previewGuestName;
  }
  if (rendered.todayBookingCount !== undefined) {
    payload.todayBookingCount = rendered.todayBookingCount;
  }
  return jsonResponse(req, payload);
}

export async function handleTelegramSendDraftPreview(
  req: Request,
  body: Record<string, unknown>,
  send: (text: string, scenario: string) => Promise<TelegramDraftSendResult>,
  options?: {
    maxLength?: number;
    defaultScenario?: string;
    requireScenario?: boolean;
    allowedScenarios?: string[];
    missingTextError?: string;
    missingScenarioError?: string;
  }
): Promise<Response> {
  const text = parseDraftText(body, options?.maxLength ?? 8000);
  if (!text) {
    return jsonError(req, options?.missingTextError ?? 'text is required');
  }

  const scenario = parseDraftScenario(body, options?.defaultScenario ?? '');
  if (options?.requireScenario && options.allowedScenarios) {
    if (!scenario || !options.allowedScenarios.includes(scenario)) {
      return jsonError(
        req,
        options?.missingScenarioError ?? 'text and valid scenario are required'
      );
    }
  }

  const preview = await send(text, scenario);
  const payload: Record<string, unknown> = {
    success: preview.sent,
    sent: preview.sent,
    error: preview.error,
    messageCharCount: preview.messageCharCount,
  };
  if (preview.previewGuestName !== undefined) {
    payload.previewGuestName = preview.previewGuestName;
  }
  if (preview.todayBookingCount !== undefined) {
    payload.todayBookingCount = preview.todayBookingCount;
  }
  return jsonResponse(req, payload, preview.sent ? 200 : 400);
}

export { parseAction };

export function parseMarketingDraftDates(body: Record<string, unknown>): {
  checkInYmd?: string;
  checkOutYmd?: string;
} {
  const ci = typeof body.checkInYmd === 'string' ? body.checkInYmd.trim() : '';
  const co = typeof body.checkOutYmd === 'string' ? body.checkOutYmd.trim() : '';
  return {
    checkInYmd: ci || undefined,
    checkOutYmd: co || undefined,
  };
}

export function templateErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
