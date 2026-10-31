/**
 * Admin booking detail patches — field allowlist, RBAC leaves, validation, and
 * sanctioned status revert / reschedule writes (non-orchestrator).
 */

import dayjs from 'dayjs';
import type { DocumentRequirement } from './documentRequirements.ts';
import { resolveDocumentRequirements } from './documentRequirements.ts';
import { createServiceClient } from './orgAuth.ts';
import type { PropertyAccessContext } from './orgAuth.ts';
import {
  bookingAssetPermission,
  isBookingAssetType,
  type BookingAssetType,
} from './bookingAssetTypes.ts';
import type { TeamPermissionId } from './propertyTeamPermissions.ts';
import { hasPropertyPermission } from './propertyTeamPermissions.ts';
import { validateEmailAddress, validatePhilippineMobilePhone } from './fieldValidation.ts';
import {
  pendingDocumentsClearCompletionsJsonbPatch,
  pendingDocumentsClearPatchForGuestEditRevert,
  shouldRevertGuestFieldEditsToPendingReview,
  isPostPendingDocumentsStatus,
} from './statusMachine.ts';
import { countStayNights, formatTime, normalizeDateToYYYYMMDD } from './utils.ts';

const SD_BANKS = ['GCash', 'GoTyme', 'Maribank'] as const;
const SD_REFUND_METHODS = ['same_phone', 'other_bank', 'cash'] as const;

export type BookingDetailsOperation =
  | 'patch'
  | 'reschedule'
  | 'clear_asset'
  | 'save_parking_rate_guest'
  | 'ensure_need_parking';

/** Columns clients may send on `patch` — strict allowlist. */
export const BOOKING_PATCH_ALLOWED_COLUMNS = new Set([
  'guest_facebook_name',
  'primary_guest_name',
  'guest_email',
  'guest_phone_number',
  'guest_address',
  'nationality',
  'primary_guest_age',
  'guest2_name',
  'guest2_age',
  'guest3_name',
  'guest3_age',
  'guest4_name',
  'guest4_age',
  'guest5_name',
  'guest5_age',
  'check_in_date',
  'check_out_date',
  'check_in_time',
  'check_out_time',
  'number_of_adults',
  'number_of_children',
  'number_of_nights',
  'need_parking',
  'car_plate_number',
  'car_brand_model',
  'car_color',
  'has_pets',
  'pet_name',
  'pet_type',
  'pet_breed',
  'pet_age',
  'pet_vaccination_date',
  'booking_source',
  'find_us',
  'find_us_details',
  'guest_special_requests',
  'guest_requests_surprise_decor',
  'booking_rate',
  'down_payment',
  'balance',
  'security_deposit',
  'pet_fee',
  'parking_rate_guest',
  'guest_additional_fee',
  'surprise_decor_staff_acknowledged',
  'parking_owner',
  'parking_rate_paid',
  'parking_endorsement_url',
  'parking_fee_included_in_downpayment',
  'parking_payment_receipt_url',
  'parking_receipt_ai_verdict',
  'parking_receipt_ai_summary',
  'guest_balance_paid_amount',
  'guest_balance_payment_receipt_url',
  'balance_receipt_ai_verdict',
  'balance_receipt_ai_summary',
  'sd_additional_expense_items',
  'sd_additional_profit_items',
  'sd_additional_expenses',
  'sd_additional_profits',
  'sd_refund_amount',
  'sd_refund_receipt_url',
  'sd_refund_method',
  'sd_refund_phone_confirmed',
  'sd_refund_bank',
  'sd_refund_account_name',
  'sd_refund_account_number',
  'sd_refund_guest_feedback',
]);

