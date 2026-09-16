/**
 * Telegram Bot API sends + marketing copy from `telegram_marketing_settings`.
 * Non-fatal on failure — callers log only.
 */

import { DatabaseService } from './databaseService.ts';
import { verifyCronSecret } from './cronSecretGate.ts';
import { listAllPropertyIds } from './propertyCron.ts';
import {
  addDaysYmd,
  calendarDaysBetween,
  collectBlockedNights,
  earliestAvailableCheckInYmd,
  formatAvailableDatesHuman,
  formatCancellationDatesHuman,
  formatDatesListForMonth,
  formatMonthName,
  listAvailableCheckIns,
  manilaTodayYmd,
  normalizeBookingDateToYmd,
} from './calendarAvailabilityManila.ts';

import {
  DEFAULT_MANILA_REMINDER_SLOTS,
  manilaNowMatchesReminderSlots,
  manilaSlotsToUtcCronPreview,
  parseManilaReminderSlots,
  type ManilaReminderSlot,
} from './telegramMarketingCronSync.ts';
import {
  getPropertyTelegramCredentialsStatus,
  resolvePropertyTelegramCredentials,
} from './propertyTelegramCredentials.ts';
import { ensureTelegramMarketingSettingsRow } from './propertySettingsSeed.ts';
import { normalizeTelegramTemplateText } from './telegramTemplateNormalize.ts';

export type TelegramMarketingSettings = {
  id: number;
  enabled: boolean;
  notify_on_new_booking: boolean;
  notify_on_cancellation: boolean;
  notify_on_daily_default: boolean;
  notify_on_daily_urgency: boolean;
  urgency_days_threshold: number;
  new_booking_dates_limit: number;
  daily_default_template: string;
  daily_urgency_template: string;
  new_booking_template: string;
  cancellation_template: string;
  /** JSONB column; omitted on older deployments until migration applies. */
  daily_reminder_times_manila?: unknown;
};

const TELEGRAM_KNOWN_PLACEHOLDERS = [
  'available_dates',
  'month_name',
  'dates_list',
  'cancellation_dates',
  'urgency_text',
] as const;

type TelegramKnownPlaceholder = (typeof TELEGRAM_KNOWN_PLACEHOLDERS)[number];

function listTemplatePlaceholderKeys(template: string): TelegramKnownPlaceholder[] {
  const keys = new Set<TelegramKnownPlaceholder>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    const k = m[1] as TelegramKnownPlaceholder;
    if ((TELEGRAM_KNOWN_PLACEHOLDERS as readonly string[]).includes(k)) {
      keys.add(k);
    }
  }
  return [...keys];
}

function applyTemplatePlaceholders(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

export class TelegramTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TelegramTemplateError';
  }
}

/** Daily urgency opener: "today," | "tomorrow," | "this" from nearest free check-in. */
function formatUrgencyText(daysOut: number): string {
  if (daysOut === 0) return 'today,';
  if (daysOut === 1) return 'tomorrow,';
  return 'this';
}

