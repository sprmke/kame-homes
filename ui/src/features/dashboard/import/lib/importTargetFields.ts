/**
 * Booking import target field ids — client mirror of importTargetSchemas.ts.
 * Sync comment: keep in step with BOOKING_IMPORT_TARGET_FIELDS in
 * supabase/functions/_shared/importTargetSchemas.ts
 */

export type ImportTargetField = {
  id: string;
  type: 'string' | 'email' | 'phone' | 'date' | 'time' | 'integer' | 'decimal' | 'boolean';
  required: boolean;
  description: string;
};

/** Client mirror — must match server importTargetSchemas.ts BOOKING_IMPORT_TARGET_FIELDS */
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
  { id: 'guest_phone_number', type: 'phone', required: true, description: 'Guest mobile number' },
  { id: 'guest_address', type: 'string', required: true, description: 'Guest city and province' },
  { id: 'check_in_date', type: 'date', required: true, description: 'Check-in date' },
  { id: 'check_out_date', type: 'date', required: true, description: 'Check-out date' },
  { id: 'check_in_time', type: 'time', required: false, description: 'Preferred check-in time' },
  { id: 'check_out_time', type: 'time', required: false, description: 'Preferred check-out time' },
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
  { id: 'primary_guest_age', type: 'integer', required: false, description: 'Primary guest age' },
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
    description: 'Special requests or notes',
  },
  {
    id: 'find_us',
    type: 'string',
    required: false,
    description: 'How the guest found the property',
  },
  {
    id: 'find_us_details',
    type: 'string',
    required: false,
    description: 'Extra detail for how guest found property',
  },
  {
    id: 'booking_source',
    type: 'string',
    required: false,
    description: 'Booking platform or channel',
  },
  {
    id: 'guest_requests_surprise_decor',
    type: 'boolean',
    required: false,
    description: 'Guest requested surprise decor',
  },
  { id: 'booking_rate', type: 'decimal', required: false, description: 'Total booking rate' },
  { id: 'down_payment', type: 'decimal', required: false, description: 'Down payment amount' },
  { id: 'balance', type: 'decimal', required: false, description: 'Remaining balance' },
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
    description: 'Additional guest fee',
  },
  { id: 'need_parking', type: 'boolean', required: false, description: 'Guest needs parking' },
  { id: 'parking_check_in_date', type: 'date', required: false, description: 'Parking start date' },
  { id: 'parking_check_out_date', type: 'date', required: false, description: 'Parking end date' },
  { id: 'car_plate_number', type: 'string', required: false, description: 'Vehicle plate number' },
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
  { id: 'has_pets', type: 'boolean', required: false, description: 'Guest has pets' },
  { id: 'pet_name', type: 'string', required: false, description: 'Pet name' },
  { id: 'pet_type', type: 'string', required: false, description: 'Pet type' },
  { id: 'pet_breed', type: 'string', required: false, description: 'Pet breed' },
  { id: 'pet_age', type: 'string', required: false, description: 'Pet age' },
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
    description: 'Unit label (informational)',
  },
  { id: 'unit_owner', type: 'string', required: false, description: 'Unit owner name' },
  {
    id: 'owner_onsite_contact_person',
    type: 'string',
    required: false,
    description: 'On-site contact person',
  },
  {
    id: 'owner_contact_number',
    type: 'phone',
    required: false,
    description: 'Owner contact phone',
  },
] as const;

export type BookingImportTargetFieldId = (typeof BOOKING_IMPORT_TARGET_FIELDS)[number]['id'];

export const REQUIRED_TARGET_FIELDS = BOOKING_IMPORT_TARGET_FIELDS.filter((f) => f.required);
export const OPTIONAL_TARGET_FIELDS = BOOKING_IMPORT_TARGET_FIELDS.filter((f) => !f.required);

const TARGET_LABEL_BY_ID = new Map(
  BOOKING_IMPORT_TARGET_FIELDS.map((field) => [field.id, field.description] as const)
);

/** Host-facing label for a target field id (falls back to the raw id). */
export function labelForImportTarget(targetId: string | null | undefined): string {
  if (!targetId) return '';
  return TARGET_LABEL_BY_ID.get(targetId) ?? targetId;
}

type ImportValidationMessage = {
  field?: string;
  code: string;
  message: string;
  value?: string | null;
  severity?: 'error' | 'warning';
};

function quoteImportValue(value: string | null | undefined): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const shortened = trimmed.length > 48 ? `${trimmed.slice(0, 45)}…` : trimmed;
  return `“${shortened}”`;
}

/** Row-level issue text for the preview table — names the field, reason, and bad value when known. */
export function formatImportValidationMessage(error: ImportValidationMessage): string {
  const label = error.field ? labelForImportTarget(error.field) : null;
  const quoted = quoteImportValue(error.value);

  let base: string;
  if (error.code === 'invalid_boolean' && label) {
    base = `${label}: use yes, no, true, or false in your file`;
  } else if (error.code === 'invalid_date' && label) {
    base = `${label}: use a recognizable date (e.g. 2026-01-15)`;
  } else if (error.code === 'required' && label) {
    base = `${label} is missing`;
  } else {
    base = label ? `${label}: ${error.message}` : error.message;
  }

  return quoted ? `${base} · ${quoted}` : base;
}

/** Compact issue summary for table cells — primary error + overflow count. */
export function formatImportRowIssueSummary(row: { validationErrors: ImportValidationMessage[] }): {
  primary: string | null;
  extraCount: number;
} {
  const blocking = row.validationErrors.filter((entry) => entry.severity === 'error');
  const primaryEntry =
    blocking[0] ?? row.validationErrors.find((entry) => entry.severity === 'warning');
  if (!primaryEntry) return { primary: null, extraCount: 0 };

  const pool = blocking.length > 0 ? blocking : row.validationErrors;
  return {
    primary: formatImportValidationMessage(primaryEntry),
    extraCount: Math.max(0, pool.length - 1),
  };
}
