/**
 * Admin operations Telegram alerts — booking workflow reminders to a dedicated admin group.
 * Event-driven (SD form submit) + instant + hourly cron (new booking, pending docs, balance receipt, SD refund).
 */

import { createClient } from './supabaseJs.ts';
import { verifyCronSecret } from './cronSecretGate.ts';
import { DatabaseService } from './databaseService.ts';
import { manilaTodayYmd, normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';
import { normalizeTelegramChatId } from './telegramMarketing.ts';
import {
  getPropertyTelegramCredentialsStatus,
  resolvePropertyTelegramCredentials,
  type TelegramAssetScopeRef,
} from './propertyTelegramCredentials.ts';
import { listAllPropertyIds, propertyIdFromRow } from './propertyCron.ts';
import { getPendingDocumentsNestedCompletion } from './statusMachine.ts';
import { DEFAULT_DOCUMENT_REQUIREMENTS } from './documentRequirements.ts';
import {
  computeTotalGuestBalanceFromBooking,
  guestBalancePaymentReceiptRequired,
} from './totalGuestBalance.ts';
import {
  formatTimeForDisplay,
  DEFAULT_CHECK_IN_TIME,
  DEFAULT_CHECK_OUT_TIME,
  countStayNights,
  formatDateForEmail,
} from './utils.ts';
import { formatReceiptVerdictLabel } from './receiptValidationService.ts';

const MANILA_TZ = 'Asia/Manila';
const APP_BASE_URL = 'https://kamehomes.space';

const DEFAULT_BALANCE_RECEIPT_NEEDED_TEMPLATE = `💳 Balance Receipt Needed

Guest: {{primary_guest_name}}
Balance due: {{total_guest_balance}}

Upload payment receipt now:
{{booking_link}}`;

const DEFAULT_BALANCE_RECEIPT_UPLOADED_TEMPLATE = `💳 Balance Receipt Uploaded

Guest: {{primary_guest_name}}
Balance due: {{total_guest_balance}}

Balance receipt AI
Verdict: {{balance_receipt_ai_verdict}}
{{balance_receipt_ai_summary}}

{{booking_link}}`;

/** Hourly reminders must never use the instant "uploaded" copy (migration 20260717120000 regression). */
function resolveBalanceReceiptHourlyTemplate(raw: string): string {
  const t = raw.trim();
  if (!t) return DEFAULT_BALANCE_RECEIPT_NEEDED_TEMPLATE;
  if (/Balance Receipt Uploaded/i.test(t)) return DEFAULT_BALANCE_RECEIPT_NEEDED_TEMPLATE;
  if (t.includes('{{balance_receipt_ai_verdict}}')) {
    return DEFAULT_BALANCE_RECEIPT_NEEDED_TEMPLATE;
  }
  return t;
}

function receiptUploadDedupeKey(receiptUrl: string): string {
  const u = receiptUrl.trim();
  if (!u) return 'empty';
  try {
    const path = new URL(u).pathname;
    return path.length > 240 ? path.slice(-240) : path;
  } catch {
    return u.length > 240 ? u.slice(-240) : u;
  }
}

export type TelegramAdminSettings = {
  id: number;
  enabled: boolean;
  notify_on_new_booking: boolean;
  notify_on_sd_form_submitted: boolean;
  notify_on_balance_receipt_uploaded: boolean;
  notify_pending_docs_hourly: boolean;
  notify_balance_receipt_hourly: boolean;
  notify_sd_refund_pending_hourly: boolean;
  new_booking_template: string;
  pending_docs_template: string;
  balance_receipt_template: string;
  balance_receipt_uploaded_template: string;
  sd_form_submitted_template: string;
  sd_refund_pending_template: string;
  updated_at: string;
};

export type AdminHourlyNotificationType =
  'new_booking' | 'pending_docs' | 'balance_receipt' | 'sd_refund_pending';

type AdminNotificationLogType = AdminHourlyNotificationType | 'balance_receipt_uploaded';

const ADMIN_KNOWN_PLACEHOLDERS = [
  'primary_guest_name',
  'guest_phone',
  'guest_email',
  'guest_address',
  'guest_facebook_name',
  'booking_source',
  'tower_and_unit_number',
  'urgent_notice',
  'check_in_date',
  'check_out_date',
  'check_in_time',
  'check_out_time',
  'nights',
  'pax',
  'need_parking',
  'has_pets',
  'surprise_decor',
  'status',
  'status_label',
  'pending_docs_list',
  'total_guest_balance',
  'sd_refund_method',
  'sd_refund_bank',
  'sd_refund_account_name',
  'sd_refund_account_number',
  'sd_refund_payout_phone',
  'sd_refund_details',
  'sd_refund_guest_feedback',
  'dp_receipt_ai_verdict',
  'dp_receipt_ai_summary',
  'balance_receipt_ai_verdict',
  'balance_receipt_ai_summary',
  'booking_link',
] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pending Review',
  PENDING_DOCUMENTS: 'Pending Documents',
  PENDING_GAF: 'Pending GAF',
  PENDING_PARKING_REQUEST: 'Pending Parking Request',
  PENDING_PET_REQUEST: 'Pending Pet Request',
  READY_FOR_CHECKIN: 'Ready for Check-in',
  READY_FOR_CHECKOUT: 'Ready for Check-out',
  PENDING_SD_REFUND: 'Pending SD Refund',
  COMPLETED: 'Completed',
  CANCELLED: 'Canceled',
};

