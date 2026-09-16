/**
 * Finance operating Telegram due-date reminders.
 */

import { createClient } from './supabaseJs.ts';
import { verifyCronSecret } from './cronSecretGate.ts';
import { DatabaseService } from './databaseService.ts';
import { listAllParkingIds, listAllPropertyIds } from './propertyCron.ts';
import { addDaysToIso, daysBetweenIso } from './financeRecurrence.ts';
import { normalizeTelegramChatId } from './telegramMarketing.ts';

export type FinanceReminderInterval =
  'hourly' | 'every_2_hours' | 'every_4_hours' | 'every_12_hours' | 'daily_noon';

export type TelegramFinanceSettings = {
  id: number;
  enabled: boolean;
  notify_on_default_reminder: boolean;
  default_reminder_template: string;
  daily_check_time_manila: unknown;
  updated_at: string;
};

type FinanceManilaTimeSlot = { hour: number; minute: number };

const FINANCE_REMINDER_PLACEHOLDERS = [
  'label',
  'amount',
  'category',
  'due_date',
  'occurred_on',
  'days_until_due',
  'notes',
  'kind',
] as const;

const FINANCE_DEFAULT_REMINDER_TEMPLATE =
  '💰 Finance Reminder\n\n{{label}}\nDue: {{due_date}} ({{days_until_due}} day(s) left)\nAmount: {{amount}} · {{category}}\n\n{{notes}}';

const MANILA_TZ = 'Asia/Manila';

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function parseFinanceSlot(raw: unknown): FinanceManilaTimeSlot {
  if (raw && typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    const h = typeof o.hour === 'number' ? o.hour : 9;
    const m = typeof o.minute === 'number' ? o.minute : 0;
    return {
      hour: Math.max(0, Math.min(23, Math.round(h))),
      minute: Math.max(0, Math.min(59, Math.round(m))),
    };
  }
  return { hour: 9, minute: 0 };
}

function formatFinanceManilaTimeLabel(slot: FinanceManilaTimeSlot): string {
  const d = new Date(2000, 0, 1, slot.hour, slot.minute);
  return d.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function manilaTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

import { normalizeTelegramTemplateText } from './telegramTemplateNormalize.ts';

export function sanitizeFinanceReminderTemplate(text: string): string {
  return normalizeTelegramTemplateText(text);
}

function isFinanceReminderInterval(v: unknown): v is FinanceReminderInterval {
  return (
    v === 'hourly' ||
    v === 'every_2_hours' ||
    v === 'every_4_hours' ||
    v === 'every_12_hours' ||
    v === 'daily_noon'
  );
}

/** Map legacy DB values from before intervals v2 (and removed until_paid). */
export function normalizeFinanceReminderInterval(v: unknown): FinanceReminderInterval {
  const raw = typeof v === 'string' ? v.trim().toLowerCase() : v;
  if (isFinanceReminderInterval(raw)) return raw;
  if (v === 'once' || v === 'daily' || v === 'weekly' || v === 'until_paid') {
    return 'daily_noon';
  }
  return 'daily_noon';
}

function isLineItemPaid(row: Record<string, unknown>): boolean {
  return Boolean(row.paid_at);
}

export function serializeFinanceSettings(row: TelegramFinanceSettings) {
  const slot = parseFinanceSlot(row.daily_check_time_manila);
  return {
    enabled: row.enabled,
    defaultReminderTemplate: sanitizeFinanceReminderTemplate(row.default_reminder_template),
    dailyCheckTimeManila: slot,
    dailyCheckUtcCronPreview: '0 * * * *',
    placeholdersReference: [...FINANCE_REMINDER_PLACEHOLDERS],
  };
}

export type FinanceTelegramAssetScope = {
  propertyId?: string;
  parkingId?: string;
};

/** Seed one finance settings row per property or parking slot (idempotent). */
export async function ensureTelegramFinanceSettings(
  scope: FinanceTelegramAssetScope
): Promise<void> {
  const existing = await DatabaseService.getTelegramFinanceSettings(
    scope.propertyId,
    scope.parkingId
  );
  if (existing) return;

  const supabase = getSupabase();
  const row: Record<string, unknown> = {
    enabled: false,
    default_reminder_template: FINANCE_DEFAULT_REMINDER_TEMPLATE,
    daily_check_time_manila: { hour: 9, minute: 0 },
  };
  if (scope.propertyId) row.property_id = scope.propertyId;
  if (scope.parkingId) row.parking_id = scope.parkingId;

  const { error } = await supabase.from('telegram_finance_settings').insert(row);
  if (error) {
    console.error('[ensureTelegramFinanceSettings]', error.message);
    throw new Error('Failed to seed Telegram finance settings');
  }
}

export async function ensureFinanceSettingsRow(): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('telegram_finance_settings')
    .select('id')
    .eq('id', 1)
    .maybeSingle();
  if (data) return;
  await supabase.from('telegram_finance_settings').insert({
    id: 1,
    enabled: false,
    default_reminder_template: FINANCE_DEFAULT_REMINDER_TEMPLATE,
  });
}