export const BOOKING_PATCH_COLUMN_PERMISSIONS: Record<string, TeamPermissionId> = {
  check_in_date: 'bookings.detail.stay:edit',
  check_out_date: 'bookings.detail.stay:edit',
  check_in_time: 'bookings.detail.stay:edit',
  check_out_time: 'bookings.detail.stay:edit',
  number_of_adults: 'bookings.detail.stay:edit',
  number_of_children: 'bookings.detail.stay:edit',
  number_of_nights: 'bookings.detail.stay:edit',
  booking_source: 'bookings.detail.stay:edit',
  find_us: 'bookings.detail.stay:edit',
  find_us_details: 'bookings.detail.stay:edit',
  guest_special_requests: 'bookings.detail.stay:edit',
  guest_requests_surprise_decor: 'bookings.detail.stay:edit',
  guest_facebook_name: 'bookings.detail.guests:edit',
  primary_guest_name: 'bookings.detail.guests:edit',
  guest_email: 'bookings.detail.guests:edit',
  guest_phone_number: 'bookings.detail.guests:edit',
  guest_address: 'bookings.detail.guests:edit',
  nationality: 'bookings.detail.guests:edit',
  primary_guest_age: 'bookings.detail.guests:edit',
  guest2_name: 'bookings.detail.guests:edit',
  guest2_age: 'bookings.detail.guests:edit',
  guest3_name: 'bookings.detail.guests:edit',
  guest3_age: 'bookings.detail.guests:edit',
  guest4_name: 'bookings.detail.guests:edit',
  guest4_age: 'bookings.detail.guests:edit',
  guest5_name: 'bookings.detail.guests:edit',
  guest5_age: 'bookings.detail.guests:edit',
  need_parking: 'bookings.detail.parking:edit',
  car_plate_number: 'bookings.detail.parking:edit',
  car_brand_model: 'bookings.detail.parking:edit',
  car_color: 'bookings.detail.parking:edit',
  parking_rate_guest: 'bookings.detail.parking:edit',
  has_pets: 'bookings.detail.pets:edit',
  pet_name: 'bookings.detail.pets:edit',
  pet_type: 'bookings.detail.pets:edit',
  pet_breed: 'bookings.detail.pets:edit',
  pet_age: 'bookings.detail.pets:edit',
  pet_vaccination_date: 'bookings.detail.pets:edit',
  pet_fee: 'bookings.detail.pets:edit',
  booking_rate: 'bookings.detail.pricing:edit',
  down_payment: 'bookings.detail.pricing:edit',
  balance: 'bookings.detail.pricing:edit',
  security_deposit: 'bookings.detail.pricing:edit',
  guest_additional_fee: 'bookings.detail.pricing:edit',
  guest_balance_paid_amount: 'bookings.detail.pricing:edit',
  guest_balance_payment_receipt_url: 'bookings.detail.pricing:edit',
  balance_receipt_ai_verdict: 'bookings.detail.pricing:edit',
  balance_receipt_ai_summary: 'bookings.detail.pricing:edit',
  sd_additional_expense_items: 'bookings.detail.pricing:edit',
  sd_additional_profit_items: 'bookings.detail.pricing:edit',
  sd_additional_expenses: 'bookings.detail.pricing:edit',
  sd_additional_profits: 'bookings.detail.pricing:edit',
  sd_refund_amount: 'bookings.detail.pricing:edit',
  sd_refund_receipt_url: 'bookings.detail.pricing:edit',
  sd_refund_method: 'bookings.detail.pricing:edit',
  sd_refund_phone_confirmed: 'bookings.detail.pricing:edit',
  sd_refund_bank: 'bookings.detail.pricing:edit',
  sd_refund_account_name: 'bookings.detail.pricing:edit',
  sd_refund_account_number: 'bookings.detail.pricing:edit',
  sd_refund_guest_feedback: 'bookings.detail.pricing:edit',
  surprise_decor_staff_acknowledged: 'bookings.detail.workflow:edit',
  parking_owner: 'bookings.detail.workflow:edit',
  parking_rate_paid: 'bookings.detail.workflow:edit',
  parking_endorsement_url: 'bookings.detail.workflow:edit',
  parking_fee_included_in_downpayment: 'bookings.detail.workflow:edit',
  parking_payment_receipt_url: 'bookings.detail.workflow:edit',
  parking_receipt_ai_verdict: 'bookings.detail.workflow:edit',
  parking_receipt_ai_summary: 'bookings.detail.workflow:edit',
};