type BookingRow = Record<string, unknown>;

function manilaDateTimeParts(date = new Date()): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value])
  );
}

function nowManila(): Date {
  const p = manilaDateTimeParts();
  const hour = p.hour === '24' ? '00' : p.hour;
  return new Date(`${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}+08:00`);
}

function manilaHourBucket(): string {
  const p = manilaDateTimeParts();
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}`;
}

function parseBookingDateTimeManila(
  dateStr: string,
  timeStr: string | null | undefined,
  defaultTime24: string
): Date | null {
  try {
    const ymd = normalizeBookingDateToYmd(dateStr);
    if (!ymd) return null;

    const raw = typeof timeStr === 'string' ? timeStr.trim() : '';
    let hour24 = 0;
    let minute = 0;

    const ampm = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const m = parseInt(ampm[2], 10);
      const period = ampm[3].toUpperCase();
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      hour24 = h;
      minute = m;
    } else {
      const plain = raw.match(/(\d{1,2}):(\d{2})/);
      if (plain) {
        hour24 = parseInt(plain[1], 10);
        minute = parseInt(plain[2], 10);
      } else {
        const [dh, dm] = defaultTime24.split(':').map(Number);
        hour24 = dh ?? 14;
        minute = dm ?? 0;
      }
    }

    return new Date(
      `${ymd}T${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`
    );
  } catch {
    return null;
  }
}

function formatDateHumanFull(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function bookingFlagTrue(v: unknown): boolean {
  return v === true || v === 'true';
}

/** Matches new-booking-request email copy. */
function notifyYesNo(v: unknown): string {
  return bookingFlagTrue(v) ? 'Yes ‼️' : 'No';
}

function formatBookingSourceLabel(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (/^airbnb$/i.test(s)) return 'Airbnb';
  if (/^facebook$/i.test(s)) return 'Facebook';
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Facebook';
}

function buildUrgentNotice(checkInDate: unknown): string {
  const ciYmd = normalizeBookingDateToYmd(String(checkInDate ?? ''));
  if (ciYmd !== manilaTodayYmd()) return '';
  return '🚨 URGENT — Same-day check-in!\nThis request requires immediate attention.\n\n';
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return 'Not set';
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatSdRefundMethod(method: unknown): string {
  const m = String(method ?? '').trim();
  if (m === 'same_phone') return 'Same phone (GCash)';
  if (m === 'other_bank') return 'Bank transfer';
  if (m === 'cash') return 'Cash pickup';
  return m || 'Not set';
}

function sdRefundFieldOrDash(value: unknown): string {
  const v = String(value ?? '').trim();
  return v || '—';
}

/** Method-aware payout lines for admin Telegram copy (GCash phone, bank transfer, or cash). */
function buildSdRefundDetailsBlock(booking: BookingRow): string {
  const method = String(booking.sd_refund_method ?? '').trim();
  if (!method) return 'Not submitted yet';

  if (method === 'same_phone') {
    const phone = String(booking.guest_phone_number ?? '').trim();
    return phone ? `GCash (on-file phone): ${phone}` : 'GCash (on-file phone): not on file';
  }
  if (method === 'other_bank') {
    const bank = sdRefundFieldOrDash(booking.sd_refund_bank);
    const name = sdRefundFieldOrDash(booking.sd_refund_account_name);
    const acct = sdRefundFieldOrDash(booking.sd_refund_account_number);
    return `Bank: ${bank}\nAccount name: ${name}\nAccount number: ${acct}`;
  }
  if (method === 'cash') {
    return 'Cash pickup at check-out';
  }
  return '—';
}

function buildSdRefundPlaceholderFields(booking: BookingRow): Record<string, string> {
  const method = String(booking.sd_refund_method ?? '').trim();
  const guestPhone = String(booking.guest_phone_number ?? '').trim();

  let bank = '—';
  let accountName = '—';
  let accountNumber = '—';
  let payoutPhone = '—';

  if (method === 'same_phone') {
    bank = 'GCash';
    payoutPhone = guestPhone || '—';
    accountNumber = guestPhone || '—';
  } else if (method === 'other_bank') {
    bank = sdRefundFieldOrDash(booking.sd_refund_bank);
    accountName = sdRefundFieldOrDash(booking.sd_refund_account_name);
    accountNumber = sdRefundFieldOrDash(booking.sd_refund_account_number);
    if (bank === 'GCash' && accountNumber !== '—') {
      payoutPhone = accountNumber;
    }
  } else if (method === 'cash') {
    bank = 'Cash pickup';
  }

  const feedback = String(booking.sd_refund_guest_feedback ?? '').trim();

  return {
    sd_refund_bank: bank,
    sd_refund_account_name: accountName,
    sd_refund_account_number: accountNumber,
    sd_refund_payout_phone: payoutPhone,
    sd_refund_details: buildSdRefundDetailsBlock(booking),
    sd_refund_guest_feedback: feedback || 'None',
  };
}

// Telegram admin builds these across many bookings synchronously (hourly scan,
// message placeholders) — property-scoped resolution lands in a later task, so
// use the default requirement list (GAF + pet) for now.
function buildPendingDocsList(booking: BookingRow): string {
  const { needParking, hasPets, gafDone, parkingDone, petDone } =
    getPendingDocumentsNestedCompletion(booking, DEFAULT_DOCUMENT_REQUIREMENTS);
  const items: string[] = [];
  if (!gafDone) items.push('GAF');
  if (needParking && !parkingDone) items.push('Parking');
  if (hasPets && !petDone) items.push('Pet');
  return items.length ? items.join(', ') : 'None';
}

function areAllRequiredDocsComplete(booking: BookingRow): boolean {
  const { gafDone, parkingDone, petDone } = getPendingDocumentsNestedCompletion(
    booking,
    DEFAULT_DOCUMENT_REQUIREMENTS
  );
  return gafDone && parkingDone && petDone;
}

function buildAdminBookingPlaceholders(booking: BookingRow): Record<string, string> {
  const ciRaw = String(booking.check_in_date ?? '');
  const coRaw = String(booking.check_out_date ?? '');
  const ciYmd = normalizeBookingDateToYmd(ciRaw) ?? ciRaw;
  const coYmd = normalizeBookingDateToYmd(coRaw) ?? coRaw;
  const status = String(booking.status ?? '');
  const adults = Number(booking.number_of_adults ?? 1) || 1;
  const children = Number(booking.number_of_children ?? 0) || 0;
  const nightsRaw = booking.number_of_nights;
  const nights =
    nightsRaw != null && Number.isFinite(Number(nightsRaw)) && Number(nightsRaw) >= 0
      ? Number(nightsRaw)
      : countStayNights(ciRaw, coRaw);

  return {
    primary_guest_name: String(booking.primary_guest_name ?? 'N/A'),
    guest_phone: String(booking.guest_phone_number ?? 'N/A'),
    guest_email: String(booking.guest_email ?? 'N/A'),
    guest_address: String(booking.guest_address ?? 'N/A'),
    guest_facebook_name: String(booking.guest_facebook_name ?? 'N/A'),
    booking_source: formatBookingSourceLabel(booking.booking_source),
    tower_and_unit_number: String(booking.tower_and_unit_number ?? '').trim() || 'Monaco 2604',
    urgent_notice: buildUrgentNotice(booking.check_in_date),
    check_in_date: formatDateForEmail(ciRaw) || formatDateHumanFull(ciYmd),
    check_out_date: formatDateForEmail(coRaw) || formatDateHumanFull(coYmd),
    check_in_time: formatTimeForDisplay(
      typeof booking.check_in_time === 'string' ? booking.check_in_time : null,
      DEFAULT_CHECK_IN_TIME
    ),
    check_out_time: formatTimeForDisplay(
      typeof booking.check_out_time === 'string' ? booking.check_out_time : null,
      DEFAULT_CHECK_OUT_TIME
    ),
    nights: String(nights),
    pax: String(adults + children),
    need_parking: notifyYesNo(booking.need_parking),
    has_pets: notifyYesNo(booking.has_pets),
    surprise_decor: notifyYesNo(booking.guest_requests_surprise_decor),
    status,
    status_label: STATUS_LABELS[status] ?? status.replace(/_/g, ' '),
    pending_docs_list: buildPendingDocsList(booking),
    total_guest_balance: formatCurrency(computeTotalGuestBalanceFromBooking(booking)),
    sd_refund_method: formatSdRefundMethod(booking.sd_refund_method),
    dp_receipt_ai_verdict: formatReceiptVerdictLabel(
      booking.dp_receipt_ai_verdict as string | null | undefined
    ),
    dp_receipt_ai_summary: String(booking.dp_receipt_ai_summary ?? '').trim() || 'N/A',
    balance_receipt_ai_verdict: formatReceiptVerdictLabel(
      booking.balance_receipt_ai_verdict as string | null | undefined
    ),
    balance_receipt_ai_summary: String(booking.balance_receipt_ai_summary ?? '').trim() || 'N/A',
    ...buildSdRefundPlaceholderFields(booking),
    booking_link: `${APP_BASE_URL}/bookings/${booking.id}`,
  };
}

function applyPlaceholders(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function isCancelledStatus(status: unknown): boolean {
  return String(status ?? '') === 'CANCELLED';
}

function isPendingReviewLikeStatus(status: unknown): boolean {
  return String(status ?? '') === 'PENDING_REVIEW';
}

/** Still awaiting admin review — hourly until Proceed to Pending Documents (or GAF). */
function bookingNeedsNewBookingHourlyAlert(booking: BookingRow): boolean {
  if (isCancelledStatus(booking.status)) return false;
  return isPendingReviewLikeStatus(booking.status);
}

/** Check-in today + incomplete required docs, not yet ready for check-in workflow-wise. */
function bookingNeedsPendingDocsHourlyAlert(booking: BookingRow, todayYmd: string): boolean {
  if (isCancelledStatus(booking.status)) return false;
  const ciYmd = normalizeBookingDateToYmd(String(booking.check_in_date ?? ''));
  if (ciYmd !== todayYmd) return false;
  if (areAllRequiredDocsComplete(booking)) return false;

  const status = String(booking.status ?? '');
  const preRfci = [
    'PENDING_REVIEW',
    'PENDING_DOCUMENTS',
    'PENDING_GAF',
    'PENDING_PARKING_REQUEST',
    'PENDING_PET_REQUEST',
  ];
  if (preRfci.includes(status)) return true;
  if (status === 'READY_FOR_CHECKIN') return !areAllRequiredDocsComplete(booking);
  return false;
}

/** During stay, after check-in time on check-in day, before check-out, positive balance receipt missing. */
function bookingNeedsBalanceReceiptHourlyAlert(
  booking: BookingRow,
  todayYmd: string,
  now: Date = nowManila()
): boolean {
  if (isCancelledStatus(booking.status)) return false;
  const ciYmd = normalizeBookingDateToYmd(String(booking.check_in_date ?? ''));
  const coYmd = normalizeBookingDateToYmd(String(booking.check_out_date ?? ''));
  if (!ciYmd || !coYmd) return false;
  if (todayYmd < ciYmd || todayYmd > coYmd) return false;

  const total = computeTotalGuestBalanceFromBooking(booking);
  if (total === null || !guestBalancePaymentReceiptRequired(total)) return false;

  const receipt = String(booking.guest_balance_payment_receipt_url ?? '').trim();
  if (receipt) return false;

  const status = String(booking.status ?? '');
  if (!['READY_FOR_CHECKIN', 'READY_FOR_CHECKOUT', 'PENDING_SD_REFUND'].includes(status)) {
    return false;
  }

  if (todayYmd === ciYmd) {
    const checkInDt = parseBookingDateTimeManila(
      String(booking.check_in_date ?? ''),
      booking.check_in_time as string | null | undefined,
      DEFAULT_CHECK_IN_TIME
    );
    if (!checkInDt || now.getTime() < checkInDt.getTime()) return false;
  }

  const checkOutDt = parseBookingDateTimeManila(
    String(booking.check_out_date ?? ''),
    booking.check_out_time as string | null | undefined,
    DEFAULT_CHECK_OUT_TIME
  );
  if (!checkOutDt || now.getTime() > checkOutDt.getTime()) return false;

  return true;
}

/** Guest submitted SD form; admin still needs to process refund. */
function bookingNeedsSdRefundPendingHourlyAlert(booking: BookingRow): boolean {
  if (isCancelledStatus(booking.status)) return false;
  if (String(booking.status ?? '') !== 'PENDING_SD_REFUND') return false;
  return !!String(booking.sd_refund_method ?? '').trim();
}

type AdminCreds = { ok: true; token: string; chatId: string } | { ok: false; error: string };

async function resolveAdminTelegramCredentials(
  scope?: TelegramAssetScopeRef | string | null
): Promise<AdminCreds> {
  const creds = await resolvePropertyTelegramCredentials('admin', scope);
  if (!creds.ok) return { ok: false, error: creds.error };
  return { ok: true, token: creds.token, chatId: creds.chatId };
}

async function sendAdminTelegramMessage(
  text: string,
  scope?: TelegramAssetScopeRef | string | null
): Promise<{ ok: boolean; error?: string }> {
  const creds = await resolveAdminTelegramCredentials(scope);
  if (!creds.ok) {
    console.warn('[telegram-admin] credentials issue:', creds.error);
    return { ok: false, error: creds.error };
  }

  const url = `https://api.telegram.org/bot${creds.token}/sendMessage`;
  const sendPayload = async (chatId: string) =>
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        disable_web_page_preview: false,
      }),
    });

  const parseResponse = async (res: Response): Promise<Record<string, unknown>> =>
    (await res.json().catch(() => ({}))) as Record<string, unknown>;

  let res = await sendPayload(creds.chatId);
  let json = await parseResponse(res);
  if (!res.ok || !json?.ok) {
    const description = String(json?.description ?? res.statusText ?? 'sendMessage failed');
    const migrateTo =
      json?.parameters &&
      typeof json.parameters === 'object' &&
      typeof (json.parameters as { migrate_to_chat_id?: unknown }).migrate_to_chat_id === 'number'
        ? String((json.parameters as { migrate_to_chat_id: number }).migrate_to_chat_id)
        : null;

    // Group -> supergroup migrations return migrate_to_chat_id. Retry immediately to avoid dropped alerts.
    if (description.includes('group chat was upgraded to a supergroup chat') && migrateTo) {
      console.warn(
        `[telegram-admin] chat migrated; retrying with chat_id=${migrateTo}. ` +
          'Update TELEGRAM_ADMIN_CHAT_ID secret to this value.'
      );
      res = await sendPayload(migrateTo);
      json = await parseResponse(res);
      if (res.ok && json?.ok) return { ok: true };
    }

    const desc = String(json?.description ?? res.statusText ?? description);
    console.error('[telegram-admin] sendMessage failed:', desc);
    return { ok: false, error: desc };
  }
  return { ok: true };
}

