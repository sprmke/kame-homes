/**
 * Maintenance operating Telegram due-date reminders.
 */

import { createClient } from './supabaseJs.ts';
import { verifyCronSecret } from './cronSecretGate.ts';
import { DatabaseService } from './databaseService.ts';
import { listAllPropertyIds } from './propertyCron.ts';
import { addDaysToIso, daysBetweenIso } from './financeRecurrence.ts';
import { normalizeTelegramChatId } from './telegramMarketing.ts';

export type MaintenanceReminderInterval =
  'hourly' | 'every_2_hours' | 'every_4_hours' | 'every_12_hours' | 'daily_noon';

export type TelegramMaintenanceSettings = {
  id: number;
  enabled: boolean;
  notify_on_default_reminder: boolean;
  default_reminder_template: string;
  daily_check_time_manila: unknown;
  updated_at: string;
};

type MaintenanceManilaTimeSlot = { hour: number; minute: number };

const MAINTENANCE_REMINDER_PLACEHOLDERS = [
  'label',
  'category',
  'due_date',
  'scheduled_on',
  'days_until_due',
  'notes',
] as const;

const MAINTENANCE_DEFAULT_REMINDER_TEMPLATE =
  '🔧 Maintenance reminder\n\n{{label}}\nDue: {{due_date}} ({{days_until_due}} day(s) left)\nCategory: {{category}}\n\n{{notes}}';

const MANILA_TZ = 'Asia/Manila';

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
}

