/**
 * Seed per-property settings rows on create-property (idempotent).
 * Defaults mirror shipped migration INSERT/UPDATE values (id=1 legacy row).
 */

import { createServiceClient } from './orgAuth.ts';
import { DEFAULT_MANILA_REMINDER_SLOTS } from './telegramMarketingCronSync.ts';

const DEFAULT_PRICING_HOLIDAY_RULES = [
  {
    id: 'new-year',
    name: "New Year's Day",
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    percentage: 50,
  },
  {
    id: 'chinese-new-year',
    name: 'Chinese New Year',
    startDate: '2026-02-17',
    endDate: '2026-02-17',
    percentage: 30,
  },
  {
    id: 'holy-week',
    name: 'Holy Week',
    startDate: '2026-04-02',
    endDate: '2026-04-05',
    percentage: 40,
  },
  {
    id: 'labor-day',
    name: 'Labor Day',
    startDate: '2026-05-01',
    endDate: '2026-05-01',
    percentage: 20,
  },
  {
    id: 'independence',
    name: 'Independence Day',
    startDate: '2026-06-12',
    endDate: '2026-06-12',
    percentage: 30,
  },
  {
    id: 'peak-july',
    name: 'Peak season',
    startDate: '2026-07-04',
    endDate: '2026-07-04',
    percentage: 25,
  },
  {
    id: 'all-saints',
    name: "All Saints' Day",
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    percentage: 30,
  },
  {
    id: 'christmas',
    name: 'Christmas Season',
    startDate: '2026-12-24',
    endDate: '2026-12-26',
    percentage: 50,
  },
  {
    id: 'new-year-eve',
    name: "New Year's Eve",
    startDate: '2026-12-31',
    endDate: '2026-12-31',
    percentage: 50,
  },
];

const STAFF_DAILY_TEMPLATE =
  "📋 Today's Booking\n\nBooking Details\n{{check_in_date}} - {{check_out_date}}\n{{check_in_time}} - {{check_out_time}}\n{{nights}} night/s, {{pax}} pax\n\nGuest Details\n{{primary_guest_name}}, {{guest_phone}}\n\nAdditional Details\n{{decor_status}}, {{pet_status}}\nSpecial Requests: {{special_requests}}\nTotal guest balance: {{total_guest_balance}}\n\nNext Bookings\n{{next_bookings}}";

const ADMIN_NEW_BOOKING_TEMPLATE =
  '🆕 New Booking Request\n\nGuest: {{primary_guest_name}}\nPhone: {{guest_phone}}\nDates: {{check_in_date}} → {{check_out_date}}\n\n{{booking_link}}';

const ADMIN_PENDING_DOCS_TEMPLATE =
  '⚠️ Pending Documents — Check-in Today\n\nGuest: {{primary_guest_name}}\nCheck-in: {{check_in_date}} at {{check_in_time}}\nStill needed: {{pending_docs_list}}\nStatus: {{status_label}}\n\n{{booking_link}}';

const ADMIN_BALANCE_RECEIPT_TEMPLATE =
  '💳 Balance Receipt Needed\n\nGuest: {{primary_guest_name}}\nBalance due: {{total_guest_balance}}\n\nUpload payment receipt now:\n{{booking_link}}';

const ADMIN_SD_FORM_SUBMITTED_TEMPLATE =
  '📝 SD Refund Form Submitted\n\nGuest: {{primary_guest_name}}\nMethod: {{sd_refund_method}}\nCheck-out: {{check_out_date}}\n\nRefund details:\n{{sd_refund_details}}\n\nProcess the refund now:\n{{booking_link}}';

const ADMIN_SD_REFUND_PENDING_TEMPLATE =
  '💰 SD Refund Pending Processing\n\nGuest: {{primary_guest_name}}\nMethod: {{sd_refund_method}}\n\nRefund details:\n{{sd_refund_details}}\n\nProcess the refund now:\n{{booking_link}}';

const FINANCE_DEFAULT_REMINDER_TEMPLATE =
  '💰 Finance Reminder\n\n{{label}}\nDue: {{due_date}} ({{days_until_due}} day(s) left)\nAmount: {{amount}} · {{category}}\n\n{{notes}}';

const MAINTENANCE_DEFAULT_REMINDER_TEMPLATE =
  '🔧 Maintenance reminder\n\n{{label}}\nDue: {{due_date}} ({{days_until_due}} day(s) left)\nCategory: {{category}}\n\n{{notes}}';