const RESCHEDULABLE_STATUSES = new Set([
  'PENDING_REVIEW',
  'PENDING_DOCUMENTS',
  'PENDING_GAF',
  'PENDING_PARKING_REQUEST',
  'PENDING_PET_REQUEST',
  'READY_FOR_CHECKIN',
]);

export function canRescheduleBookingAtStatus(status: string | null | undefined): boolean {
  return RESCHEDULABLE_STATUSES.has(String(status ?? '').trim());
}

const BOOKING_ASSET_URL_COLUMN: Record<BookingAssetType, string> = {
  parking_endorsement: 'parking_endorsement_url',
  parking_payment_receipt: 'parking_payment_receipt_url',
  approved_gaf: 'approved_gaf_pdf_url',
  approved_pet: 'approved_pet_pdf_url',
  sd_refund_receipt: 'sd_refund_receipt_url',
  guest_balance_payment_receipt: 'guest_balance_payment_receipt_url',
  valid_id: 'valid_id_url',
  guest2_valid_id: 'guest2_valid_id_url',
  guest3_valid_id: 'guest3_valid_id_url',
  guest4_valid_id: 'guest4_valid_id_url',
  guest5_valid_id: 'guest5_valid_id_url',
  payment_receipt: 'payment_receipt_url',
  pet_vaccination: 'pet_vaccination_url',
  pet_image: 'pet_image_url',
};

const BOOKING_ASSET_AI_COLUMNS: Partial<
  Record<BookingAssetType, { verdict: string; summary: string }>
> = {
  payment_receipt: { verdict: 'dp_receipt_ai_verdict', summary: 'dp_receipt_ai_summary' },
  guest_balance_payment_receipt: {
    verdict: 'balance_receipt_ai_verdict',
    summary: 'balance_receipt_ai_summary',
  },
  parking_payment_receipt: {
    verdict: 'parking_receipt_ai_verdict',
    summary: 'parking_receipt_ai_summary',
  },
  valid_id: { verdict: 'valid_id_ai_verdict', summary: 'valid_id_ai_summary' },
  guest2_valid_id: { verdict: 'guest2_valid_id_ai_verdict', summary: 'guest2_valid_id_ai_summary' },
  guest3_valid_id: { verdict: 'guest3_valid_id_ai_verdict', summary: 'guest3_valid_id_ai_summary' },
  guest4_valid_id: { verdict: 'guest4_valid_id_ai_verdict', summary: 'guest4_valid_id_ai_summary' },
  guest5_valid_id: { verdict: 'guest5_valid_id_ai_verdict', summary: 'guest5_valid_id_ai_summary' },
};

export function bookingAssetClearPatch(assetType: BookingAssetType): Record<string, null> {
  const patch: Record<string, null> = {
    [BOOKING_ASSET_URL_COLUMN[assetType]]: null,
  };
  const ai = BOOKING_ASSET_AI_COLUMNS[assetType];
  if (ai) {
    patch[ai.verdict] = null;
    patch[ai.summary] = null;
  }
  return patch;
}

/** Columns the server writes in addition to the client payload. */
export function impliedBookingPatchColumns(patch: Record<string, unknown>): string[] {
  const extra: string[] = [];
  if (patch.booking_source === 'Airbnb') {
    extra.push('down_payment', 'security_deposit');
    if (patch.booking_rate != null && patch.balance === undefined) {
      extra.push('balance');
    }
  }
  return extra;
}

export function requiredPermissionsForPatchColumns(columns: readonly string[]): TeamPermissionId[] {
  const needed: TeamPermissionId[] = [];
  for (const column of columns) {
    const perm = BOOKING_PATCH_COLUMN_PERMISSIONS[column];
    if (!perm) {
      throw new Error(`Field "${column}" is not allowed`);
    }
    if (!needed.includes(perm)) needed.push(perm);
  }
  return needed;
}

