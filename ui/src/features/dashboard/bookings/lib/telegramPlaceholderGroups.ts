export type TelegramPlaceholderItem = {
  token: string;
  description: string;
  example: string;
  group: string;
};

const GROUP_ORDER = [
  'Guest',
  'Stay',
  'Booking',
  'Chat',
  'Flags',
  'Sections',
  'Workflow',
  'Payments',
  'SD refund',
  'Contact',
  'Calendar',
  'Summary',
  'Other',
] as const;

type PlaceholderMeta = {
  group: (typeof GROUP_ORDER)[number];
  description: string;
  example: string;
};

/** Short labels + sample output — keep in sync with `telegramPreviewSamples.ts`. */
const PLACEHOLDER_META: Record<string, PlaceholderMeta> = {
  primary_guest_name: {
    group: 'Guest',
    description: 'Guest full name',
    example: 'Juan Dela Cruz',
  },
  guest_phone: {
    group: 'Guest',
    description: 'Phone number',
    example: '09171234567',
  },
  guest_email: {
    group: 'Guest',
    description: 'Email address',
    example: 'juandelacruz@gmail.com',
  },
  guest_address: {
    group: 'Guest',
    description: 'Home address',
    example: 'Quezon City, Metro Manila',
  },
  guest_facebook_name: {
    group: 'Guest',
    description: 'Guest display name',
    example: 'Kyle Soriano',
  },
  guest_name: {
    group: 'Guest',
    description: 'Guest display name',
    example: 'Jane Guest',
  },
  check_in_date: {
    group: 'Stay',
    description: 'Check-in date',
    example: 'June 18, 2026',
  },
  check_out_date: {
    group: 'Stay',
    description: 'Check-out date',
    example: 'June 20, 2026',
  },
  check_in_time: {
    group: 'Stay',
    description: 'Check-in time',
    example: '2:00 PM',
  },
  check_out_time: {
    group: 'Stay',
    description: 'Check-out time',
    example: '11:00 AM',
  },
  nights: {
    group: 'Stay',
    description: 'Night count',
    example: '2',
  },
  pax: {
    group: 'Stay',
    description: 'Guest count',
    example: '2',
  },
  booking_source: {
    group: 'Booking',
    description: 'Booking channel',
    example: 'Airbnb',
  },
  tower_and_unit_number: {
    group: 'Booking',
    description: 'Tower and unit',
    example: 'Monaco 2604',
  },
  unit_number: {
    group: 'Booking',
    description: 'Unit number',
    example: 'Monaco 2604',
  },
  property_name: {
    group: 'Booking',
    description: 'Property name',
    example: 'Property alerts',
  },
  booking_link: {
    group: 'Booking',
    description: 'Admin booking URL',
    example: 'kamehomes.space/bookings/…',
  },
  chat_source: {
    group: 'Chat',
    description: 'Channel (Web chat, Facebook Messenger, Instagram)',
    example: 'Web chat',
  },
  chat_content: {
    group: 'Chat',
    description: 'Guest message text (or attachment note)',
    example: 'Hi! Is June 18–20 still available?',
  },
  attachment_summary: {
    group: 'Chat',
    description: 'Short attachment count (e.g. 1 image)',
    example: '1 image',
  },
  attachment_line: {
    group: 'Chat',
    description: 'Optional attachment line (empty when none)',
    example: '📎 Photo',
  },
  conversation_link: {
    group: 'Chat',
    description: 'Inbox deep link to this conversation',
    example: 'kamehomes.space/org/…/property/…/inbox?conversationId=…',
  },
  sent_at: {
    group: 'Chat',
    description: 'Message time (Asia/Manila)',
    example: 'Jun 15, 2026, 3:42 PM',
  },
  booking_vehicle_copy: {
    group: 'Sections',
    description: 'Parking broadcast copy block',
    example: 'Unit · dates · guest · vehicle',
  },
  sd_form_url: {
    group: 'SD refund',
    description: 'Guest SD refund form URL',
    example: 'kamehomes.space/sd-form?…',
  },
  security_deposit: {
    group: 'Payments',
    description: 'Security deposit (₱ formatted)',
    example: '₱3,000.00',
  },
  facebook_page_url: {
    group: 'Contact',
    description: 'Facebook page URL (property settings → org)',
    example: 'facebook.com/…',
  },
  airbnb_url: {
    group: 'Contact',
    description: 'Airbnb listing URL (property settings → org)',
    example: 'airbnb.com/rooms/…',
  },
  contact_name: {
    group: 'Contact',
    description: 'Contact person name (property profile → org)',
    example: 'Jane Host',
  },
  contact_phone: {
    group: 'Contact',
    description: 'Contact phone (property profile → org)',
    example: '09171234567',
  },
  contact_email: {
    group: 'Contact',
    description: 'Contact email (property profile → org)',
    example: 'host@example.com',
  },
  social_contact_mentions: {
    group: 'Contact',
    description: '“message us on Facebook or Airbnb” (platform names linked)',
    example: 'message us on Facebook or Airbnb',
  },
  update_notice: {
    group: 'Sections',
    description: 'GAF/pet/parking resubmit notice (empty on first send)',
    example: 'Updated request copy',
  },
  new_booking_detail_tables: {
    group: 'Sections',
    description: 'Stay, guest, and notable detail tables',
    example: 'Rendered tables',
  },
  downpayment_receipt_ai_section: {
    group: 'Sections',
    description: 'Downpayment receipt AI check table',
    example: 'Verdict + summary',
  },
  booking_link_cta: {
    group: 'Sections',
    description: 'Admin “View Booking Details” button',
    example: 'CTA button',
  },
  document_reminders_section: {
    group: 'Sections',
    description: 'GAF/parking/pet reminder card',
    example: 'Reminder list',
  },
  payment_breakdown_section: {
    group: 'Sections',
    description: 'Payment breakdown table',
    example: 'Rate, DP, balance, SD',
  },
  gcash_payment_section: {
    group: 'Sections',
    description: 'Payment accounts (+ QR when uploaded)',
    example: 'Account details (± QR)',
  },
  sd_refund_checklist_section: {
    group: 'Sections',
    description: 'Check-out checklist table',
    example: '8-step checklist',
  },
  sd_refund_details_section: {
    group: 'Sections',
    description: 'SD refund amount copy + form CTA button',
    example: 'Refund details + button',
  },
  pet_details_section: {
    group: 'Sections',
    description: 'Pet details table (name, type, breed, age, vax date)',
    example: 'Styled table',
  },
  pet_attachments_section: {
    group: 'Sections',
    description: 'Attachments included list (pet form, vax, photo)',
    example: 'Bulleted list',
  },
  parking_reply_callout_section: {
    group: 'Sections',
    description: 'Parking reply-with-rate callout',
    example: 'Blue callout',
  },
  email_signature_section: {
    group: 'Sections',
    description: 'Best regards sign-off (unit owner from settings)',
    example: 'Name + unit role',
  },
  booking_acknowledgement_flow_section: {
    group: 'Sections',
    description: 'Summary callout + What’s next step cards',
    example: '3 numbered steps',
  },
  ready_for_checkin_booking_summary_section: {
    group: 'Sections',
    description: 'Unit, check-in/out, guests table',
    example: 'Booking summary table',
  },
  ready_for_checkin_contact_section: {
    group: 'Sections',
    description: 'Contact us (Facebook + phone numbers)',
    example: 'Smart / Globe lines',
  },
  stay_guide_cta_section: {
    group: 'Sections',
    description: 'Guest stay guide button',
    example: 'Stay guide button',
  },
  decor_status: {
    group: 'Flags',
    description: 'Decor yes/no',
    example: '🎉 Yes',
  },
  pet_status: {
    group: 'Flags',
    description: 'Pets yes/no',
    example: 'No',
  },
  has_decor: {
    group: 'Flags',
    description: 'Plain decor label',
    example: 'Yes',
  },
  has_pets: {
    group: 'Flags',
    description: 'Has pets',
    example: 'No',
  },
  decor_flag: {
    group: 'Flags',
    description: 'Decor flag line (empty when no decor)',
    example: '🎉 Has decor',
  },
  pet_flag: {
    group: 'Flags',
    description: 'Pet flag line (empty when no pets)',
    example: '🐶 Has pets',
  },
  need_parking: {
    group: 'Flags',
    description: 'Parking requested',
    example: 'Yes ‼️',
  },
  surprise_decor: {
    group: 'Flags',
    description: 'Surprise decor',
    example: 'Yes ‼️',
  },
  special_requests: {
    group: 'Flags',
    description: 'Guest requests',
    example: 'Late check-in around 8 PM',
  },
  pet_name: {
    group: 'Flags',
    description: 'Pet name',
    example: 'Buddy',
  },
  pet_type: {
    group: 'Flags',
    description: 'Pet type',
    example: 'Dog',
  },
  pet_breed: {
    group: 'Flags',
    description: 'Pet breed',
    example: 'Shih Tzu',
  },
  car_brand_model: {
    group: 'Flags',
    description: 'Vehicle make/model',
    example: 'Toyota Vios',
  },
  car_color: {
    group: 'Flags',
    description: 'Vehicle color',
    example: 'White',
  },
  car_plate_number: {
    group: 'Flags',
    description: 'Plate number',
    example: 'ABC 1234',
  },
  urgent_notice: {
    group: 'Sections',
    description: 'Same-day check-in urgent banner (empty when not same-day)',
    example: 'Urgent callout',
  },
  status: {
    group: 'Workflow',
    description: 'Status code',
    example: 'PENDING_REVIEW',
  },
  status_label: {
    group: 'Workflow',
    description: 'Status label',
    example: 'Pending Review',
  },
  pending_docs_list: {
    group: 'Workflow',
    description: 'Missing documents',
    example: 'GAF, Parking',
  },
  total_guest_balance: {
    group: 'Payments',
    description: 'Balance due',
    example: '₱3,599',
  },
  dp_receipt_ai_verdict: {
    group: 'Payments',
    description: 'DP receipt verdict',
    example: 'Likely valid',
  },
  dp_receipt_ai_summary: {
    group: 'Payments',
    description: 'DP receipt summary',
    example: 'Amount ₱1,500 matches down payment',
  },
  balance_receipt_ai_verdict: {
    group: 'Payments',
    description: 'Balance receipt verdict',
    example: 'Valid',
  },
  balance_receipt_ai_summary: {
    group: 'Payments',
    description: 'Balance receipt summary',
    example: 'Balance receipt shows ₱3,599 paid',
  },
  sd_refund_method: {
    group: 'SD refund',
    description: 'Refund method',
    example: 'Same phone (GCash)',
  },
  sd_refund_bank: {
    group: 'SD refund',
    description: 'Refund bank',
    example: 'GCash',
  },
  sd_refund_account_name: {
    group: 'SD refund',
    description: 'Account holder',
    example: 'Juan Dela Cruz',
  },
  sd_refund_account_number: {
    group: 'SD refund',
    description: 'Account number',
    example: '09171234567',
  },
  sd_refund_payout_phone: {
    group: 'SD refund',
    description: 'GCash phone',
    example: '09171234567',
  },
  sd_refund_details: {
    group: 'SD refund',
    description: 'Refund details',
    example: 'GCash (on-file phone): 09171234567',
  },
  sd_refund_guest_feedback: {
    group: 'SD refund',
    description: 'Guest feedback',
    example: 'Great stay. Thank you!',
  },
  next_bookings: {
    group: 'Summary',
    description: 'Next 3 days',
    example: 'Jun 19: 2:00 PM-11:00 AM, 2pax',
  },
  available_dates: {
    group: 'Calendar',
    description: 'Free check-in dates',
    example: 'June 18, 19, 20, 21',
  },
  month_name: {
    group: 'Calendar',
    description: 'Month name',
    example: 'June',
  },
  dates_list: {
    group: 'Calendar',
    description: 'Open day numbers',
    example: '18, 19, 20, 21',
  },
  cancellation_dates: {
    group: 'Calendar',
    description: 'Cancelled stay dates',
    example: 'June 18–19',
  },
  urgency_text: {
    group: 'Calendar',
    description: 'Urgency opener',
    example: 'this',
  },
  label: {
    group: 'Other',
    description: 'Item title',
    example: 'Monthly HOA dues',
  },
  amount: {
    group: 'Payments',
    description: 'Amount due',
    example: '₱4,500.00',
  },
  category: {
    group: 'Other',
    description: 'Category name',
    example: 'HOA',
  },
  due_date: {
    group: 'Other',
    description: 'Due date',
    example: '06/20/2026',
  },
  occurred_on: {
    group: 'Other',
    description: 'Transaction date',
    example: '06/01/2026',
  },
  scheduled_on: {
    group: 'Other',
    description: 'Scheduled date',
    example: '06/20/2026',
  },
  days_until_due: {
    group: 'Other',
    description: 'Days until due',
    example: '3',
  },
  notes: {
    group: 'Other',
    description: 'Extra notes',
    example: 'Pay via BPI transfer',
  },
  kind: {
    group: 'Other',
    description: 'Transaction kind',
    example: 'expense',
  },
};