function effectiveDueDate(row: Record<string, unknown>): string {
  const due = row.telegram_due_date
    ? String(row.telegram_due_date).slice(0, 10)
    : String(row.occurred_on).slice(0, 10);
  return due;
}

function reminderSeriesKey(row: Record<string, unknown>): string {
  const seriesId = row.recurrence_series_id;
  if (seriesId) return `series:${String(seriesId)}`;
  return `item:${String(row.id)}`;
}

/** One reminder per recurring series per cron tick — earliest in-window occurrence wins. */
function selectFinanceReminderRows(
  rows: Record<string, unknown>[],
  now: Date,
  lastSentByItem: Map<string, string>
): Record<string, unknown>[] {
  const eligible: Record<string, unknown>[] = [];

  for (const row of rows) {
    const interval = normalizeFinanceReminderInterval(row.telegram_reminder_interval);
    const daysBefore = Math.max(0, Math.min(90, Number(row.telegram_days_before ?? 3)));
    const lastSentAt = lastSentByItem.get(String(row.id)) ?? null;
    if (shouldSendFinanceReminderNow(row, now, interval, daysBefore, lastSentAt)) {
      eligible.push(row);
    }
  }

  const bySeries = new Map<string, Record<string, unknown>[]>();
  for (const row of eligible) {
    const key = reminderSeriesKey(row);
    const group = bySeries.get(key) ?? [];
    group.push(row);
    bySeries.set(key, group);
  }

  const selected: Record<string, unknown>[] = [];
  for (const group of bySeries.values()) {
    if (group.length === 1) {
      selected.push(group[0]);
      continue;
    }
    group.sort((a, b) => {
      const dueCmp = effectiveDueDate(a).localeCompare(effectiveDueDate(b));
      if (dueCmp !== 0) return dueCmp;
      return String(a.occurred_on).localeCompare(String(b.occurred_on));
    });
    selected.push(group[0]);
  }

  return selected;
}

function manilaDateTimeParts(now = new Date()): {
  date: string;
  hour: number;
  minute: number;
  ms: number;
} {
  const date = manilaTodayYmd(now);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return { date, hour, minute, ms: now.getTime() };
}

function intervalMinGapMs(interval: FinanceReminderInterval): number | null {
  switch (interval) {
    case 'hourly':
      return 60 * 60 * 1000;
    case 'every_2_hours':
      return 2 * 60 * 60 * 1000;
    case 'every_4_hours':
      return 4 * 60 * 60 * 1000;
    case 'every_12_hours':
      return 12 * 60 * 60 * 1000;
    case 'daily_noon':
      return null;
  }
}

function isInReminderWindow(
  row: Record<string, unknown>,
  today: string,
  interval: FinanceReminderInterval,
  daysBefore: number
): boolean {
  if (isLineItemPaid(row)) return false;

  const due = effectiveDueDate(row);
  const windowStart = addDaysToIso(due, -daysBefore);
  if (today < windowStart) return false;
  if (today > due) return false;
  return true;
}

/** @deprecated Use shouldSendFinanceReminderNow — kept for callers/tests. */
function shouldSendFinanceReminderToday(
  row: Record<string, unknown>,
  today: string,
  interval: FinanceReminderInterval,
  daysBefore: number
): boolean {
  return shouldSendFinanceReminderNow(row, new Date(), interval, daysBefore, null);
}

function shouldSendFinanceReminderNow(
  row: Record<string, unknown>,
  now: Date,
  interval: FinanceReminderInterval,
  daysBefore: number,
  lastSentAt: string | null
): boolean {
  const { date: today, hour, ms } = manilaDateTimeParts(now);
  if (!isInReminderWindow(row, today, interval, daysBefore)) return false;

  if (interval === 'daily_noon') {
    if (hour !== 12) return false;
    if (lastSentAt && manilaTodayYmd(new Date(lastSentAt)) === today) return false;
    return true;
  }

  const minGap = intervalMinGapMs(interval);
  if (minGap === null) return false;
  if (!lastSentAt) return true;
  return ms - new Date(lastSentAt).getTime() >= minGap;
}