const CHAT_DEFAULT_NEW_MESSAGE_TEMPLATE =
  '💬 New guest chat\n\nProperty: {{property_name}}\nSource: {{chat_source}}\n\nGuest: {{guest_name}}\nMessage:\n{{chat_content}}\n{{attachment_line}}\n\nReply now:\n{{conversation_link}}';

async function upsertIfMissing(
  table: string,
  propertyId: string,
  values: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from(table)
    .select('id')
    .eq('property_id', propertyId)
    .maybeSingle();

  if (existing) return;

  const payload = { property_id: propertyId, ...values };
  let { error } = await supabase.from(table).insert(payload);

  if (error?.code === '23505') {
    const { data: maxRow } = await supabase
      .from(table)
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextId = (Number(maxRow?.id) || 0) + 1;
    const retry = await supabase.from(table).insert({ id: nextId, ...payload });
    error = retry.error;
  }

  if (error) {
    console.error(`[propertySettingsSeed] ${table} insert:`, error.message);
    throw new Error(`Failed to seed ${table} for property ${propertyId}`);
  }
}

export async function ensureTelegramMarketingSettingsRow(propertyId: string): Promise<void> {
  await upsertIfMissing('telegram_marketing_settings', propertyId, {
    enabled: false,
    notify_on_new_booking: true,
    notify_on_cancellation: true,
    notify_on_daily_default: true,
    notify_on_daily_urgency: true,
    urgency_days_threshold: 5,
    new_booking_dates_limit: 8,
    daily_reminder_times_manila: DEFAULT_MANILA_REMINDER_SLOTS,
    daily_default_template: 'Pa up and share po ka-uppers! Salamuch!',
    daily_urgency_template:
      'Available {{urgency_text}} {{month_name}} {{dates_list}}. Book now and get huge last minute discount!',
    new_booking_template:
      'Available next dates: {{month_name}} {{dates_list}}. Book now and get huge discount for this month!',
    cancellation_template:
      'Available this {{cancellation_dates}} due to guest cancellation! Book now and get huge discount for this specific date/s!',
  });
}

/** Idempotent: creates default settings rows for a new property. */
export async function seedPropertySettings(
  propertyId: string,
  options?: { residenceName?: string | null }
): Promise<void> {
  const pid = propertyId.trim();
  if (!pid) throw new Error('propertyId required');

  const appSettingsSeed: Record<string, unknown> = {
    pricing_holiday_rules: DEFAULT_PRICING_HOLIDAY_RULES,
  };

  await upsertIfMissing('app_settings', pid, appSettingsSeed);

  await ensureTelegramMarketingSettingsRow(pid);

  await upsertIfMissing('telegram_staff_settings', pid, {
    enabled: false,
    notify_on_same_day_checkin: true,
    notify_on_daily_summary: true,
    notify_on_daily_summary_no_bookings: true,
    daily_summary_template: STAFF_DAILY_TEMPLATE,
    daily_summary_time_manila: { hour: 8, minute: 0 },
  });

  await upsertIfMissing('telegram_admin_settings', pid, {
    enabled: false,
    new_booking_template: ADMIN_NEW_BOOKING_TEMPLATE,
    pending_docs_template: ADMIN_PENDING_DOCS_TEMPLATE,
    balance_receipt_template: ADMIN_BALANCE_RECEIPT_TEMPLATE,
    sd_form_submitted_template: ADMIN_SD_FORM_SUBMITTED_TEMPLATE,
    sd_refund_pending_template: ADMIN_SD_REFUND_PENDING_TEMPLATE,
  });

  await upsertIfMissing('telegram_finance_settings', pid, {
    enabled: false,
    default_reminder_template: FINANCE_DEFAULT_REMINDER_TEMPLATE,
    daily_check_time_manila: { hour: 9, minute: 0 },
  });

  await upsertIfMissing('telegram_maintenance_settings', pid, {
    enabled: false,
    default_reminder_template: MAINTENANCE_DEFAULT_REMINDER_TEMPLATE,
    daily_check_time_manila: { hour: 9, minute: 0 },
  });

  await upsertIfMissing('telegram_chat_settings', pid, {
    enabled: false,
    notify_on_new_message: true,
    new_message_template: CHAT_DEFAULT_NEW_MESSAGE_TEMPLATE,
  });
}

/** Ensure all settings exist (create-property + app-settings GET). */
export async function ensurePropertySettings(propertyId: string): Promise<void> {
  await seedPropertySettings(propertyId);
}