function tokenName(token: string): string {
  return token.replace(/^\{\{|\}\}$/g, '').trim();
}

function inferGroupFromToken(name: string): (typeof GROUP_ORDER)[number] {
  if (/^(primary_guest|guest_)/.test(name)) return 'Guest';
  if (/^(check_in|check_out|nights|pax)$/.test(name)) return 'Stay';
  if (/^(available_dates|month_name|dates_list|cancellation_dates|urgency_text)$/.test(name)) {
    return 'Calendar';
  }
  if (/^(decor_|pet_|has_decor|has_pets|special_requests|need_parking|surprise_decor)/.test(name)) {
    return 'Flags';
  }
  if (/^(next_bookings|total_guest)/.test(name)) return 'Summary';
  if (/^sd_refund_/.test(name)) return 'SD refund';
  if (
    /^(update_notice|new_booking|downpayment_receipt|booking_link_cta|document_reminders|payment_breakdown|gcash_payment|sd_refund_checklist|sd_refund_details|sd_refund_footer)/.test(
      name
    )
  ) {
    return 'Sections';
  }
  if (/^(status|pending_docs|urgent_)/.test(name)) return 'Workflow';
  if (/^(amount|dp_receipt|balance_receipt)/.test(name)) return 'Payments';
  if (/^(booking_link|booking_source|tower_)/.test(name)) return 'Booking';
  return 'Other';
}