function parseMaintenanceSlot(raw: unknown): MaintenanceManilaTimeSlot {
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

function formatMaintenanceManilaTimeLabel(slot: MaintenanceManilaTimeSlot): string {
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

import { normalizeTelegramTemplateText } from './telegramTemplateNormalize.ts';

export function sanitizeMaintenanceReminderTemplate(text: string): string {
  return normalizeTelegramTemplateText(text);
}

function isMaintenanceReminderInterval(v: unknown): v is MaintenanceReminderInterval {
  return (
    v === 'hourly' ||
    v === 'every_2_hours' ||
    v === 'every_4_hours' ||
    v === 'every_12_hours' ||
    v === 'daily_noon'
  );
}

/** Map legacy DB values from before intervals v2 (and removed until_paid). */
export function normalizeMaintenanceReminderInterval(v: unknown): MaintenanceReminderInterval {
  const raw = typeof v === 'string' ? v.trim().toLowerCase() : v;
  if (isMaintenanceReminderInterval(raw)) return raw;
  if (v === 'once' || v === 'daily' || v === 'weekly' || v === 'until_paid') {
    return 'daily_noon';
  }
  return 'daily_noon';
}

function isItemComplete(row: Record<string, unknown>): boolean {
  return Boolean(row.completed_at);
}

export function serializeMaintenanceSettings(row: TelegramMaintenanceSettings) {
  const slot = parseMaintenanceSlot(row.daily_check_time_manila);
  return {
    enabled: row.enabled,
    defaultReminderTemplate: sanitizeMaintenanceReminderTemplate(row.default_reminder_template),
    dailyCheckTimeManila: slot,
    dailyCheckUtcCronPreview: '0 * * * *',
    placeholdersReference: [...MAINTENANCE_REMINDER_PLACEHOLDERS],
  };
}

export async function ensureMaintenanceSettingsRow(): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('telegram_maintenance_settings')
    .select('id')
    .eq('id', 1)
    .maybeSingle();
  if (data) return;
  await supabase.from('telegram_maintenance_settings').insert({
    id: 1,
    enabled: false,
    default_reminder_template: MAINTENANCE_DEFAULT_REMINDER_TEMPLATE,
  });
}

function effectiveDueDate(row: Record<string, unknown>): string {
  const due = row.telegram_due_date
    ? String(row.telegram_due_date).slice(0, 10)
    : String(row.scheduled_on).slice(0, 10);
  return due;
}

function reminderSeriesKey(row: Record<string, unknown>): string {
  const seriesId = row.recurrence_series_id;
  if (seriesId) return `series:${String(seriesId)}`;
  return `item:${String(row.id)}`;
}

/** One reminder per recurring series per cron tick — earliest in-window occurrence wins. */
function selectMaintenanceReminderRows(
  rows: Record<string, unknown>[],
  now: Date,
  lastSentByItem: Map<string, string>
): Record<string, unknown>[] {
  const eligible: Record<string, unknown>[] = [];

  for (const row of rows) {
    const interval = normalizeMaintenanceReminderInterval(row.telegram_reminder_interval);
    const daysBefore = Math.max(0, Math.min(90, Number(row.telegram_days_before ?? 3)));
    const lastSentAt = lastSentByItem.get(String(row.id)) ?? null;
    if (shouldSendMaintenanceReminderNow(row, now, interval, daysBefore, lastSentAt)) {
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
      return String(a.scheduled_on).localeCompare(String(b.scheduled_on));
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

function intervalMinGapMs(interval: MaintenanceReminderInterval): number | null {
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
  interval: MaintenanceReminderInterval,
  daysBefore: number
): boolean {
  if (isItemComplete(row)) return false;

  const due = effectiveDueDate(row);
  const windowStart = addDaysToIso(due, -daysBefore);
  if (today < windowStart) return false;
  if (today > due) return false;
  return true;
}

/** @deprecated Use shouldSendMaintenanceReminderNow — kept for callers/tests. */
function shouldSendMaintenanceReminderToday(
  row: Record<string, unknown>,
  today: string,
  interval: MaintenanceReminderInterval,
  daysBefore: number
): boolean {
  return shouldSendMaintenanceReminderNow(row, new Date(), interval, daysBefore, null);
}

function shouldSendMaintenanceReminderNow(
  row: Record<string, unknown>,
  now: Date,
  interval: MaintenanceReminderInterval,
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

function buildMaintenanceReminderPlaceholders(
  row: Record<string, unknown>,
  today: string
): Record<string, string> {
  const due = effectiveDueDate(row);
  const daysUntil = daysBetweenIso(today, due);
  return {
    label: String(row.label ?? ''),
    category: String(row.category ?? '—'),
    due_date: formatDisplayDate(due),
    scheduled_on: formatDisplayDate(String(row.scheduled_on).slice(0, 10)),
    days_until_due: String(Math.max(0, daysUntil)),
    notes: String(row.notes ?? '').trim() || '—',
  };
}

function renderMaintenanceReminderMessage(
  row: Record<string, unknown>,
  template: string,
  today: string
): string {
  const replacements = buildMaintenanceReminderPlaceholders(row, today);
  let out = template;
  for (const [key, value] of Object.entries(replacements)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out.trim().slice(0, 4096);
}

export type MaintenanceDraftRenderResult = {
  renderedText?: string;
  placeholders?: Record<string, string>;
  error?: string;
};

/** In-app preview: resolve placeholders from an unpaid maintenance line item. */
export async function renderMaintenanceDraftPreview(
  template: string
): Promise<MaintenanceDraftRenderResult> {
  const trimmed = sanitizeMaintenanceReminderTemplate(template);
  if (!trimmed) return { error: 'text is required' };

  const today = manilaTodayYmd();
  const supabase = getSupabase();
  const { data: items, error } = await supabase
    .from('maintenance_items')
    .select('*')
    .eq('telegram_reminder_enabled', true)
    .is('completed_at', null)
    .order('telegram_due_date', { ascending: true })
    .limit(50);

  if (error) return { error: error.message };

  const rows = (items ?? []) as Record<string, unknown>[];
  const row =
    rows.find((candidate) => {
      const interval = normalizeMaintenanceReminderInterval(candidate.telegram_reminder_interval);
      const daysBefore = Math.max(0, Math.min(90, Number(candidate.telegram_days_before ?? 3)));
      return isInReminderWindow(candidate, today, interval, daysBefore);
    }) ?? rows[0];

  if (!row) {
    return {
      error: 'No open maintenance item with Telegram reminders enabled for preview.',
    };
  }

  const placeholders = buildMaintenanceReminderPlaceholders(row, today);
  const renderedText = renderMaintenanceReminderMessage(row, trimmed, today);
  return { renderedText, placeholders };
}

async function sendMaintenanceTelegramMessage(
  text: string,
  scope?: import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef | string | null
): Promise<{ ok: boolean; error?: string }> {
  const { sendPropertyTelegramMessage } = await import('./propertyTelegramCredentials.ts');
  return sendPropertyTelegramMessage('maintenance', text, scope);
}

export function verifyMaintenanceCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'TELEGRAM_MAINTENANCE_CRON_SECRET',
    headerName: 'x-telegram-cron-secret',
  });
}

export async function verifyMaintenanceTelegramEnv(
  scope?: import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef | string | null,
  overrides?: { botToken?: string; chatId?: string }
) {
  const { verifyPropertyTelegramChannel } = await import('./propertyTelegramCredentials.ts');
  return verifyPropertyTelegramChannel('maintenance', scope, overrides);
}

export async function sendMaintenanceDraftPreview(
  text: string,
  scope?: import('./propertyTelegramCredentials.ts').TelegramAssetScopeRef | string | null
) {
  const rendered = await renderMaintenanceDraftPreview(text);
  if (rendered.error || !rendered.renderedText) {
    return {
      sent: false,
      error: rendered.error ?? 'text is required',
      messageCharCount: 0,
    };
  }
  const r = await sendMaintenanceTelegramMessage(rendered.renderedText, scope);
  return {
    sent: r.ok,
    error: r.error,
    messageCharCount: rendered.renderedText.length,
  };
}

export type MaintenanceDueRemindersResult = {
  sent: number;
  matched: number;
  skipped?: boolean;
  reason?: string;
  today?: string;
  errors?: string[];
  properties?: Array<MaintenanceDueRemindersResult & { propertyId: string }>;
};

export async function runMaintenanceDueReminders(options?: {
  force?: boolean;
  propertyId?: string;
}): Promise<MaintenanceDueRemindersResult> {
  if (!options?.propertyId) {
    const propertyIds = await listAllPropertyIds();
    const properties: Array<MaintenanceDueRemindersResult & { propertyId: string }> = [];
    for (const propertyId of propertyIds) {
      properties.push({
        propertyId,
        ...(await runMaintenanceDueReminders({ ...options, propertyId })),
      });
    }
    const sent = properties.reduce((sum, p) => sum + Number(p.sent ?? 0), 0);
    const matched = properties.reduce((sum, p) => sum + Number(p.matched ?? 0), 0);
    return { sent, matched, properties };
  }

  const settingsRow = await DatabaseService.getTelegramMaintenanceSettings(options.propertyId);
  if (!settingsRow?.enabled && !options?.force) {
    return { skipped: true, reason: 'disabled', sent: 0, matched: 0 };
  }

  const today = manilaTodayYmd();
  const now = new Date();
  const supabase = getSupabase();
  const { data: items, error } = await supabase
    .from('maintenance_items')
    .select('*')
    .eq('property_id', options.propertyId)
    .eq('telegram_reminder_enabled', true)
    .is('completed_at', null);
  if (error) throw new Error(`maintenance reminders query failed: ${error.message}`);

  const rows = (items ?? []) as Record<string, unknown>[];
  const lineItemIds = rows.map((row) => String(row.id));
  const lastSentByItem = new Map<string, string>();

  if (lineItemIds.length > 0) {
    const { data: logs, error: logErr } = await supabase
      .from('maintenance_telegram_reminder_log')
      .select('item_id, sent_at')
      .in('item_id', lineItemIds)
      .order('sent_at', { ascending: false });
    if (logErr) {
      throw new Error(`maintenance reminder log query failed: ${logErr.message}`);
    }
    for (const log of logs ?? []) {
      const id = String((log as Record<string, unknown>).item_id);
      if (!lastSentByItem.has(id)) {
        lastSentByItem.set(id, String((log as Record<string, unknown>).sent_at));
      }
    }
  }

  const defaultTemplate = String(
    settingsRow?.default_reminder_template ?? MAINTENANCE_DEFAULT_REMINDER_TEMPLATE
  );

  const toSend = selectMaintenanceReminderRows(rows, now, lastSentByItem);

  let matched = toSend.length;
  let sent = 0;
  const errors: string[] = [];

  for (const row of toSend) {
    const lineItemId = String(row.id);

    const template = row.telegram_message_template
      ? String(row.telegram_message_template)
      : defaultTemplate;
    const message = renderMaintenanceReminderMessage(row, template, today);
    const result = await sendMaintenanceTelegramMessage(message, options.propertyId);
    if (!result.ok) {
      errors.push(`${lineItemId}: ${result.error ?? 'send failed'}`);
      continue;
    }

    await supabase.from('maintenance_telegram_reminder_log').insert({
      item_id: lineItemId,
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

export type MaintenanceTelegramReminderInput = {
  telegram_reminder_enabled?: boolean;
  telegram_due_date?: string | null;
  telegram_days_before?: number;
  telegram_reminder_interval?: MaintenanceReminderInterval;
  telegram_message_template?: string | null;
  marked_complete?: boolean;
};

export function parseMaintenanceTelegramReminderInput(
  body: Record<string, unknown>
): MaintenanceTelegramReminderInput | undefined {
  const hasReminderFields =
    body.telegram_reminder_enabled !== undefined ||
    body.telegram_due_date !== undefined ||
    body.telegram_days_before !== undefined ||
    body.telegram_reminder_interval !== undefined ||
    body.telegram_message_template !== undefined ||
    body.marked_complete !== undefined;

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
      marked_complete: body.marked_complete === true,
    };
  }

  if (body.telegram_reminder_enabled === undefined && body.marked_complete !== undefined) {
    return {
      marked_complete: body.marked_complete === true,
    };
  }

  const daysRaw = Number(body.telegram_days_before ?? 3);
  const daysBefore = Number.isFinite(daysRaw) ? Math.max(0, Math.min(90, Math.round(daysRaw))) : 3;
  const interval = normalizeMaintenanceReminderInterval(body.telegram_reminder_interval);

  let dueDate: string | null = null;
  if (typeof body.telegram_due_date === 'string' && body.telegram_due_date) {
    const d = body.telegram_due_date.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dueDate = d;
  }

  let template: string | null = null;
  if (typeof body.telegram_message_template === 'string') {
    const t = sanitizeMaintenanceReminderTemplate(body.telegram_message_template);
    template = t ? t.slice(0, 4000) : null;
  }

  return {
    telegram_reminder_enabled: true,
    telegram_due_date: dueDate,
    telegram_days_before: daysBefore,
    telegram_reminder_interval: interval,
    telegram_message_template: template,
    ...(body.marked_complete !== undefined
      ? { marked_complete: body.marked_complete === true }
      : {}),
  };
}

export function reminderFieldsForInsert(
  input: MaintenanceTelegramReminderInput | undefined,
  occurredOn: string
): Record<string, unknown> {
  if (!input?.telegram_reminder_enabled) {
    return {
      telegram_reminder_enabled: false,
      telegram_due_date: null,
      telegram_days_before: 3,
      telegram_reminder_interval: 'daily_noon',
      telegram_message_template: null,
      ...(input?.marked_complete ? { completed_at: new Date().toISOString() } : {}),
    };
  }
  return {
    telegram_reminder_enabled: true,
    telegram_due_date: input.telegram_due_date ?? null,
    telegram_days_before: input.telegram_days_before ?? 3,
    telegram_reminder_interval: input.telegram_reminder_interval ?? 'daily_noon',
    telegram_message_template: input.telegram_message_template ?? null,
    ...(input.marked_complete ? { completed_at: new Date().toISOString() } : {}),
  };
}

/** Per recurring row: due date always follows that occurrence's transaction date. */
export function reminderFieldsForRecurringRow(
  input: MaintenanceTelegramReminderInput | undefined,
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
  input: MaintenanceTelegramReminderInput | undefined
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

  if (input.marked_complete !== undefined) {
    patch.completed_at = input.marked_complete ? new Date().toISOString() : null;
  }

  return Object.keys(patch).length ? patch : undefined;
}
