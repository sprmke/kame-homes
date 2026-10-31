/**
 * Canonical booking import mapping targets — single source of truth for AI + manual mapping UI.
 *
 * Excludes system-only guest_submissions columns (status, URLs, AI verdicts, workflow timestamps, etc.).
 * Mirror field ids in ui/.../import/lib/importCsvTemplate.ts IMPORT_CSV_TEMPLATE_HEADERS where applicable.
 */

export type ImportTargetFieldType =
  'string' | 'email' | 'phone' | 'date' | 'time' | 'integer' | 'decimal' | 'boolean';

export type ImportTargetField = {
  id: string;
  type: ImportTargetFieldType;
  required: boolean;
  description: string;
};

/** Fields hosts may map CSV columns onto when importing into guest_submissions. */
export const BOOKING_IMPORT_TARGET_FIELDS: readonly ImportTargetField[] = [
  {
    id: 'guest_display_name',
    type: 'string',
    required: true,
    description: 'Guest display name (Direct, Facebook, or Airbnb)',
  },
  {
    id: 'primary_guest_name',
    type: 'string',
    required: true,
    description: 'Primary guest full legal name',
  },
  { id: 'guest_email', type: 'email', required: true, description: 'Guest email address' },
  {
    id: 'guest_phone_number',
    type: 'phone',
    required: true,
    description: 'Guest mobile number (often 11-digit PH format)',
  },
  {
    id: 'guest_address',
    type: 'string',
    required: true,
    description: 'Guest city and province (e.g. San Fernando, Pampanga)',
  },
  {
    id: 'check_in_date',
    type: 'date',
    required: true,
    description: "Guest's arrival / check-in date",
  },
  {
    id: 'check_out_date',
    type: 'date',
    required: true,
    description: "Guest's departure / check-out date",
  },
  {
    id: 'check_in_time',
    type: 'time',
    required: false,
    description: 'Preferred check-in time (24h or 12h text)',
  },
  {
    id: 'check_out_time',
    type: 'time',
    required: false,
    description: 'Preferred check-out time (24h or 12h text)',
  },
  { id: 'nationality', type: 'string', required: false, description: 'Guest nationality' },
  {
    id: 'number_of_adults',
    type: 'integer',
    required: false,
    description: 'Count of adult guests',
  },
  {
    id: 'number_of_children',
    type: 'integer',
    required: false,
    description: 'Count of child guests',
  },
  {
    id: 'number_of_nights',
    type: 'integer',
    required: false,
    description: 'Length of stay in nights',
  },
  {
    id: 'primary_guest_age',
    type: 'integer',
    required: false,
    description: 'Primary guest age in years',
  },
  { id: 'guest2_name', type: 'string', required: false, description: 'Second guest full name' },
  { id: 'guest2_age', type: 'integer', required: false, description: 'Second guest age' },
  { id: 'guest3_name', type: 'string', required: false, description: 'Third guest full name' },
  { id: 'guest3_age', type: 'integer', required: false, description: 'Third guest age' },
  { id: 'guest4_name', type: 'string', required: false, description: 'Fourth guest full name' },
  { id: 'guest4_age', type: 'integer', required: false, description: 'Fourth guest age' },
  { id: 'guest5_name', type: 'string', required: false, description: 'Fifth guest full name' },
  { id: 'guest5_age', type: 'integer', required: false, description: 'Fifth guest age' },
  {
    id: 'guest_special_requests',
    type: 'string',
    required: false,
    description: 'Free-text special requests or notes',
  },
  {
    id: 'find_us',
    type: 'string',
    required: false,
    description: 'How the guest found the property (e.g. Facebook, referral)',
  },
  {
    id: 'find_us_details',
    type: 'string',
    required: false,
    description: 'Extra detail for how the guest found the property',
  },
  {
    id: 'booking_source',
    type: 'string',
    required: false,
    description: 'Booking platform or channel (Direct, Facebook, Airbnb, etc.)',
  },
  {
    id: 'guest_requests_surprise_decor',
    type: 'boolean',
    required: false,
    description: 'Whether guest requested surprise decor / setup',
  },
  {
    id: 'booking_rate',
    type: 'decimal',
    required: false,
    description: 'Total booking rate in pesos',
  },
  {
    id: 'down_payment',
    type: 'decimal',
    required: false,
    description: 'Down payment amount received',
  },
  { id: 'balance', type: 'decimal', required: false, description: 'Remaining balance due' },
  {
    id: 'security_deposit',
    type: 'decimal',
    required: false,
    description: 'Security deposit amount',
  },
  { id: 'pet_fee', type: 'decimal', required: false, description: 'Pet fee amount' },
  {
    id: 'guest_additional_fee',
    type: 'decimal',
    required: false,
    description: 'Additional guest fee amount',
  },
  {
    id: 'need_parking',
    type: 'boolean',
    required: false,
    description: 'Whether guest needs parking',
  },
  {
    id: 'parking_check_in_date',
    type: 'date',
    required: false,
    description: 'Parking entitlement start date',
  },
  {
    id: 'parking_check_out_date',
    type: 'date',
    required: false,
    description: 'Parking entitlement end date',
  },
  {
    id: 'car_plate_number',
    type: 'string',
    required: false,
    description: 'Vehicle plate number',
  },
  {
    id: 'car_brand_model',
    type: 'string',
    required: false,
    description: 'Vehicle brand and model',
  },
  { id: 'car_color', type: 'string', required: false, description: 'Vehicle color' },
  {
    id: 'parking_rate_guest',
    type: 'decimal',
    required: false,
    description: 'Guest-paid parking rate',
  },
  {
    id: 'parking_rate_paid',
    type: 'decimal',
    required: false,
    description: 'Owner-paid parking rate',
  },
  { id: 'has_pets', type: 'boolean', required: false, description: 'Whether guest has pets' },
  { id: 'pet_name', type: 'string', required: false, description: 'Pet name' },
  { id: 'pet_type', type: 'string', required: false, description: 'Pet type (dog, cat, etc.)' },
  { id: 'pet_breed', type: 'string', required: false, description: 'Pet breed' },
  { id: 'pet_age', type: 'string', required: false, description: 'Pet age (free text)' },
  {
    id: 'pet_vaccination_date',
    type: 'date',
    required: false,
    description: 'Pet vaccination date',
  },
  {
    id: 'tower_and_unit_number',
    type: 'string',
    required: false,
    description: 'Unit label in the host file (informational cross-check only)',
  },
  { id: 'unit_owner', type: 'string', required: false, description: 'Unit owner name' },
  {
    id: 'owner_onsite_contact_person',
    type: 'string',
    required: false,
    description: 'On-site contact person for the unit',
  },
  {
    id: 'owner_contact_number',
    type: 'phone',
    required: false,
    description: 'Owner or on-site contact phone number',
  },
] as const;