/** Live values from the booking calendar (Manila). Throws if a token in the template cannot be filled. */
async function resolveTemplatePlaceholderVars(
  template: string,
  settings: TelegramMarketingSettings,
  opts?: { checkInYmd?: string; checkOutYmd?: string; propertyId?: string }
): Promise<Record<string, string>> {
  const keys = listTemplatePlaceholderKeys(template);
  if (keys.length === 0) return {};

  const unknown = [...template.matchAll(/\{\{(\w+)\}\}/g)]
    .map((m) => m[1])
    .filter((k) => !(TELEGRAM_KNOWN_PLACEHOLDERS as readonly string[]).includes(k));
  if (unknown.length > 0) {
    throw new TelegramTemplateError(
      `Unknown placeholders: ${unknown.map((k) => `{{${k}}}`).join(', ')}`
    );
  }

  const blocked = await buildBlockedSet(opts?.propertyId);
  const todayYmd = manilaTodayYmd();
  const keySet = new Set(keys);
  const vars: Record<string, string> = {};

  const needsNewBookingBundle = keySet.has('month_name') || keySet.has('dates_list');
  const needsUrgencyAvailable = keySet.has('available_dates') && !needsNewBookingBundle;

  if (needsNewBookingBundle) {
    const anchorMonth = todayYmd.slice(0, 7);
    const monthStart = `${anchorMonth}-01`;
    const candidates = listAvailableCheckIns(blocked, todayYmd, 60).filter((ymd) =>
      ymd.startsWith(anchorMonth)
    );
    const picked = candidates.slice(0, settings.new_booking_dates_limit);
    if (picked.length === 0) {
      throw new TelegramTemplateError(
        'No free check-in dates left this month for {{month_name}} / {{dates_list}}.'
      );
    }
    if (keySet.has('month_name')) {
      vars.month_name = formatMonthName(monthStart);
    }
    if (keySet.has('dates_list')) {
      vars.dates_list = formatDatesListForMonth(picked, monthStart);
    }
    if (keySet.has('available_dates')) {
      vars.available_dates = formatAvailableDatesHuman(picked);
    }
  }

  if (needsUrgencyAvailable) {
    const freeCheckIns = listAvailableCheckIns(blocked, todayYmd, 12);
    const v = formatAvailableDatesHuman(freeCheckIns);
    if (!v.trim()) {
      throw new TelegramTemplateError(
        'No available check-in dates in the calendar for {{available_dates}}.'
      );
    }
    vars.available_dates = v;
  }

  if (keySet.has('cancellation_dates')) {
    const ci = opts?.checkInYmd?.trim();
    const co = opts?.checkOutYmd?.trim();
    if (!ci || !co) {
      throw new TelegramTemplateError(
        'Check-in and check-out are required for {{cancellation_dates}} — set them in the cancellation date fields above.'
      );
    }
    vars.cancellation_dates = formatCancellationDatesHuman(
      normalizeBookingDateToYmd(ci) ?? ci,
      normalizeBookingDateToYmd(co) ?? co
    );
  }

  if (keySet.has('urgency_text')) {
    const earliest = earliestAvailableCheckInYmd(blocked, todayYmd);
    if (!earliest) {
      throw new TelegramTemplateError(
        'No available check-in dates in the calendar for {{urgency_text}}.'
      );
    }
    vars.urgency_text = formatUrgencyText(calendarDaysBetween(todayYmd, earliest));
  }

  return vars;
}

function renderTelegramTemplate(template: string, vars: Record<string, string>): string {
  const text = applyTemplatePlaceholders(template, vars);
  const unresolved = text.match(/\{\{[^}]+\}\}/g);
  if (unresolved?.length) {
    throw new TelegramTemplateError(
      `Unresolved placeholders after render: ${unresolved.join(', ')}`
    );
  }
  return text;
}

/** Resolve live calendar data and substitute; throws TelegramTemplateError on missing data. */
export async function prepareTelegramTemplateMessage(
  template: string,
  settings: TelegramMarketingSettings,
  opts?: { checkInYmd?: string; checkOutYmd?: string; propertyId?: string }
): Promise<string> {
  const { renderedText } = await renderMarketingDraftPreview(template, settings, opts);
  return renderedText;
}

/** In-app preview: resolve placeholders without sending Telegram. */
export async function renderMarketingDraftPreview(
  template: string,
  settings: TelegramMarketingSettings,
  opts?: { checkInYmd?: string; checkOutYmd?: string; propertyId?: string }
): Promise<{ renderedText: string; placeholders: Record<string, string> }> {
  const trimmed = template.trim().slice(0, 4000);
  if (!trimmed) {
    throw new TelegramTemplateError('text is required');
  }
  const placeholders = await resolveTemplatePlaceholderVars(trimmed, settings, opts);
  const renderedText = renderTelegramTemplate(trimmed, placeholders);
  return { renderedText, placeholders };
}

/**
 * Hyphen/minus glyphs that paste as “looks like minus” but fail `/^-?[0-9]+$/`. Telegram expects ASCII `-`.
 */
const UNICODE_HYPHENS = /[\u2212\u2013\u2012\uFE63\uFF0D\u2014\u2015]/g;