function buildFinanceReminderPlaceholders(
  row: Record<string, unknown>,
  today: string
): Record<string, string> {
  const due = effectiveDueDate(row);
  const daysUntil = daysBetweenIso(today, due);
  return {
    label: String(row.label ?? ''),
    amount: formatMoney(Number(row.amount ?? 0)),
    category: String(row.category ?? '—'),
    due_date: formatDisplayDate(due),
    occurred_on: formatDisplayDate(String(row.occurred_on).slice(0, 10)),
    days_until_due: String(Math.max(0, daysUntil)),
    notes: String(row.notes ?? '').trim() || '—',
    kind: String(row.kind ?? ''),
  };
}

function renderFinanceReminderMessage(
  row: Record<string, unknown>,
  template: string,
  today: string
): string {
  const replacements = buildFinanceReminderPlaceholders(row, today);
  let out = template;
  for (const [key, value] of Object.entries(replacements)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out.trim().slice(0, 4096);
}

export type FinanceDraftRenderResult = {
  renderedText?: string;
  placeholders?: Record<string, string>;
  error?: string;
};

/** In-app preview: resolve placeholders from an unpaid finance line item. */
export async function renderFinanceDraftPreview(
  template: string,
  scope?:
    | FinanceTelegramAssetScope
    | import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef
    | string
    | null
): Promise<FinanceDraftRenderResult> {
  const trimmed = sanitizeFinanceReminderTemplate(template);
  if (!trimmed) return { error: 'text is required' };

  const assetScope =
    typeof scope === 'object' && scope !== null && ('propertyId' in scope || 'parkingId' in scope)
      ? (scope as FinanceTelegramAssetScope)
      : undefined;

  const today = manilaTodayYmd();
  const supabase = getSupabase();
  let query = supabase
    .from('finance_line_items')
    .select('*')
    .eq('telegram_reminder_enabled', true)
    .is('paid_at', null)
    .order('telegram_due_date', { ascending: true })
    .limit(50);

  if (assetScope?.propertyId) {
    query = query.eq('property_id', assetScope.propertyId);
  }
  if (assetScope?.parkingId) {
    query = query.eq('parking_id', assetScope.parkingId);
  }

  const { data: items, error } = await query;

  if (error) return { error: error.message };

  const rows = (items ?? []) as Record<string, unknown>[];
  const row =
    rows.find((candidate) => {
      const interval = normalizeFinanceReminderInterval(candidate.telegram_reminder_interval);
      const daysBefore = Math.max(0, Math.min(90, Number(candidate.telegram_days_before ?? 3)));
      return isInReminderWindow(candidate, today, interval, daysBefore);
    }) ?? rows[0];

  if (!row) {
    return {
      error: 'No unpaid finance line item with Telegram reminders enabled for preview.',
    };
  }

  const placeholders = buildFinanceReminderPlaceholders(row, today);
  const renderedText = renderFinanceReminderMessage(row, trimmed, today);
  return { renderedText, placeholders };
}

async function sendFinanceTelegramMessage(
  text: string,
  scope?: import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef | string | null
): Promise<{ ok: boolean; error?: string }> {
  const { sendPropertyTelegramMessage } = await import('./propertyTelegramCredentials.ts');
  return sendPropertyTelegramMessage('finance', text, scope);
}

export function verifyFinanceCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'TELEGRAM_FINANCE_CRON_SECRET',
    headerName: 'x-telegram-cron-secret',
  });
}

export async function verifyFinanceTelegramEnv(
  scope?: import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef | string | null,
  overrides?: { botToken?: string; chatId?: string }
) {
  const { verifyPropertyTelegramChannel } = await import('./propertyTelegramCredentials.ts');
  return verifyPropertyTelegramChannel('finance', scope, overrides);
}

export async function sendFinanceDraftPreview(
  text: string,
  scope?: import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef | string | null
) {
  const rendered = await renderFinanceDraftPreview(text, scope);
  if (rendered.error || !rendered.renderedText) {
    return {
      sent: false,
      error: rendered.error ?? 'text is required',
      messageCharCount: 0,
    };
  }
  const r = await sendFinanceTelegramMessage(rendered.renderedText, scope);
  return {
    sent: r.ok,
    error: r.error,
    messageCharCount: rendered.renderedText.length,
  };
}