async function loadAdminSettings(propertyId?: string): Promise<TelegramAdminSettings | null> {
  try {
    const row = await DatabaseService.getTelegramAdminSettings(propertyId);
    if (!row) return null;
    return row as unknown as TelegramAdminSettings;
  } catch (e) {
    console.error('[telegram-admin] load settings:', e);
    return null;
  }
}

async function hasNotificationLogEntry(
  bookingId: string,
  notificationType: AdminNotificationLogType,
  hourBucket: string
): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data, error } = await supabase
    .from('telegram_admin_notification_log')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('notification_type', notificationType)
    .eq('hour_bucket', hourBucket)
    .maybeSingle();
  if (error) {
    console.error('[telegram-admin] dedupe lookup:', error);
    return false;
  }
  return !!data;
}

async function recordNotificationLog(
  bookingId: string,
  notificationType: AdminNotificationLogType,
  hourBucket: string
): Promise<{ ok: boolean; constraintRejected?: boolean }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { error } = await supabase.from('telegram_admin_notification_log').insert({
    booking_id: bookingId,
    notification_type: notificationType,
    hour_bucket: hourBucket,
  });
  if (error?.code === '23505') return { ok: true };
  if (error?.code === '23514') {
    console.error(
      '[telegram-admin] notification_type rejected by DB check — deploy migration ' +
        '20260705120000_telegram_admin_new_booking_hourly.sql and ' +
        '20260721140000_telegram_admin_balance_receipt_hourly_fix.sql',
      error
    );
    return { ok: false, constraintRejected: true };
  }
  if (error) {
    console.error('[telegram-admin] record hourly send:', error);
    return { ok: false };
  }
  return { ok: true };
}