/**
 * Trim, strip BOM/CR, remove wrapping quotes. Telegram expects a numeric id for groups
 * (often negative, e.g. -100…). @username is not accepted here — use getUpdates / RawDataBot.
 */
export function normalizeTelegramChatId(
  raw: string
): { ok: true; chatId: string } | { ok: false; error: string } {
  let s = raw
    .trim()
    .replace(/\r/g, '')
    .replace(/\uFEFF/g, '')
    .replace(UNICODE_HYPHENS, '-');
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s
      .slice(1, -1)
      .trim()
      .replace(/\r/g, '')
      .replace(/\uFEFF/g, '')
      .replace(UNICODE_HYPHENS, '-');
  }
  // Allowed final form is -?[0-9]+ — remove stray spaces/NBSP (Slack/email: "- 100…")
  s = s.replace(/\s+/g, '');
  if (!s) return { ok: false, error: 'TELEGRAM_CHAT_ID is empty after normalization' };
  if (!/^-?[0-9]+$/.test(s)) {
    return {
      ok: false,
      error:
        'TELEGRAM_CHAT_ID must be a numeric id (e.g. -100… for supergroups). Use ASCII minus (-), not a Unicode dash from Word/PDF. Remove @ prefixes and non-digits.',
    };
  }
  return { ok: true, chatId: s };
}

type ResolveTelegramCreds =
  | { ok: true; token: string; chatId: string }
  | { ok: false; error: string; code: 'missing_token' | 'missing_chat_id' | 'invalid_chat_id' };

async function resolveTelegramCredentials(
  scope?: import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef | string | null
): Promise<ResolveTelegramCreds> {
  return resolvePropertyTelegramCredentials('marketing', scope);
}

export type { TelegramEnvVerifyResult } from './propertyTelegramCredentials.ts';

/** Admin-only: getMe + getChat using saved or draft credentials. */
export async function verifyTelegramEnv(
  scope?: import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef | string | null,
  overrides?: { botToken?: string; chatId?: string }
): Promise<import('./propertyTelegramCredentials.ts').TelegramEnvVerifyResult> {
  const { verifyPropertyTelegramChannel } = await import('./propertyTelegramCredentials.ts');
  return verifyPropertyTelegramChannel('marketing', scope, overrides);
}