export function assertPropertyHasPermissions(
  propertyAccess: PropertyAccessContext,
  required: readonly TeamPermissionId[]
): void {
  for (const perm of required) {
    if (!hasPropertyPermission(propertyAccess.permissions, perm)) {
      throw new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
}

function formatDateForGuestSubmission(dateStr: string): string {
  const normalized = normalizeDateToYYYYMMDD(dateStr);
  if (!normalized) throw new Error(`Invalid date: ${dateStr}`);
  return dayjs(normalized, 'YYYY-MM-DD', true).format('MM-DD-YYYY');
}

function parseFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a number`);
  }
  return value;
}

function parseOptionalFiniteNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return parseFiniteNumber(value, field);
}

function parseOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('Expected a string');
  const trimmed = value.trim();
  if (trimmed.length > 5_000) throw new Error('Text value is too long');
  return trimmed ? trimmed : null;
}

function parseOptionalInteger(
  value: unknown,
  field: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER
): number | null {
  const num = parseOptionalFiniteNumber(value, field);
  if (num === null) return null;
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new Error(`${field} must be an integer from ${min} to ${max}`);
  }
  return num;
}

function parsePayloadRecord(raw: unknown, fieldName: string): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${fieldName} must be an object`);
  }
  return raw as Record<string, unknown>;
}

function computeBalance(
  bookingRate?: number | null,
  downPayment?: number | null
): number | null {
  if (bookingRate == null || downPayment == null) return null;
  return Math.round((bookingRate - downPayment) * 100) / 100;
}

function patchGuestSubmissionForDb(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };
  if (typeof out.check_in_date === 'string' && out.check_in_date) {
    out.check_in_date = formatDateForGuestSubmission(out.check_in_date);
  }
  if (typeof out.check_out_date === 'string' && out.check_out_date) {
    out.check_out_date = formatDateForGuestSubmission(out.check_out_date);
  }
  if (typeof out.check_in_time === 'string' && out.check_in_time) {
    out.check_in_time = formatTime(out.check_in_time);
  }
  if (typeof out.check_out_time === 'string' && out.check_out_time) {
    out.check_out_time = formatTime(out.check_out_time);
  }
  return out;
}

