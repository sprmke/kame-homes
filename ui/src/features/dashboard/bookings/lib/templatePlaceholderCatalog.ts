/**
 * Per-template placeholder lists for Property Templates + Telegram notifications.
 *
 * Philosophy: show every token that *can* be filled for that template at send/preview
 * time — prefer inclusive over minimal. Exclude only cross-domain tokens (e.g.
 * marketing calendar slots on staff alerts).
 */

import { placeholderLinesFromKeys } from '@/features/dashboard/bookings/lib/telegramPlaceholderGroups';

function uniqueKeys(...groups: readonly (readonly string[])[]): readonly string[] {
  return [...new Set(groups.flat())];
}

/** Plain field tokens shared across many property templates. */
const PROPERTY_GUEST_KEYS = [
  'primary_guest_name',
  'guest_name',
  'guest_phone',
  'guest_email',
  'guest_facebook_name',
] as const;

const PROPERTY_STAY_KEYS = [
  'check_in_date',
  'check_out_date',
  'check_in_time',
  'check_out_time',
  'nights',
  'pax',
  'tower_and_unit_number',
  'unit_number',
  'property_name',
] as const;

const PROPERTY_FLAG_KEYS = [
  'decor_status',
  'pet_status',
  'has_decor',
  'has_pets',
  'decor_flag',
  'pet_flag',
  'special_requests',
] as const;

const PROPERTY_PET_KEYS = ['pet_name', 'pet_type', 'pet_breed', 'pet_age'] as const;

const PROPERTY_VEHICLE_KEYS = [
  'car_brand_model',
  'car_color',
  'car_plate_number',
  'booking_vehicle_copy',
] as const;

const PROPERTY_PAYMENT_KEYS = ['total_guest_balance', 'security_deposit', 'sd_form_url'] as const;

const PROPERTY_GUEST_CONTACT_KEYS = [
  'facebook_page_url',
  'airbnb_url',
  'contact_name',
  'contact_phone',
  'contact_email',
  'social_contact_mentions',
] as const;

const PROPERTY_BOOKING_META_KEYS = ['booking_source', 'booking_link'] as const;

/** Guest-facing links (only filled on guest emails). */
const PROPERTY_GUEST_LINK_KEYS = ['trip_url'] as const;

const PROPERTY_SECTION_KEYS = [
  'urgent_notice',
  'update_notice',
  'pet_details_section',
  'pet_attachments_section',
  'parking_reply_callout_section',
  'email_signature_section',
  'booking_acknowledgement_flow_section',
  'ready_for_checkin_booking_summary_section',
  'ready_for_checkin_contact_section',
  'stay_guide_cta_section',
  'new_booking_detail_tables',
  'downpayment_receipt_ai_section',
  'booking_link_cta',
  'document_reminders_section',
  'payment_breakdown_section',
  'gcash_payment_section',
  'sd_refund_checklist_section',
  'sd_refund_details_section',
  'booking_vehicle_copy',
] as const;

/** Block-level placeholders — each must sit on its own `<p>` line in email templates. */
export const PROPERTY_BLOCK_PLACEHOLDER_KEYS = PROPERTY_SECTION_KEYS;

export function isBlockLevelPropertyPlaceholder(key: string): boolean {
  return (PROPERTY_BLOCK_PLACEHOLDER_KEYS as readonly string[]).includes(key);
}

export function placeholderTokenForKey(key: string): string {
  return `{{${key}}}`;
}

/** Guest + stay + flags — most guest-facing copy. */
const PROPERTY_EMAIL_CORE = uniqueKeys(PROPERTY_GUEST_KEYS, PROPERTY_STAY_KEYS, PROPERTY_FLAG_KEYS);

/** Core + payment fields. */
const PROPERTY_EMAIL_WITH_PAYMENT = uniqueKeys(PROPERTY_EMAIL_CORE, PROPERTY_PAYMENT_KEYS);

/** Standard property docs (house rules, instructions). */
const PROPERTY_STANDARD_KEYS = uniqueKeys(PROPERTY_EMAIL_CORE);

/** Full catalog for custom templates. */
const PROPERTY_CUSTOM_TEMPLATE_KEYS = uniqueKeys(
  PROPERTY_EMAIL_CORE,
  PROPERTY_PET_KEYS,
  PROPERTY_VEHICLE_KEYS,
  PROPERTY_PAYMENT_KEYS,
  PROPERTY_BOOKING_META_KEYS,
  PROPERTY_GUEST_CONTACT_KEYS,
  PROPERTY_SECTION_KEYS
);