async function sendTelegramMessage(
  text: string,
  scope?: import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef | string | null
): Promise<{ ok: boolean; error?: string }> {
  const creds = await resolveTelegramCredentials(scope);
  if (!creds.ok) {
    if (creds.code === 'missing_token' || creds.code === 'missing_chat_id') {
      return { ok: false, error: 'missing_credentials' };
    }
    console.error('[telegram] invalid TELEGRAM_CHAT_ID:', creds.error);
    return { ok: false, error: creds.error };
  }
  const url = `https://api.telegram.org/bot${creds.token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: creds.chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    const desc = json?.description ?? res.statusText;
    console.error('[telegram] sendMessage failed:', desc);
    return { ok: false, error: String(desc) };
  }
  return { ok: true };
}

async function loadSettings(propertyId?: string): Promise<TelegramMarketingSettings | null> {
  try {
    const row = await DatabaseService.getTelegramMarketingSettings(propertyId);
    if (!row) return null;
    return row as TelegramMarketingSettings;
  } catch (e) {
    console.error('[telegram] load settings:', e);
    return null;
  }
}

function buildBlockedSet(propertyId?: string): Promise<Set<string>> {
  return DatabaseService.listBookingRangesForAvailability(propertyId).then((ranges) =>
    collectBlockedNights(ranges)
  );
}

/** Send arbitrary text (admin tests); ignores `telegram_marketing_settings.enabled`. */
export async function sendTelegramAdminPreview(
  text: string,
  scope?: import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef | string | null
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'empty_message' };
  return sendTelegramMessage(trimmed.slice(0, 4096), scope);
}

export type TelegramDailyReminderResult = {
  sent: boolean;
  /** Primary outcome for callers; `both` = default + urgency sent. */
  mode: 'skipped' | 'default' | 'urgency' | 'both' | 'disabled' | 'no_env';
  detail?: string;
  defaultSent?: boolean;
  urgencySent?: boolean;
  /** Manila calendar days until earliest free check-in; omitted when none found. */
  daysOut?: number;
  urgencyThreshold?: number;
  earliestCheckInYmd?: string | null;
  telegramErrors?: string[];
};

/** Scheduled N×/day: always send daily default; also send urgency when calendar is tight. */
export async function runTelegramDailyReminder(opts?: {
  force?: boolean;
  propertyId?: string;
}): Promise<
  TelegramDailyReminderResult & {
    properties?: Array<TelegramDailyReminderResult & { propertyId: string }>;
  }
> {
  if (!opts?.propertyId) {
    const propertyIds = await listAllPropertyIds();
    const properties: Array<TelegramDailyReminderResult & { propertyId: string }> = [];
    for (const propertyId of propertyIds) {
      const result = await runTelegramDailyReminder({ ...opts, propertyId });
      properties.push({ propertyId, ...result });
    }
    const sent = properties.some((p) => p.sent);
    return {
      sent,
      mode: sent ? 'default' : 'skipped',
      properties,
    };
  }

  const settings = await loadSettings(opts.propertyId);
  if (!settings) {
    return { sent: false, mode: 'skipped', detail: 'no_settings_row' };
  }
  if (!opts?.force && !settings.enabled) {
    return { sent: false, mode: 'disabled' };
  }
  const slots = dailySlotsFromRow(settings);
  if (!opts?.force && !manilaNowMatchesReminderSlots(slots)) {
    return { sent: false, mode: 'skipped', detail: 'schedule_mismatch' };
  }
  const creds = await resolveTelegramCredentials(opts.propertyId);
  if (!creds.ok) {
    return {
      sent: false,
      mode: 'no_env',
      detail: creds.code === 'invalid_chat_id' ? creds.error : undefined,
    };
  }

  const telegramErrors: string[] = [];
  let defaultSent = false;
  let urgencySent = false;

  const sendDefault = async (): Promise<void> => {
    if (!opts?.force && !settings.notify_on_daily_default) return;
    const text = await prepareTelegramTemplateMessage(settings.daily_default_template, settings, {
      propertyId: opts.propertyId,
    });
    const r = await sendTelegramMessage(text, opts.propertyId);
    defaultSent = r.ok;
    if (!r.ok && r.error) telegramErrors.push(`default: ${r.error}`);
  };

  const sendUrgency = async (): Promise<void> => {
    if (!opts?.force && !settings.notify_on_daily_urgency) return;
    const text = await prepareTelegramTemplateMessage(settings.daily_urgency_template, settings, {
      propertyId: opts!.propertyId,
    });
    const r = await sendTelegramMessage(text, opts!.propertyId);
    urgencySent = r.ok;
    if (!r.ok && r.error) telegramErrors.push(`urgency: ${r.error}`);
  };

  try {
    if (opts?.force || settings.notify_on_daily_default) {
      await sendDefault();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    telegramErrors.push(`default: ${msg}`);
  }

  const todayYmd = manilaTodayYmd();
  const blocked = await buildBlockedSet(opts?.propertyId);
  const earliest = earliestAvailableCheckInYmd(blocked, todayYmd);
  const threshold = settings.urgency_days_threshold;

  if (!earliest) {
    return {
      sent: defaultSent,
      mode: defaultSent ? 'default' : 'skipped',
      defaultSent,
      urgencySent: false,
      earliestCheckInYmd: null,
      urgencyThreshold: threshold,
      detail: telegramErrors[0] ?? (!defaultSent ? 'no_availability_found' : undefined),
      telegramErrors: telegramErrors.length ? telegramErrors : undefined,
    };
  }

  const daysOut = calendarDaysBetween(todayYmd, earliest);
  const useUrgency = daysOut < threshold;

  if (useUrgency && (opts?.force || settings.notify_on_daily_urgency)) {
    try {
      await sendUrgency();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      telegramErrors.push(`urgency: ${msg}`);
    }
  }

  const sent = defaultSent || urgencySent;
  let mode: TelegramDailyReminderResult['mode'] = 'skipped';
  if (defaultSent && urgencySent) mode = 'both';
  else if (defaultSent) mode = 'default';
  else if (urgencySent) mode = 'urgency';

  return {
    sent,
    mode,
    defaultSent,
    urgencySent,
    daysOut,
    urgencyThreshold: threshold,
    earliestCheckInYmd: earliest,
    detail: telegramErrors.length ? telegramErrors.join('; ') : undefined,
    telegramErrors: telegramErrors.length ? telegramErrors : undefined,
  };
}

/** Admin test: send only the daily urgency template (ignores threshold and enabled toggle). */
async function runTelegramDailyUrgencyTest(opts?: {
  force?: boolean;
  propertyId?: string;
}): Promise<TelegramDailyReminderResult> {
  const settings = await loadSettings(opts?.propertyId);
  if (!settings) {
    return { sent: false, mode: 'skipped', detail: 'no_settings_row' };
  }
  if (!opts?.force && !settings.enabled) {
    return { sent: false, mode: 'disabled' };
  }
  if (!opts?.force && !settings.notify_on_daily_urgency) {
    return { sent: false, mode: 'skipped', detail: 'notify_off' };
  }
  const creds = await resolveTelegramCredentials(opts?.propertyId);
  if (!creds.ok) {
    return {
      sent: false,
      mode: 'no_env',
      detail: creds.code === 'invalid_chat_id' ? creds.error : undefined,
    };
  }

  const telegramErrors: string[] = [];
  let urgencySent = false;

  try {
    const text = await prepareTelegramTemplateMessage(settings.daily_urgency_template, settings, {
      propertyId: opts?.propertyId,
    });
    const r = await sendTelegramMessage(text, opts?.propertyId);
    urgencySent = r.ok;
    if (!r.ok && r.error) telegramErrors.push(r.error);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    telegramErrors.push(msg);
  }

  const todayYmd = manilaTodayYmd();
  const blocked = await buildBlockedSet(opts?.propertyId);
  const earliest = earliestAvailableCheckInYmd(blocked, todayYmd);
  const threshold = settings.urgency_days_threshold;
  const daysOut = earliest ? calendarDaysBetween(todayYmd, earliest) : undefined;

  return {
    sent: urgencySent,
    mode: urgencySent ? 'urgency' : 'skipped',
    defaultSent: false,
    urgencySent,
    daysOut,
    urgencyThreshold: threshold,
    earliestCheckInYmd: earliest,
    detail: telegramErrors[0] ?? (!urgencySent ? 'send_failed' : undefined),
    telegramErrors: telegramErrors.length ? telegramErrors : undefined,
  };
}

export type TelegramNotifySkip =
  'disabled' | 'notify_off' | 'no_dates' | 'missing_env' | 'send_failed' | 'no_settings';

/** After a brand-new guest submission row is inserted. */
export async function notifyTelegramNewBookingRequest(opts?: {
  force?: boolean;
  propertyId?: string;
}): Promise<{ sent: boolean; skip?: TelegramNotifySkip; telegramError?: string }> {
  const settings = await loadSettings(opts?.propertyId);
  if (!settings) {
    return { sent: false, skip: 'no_settings' };
  }
  if (!opts?.force && (!settings.enabled || !settings.notify_on_new_booking)) {
    return { sent: false, skip: !settings.enabled ? 'disabled' : 'notify_off' };
  }

  const todayYmd = manilaTodayYmd();
  const blocked = await buildBlockedSet(opts?.propertyId);

  const anchorMonth = todayYmd.slice(0, 7); // YYYY-MM
  const monthStart = `${anchorMonth}-01`;
  const limit = settings.new_booking_dates_limit;

  const candidates = listAvailableCheckIns(blocked, todayYmd, 60).filter((ymd) =>
    ymd.startsWith(anchorMonth)
  );
  const picked = candidates.slice(0, limit);
  if (picked.length === 0) {
    return { sent: false, skip: 'no_dates' };
  }

  let text: string;
  try {
    text = await prepareTelegramTemplateMessage(settings.new_booking_template, settings, {
      propertyId: opts?.propertyId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[telegram] new booking template:', msg);
    return { sent: false, skip: 'no_dates', telegramError: msg };
  }
  const r = await sendTelegramMessage(text, opts?.propertyId);
  if (!r.ok) {
    console.error('[telegram] new booking notify failed');
    return {
      sent: false,
      skip: r.error === 'missing_env' ? 'missing_env' : 'send_failed',
      telegramError: r.error,
    };
  }
  return { sent: true };
}

/** After cancel — dates are still on the row until transition; pass explicit YMDs. */
export async function notifyTelegramCancellation(
  checkInYmd: string,
  checkOutYmd: string,
  opts?: { force?: boolean; propertyId?: string }
): Promise<{ sent: boolean; skip?: TelegramNotifySkip; telegramError?: string }> {
  const settings = await loadSettings(opts?.propertyId);
  if (!settings) {
    return { sent: false, skip: 'no_settings' };
  }
  if (!opts?.force && (!settings.enabled || !settings.notify_on_cancellation)) {
    return { sent: false, skip: !settings.enabled ? 'disabled' : 'notify_off' };
  }

  const ci = normalizeBookingDateToYmd(checkInYmd) ?? checkInYmd;
  const co = normalizeBookingDateToYmd(checkOutYmd) ?? checkOutYmd;
  let text: string;
  try {
    text = await prepareTelegramTemplateMessage(settings.cancellation_template, settings, {
      checkInYmd: ci,
      checkOutYmd: co,
      propertyId: opts?.propertyId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[telegram] cancellation template:', msg);
    return { sent: false, skip: 'send_failed', telegramError: msg };
  }
  const r = await sendTelegramMessage(text, opts?.propertyId);
  if (!r.ok) {
    console.error('[telegram] cancellation notify failed');
    return {
      sent: false,
      skip: r.error === 'missing_env' ? 'missing_env' : 'send_failed',
      telegramError: r.error,
    };
  }
  return { sent: true };
}

/** Optional gate for cron: if TELEGRAM_CRON_SECRET is set, header must match. */
export function verifyTelegramCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'TELEGRAM_CRON_SECRET',
    headerName: 'x-telegram-cron-secret',
  });
}

function dailySlotsFromRow(row: TelegramMarketingSettings): ManilaReminderSlot[] {
  const raw = row.daily_reminder_times_manila;
  try {
    return parseManilaReminderSlots(raw);
  } catch {
    return [...DEFAULT_MANILA_REMINDER_SLOTS];
  }
}

/** Public shape for Settings GET (no secrets). */
export function serializeTelegramSettings(row: TelegramMarketingSettings) {
  const slots = dailySlotsFromRow(row);
  return {
    enabled: row.enabled,
    notifyOnNewBooking: row.notify_on_new_booking,
    notifyOnCancellation: row.notify_on_cancellation,
    notifyOnDailyDefault: row.notify_on_daily_default ?? true,
    notifyOnDailyUrgency: row.notify_on_daily_urgency ?? true,
    urgencyDaysThreshold: row.urgency_days_threshold,
    newBookingDatesLimit: row.new_booking_dates_limit,
    dailyReminderTimesManila: slots,
    dailyReminderUtcCronPreview: manilaSlotsToUtcCronPreview(slots),
    dailyDefaultTemplate: normalizeTelegramTemplateText(row.daily_default_template),
    dailyUrgencyTemplate: normalizeTelegramTemplateText(row.daily_urgency_template),
    newBookingTemplate: normalizeTelegramTemplateText(row.new_booking_template),
    cancellationTemplate: normalizeTelegramTemplateText(row.cancellation_template),
    placeholdersReference: [
      '{{available_dates}} — free check-in dates from the live calendar',
      '{{month_name}} — current month name from the booking calendar',
      '{{dates_list}} — free check-in day numbers this month',
      '{{cancellation_dates}} — freed dates from the cancelled stay window',
      '{{urgency_text}} — daily urgency opener: "today," | "tomorrow," | "this" (nearest free check-in)',
    ],
  };
}

/** Ensure marketing row exists for property; used defensively on admin GET/POST. */
export async function ensureTelegramSettingsRow(propertyId?: string): Promise<void> {
  if (!propertyId) return;
  await ensureTelegramMarketingSettingsRow(propertyId);
}