function validatePatchValue(column: string, value: unknown): unknown {
  switch (column) {
    case 'guest_facebook_name':
    case 'primary_guest_name':
    case 'guest_email':
    case 'guest_phone_number': {
      const s = parseOptionalString(value);
      if (!s) throw new Error(`${column} is required`);
      if (column === 'guest_email') {
        const error = validateEmailAddress(s);
        if (error) throw new Error(error);
      }
      if (column === 'guest_phone_number') {
        const error = validatePhilippineMobilePhone(s);
        if (error) throw new Error(error);
      }
      return s;
    }
    case 'number_of_adults': {
      const count = parseOptionalInteger(value, column, 1);
      if (count === null) throw new Error('number_of_adults is required');
      return count;
    }
    case 'number_of_children':
      return parseOptionalInteger(value, column, 0);
    case 'primary_guest_age':
    case 'guest2_age':
    case 'guest3_age':
    case 'guest4_age':
    case 'guest5_age':
      return parseOptionalInteger(value, column, 0, 120);
    case 'number_of_nights': {
      const count = parseOptionalInteger(value, column, 1);
      if (count === null) throw new Error('number_of_nights is required');
      return count;
    }
    case 'need_parking':
    case 'has_pets':
    case 'guest_requests_surprise_decor':
    case 'surprise_decor_staff_acknowledged':
    case 'parking_fee_included_in_downpayment':
      if (typeof value !== 'boolean') {
        throw new Error(`${column} must be a boolean`);
      }
      return value;
    case 'sd_refund_phone_confirmed':
      if (value === null) return null;
      if (typeof value !== 'boolean') {
        throw new Error(`${column} must be a boolean or null`);
      }
      return value;
    case 'check_in_date':
    case 'check_out_date':
    case 'pet_vaccination_date':
      if (typeof value !== 'string' || !normalizeDateToYYYYMMDD(value)) {
        throw new Error(`${column} must be a valid date`);
      }
      return value;
    case 'check_in_time':
    case 'check_out_time':
      if (value === null) return null;
      if (typeof value !== 'string' || !formatTime(value)) {
        throw new Error(`${column} must be a valid time`);
      }
      return value;
    case 'booking_rate':
    case 'down_payment':
    case 'security_deposit':
    case 'pet_fee':
    case 'parking_rate_guest':
    case 'guest_additional_fee':
    case 'parking_rate_paid':
    case 'sd_refund_amount':
      {
        const amount = parseFiniteNumber(value, column);
        if (amount < 0) throw new Error(`${column} must not be negative`);
        return amount;
      }
    case 'balance':
    case 'guest_balance_paid_amount': {
      const amount = parseOptionalFiniteNumber(value, column);
      if (amount !== null && amount < 0) {
        throw new Error(`${column} must not be negative`);
      }
      return amount;
    }
    case 'sd_refund_method': {
      const method = String(value ?? '').trim();
      if (!(SD_REFUND_METHODS as readonly string[]).includes(method)) {
        throw new Error('sd_refund_method is invalid');
      }
      return method;
    }
    case 'sd_refund_bank': {
      if (value === null) return null;
      const bank = String(value).trim();
      if (!(SD_BANKS as readonly string[]).includes(bank)) {
        throw new Error('sd_refund_bank is invalid');
      }
      return bank;
    }
    case 'sd_additional_expense_items':
    case 'sd_additional_profit_items':
      if (!Array.isArray(value)) throw new Error(`${column} must be an array`);
      if (value.length > 100) throw new Error(`${column} has too many items`);
      return value.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error(`${column}[${index}] must be an object`);
        }
        const record = item as Record<string, unknown>;
        const label = parseOptionalString(record.label);
        const amount = parseFiniteNumber(record.amount, `${column}[${index}].amount`);
        if (!label || amount < 0) throw new Error(`${column}[${index}] is invalid`);
        return { label, amount };
      });
    case 'sd_additional_expenses':
    case 'sd_additional_profits':
      if (!Array.isArray(value)) throw new Error(`${column} must be an array`);
      if (value.length > 100) throw new Error(`${column} has too many items`);
      return value.map((item, index) => {
        const amount = parseFiniteNumber(item, `${column}[${index}]`);
        if (amount < 0) throw new Error(`${column}[${index}] must not be negative`);
        return amount;
      });
    default:
      return parseOptionalString(value);
  }
}

export function sanitizeBookingPatchPayload(raw: unknown): Record<string, unknown> {
  const input = parsePayloadRecord(raw, 'payload');
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!BOOKING_PATCH_ALLOWED_COLUMNS.has(key)) {
      throw new Error(`Field "${key}" is not allowed`);
    }
    patch[key] = validatePatchValue(key, value);
  }
  if (Object.keys(patch).length === 0) {
    throw new Error('No valid fields to update');
  }
  return patch;
}

function petDocumentationConfigured(requirements: DocumentRequirement[]): boolean {
  return requirements.some((req) => req.id === 'pet' || req.triggerCondition === 'has_pets');
}

function trimText(v: string | null | undefined): string {
  return (v ?? '').trim();
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return trimText(a) === trimText(b);
}

function sameBool(a: boolean | null | undefined, b: boolean | null | undefined): boolean {
  return !!a === !!b;
}

function sameNumber(a: number | null | undefined, b: number | null | undefined): boolean {
  const left = a == null || Number.isNaN(a) ? null : a;
  const right = b == null || Number.isNaN(b) ? null : b;
  return left === right;
}

function normDate(d: string | null | undefined): string {
  const s = trimText(d);
  if (!s) return '';
  return normalizeDateToYYYYMMDD(s) || s;
}

