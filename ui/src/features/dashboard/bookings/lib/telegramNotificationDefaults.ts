/**
 * Factory defaults for Telegram notification settings UI reset actions.
 * Keep in sync with `supabase/functions/_shared/propertySettingsSeed.ts` and
 * module-specific `*_DEFAULT_*_TEMPLATE` constants on the server.
 */

import { FINANCE_DEFAULT_REMINDER_TEMPLATE } from '@/features/dashboard/finance/lib/financeReminderTemplate';
import { MAINTENANCE_DEFAULT_REMINDER_TEMPLATE } from '@/features/dashboard/maintenance/lib/maintenanceReminderTemplate';

export type ManilaTimeSlot = { hour: number; minute: number };

export const DEFAULT_STAFF_DAILY_SUMMARY_TIME: ManilaTimeSlot = {
  hour: 8,
  minute: 0,
};

export const DEFAULT_FINANCE_DAILY_CHECK_TIME: ManilaTimeSlot = {
  hour: 9,
  minute: 0,
};

export const DEFAULT_MAINTENANCE_DAILY_CHECK_TIME: ManilaTimeSlot = {
  hour: 9,
  minute: 0,
};

export const DEFAULT_MARKETING_REMINDER_SLOTS: ManilaTimeSlot[] = [
  { hour: 10, minute: 0 },
  { hour: 15, minute: 0 },
  { hour: 21, minute: 0 },
];

export const DEFAULT_MARKETING_URGENCY_DAYS = 5;
export const DEFAULT_MARKETING_NEW_BOOKING_DATES_LIMIT = 8;

export const STAFF_TEMPLATE_DEFAULTS = {
  dailySummaryTemplate:
    "📋 Today's Booking\n\n" +
    'Booking Details\n{{check_in_date}} - {{check_out_date}}\n{{check_in_time}} - {{check_out_time}}\n{{nights}} night/s, {{pax}} pax\n\n' +
    'Guest Details\n{{primary_guest_name}}, {{guest_phone}}\n\n' +
    'Additional Details\n{{decor_status}}, {{pet_status}}\nSpecial Requests: {{special_requests}}\nTotal guest balance: {{total_guest_balance}}\n\n' +
    'Next Bookings\n{{next_bookings}}',
  dailySummaryNoBookingsTemplate:
    '📋 No bookings for today.\n\n' +
    'Kindly do a general cleaning, especially the following items:\n\n' +
    '* Clean the aircon filter\n' +
    '* Clean the tower fan\n' +
    '* Clean behind the sofa\n' +
    '* Clean the exhaust fan\n' +
    '* Remove dust and cobwebs from the ceiling\n' +
    '* Clean the balcony (including underneath the grass)\n' +
    '* Clean the bathroom tiles & shower head\n' +
    '* Clean the walls and cabinets\n\n' +
    'Next Bookings\n{{next_bookings}}',
  sameDayCheckinTemplate:
    '🚨 Same-Day Check-In Alert\n\n' +
    'Guest: {{primary_guest_name}}\n' +
    'Phone: {{guest_phone}}\n\n' +
    'Check-in: {{check_in_date}} at {{check_in_time}}\n' +
    'Check-out: {{check_out_date}} at {{check_out_time}}\n' +
    '{{nights}} night/s · {{pax}} pax\n\n' +
    'Has decor: {{decor_status}}\n' +
    'Has pets: {{pet_status}}\n' +
    'Special requests: {{special_requests}}\n' +
    'Balance due: {{total_guest_balance}}',
} as const;

export const MARKETING_TEMPLATE_DEFAULTS = {
  dailyDefaultTemplate: 'Pa up and share po ka-uppers! Salamuch!',
  dailyUrgencyTemplate:
    'Available {{urgency_text}} {{month_name}} {{dates_list}}. Book now and get huge last minute discount!',
  newBookingTemplate:
    'Available next dates: {{month_name}} {{dates_list}}. Book now and get huge discount for this month!',
  cancellationTemplate:
    'Available this {{cancellation_dates}} due to guest cancellation! Book now and get huge discount for this specific date/s!',
} as const;

export const ADMIN_TEMPLATE_DEFAULTS = {
  newBookingTemplate:
    '🆕 New Booking Request\n\nGuest: {{primary_guest_name}}\nPhone: {{guest_phone}}\nDates: {{check_in_date}} → {{check_out_date}}\n\n{{booking_link}}',
  pendingDocsTemplate:
    '⚠️ Pending Documents: Check-in Today\n\nGuest: {{primary_guest_name}}\nCheck-in: {{check_in_date}} at {{check_in_time}}\nStill needed: {{pending_docs_list}}\nStatus: {{status_label}}\n\n{{booking_link}}',
  balanceReceiptTemplate:
    '💳 Balance Receipt Needed\n\nGuest: {{primary_guest_name}}\nBalance due: {{total_guest_balance}}\n\nUpload payment receipt now:\n{{booking_link}}',
  balanceReceiptUploadedTemplate:
    '💳 Balance Receipt Uploaded\n\nGuest: {{primary_guest_name}}\nBalance due: {{total_guest_balance}}\n\nBalance receipt AI\nVerdict: {{balance_receipt_ai_verdict}}\n{{balance_receipt_ai_summary}}\n\n{{booking_link}}',
  sdFormSubmittedTemplate:
    '📝 SD Refund Form Submitted\n\nGuest: {{primary_guest_name}}\nMethod: {{sd_refund_method}}\nCheck-out: {{check_out_date}}\n\nRefund details:\n{{sd_refund_details}}\n\nProcess the refund now:\n{{booking_link}}',
  sdRefundPendingTemplate:
    '💰 SD Refund Pending Processing\n\nGuest: {{primary_guest_name}}\nMethod: {{sd_refund_method}}\n\nRefund details:\n{{sd_refund_details}}\n\nProcess the refund now:\n{{booking_link}}',
} as const;

export const FINANCE_TEMPLATE_DEFAULTS = {
  defaultReminderTemplate: FINANCE_DEFAULT_REMINDER_TEMPLATE,
} as const;

export const MAINTENANCE_TEMPLATE_DEFAULTS = {
  defaultReminderTemplate: MAINTENANCE_DEFAULT_REMINDER_TEMPLATE,
} as const;

export const CHAT_TEMPLATE_DEFAULTS = {
  newMessageTemplate:
    '💬 New guest chat\n\nProperty: {{property_name}}\nSource: {{chat_source}}\n\nGuest: {{guest_name}}\nMessage:\n{{chat_content}}\n{{attachment_line}}\n\nReply now:\n{{conversation_link}}',
} as const;