async function sendAdminTemplateForBooking(
  template: string,
  booking: BookingRow
): Promise<{ ok: boolean; error?: string }> {
  const text = applyPlaceholders(template, buildAdminBookingPlaceholders(booking));
  const unresolved = text.match(/\{\{[^}]+\}\}/g);
  if (unresolved?.length) {
    console.warn('[telegram-admin] unresolved placeholders:', unresolved.join(', '));
  }
  return sendAdminTelegramMessage(text, propertyIdFromRow(booking));
}

export type AdminNotifySkip =
  'disabled' | 'notify_off' | 'missing_env' | 'send_failed' | 'no_settings' | 'dedupe';

/** After a brand-new guest submission row is inserted. */
export async function notifyTelegramAdminNewBooking(
  booking: BookingRow,
  opts?: { force?: boolean }
): Promise<{ sent: boolean; skip?: AdminNotifySkip; telegramError?: string }> {
  const settings = await loadAdminSettings(propertyIdFromRow(booking));
  if (!settings) return { sent: false, skip: 'no_settings' };
  if (!opts?.force && (!settings.enabled || !settings.notify_on_new_booking)) {
    return { sent: false, skip: !settings.enabled ? 'disabled' : 'notify_off' };
  }
  const creds = await resolveAdminTelegramCredentials(propertyIdFromRow(booking));
  if (!creds.ok) return { sent: false, skip: 'missing_env', telegramError: creds.error };

  const r = await sendAdminTemplateForBooking(settings.new_booking_template, booking);
  if (!r.ok) {
    return { sent: false, skip: 'send_failed', telegramError: r.error };
  }
  const bookingId = String(booking.id ?? '').trim();
  if (bookingId) {
    await recordNotificationLog(bookingId, 'new_booking', manilaHourBucket());
  }
  return { sent: true };
}

