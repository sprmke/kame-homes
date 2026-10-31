export type TelegramPreviewSampleSet =
  'admin' | 'staff' | 'marketing' | 'finance' | 'maintenance' | 'parking' | 'chat';

const SHARED_STAY_SAMPLES: Record<string, string> = {
  check_in_date: 'June 18, 2026',
  check_out_date: 'June 20, 2026',
  check_in_time: '2:00 PM',
  check_out_time: '11:00 AM',
  nights: '2',
  pax: '2',
  primary_guest_name: 'Juan Dela Cruz',
  guest_phone: '09171234567',
  total_guest_balance: '₱3,599',
};

const ADMIN_SAMPLES: Record<string, string> = {
  ...SHARED_STAY_SAMPLES,
  guest_email: 'juandelacruz@gmail.com',
  guest_address: 'Quezon City, Metro Manila',
  guest_facebook_name: 'Kyle Soriano',
  booking_source: 'Airbnb',
  tower_and_unit_number: 'Monaco 2604',
  urgent_notice: '🚨 URGENT: Same-day check-in!\nThis request requires immediate attention.\n\n',
  need_parking: 'Yes ‼️',
  has_pets: 'No',
  surprise_decor: 'Yes ‼️',
  status: 'PENDING_REVIEW',
  status_label: 'Pending Review',
  pending_docs_list: 'GAF, Parking',
  sd_refund_method: 'Same phone (GCash)',
  sd_refund_bank: 'GCash',
  sd_refund_account_name: '-',
  sd_refund_account_number: '09171234567',
  sd_refund_payout_phone: '09171234567',
  sd_refund_details: 'GCash (on-file phone): 09171234567',
  sd_refund_guest_feedback: 'Great stay. Thank you!',
  dp_receipt_ai_verdict: 'Likely valid',
  dp_receipt_ai_summary: 'Amount ₱1,500 matches down payment; sender name matches guest.',
  balance_receipt_ai_verdict: 'Valid',
  balance_receipt_ai_summary: 'Balance receipt shows ₱3,599 paid to host GCash.',
  booking_link: 'https://kamehomes.space/bookings/00000000-0000-4000-8000-000000000001',
};

const STAFF_SAMPLES: Record<string, string> = {
  ...SHARED_STAY_SAMPLES,
  decor_status: '🎉 Yes',
  pet_status: 'No',
  has_decor: 'Yes',
  has_pets: 'No',
  decor_flag: '🎉 Has decor',
  pet_flag: '',
  special_requests: 'Late check-in around 8 PM',
  next_bookings: [
    'Jun 19: 2:00 PM-11:00 AM, 2pax, 🎉 Has decor',
    'Jun 20: 2:00 PM-11:00 AM, 4pax',
    'Jun 21: No bookings',
  ].join('\n'),
};

/** Mirror `calendarAvailabilityManila.ts` + `telegramMarketing.ts` placeholder output. */
const MARKETING_SAMPLES: Record<string, string> = {
  /** `formatAvailableDatesHuman` — same month: "June 18, 19, 20, 21" */
  available_dates: 'June 18, 19, 20, 21',
  /** `formatMonthName` — long month name only (no year) */
  month_name: 'June',
  /** `formatDatesListForMonth` — comma-separated day numbers only */
  dates_list: '18, 19, 20, 21',
  /** `formatUrgencyText` — nearest free check-in: today, | tomorrow, | this */
  urgency_text: 'this',
  /** `formatCancellationDatesHuman` — check-in Jun 18, check-out Jun 20 → nights 18–19 */
  cancellation_dates: 'June 18–19',
};

const FINANCE_SAMPLES: Record<string, string> = {
  label: 'Monthly HOA dues',
  amount: '₱4,500.00',
  category: 'HOA',
  due_date: '06/20/2026',
  occurred_on: '06/01/2026',
  days_until_due: '3',
  notes: 'Pay via BPI transfer',
  kind: 'expense',
};

const MAINTENANCE_SAMPLES: Record<string, string> = {
  label: 'AC filter replacement',
  category: 'Appliance',
  due_date: '06/20/2026',
  scheduled_on: '06/20/2026',
  days_until_due: '3',
  notes: 'Replace filters in both units',
};

const PARKING_SAMPLES: Record<string, string> = {
  slot_label: 'ML2S26',
  check_in_date: '07-20-2026',
  guest_name: 'Juan Dela Cruz',
  amount: '₱1,200',
};

const CHAT_SAMPLES: Record<string, string> = {
  guest_name: 'Juan Dela Cruz',
  property_name: 'Sample Property',
  chat_source: 'Web chat',
  chat_content: 'Hi! Is June 18–20 still available for 2 guests?',
  attachment_summary: '1 image',
  attachment_line: '\n📎 Photo',
  conversation_link:
    'https://kamehomes.space/org/demo/property/demo-unit/inbox?conversationId=00000000-0000-4000-8000-000000000001&platform=web',
  check_in_date: 'June 18, 2026',
  check_out_date: 'June 20, 2026',
  sent_at: 'Jun 15, 2026, 3:42 PM',
};

const SAMPLE_SETS: Record<TelegramPreviewSampleSet, Record<string, string>> = {
  admin: ADMIN_SAMPLES,
  staff: STAFF_SAMPLES,
  marketing: MARKETING_SAMPLES,
  finance: FINANCE_SAMPLES,
  maintenance: MAINTENANCE_SAMPLES,
  parking: PARKING_SAMPLES,
  chat: CHAT_SAMPLES,
};

export function getTelegramPreviewSamples(set: TelegramPreviewSampleSet): Record<string, string> {
  return { ...SAMPLE_SETS[set] };
}