export async function runFinanceDueReminders(options?: {
  force?: boolean;
  propertyId?: string;
  parkingId?: string;
}) {
  if (!options?.propertyId && !options?.parkingId) {
    const propertyIds = await listAllPropertyIds();
    const parkingIds = await listAllParkingIds();
    const assets: Array<Record<string, unknown>> = [];
    for (const propertyId of propertyIds) {
      assets.push({
        propertyId,
        ...(await runFinanceDueReminders({ ...options, propertyId })),
      });
    }
    for (const parkingId of parkingIds) {
      assets.push({
        parkingId,
        ...(await runFinanceDueReminders({ ...options, parkingId })),
      });
    }
    const sent = assets.reduce((sum, asset) => sum + Number(asset.sent ?? 0), 0);
    const matched = assets.reduce((sum, asset) => sum + Number(asset.matched ?? 0), 0);
    return { sent, matched, assets };
  }

  const settingsRow = await DatabaseService.getTelegramFinanceSettings(
    options.propertyId,
    options.parkingId
  );
  if (!settingsRow?.enabled && !options?.force) {
    return { skipped: true, reason: 'disabled', sent: 0, matched: 0 };
  }

  const today = manilaTodayYmd();
  const now = new Date();
  const supabase = getSupabase();
  let itemsQuery = supabase
    .from('finance_line_items')
    .select('*')
    .eq('telegram_reminder_enabled', true)
    .is('paid_at', null);

  if (options.propertyId) {
    itemsQuery = itemsQuery.eq('property_id', options.propertyId);
  } else if (options.parkingId) {
    itemsQuery = itemsQuery.eq('parking_id', options.parkingId);
  }

  const { data: items, error } = await itemsQuery;
  if (error) throw new Error(`finance reminders query failed: ${error.message}`);

  const rows = (items ?? []) as Record<string, unknown>[];
  const lineItemIds = rows.map((row) => String(row.id));
  const lastSentByItem = new Map<string, string>();

  if (lineItemIds.length > 0) {
    const { data: logs, error: logErr } = await supabase
      .from('finance_telegram_reminder_log')
      .select('line_item_id, sent_at')
      .in('line_item_id', lineItemIds)
      .order('sent_at', { ascending: false });
    if (logErr) {
      throw new Error(`finance reminder log query failed: ${logErr.message}`);
    }
    for (const log of logs ?? []) {
      const id = String((log as Record<string, unknown>).line_item_id);
      if (!lastSentByItem.has(id)) {
        lastSentByItem.set(id, String((log as Record<string, unknown>).sent_at));
      }
    }
  }

  const defaultTemplate = String(
    settingsRow?.default_reminder_template ?? FINANCE_DEFAULT_REMINDER_TEMPLATE
  );

  const toSend = selectFinanceReminderRows(rows, now, lastSentByItem);

  let matched = toSend.length;
  let sent = 0;
  const errors: string[] = [];

  for (const row of toSend) {
    const lineItemId = String(row.id);

    const template = row.telegram_message_template
      ? String(row.telegram_message_template)
      : defaultTemplate;
    const message = renderFinanceReminderMessage(row, template, today);
    const messageScope = options.parkingId ? { parkingId: options.parkingId } : options.propertyId;
    const result = await sendFinanceTelegramMessage(message, messageScope);
    if (!result.ok) {
      errors.push(`${lineItemId}: ${result.error ?? 'send failed'}`);
      continue;
    }

    await supabase.from('finance_telegram_reminder_log').insert({
      line_item_id: lineItemId,
      sent_on_date: today,
    });
    sent += 1;
  }

  return {
    skipped: false,
    today,
    matched,
    sent,
    errors,
  };
}

export type FinanceTelegramReminderInput = {
  telegram_reminder_enabled?: boolean;
  telegram_due_date?: string | null;
  telegram_days_before?: number;
  telegram_reminder_interval?: FinanceReminderInterval;
  telegram_message_template?: string | null;
  marked_paid?: boolean;
};