/** After guest submits SD refund form (transition to PENDING_SD_REFUND). */
export async function notifyTelegramAdminSdFormSubmitted(
  booking: BookingRow,
  opts?: { force?: boolean }
): Promise<{ sent: boolean; skip?: AdminNotifySkip; telegramError?: string }> {
  const settings = await loadAdminSettings(propertyIdFromRow(booking));
  if (!settings) return { sent: false, skip: 'no_settings' };
  if (!opts?.force && (!settings.enabled || !settings.notify_on_sd_form_submitted)) {
    return { sent: false, skip: !settings.enabled ? 'disabled' : 'notify_off' };
  }
  const creds = await resolveAdminTelegramCredentials(propertyIdFromRow(booking));
  if (!creds.ok) return { sent: false, skip: 'missing_env', telegramError: creds.error };

  const r = await sendAdminTemplateForBooking(settings.sd_form_submitted_template, booking);
  if (!r.ok) {
    return { sent: false, skip: 'send_failed', telegramError: r.error };
  }
  return { sent: true };
}

/** After admin uploads a guest balance payment receipt. */
export async function notifyTelegramAdminBalanceReceiptUploaded(
  booking: BookingRow,
  opts?: { force?: boolean }
): Promise<{ sent: boolean; skip?: AdminNotifySkip; telegramError?: string }> {
  const settings = await loadAdminSettings(propertyIdFromRow(booking));
  if (!settings) return { sent: false, skip: 'no_settings' };
  if (
    !opts?.force &&
    (!settings.enabled || settings.notify_on_balance_receipt_uploaded === false)
  ) {
    return {
      sent: false,
      skip: !settings.enabled ? 'disabled' : 'notify_off',
    };
  }
  const creds = await resolveAdminTelegramCredentials(propertyIdFromRow(booking));
  if (!creds.ok) return { sent: false, skip: 'missing_env', telegramError: creds.error };

  const bookingId = String(booking.id ?? '').trim();
  const receiptUrl = String(booking.guest_balance_payment_receipt_url ?? '').trim();
  const dedupeKey = receiptUploadDedupeKey(receiptUrl);
  if (
    !opts?.force &&
    bookingId &&
    receiptUrl &&
    (await hasNotificationLogEntry(bookingId, 'balance_receipt_uploaded', dedupeKey))
  ) {
    return { sent: false, skip: 'dedupe' };
  }

  const template =
    String(settings.balance_receipt_uploaded_template ?? '').trim() ||
    DEFAULT_BALANCE_RECEIPT_UPLOADED_TEMPLATE;
  const r = await sendAdminTemplateForBooking(template, booking);
  if (!r.ok) {
    return { sent: false, skip: 'send_failed', telegramError: r.error };
  }
  if (bookingId && receiptUrl) {
    await recordNotificationLog(bookingId, 'balance_receipt_uploaded', dedupeKey);
  }
  return { sent: true };
}