/** Clear stored request PDF URLs when an admin edit changes PDF fill content. */
export function requestPdfClearPatchForAdminPayload(
  baseline: Record<string, unknown>,
  draft: Record<string, unknown>,
  documentRequirements: DocumentRequirement[]
): Record<string, null> {
  const patch: Record<string, null> = {};

  if (!sameText(baseline.guest_facebook_name as string, draft.guest_facebook_name as string)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.primary_guest_name as string, draft.primary_guest_name as string)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest_email as string, draft.guest_email as string)) {
    patch.gaf_request_pdf_url = null;
  } else if (
    !sameText(baseline.guest_phone_number as string, draft.guest_phone_number as string)
  ) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest2_name as string, draft.guest2_name as string)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameNumber(baseline.guest2_age as number, draft.guest2_age as number)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest3_name as string, draft.guest3_name as string)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameNumber(baseline.guest3_age as number, draft.guest3_age as number)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest4_name as string, draft.guest4_name as string)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameNumber(baseline.guest4_age as number, draft.guest4_age as number)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest5_name as string, draft.guest5_name as string)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameNumber(baseline.guest5_age as number, draft.guest5_age as number)) {
    patch.gaf_request_pdf_url = null;
  } else if (normDate(baseline.check_in_date as string) !== normDate(draft.check_in_date as string)) {
    patch.gaf_request_pdf_url = null;
  } else if (
    normDate(baseline.check_out_date as string) !== normDate(draft.check_out_date as string)
  ) {
    patch.gaf_request_pdf_url = null;
  } else if (
    formatTime(baseline.check_in_time as string) !== formatTime(draft.check_in_time as string)
  ) {
    patch.gaf_request_pdf_url = null;
  } else if (
    formatTime(baseline.check_out_time as string) !== formatTime(draft.check_out_time as string)
  ) {
    patch.gaf_request_pdf_url = null;
  } else if (
    !sameBool(
      baseline.guest_requests_surprise_decor as boolean,
      draft.guest_requests_surprise_decor as boolean
    )
  ) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameBool(baseline.need_parking as boolean, draft.need_parking as boolean)) {
    patch.gaf_request_pdf_url = null;
  } else if (draft.need_parking) {
    if (!sameText(baseline.car_plate_number as string, draft.car_plate_number as string)) {
      patch.gaf_request_pdf_url = null;
    } else if (!sameText(baseline.car_brand_model as string, draft.car_brand_model as string)) {
      patch.gaf_request_pdf_url = null;
    } else if (!sameText(baseline.car_color as string, draft.car_color as string)) {
      patch.gaf_request_pdf_url = null;
    }
  } else if (!sameBool(baseline.has_pets as boolean, draft.has_pets as boolean)) {
    patch.gaf_request_pdf_url = null;
  }

  if (petDocumentationConfigured(documentRequirements)) {
    if (!sameBool(baseline.has_pets as boolean, draft.has_pets as boolean)) {
      patch.pet_request_pdf_url = null;
    } else if (draft.has_pets) {
      if (!sameText(baseline.pet_name as string, draft.pet_name as string)) {
        patch.pet_request_pdf_url = null;
      } else if (!sameText(baseline.pet_type as string, draft.pet_type as string)) {
        patch.pet_request_pdf_url = null;
      } else if (!sameText(baseline.pet_breed as string, draft.pet_breed as string)) {
        patch.pet_request_pdf_url = null;
      } else if (!sameText(baseline.pet_age as string, draft.pet_age as string)) {
        patch.pet_request_pdf_url = null;
      } else if (
        normDate(baseline.pet_vaccination_date as string) !==
        normDate(draft.pet_vaccination_date as string)
      ) {
        patch.pet_request_pdf_url = null;
      }
    }
  }

  return patch;
}

export type ApplyBookingDetailsPatchInput = {
  bookingId: string;
  propertyId: string;
  operation: BookingDetailsOperation;
  body: Record<string, unknown>;
  existingBooking?: Record<string, unknown>;
};

export type ApplyBookingDetailsPatchResult = {
  booking: Record<string, unknown>;
  skipped?: boolean;
  changedColumns: string[];
};

async function updateBookingRow(
  bookingId: string,
  patch: Record<string, unknown>,
  opts: { expectedStatus?: string | null }
): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  let query = supabase
    .from('guest_submissions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  const expectedStatus = opts.expectedStatus?.trim();
  if (expectedStatus) {
    query = query.eq('status', expectedStatus);
  }

  const { data, error } = await query.select('*').maybeSingle();
  if (error) throw new Error(`Failed to update booking: ${error.message}`);
  if (!data) {
    throw new Error('STATUS_CONFLICT: Booking status changed. Refresh and try again.');
  }
  return data as Record<string, unknown>;
}