/** Placeholder keys allowed per property template key. */
export const PROPERTY_PLACEHOLDER_KEYS_BY_TEMPLATE: Record<string, readonly string[]> = {
  'house-rules': PROPERTY_STANDARD_KEYS,
  'check-in-instructions': uniqueKeys(PROPERTY_STANDARD_KEYS, PROPERTY_PAYMENT_KEYS),
  'check-out-instructions': uniqueKeys(PROPERTY_STANDARD_KEYS, PROPERTY_PAYMENT_KEYS),
  'parking-reminders': uniqueKeys(PROPERTY_STANDARD_KEYS, PROPERTY_VEHICLE_KEYS),
  'email-gaf-request': uniqueKeys(PROPERTY_EMAIL_CORE, PROPERTY_BOOKING_META_KEYS, [
    'urgent_notice',
    'update_notice',
    'email_signature_section',
  ]),
  'email-pet-request': uniqueKeys(
    PROPERTY_EMAIL_CORE,
    PROPERTY_PET_KEYS,
    PROPERTY_BOOKING_META_KEYS,
    [
      'urgent_notice',
      'update_notice',
      'pet_details_section',
      'pet_attachments_section',
      'email_signature_section',
    ]
  ),
  'email-parking-request': uniqueKeys(
    PROPERTY_EMAIL_CORE,
    PROPERTY_VEHICLE_KEYS,
    PROPERTY_BOOKING_META_KEYS,
    [
      'urgent_notice',
      'update_notice',
      'booking_vehicle_copy',
      'parking_reply_callout_section',
      'email_signature_section',
    ]
  ),
  'email-new-booking-request': uniqueKeys(
    PROPERTY_EMAIL_CORE,
    PROPERTY_BOOKING_META_KEYS,
    PROPERTY_PAYMENT_KEYS,
    [
      'urgent_notice',
      'new_booking_detail_tables',
      'downpayment_receipt_ai_section',
      'booking_link_cta',
    ]
  ),
  'email-booking-acknowledgement': uniqueKeys(
    PROPERTY_EMAIL_CORE,
    PROPERTY_BOOKING_META_KEYS,
    PROPERTY_GUEST_CONTACT_KEYS,
    PROPERTY_GUEST_LINK_KEYS,
    ['booking_acknowledgement_flow_section', 'email_signature_section']
  ),
  'email-ready-for-checkin': uniqueKeys(
    PROPERTY_EMAIL_WITH_PAYMENT,
    PROPERTY_GUEST_CONTACT_KEYS,
    PROPERTY_GUEST_LINK_KEYS,
    [
      'ready_for_checkin_booking_summary_section',
      'document_reminders_section',
      'payment_breakdown_section',
      'gcash_payment_section',
      'stay_guide_cta_section',
      'ready_for_checkin_contact_section',
      'email_signature_section',
    ]
  ),
  'email-sd-refund-form-request': uniqueKeys(
    PROPERTY_EMAIL_WITH_PAYMENT,
    PROPERTY_GUEST_CONTACT_KEYS,
    PROPERTY_GUEST_LINK_KEYS,
    ['sd_refund_checklist_section', 'sd_refund_details_section']
  ),
};

export function propertyPlaceholderKeysForTemplate(
  templateKey: string,
  category: 'standard' | 'email' | 'custom'
): readonly string[] {
  if (category === 'custom') return PROPERTY_CUSTOM_TEMPLATE_KEYS;
  return PROPERTY_PLACEHOLDER_KEYS_BY_TEMPLATE[templateKey] ?? PROPERTY_CUSTOM_TEMPLATE_KEYS;
}

export function propertyPlaceholderLinesForTemplate(
  templateKey: string,
  category: 'standard' | 'email' | 'custom'
): string[] {
  return placeholderLinesFromKeys(propertyPlaceholderKeysForTemplate(templateKey, category));
}

/** Shared booking/guest tokens for Telegram booking alerts. */
const TELEGRAM_BOOKING_GUEST_STAY = [
  'primary_guest_name',
  'guest_name',
  'guest_phone',
  'guest_email',
  'guest_facebook_name',
  'guest_address',
  'check_in_date',
  'check_out_date',
  'check_in_time',
  'check_out_time',
  'nights',
  'pax',
  'tower_and_unit_number',
  'unit_number',
  'property_name',
  'booking_source',
  'booking_link',
] as const;