export type AdminHourlyCronResult = {
  sent: boolean;
  mode: 'sent' | 'disabled' | 'no_env' | 'no_settings' | 'nothing_due' | 'error';
  hourBucket?: string;
  newBookingSent?: number;
  pendingDocsSent?: number;
  balanceReceiptSent?: number;
  sdRefundPendingSent?: number;
  matchedNewBooking?: number;
  matchedPendingDocs?: number;
  matchedBalanceReceipt?: number;
  matchedSdRefundPending?: number;
  skippedDedupe?: number;
  detail?: string;
};

export async function runAdminHourlyAlerts(opts?: {
  force?: boolean;
  propertyId?: string;
}): Promise<
  AdminHourlyCronResult & { properties?: Array<AdminHourlyCronResult & { propertyId: string }> }
> {
  if (!opts?.propertyId) {
    const propertyIds = await listAllPropertyIds();
    const properties: Array<AdminHourlyCronResult & { propertyId: string }> = [];
    for (const propertyId of propertyIds) {
      const result = await runAdminHourlyAlerts({ ...opts, propertyId });
      properties.push({ propertyId, ...result });
    }
    return {
      sent: properties.some((p) => p.sent),
      mode: properties.some((p) => p.sent) ? 'sent' : 'nothing_due',
      properties,
    };
  }

  const settings = await loadAdminSettings(opts.propertyId);
  if (!settings) {
    return { sent: false, mode: 'no_settings', detail: 'no_settings_row' };
  }
  if (!opts?.force && !settings.enabled) {
    return { sent: false, mode: 'disabled' };
  }
  const creds = await resolveAdminTelegramCredentials(opts.propertyId);
  if (!creds.ok) {
    return { sent: false, mode: 'no_env', detail: creds.error };
  }

  const todayYmd = manilaTodayYmd();
  const hourBucket = manilaHourBucket();
  const now = nowManila();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  // All four `bookingNeeds*HourlyAlert` checks below require a non-CANCELLED,
  // non-COMPLETED status (PENDING_REVIEW/_DOCUMENTS/_GAF/_PARKING_REQUEST/_PET_REQUEST,
  // READY_FOR_CHECKIN, or PENDING_SD_REFUND) — a COMPLETED booking can never match any
  // of them, so excluding it in SQL is behavior-preserving and keeps this hourly,
  // per-property cron from re-fetching a property's entire completed booking history
  // every run (Phase 10.5 audit, doc 10). The duplicate `.neq('status', 'CANCELLED')`
  // was a harmless pre-existing no-op, folded into one call.
  const { data: rows, error } = await supabase
    .from('guest_submissions')
    .select('*')
    .eq('property_id', opts.propertyId)
    .neq('status', 'CANCELLED')
    .neq('status', 'COMPLETED');

  if (error) {
    console.error('[telegram-admin] query bookings:', error);
    return { sent: false, mode: 'error', detail: error.message };
  }

  let newBookingSent = 0;
  let pendingDocsSent = 0;
  let balanceReceiptSent = 0;
  let sdRefundPendingSent = 0;
  let matchedNewBooking = 0;
  let matchedPendingDocs = 0;
  let matchedBalanceReceipt = 0;
  let matchedSdRefundPending = 0;
  let skippedDedupe = 0;
  let dedupeMigrationMissing = false;
  const errors: string[] = [];

  async function sendHourlyAlert(
    booking: BookingRow,
    id: string,
    enabled: boolean,
    needsAlert: boolean,
    template: string,
    notificationType: AdminHourlyNotificationType
  ): Promise<boolean> {
    if (!needsAlert) return false;
    if (notificationType === 'new_booking') matchedNewBooking++;
    else if (notificationType === 'pending_docs') matchedPendingDocs++;
    else if (notificationType === 'balance_receipt') matchedBalanceReceipt++;
    else if (notificationType === 'sd_refund_pending') matchedSdRefundPending++;

    if (!opts?.force && !enabled) return false;

    if (!opts?.force && (await hasNotificationLogEntry(id, notificationType, hourBucket))) {
      skippedDedupe++;
      return false;
    }
    const r = await sendAdminTemplateForBooking(template, booking);
    if (!r.ok) {
      if (r.error) errors.push(`${notificationType}:${id}:${r.error}`);
      return false;
    }
    if (!opts?.force) {
      const recorded = await recordNotificationLog(id, notificationType, hourBucket);
      if (recorded.constraintRejected) dedupeMigrationMissing = true;
    }
    return true;
  }

  for (const booking of rows ?? []) {
    const id = String(booking.id ?? '');
    if (!id) continue;

    if (
      await sendHourlyAlert(
        booking,
        id,
        settings.notify_on_new_booking,
        bookingNeedsNewBookingHourlyAlert(booking),
        settings.new_booking_template,
        'new_booking'
      )
    ) {
      newBookingSent++;
    }

    if (
      await sendHourlyAlert(
        booking,
        id,
        settings.notify_pending_docs_hourly,
        bookingNeedsPendingDocsHourlyAlert(booking, todayYmd),
        settings.pending_docs_template,
        'pending_docs'
      )
    ) {
      pendingDocsSent++;
    }

    if (
      await sendHourlyAlert(
        booking,
        id,
        settings.notify_balance_receipt_hourly,
        bookingNeedsBalanceReceiptHourlyAlert(booking, todayYmd, now),
        resolveBalanceReceiptHourlyTemplate(settings.balance_receipt_template),
        'balance_receipt'
      )
    ) {
      balanceReceiptSent++;
    }

    if (
      await sendHourlyAlert(
        booking,
        id,
        settings.notify_sd_refund_pending_hourly,
        bookingNeedsSdRefundPendingHourlyAlert(booking),
        settings.sd_refund_pending_template,
        'sd_refund_pending'
      )
    ) {
      sdRefundPendingSent++;
    }
  }

  const totalSent = newBookingSent + pendingDocsSent + balanceReceiptSent + sdRefundPendingSent;
  const totalMatched =
    matchedNewBooking + matchedPendingDocs + matchedBalanceReceipt + matchedSdRefundPending;

  const disabledToggles: string[] = [];
  if (!settings.notify_on_new_booking) disabledToggles.push('notify_on_new_booking');
  if (!settings.notify_pending_docs_hourly) disabledToggles.push('notify_pending_docs_hourly');
  if (!settings.notify_balance_receipt_hourly)
    disabledToggles.push('notify_balance_receipt_hourly');
  if (!settings.notify_sd_refund_pending_hourly)
    disabledToggles.push('notify_sd_refund_pending_hourly');

  return {
    sent: totalSent > 0,
    mode: totalSent > 0 ? 'sent' : 'nothing_due',
    hourBucket,
    newBookingSent,
    pendingDocsSent,
    balanceReceiptSent,
    sdRefundPendingSent,
    matchedNewBooking,
    matchedPendingDocs,
    matchedBalanceReceipt,
    matchedSdRefundPending,
    skippedDedupe,
    detail: errors.length
      ? errors.join('; ')
      : dedupeMigrationMissing
        ? 'deploy_migration_20260705120000_for_new_booking_hourly_dedupe'
        : totalMatched === 0
          ? 'no_bookings_matched_any_scenario'
          : totalSent === 0 && skippedDedupe > 0
            ? 'all_due_alerts_already_sent_this_hour'
            : totalSent === 0 && totalMatched > 0
              ? disabledToggles.length
                ? `matched_${totalMatched}_bookings_but_toggles_off:${disabledToggles.join(',')}`
                : 'matched_bookings_but_send_failed'
              : undefined,
  };
}