async function loadBookingRow(bookingId: string): Promise<Record<string, unknown>> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_submissions')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !data) throw new Error('Booking not found');
  return data as Record<string, unknown>;
}

export function assertBookingPropertyScope(
  booking: Record<string, unknown>,
  propertyId: string
): void {
  const bookingPropertyId = booking.property_id;
  if (bookingPropertyId == null || bookingPropertyId === '') {
    throw new Error('Booking is missing property scope');
  }
  if (String(bookingPropertyId) !== propertyId) {
    throw new Error('Booking does not belong to this property');
  }
}

export async function applyBookingDetailsPatch(
  input: ApplyBookingDetailsPatchInput
): Promise<ApplyBookingDetailsPatchResult> {
  const { bookingId, propertyId, operation, body } = input;
  const existing = input.existingBooking ?? (await loadBookingRow(bookingId));
  assertBookingPropertyScope(existing, propertyId);

  const nowIso = new Date().toISOString();
  const existingStatus = String(existing.status ?? '').trim();

  if (operation === 'ensure_need_parking') {
    if (existing.need_parking === true) {
      return { booking: existing, skipped: true, changedColumns: [] };
    }
    const patch: Record<string, unknown> = { need_parking: true };
    if (
      existing.parking_completed_at ||
      isPostPendingDocumentsStatus(existingStatus)
    ) {
      patch.parking_completed_at = null;
    }
    const booking = await updateBookingRow(bookingId, patch, {
      expectedStatus: existingStatus,
    });
    return { booking, changedColumns: Object.keys(patch) };
  }

  if (operation === 'save_parking_rate_guest') {
    const parkingRateGuest = parseFiniteNumber(body.parkingRateGuest, 'parkingRateGuest');
    if (parkingRateGuest <= 0) throw new Error('Enter a parking rate greater than 0');
    const parkingCheckInDate = parseOptionalString(body.parkingCheckInDate);
    const parkingCheckOutDate = parseOptionalString(body.parkingCheckOutDate);
    if (!parkingCheckInDate || !parkingCheckOutDate) {
      throw new Error('Select parking check-in and check-out dates');
    }
    if (
      !normalizeDateToYYYYMMDD(parkingCheckInDate) ||
      !normalizeDateToYYYYMMDD(parkingCheckOutDate)
    ) {
      throw new Error('Parking dates must be valid');
    }
    const patch: Record<string, unknown> = {
      parking_rate_guest: parkingRateGuest,
      parking_check_in_date: formatDateForGuestSubmission(parkingCheckInDate),
      parking_check_out_date: formatDateForGuestSubmission(parkingCheckOutDate),
      need_parking: true,
    };
    if (
      existing.parking_completed_at ||
      isPostPendingDocumentsStatus(existingStatus)
    ) {
      patch.parking_completed_at = null;
    }
    const booking = await updateBookingRow(bookingId, patch, {
      expectedStatus: existingStatus,
    });
    return { booking, changedColumns: Object.keys(patch) };
  }

  if (operation === 'clear_asset') {
    const assetTypeRaw = body.assetType;
    if (!isBookingAssetType(assetTypeRaw)) {
      throw new Error(`Invalid assetType: "${String(assetTypeRaw)}"`);
    }
    const patch = bookingAssetClearPatch(assetTypeRaw);
    const booking = await updateBookingRow(bookingId, patch, {});
    return { booking, changedColumns: Object.keys(patch) };
  }

  if (operation === 'reschedule') {
    const currentStatus = String(existing.status ?? '').trim();
    if (!canRescheduleBookingAtStatus(currentStatus)) {
      throw new Error('Booking cannot be rescheduled at its current status');
    }
    const checkInDate = parseOptionalString(body.checkInDate);
    const checkOutDate = parseOptionalString(body.checkOutDate);
    if (!checkInDate || !checkOutDate) {
      throw new Error('checkInDate and checkOutDate are required');
    }
    const patch: Record<string, unknown> = {
      check_in_date: formatDateForGuestSubmission(checkInDate),
      check_out_date: formatDateForGuestSubmission(checkOutDate),
      number_of_nights: countStayNights(checkInDate, checkOutDate),
      ...pendingDocumentsClearPatchForGuestEditRevert(),
      document_requirement_completions: pendingDocumentsClearCompletionsJsonbPatch(
        body.currentDocumentRequirementCompletions ?? existing.document_requirement_completions
      ),
      status: 'PENDING_REVIEW',
      status_updated_at: nowIso,
    };
    const booking = await updateBookingRow(bookingId, patch, { expectedStatus: currentStatus });
    return { booking, changedColumns: Object.keys(patch) };
  }

  // patch
  const currentStatus = existingStatus;
  if (!currentStatus) throw new Error('currentStatus is required');

  let patch = sanitizeBookingPatchPayload(body.payload);

  if (patch.booking_source === 'Airbnb') {
    patch.down_payment = 0;
    patch.security_deposit = 0;
  }

  if (
    patch.booking_rate != null &&
    (patch.down_payment != null || patch.booking_source === 'Airbnb') &&
    patch.balance === undefined
  ) {
    patch.balance = computeBalance(
      patch.booking_rate as number,
      patch.booking_source === 'Airbnb' ? 0 : (patch.down_payment as number)
    );
  }

  patch = patchGuestSubmissionForDb(patch);

  const revertToPendingReview = body.revertToPendingReview === true;
  let statusGuard: string | null = null;

  if (revertToPendingReview && shouldRevertGuestFieldEditsToPendingReview(currentStatus)) {
    Object.assign(patch, pendingDocumentsClearPatchForGuestEditRevert());
    const documentRequirements = await resolveDocumentRequirements(propertyId);
    const baseline = parsePayloadRecord(body.revertBaselinePayload ?? {}, 'revertBaselinePayload');
    Object.assign(
      patch,
      requestPdfClearPatchForAdminPayload(baseline, patch, documentRequirements)
    );
    patch.document_requirement_completions = pendingDocumentsClearCompletionsJsonbPatch(
      body.currentDocumentRequirementCompletions ?? existing.document_requirement_completions
    );
    patch.status = 'PENDING_REVIEW';
    patch.status_updated_at = nowIso;
    statusGuard = currentStatus;
  }

  const booking = await updateBookingRow(bookingId, patch, {
    expectedStatus: statusGuard,
  });
  return { booking, changedColumns: Object.keys(patch) };
}