function parsePlaceholderLine(line: string): { token: string; description?: string } {
  const trimmed = line.trim();
  // Catalog lines use ":" (em dash was removed). Still accept a dash so older lines parse.
  const rich = trimmed.match(/^(\{\{[^}]+\}\})\s*(?:[—–-]|:)\s*(.+)$/);
  if (rich) {
    return { token: rich[1], description: rich[2].trim() };
  }
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
    return { token: trimmed };
  }
  if (/^[a-z_]+$/.test(trimmed)) {
    return { token: `{{${trimmed}}}` };
  }
  return { token: trimmed };
}

export function buildValidPlaceholderKeySet(lines: string[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const line of lines) {
    const { token } = parsePlaceholderLine(line);
    const name = tokenName(token);
    if (name) keys.add(name);
  }
  return keys;
}

/** Build catalog lines from keys (for per-template placeholder modals). */
export function placeholderLinesFromKeys(keys: readonly string[]): string[] {
  return keys.map((key) => {
    const token = `{{${key}}}`;
    const meta = PLACEHOLDER_META[key];
    return meta ? `${token}: ${meta.description}` : token;
  });
}

export function enrichPlaceholderLines(
  lines: string[],
  sampleVars?: Record<string, string>
): TelegramPlaceholderItem[] {
  return lines.map((line) => {
    const { token, description: lineDescription } = parsePlaceholderLine(line);
    const name = tokenName(token);
    const meta = PLACEHOLDER_META[name];
    const sampleValue = sampleVars?.[name];

    if (meta) {
      const example =
        meta.example === '-' && sampleValue !== undefined
          ? formatPlaceholderExample(sampleValue)
          : meta.example;
      return {
        token,
        description: meta.description,
        example,
        group: meta.group,
      };
    }

    return {
      token,
      description: lineDescription ?? 'Template token',
      example: sampleValue !== undefined ? formatPlaceholderExample(sampleValue) : '-',
      group: inferGroupFromToken(name),
    };
  });
}

/** Human-readable e.g. line — empty strings become "(empty)", long values truncate. */
function formatPlaceholderExample(value: string): string {
  if (value === '') return '(empty)';
  if (value.length > 52) return `${value.slice(0, 49)}…`;
  return value;
}

export function groupPlaceholders(
  items: TelegramPlaceholderItem[]
): Array<{ group: string; items: TelegramPlaceholderItem[] }> {
  const map = new Map<string, TelegramPlaceholderItem[]>();
  for (const item of items) {
    const list = map.get(item.group) ?? [];
    list.push(item);
    map.set(item.group, list);
  }
  const ordered: Array<{ group: string; items: TelegramPlaceholderItem[] }> = GROUP_ORDER.filter(
    (g) => map.has(g)
  ).map((group) => ({
    group,
    items: map.get(group)!,
  }));
  for (const [group, groupItems] of map) {
    if (!(GROUP_ORDER as readonly string[]).includes(group)) {
      ordered.push({ group, items: groupItems });
    }
  }
  return ordered;
}

export function filterPlaceholders(
  items: TelegramPlaceholderItem[],
  query: string
): TelegramPlaceholderItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (item) =>
      item.token.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.example.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q)
  );
}