export function parseFinanceTelegramReminderInput(
  body: Record<string, unknown>
): FinanceTelegramReminderInput | undefined {
  const hasReminderFields =
    body.telegram_reminder_enabled !== undefined ||
    body.telegram_due_date !== undefined ||
    body.telegram_days_before !== undefined ||
    body.telegram_reminder_interval !== undefined ||
    body.telegram_message_template !== undefined ||
    body.marked_paid !== undefined;

  if (!hasReminderFields && body.telegram_reminder_enabled === undefined) {
    return undefined;
  }

  if (body.telegram_reminder_enabled === false) {
    return {
      telegram_reminder_enabled: false,
      telegram_due_date: null,
      telegram_days_before: 3,
      telegram_reminder_interval: 'daily_noon',
      telegram_message_template: null,
      marked_paid: body.marked_paid === true,
    };
  }

  if (body.telegram_reminder_enabled === undefined && body.marked_paid !== undefined) {
    return {
      marked_paid: body.marked_paid === true,
    };
  }

  const daysRaw = Number(body.telegram_days_before ?? 3);
  const daysBefore = Number.isFinite(daysRaw) ? Math.max(0, Math.min(90, Math.round(daysRaw))) : 3;
  const interval = normalizeFinanceReminderInterval(body.telegram_reminder_interval);

  let dueDate: string | null = null;
  if (typeof body.telegram_due_date === 'string' && body.telegram_due_date) {
    const d = body.telegram_due_date.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dueDate = d;
  }

  let template: string | null = null;
  if (typeof body.telegram_message_template === 'string') {
    const t = sanitizeFinanceReminderTemplate(body.telegram_message_template);
    template = t ? t.slice(0, 4000) : null;
  }

  return {
    telegram_reminder_enabled: true,
    telegram_due_date: dueDate,
    telegram_days_before: daysBefore,
    telegram_reminder_interval: interval,
    telegram_message_template: template,
    ...(body.marked_paid !== undefined ? { marked_paid: body.marked_paid === true } : {}),
  };
}

export function reminderFieldsForInsert(
  input: FinanceTelegramReminderInput | undefined,
  occurredOn: string
): Record<string, unknown> {
  if (!input?.telegram_reminder_enabled) {
    return {
      telegram_reminder_enabled: false,
      telegram_due_date: null,
      telegram_days_before: 3,
      telegram_reminder_interval: 'daily_noon',
      telegram_message_template: null,
      ...(input?.marked_paid ? { paid_at: new Date().toISOString() } : {}),
    };
  }
  return {
    telegram_reminder_enabled: true,
    telegram_due_date: input.telegram_due_date ?? null,
    telegram_days_before: input.telegram_days_before ?? 3,
    telegram_reminder_interval: input.telegram_reminder_interval ?? 'daily_noon',
    telegram_message_template: input.telegram_message_template ?? null,
    ...(input.marked_paid ? { paid_at: new Date().toISOString() } : {}),
  };
}

/** Per recurring row: due date always follows that occurrence's transaction date. */
export function reminderFieldsForRecurringRow(
  input: FinanceTelegramReminderInput | undefined,
  occurredOn: string
): Record<string, unknown> {
  if (!input?.telegram_reminder_enabled) {
    return reminderFieldsForInsert(input, occurredOn);
  }
  return {
    telegram_reminder_enabled: true,
    telegram_due_date: occurredOn,
    telegram_days_before: input.telegram_days_before ?? 3,
    telegram_reminder_interval: input.telegram_reminder_interval ?? 'daily_noon',
    telegram_message_template: input.telegram_message_template ?? null,
  };
}

export function reminderFieldsForUpdate(
  input: FinanceTelegramReminderInput | undefined
): Record<string, unknown> | undefined {
  if (!input) return undefined;

  const patch: Record<string, unknown> = {};

  if (input.telegram_reminder_enabled !== undefined) {
    if (input.telegram_reminder_enabled === false) {
      Object.assign(patch, {
        telegram_reminder_enabled: false,
        telegram_due_date: null,
        telegram_days_before: 3,
        telegram_reminder_interval: 'daily_noon',
        telegram_message_template: null,
      });
    } else {
      Object.assign(patch, {
        telegram_reminder_enabled: true,
        telegram_due_date: input.telegram_due_date ?? null,
        telegram_days_before: input.telegram_days_before ?? 3,
        telegram_reminder_interval: input.telegram_reminder_interval ?? 'daily_noon',
        telegram_message_template: input.telegram_message_template ?? null,
      });
    }
  } else if (
    input.telegram_due_date !== undefined ||
    input.telegram_days_before !== undefined ||
    input.telegram_reminder_interval !== undefined ||
    input.telegram_message_template !== undefined
  ) {
    Object.assign(patch, {
      telegram_due_date: input.telegram_due_date ?? null,
      telegram_days_before: input.telegram_days_before ?? 3,
      telegram_reminder_interval: input.telegram_reminder_interval ?? 'daily_noon',
      telegram_message_template: input.telegram_message_template ?? null,
    });
  }

  if (input.marked_paid !== undefined) {
    patch.paid_at = input.marked_paid ? new Date().toISOString() : null;
  }

  return Object.keys(patch).length ? patch : undefined;
}