export function requiredPermissionsForOperation(
  operation: BookingDetailsOperation,
  body: Record<string, unknown>
): TeamPermissionId[] {
  switch (operation) {
    case 'reschedule':
      return ['bookings.detail.stay:edit'];
    case 'save_parking_rate_guest':
    case 'ensure_need_parking':
      return ['bookings.detail.parking:edit'];
    case 'clear_asset': {
      const assetTypeRaw = body.assetType;
      if (!isBookingAssetType(assetTypeRaw)) {
        throw new Error(`Invalid assetType: "${String(assetTypeRaw)}"`);
      }
      return [bookingAssetPermission(assetTypeRaw)];
    }
    case 'patch': {
      const payload = sanitizeBookingPatchPayload(body.payload);
      return requiredPermissionsForPatchColumns([
        ...Object.keys(payload),
        ...impliedBookingPatchColumns(payload),
      ]);
    }
    default:
      throw new Error('Unknown operation');
  }
}

export function parseBookingDetailsOperation(value: unknown): BookingDetailsOperation {
  const op = String(value ?? '').trim();
  if (
    op === 'patch' ||
    op === 'reschedule' ||
    op === 'clear_asset' ||
    op === 'save_parking_rate_guest' ||
    op === 'ensure_need_parking'
  ) {
    return op;
  }
  throw new Error('operation is required');
}