export type AdminDraftRenderResult = {
  renderedText?: string;
  placeholders?: Record<string, string>;
  previewGuestName?: string;
  error?: string;
};

/** In-app preview: resolve placeholders from a matching booking without sending Telegram. */
export async function renderAdminDraftPreview(
  template: string,
  scenario:
    AdminHourlyNotificationType | 'new_booking' | 'sd_form_submitted' | 'balance_receipt_uploaded'
): Promise<AdminDraftRenderResult> {
  const trimmed = template.trim();
  if (!trimmed) return { error: 'empty_message' };

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data: rows, error } = await supabase
    .from('guest_submissions')
    .select('*')
    .neq('status', 'CANCELLED')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return { error: error.message };
  }

  const todayYmd = manilaTodayYmd();
  const now = nowManila();
  let booking: BookingRow | undefined;

  if (scenario === 'new_booking') {
    booking = (rows ?? []).find((r) => bookingNeedsNewBookingHourlyAlert(r));
  } else if (scenario === 'sd_form_submitted') {
    booking = (rows ?? []).find(
      (r) => String(r.status) === 'PENDING_SD_REFUND' && r.sd_refund_method
    );
  } else if (scenario === 'pending_docs') {
    booking = (rows ?? []).find((r) => bookingNeedsPendingDocsHourlyAlert(r, todayYmd));
  } else if (scenario === 'balance_receipt') {
    booking = (rows ?? []).find((r) => bookingNeedsBalanceReceiptHourlyAlert(r, todayYmd, now));
  } else if (scenario === 'balance_receipt_uploaded') {
    booking = (rows ?? []).find((r) => String(r.guest_balance_payment_receipt_url ?? '').trim());
  } else if (scenario === 'sd_refund_pending') {
    booking = (rows ?? []).find((r) => bookingNeedsSdRefundPendingHourlyAlert(r));
  }

  if (!booking) {
    return {
      error: `No booking matches scenario "${scenario}" for preview. Try to execute Run hourly cron.`,
    };
  }

  const placeholders = buildAdminBookingPlaceholders(booking);
  const renderedText = applyPlaceholders(trimmed, placeholders);
  return {
    renderedText,
    placeholders,
    previewGuestName: String(booking.primary_guest_name ?? 'Guest'),
  };
}