const TELEGRAM_BOOKING_FLAGS = [
  'decor_status',
  'pet_status',
  'has_decor',
  'has_pets',
  'decor_flag',
  'pet_flag',
  'need_parking',
  'surprise_decor',
  'special_requests',
  'pet_name',
  'pet_type',
  'pet_breed',
  'car_brand_model',
  'car_color',
  'car_plate_number',
] as const;

const TELEGRAM_BOOKING_CONTEXT = uniqueKeys(TELEGRAM_BOOKING_GUEST_STAY, TELEGRAM_BOOKING_FLAGS);

const TELEGRAM_PAYMENT_AI = [
  'total_guest_balance',
  'dp_receipt_ai_verdict',
  'dp_receipt_ai_summary',
  'balance_receipt_ai_verdict',
  'balance_receipt_ai_summary',
  'ai_stay_summary',
] as const;

const TELEGRAM_WORKFLOW = ['urgent_notice', 'status', 'status_label', 'pending_docs_list'] as const;

const TELEGRAM_SD_REFUND = [
  'sd_refund_method',
  'sd_refund_bank',
  'sd_refund_account_name',
  'sd_refund_account_number',
  'sd_refund_payout_phone',
  'sd_refund_details',
  'sd_refund_guest_feedback',
  'security_deposit',
] as const;

/** Telegram Staff — tab id → allowed placeholder keys. */
export const TELEGRAM_STAFF_PLACEHOLDERS_BY_TAB: Record<string, readonly string[]> = {
  daily_summary: uniqueKeys(TELEGRAM_BOOKING_CONTEXT, TELEGRAM_PAYMENT_AI, ['next_bookings']),
  daily_summary_no_bookings: ['next_bookings'],
  same_day_checkin: uniqueKeys(TELEGRAM_BOOKING_CONTEXT, TELEGRAM_PAYMENT_AI),
};

/** Telegram Operations (admin) — scenario id → keys. */
export const TELEGRAM_ADMIN_PLACEHOLDERS_BY_TAB: Record<string, readonly string[]> = {
  new_booking: uniqueKeys(TELEGRAM_BOOKING_CONTEXT, TELEGRAM_PAYMENT_AI, TELEGRAM_WORKFLOW),
  pending_docs: uniqueKeys(TELEGRAM_BOOKING_CONTEXT, TELEGRAM_WORKFLOW, TELEGRAM_PAYMENT_AI),
  balance_receipt: uniqueKeys(TELEGRAM_BOOKING_CONTEXT, TELEGRAM_PAYMENT_AI, TELEGRAM_WORKFLOW),
  balance_receipt_uploaded: uniqueKeys(
    TELEGRAM_BOOKING_CONTEXT,
    TELEGRAM_PAYMENT_AI,
    TELEGRAM_WORKFLOW
  ),
  sd_form_submitted: uniqueKeys(TELEGRAM_BOOKING_CONTEXT, TELEGRAM_SD_REFUND, TELEGRAM_WORKFLOW),
  sd_refund_pending: uniqueKeys(TELEGRAM_BOOKING_CONTEXT, TELEGRAM_SD_REFUND, TELEGRAM_WORKFLOW),
};

/** Telegram Marketing — tab id → keys. */
export const TELEGRAM_MARKETING_PLACEHOLDERS_BY_TAB: Record<string, readonly string[]> = {
  'tpl-daily-default': [],
  'tpl-daily-urgency': ['urgency_text', 'month_name', 'dates_list', 'available_dates'],
  'tpl-new': ['month_name', 'dates_list', 'available_dates'],
  'tpl-cancel': ['cancellation_dates', 'month_name', 'dates_list'],
};

/** Finance + maintenance — single template tabs. */
export const TELEGRAM_FINANCE_PLACEHOLDER_KEYS = [
  'label',
  'amount',
  'category',
  'due_date',
  'occurred_on',
  'days_until_due',
  'notes',
  'kind',
] as const;

export const TELEGRAM_MAINTENANCE_PLACEHOLDER_KEYS = [
  'label',
  'category',
  'due_date',
  'occurred_on',
  'scheduled_on',
  'days_until_due',
  'notes',
  'kind',
] as const;

export const TELEGRAM_CHAT_PLACEHOLDER_KEYS = [
  'guest_name',
  'property_name',
  'chat_source',
  'chat_content',
  'attachment_summary',
  'attachment_line',
  'conversation_link',
  'check_in_date',
  'check_out_date',
  'sent_at',
] as const;

export function telegramPlaceholderLinesByTab(
  map: Record<string, readonly string[]>
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(map).map(([tabId, keys]) => [tabId, placeholderLinesFromKeys(keys)])
  );
}