export type BookingImportTargetFieldId = (typeof BOOKING_IMPORT_TARGET_FIELDS)[number]['id'];

const TARGET_FIELD_ID_SET = new Set<string>(BOOKING_IMPORT_TARGET_FIELDS.map((field) => field.id));

/**
 * Legacy CSV / header names → current import target ids.
 * Keeps old downloads and fixtures mappable without a DB rename.
 */
export const BOOKING_IMPORT_HEADER_ALIASES: Readonly<Record<string, BookingImportTargetFieldId>> = {
  guest_facebook_name: 'guest_display_name',
};

/**
 * Import target ids that write to a different guest_submissions column.
 * DB column stays `guest_facebook_name` — no migration.
 */
export const BOOKING_IMPORT_TARGET_TO_DB_COLUMN: Readonly<Record<string, string>> = {
  guest_display_name: 'guest_facebook_name',
};

export function isBookingImportTargetFieldId(value: string): value is BookingImportTargetFieldId {
  return TARGET_FIELD_ID_SET.has(value);
}

/** Resolve a CSV header or target id (including legacy aliases) to a current target id. */
export function resolveBookingImportTargetId(value: string): BookingImportTargetFieldId | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isBookingImportTargetFieldId(trimmed)) return trimmed;
  return BOOKING_IMPORT_HEADER_ALIASES[trimmed] ?? null;
}

export function dbColumnForImportTarget(fieldId: string): string {
  return BOOKING_IMPORT_TARGET_TO_DB_COLUMN[fieldId] ?? fieldId;
}

export function getBookingImportTargetField(id: string): ImportTargetField | undefined {
  return BOOKING_IMPORT_TARGET_FIELDS.find((field) => field.id === id);
}

/** JSON-serializable field list for AI prompts and future manual-mapping UI. */
export function serializeBookingImportTargetFields(): ImportTargetField[] {
  return BOOKING_IMPORT_TARGET_FIELDS.map((field) => ({ ...field }));
}