export async function sendAdminDraftPreview(
  template: string,
  scenario:
    AdminHourlyNotificationType | 'new_booking' | 'sd_form_submitted' | 'balance_receipt_uploaded',
  propertyId?: string,
  credentialScope?: TelegramAssetScopeRef | string | null
): Promise<{
  sent: boolean;
  error?: string;
  messageCharCount?: number;
  previewGuestName?: string;
}> {
  const rendered = await renderAdminDraftPreview(template, scenario);
  if (rendered.error || !rendered.renderedText) {
    return { sent: false, error: rendered.error ?? 'empty_message' };
  }

  const r = await sendAdminTelegramMessage(rendered.renderedText, credentialScope ?? propertyId);
  if (!r.ok) return { sent: false, error: r.error ?? 'send_failed' };

  return {
    sent: true,
    messageCharCount: rendered.renderedText.length,
    previewGuestName: rendered.previewGuestName,
  };
}

export function verifyAdminCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'TELEGRAM_ADMIN_CRON_SECRET',
    headerName: 'x-telegram-cron-secret',
  });
}

export async function verifyAdminTelegramEnv(
  scope?: TelegramAssetScopeRef | string | null,
  overrides?: { botToken?: string; chatId?: string }
): Promise<{
  credentials: {
    tokenConfigured: boolean;
    chatIdConfigured: boolean;
    normalizedChatId?: string;
    normalizeError?: string;
  };
  getMe: { ok: boolean; username?: string; error?: string };
  getChat: { ok: boolean; type?: string; title?: string; error?: string };
}> {
  const { verifyPropertyTelegramChannel } = await import('./propertyTelegramCredentials.ts');
  return verifyPropertyTelegramChannel('admin', scope, overrides);
}

import { normalizeTelegramTemplateText } from './telegramTemplateNormalize.ts';

export function serializeAdminSettings(row: TelegramAdminSettings) {
  return {
    enabled: row.enabled,
    notifyOnNewBooking: row.notify_on_new_booking,
    notifyOnSdFormSubmitted: row.notify_on_sd_form_submitted,
    notifyOnBalanceReceiptUploaded: row.notify_on_balance_receipt_uploaded ?? true,
    notifyPendingDocsHourly: row.notify_pending_docs_hourly,
    notifyBalanceReceiptHourly: row.notify_balance_receipt_hourly,
    notifySdRefundPendingHourly: row.notify_sd_refund_pending_hourly,
    newBookingTemplate: normalizeTelegramTemplateText(row.new_booking_template),
    pendingDocsTemplate: normalizeTelegramTemplateText(row.pending_docs_template),
    balanceReceiptTemplate: normalizeTelegramTemplateText(row.balance_receipt_template),
    balanceReceiptUploadedTemplate: normalizeTelegramTemplateText(
      row.balance_receipt_uploaded_template ?? DEFAULT_BALANCE_RECEIPT_UPLOADED_TEMPLATE
    ),
    sdFormSubmittedTemplate: normalizeTelegramTemplateText(row.sd_form_submitted_template),
    sdRefundPendingTemplate: normalizeTelegramTemplateText(row.sd_refund_pending_template),
    hourlyUtcCronPreview: '0 * * * *',
    placeholdersReference: ADMIN_KNOWN_PLACEHOLDERS.map((p) => `{{${p}}}`),
    scenarios: [
      {
        id: 'new_booking',
        label: 'New booking',
        trigger: 'Instant on submit, then hourly while Pending Review',
        type: 'hourly',
      },
      {
        id: 'pending_docs',
        label: 'Pending documents on check-in day',
        trigger: 'Hourly on check-in day while GAF, parking, or pet docs wait',
        type: 'hourly',
      },
      {
        id: 'balance_receipt',
        label: 'Balance receipt needed',
        trigger: 'Hourly during stay until balance receipt is uploaded',
        type: 'hourly',
      },
      {
        id: 'balance_receipt_uploaded',
        label: 'Balance receipt uploaded',
        trigger: 'Instant when admin uploads a guest balance payment receipt',
        type: 'event',
      },
      {
        id: 'sd_form_submitted',
        label: 'SD form submitted',
        trigger: 'Instant when guest completes the SD refund form',
        type: 'event',
      },
      {
        id: 'sd_refund_pending',
        label: 'SD refund awaiting processing',
        trigger: 'Hourly while Pending SD Refund with guest details on file',
        type: 'hourly',
      },
    ],
  };
}

export async function ensureAdminSettingsRow(): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  const { data, error } = await supabase
    .from('telegram_admin_settings')
    .select('id')
    .eq('id', 1)
    .maybeSingle();
  if (error) {
    throw new Error(
      `telegram_admin_settings query failed (${error.code ?? 'no-code'}: ${error.message}). ` +
        `Deploy migration 20260702120000_telegram_admin_settings.sql.`
    );
  }
  if (data) return;

  const { error: insertError } = await supabase.from('telegram_admin_settings').insert({
    id: 1,
    enabled: false,
  });
  if (insertError) {
    throw new Error(`Could not seed telegram_admin_settings: ${insertError.message}`);
  }
}
