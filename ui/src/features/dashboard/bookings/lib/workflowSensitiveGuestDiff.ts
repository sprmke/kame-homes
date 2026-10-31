import type { UpdateBookingPayload } from '@/features/dashboard/bookings/hooks/useUpdateBooking';
import {
  DEFAULT_DOCUMENT_REQUIREMENTS,
  type DocumentRequirement,
} from '@/features/dashboard/bookings/lib/documentRequirements';

/** True when some resolved requirement is triggered by (or literally is) pet approval. */
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

/** Match DB 12h / 24h / HH:mm:ss into HH:mm for comparison with admin form time inputs. */
function timeForCompare(value: string | null | undefined): string {
  const raw = trimText(value);
  if (!raw) return '';

  if (/^\d{2}:\d{2}$/.test(raw)) return raw;

  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);

  const m = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!m) return '';
  const hour12 = Number(m[1]);
  const minute = m[2];
  const ampm = m[3].toUpperCase();
  let hour24 = hour12 % 12;
  if (ampm === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${minute}`;
}

function sameNumber(a: number | null | undefined, b: number | null | undefined): boolean {
  const left = a == null || Number.isNaN(a) ? null : a;
  const right = b == null || Number.isNaN(b) ? null : b;
  return left === right;
}

function normDate(d: string | null | undefined): string {
  const s = trimText(d);
  if (!s) return '';
  // Payload dates are already YYYY-MM-DD from the edit form.
  return s;
}

/**
 * True when `draft` differs from `baseline` on any field that should force
 * status → PENDING_REVIEW while the booking is in the documents pipeline or
 * Ready for check-in (see docs/todos/ + booking-workflow.mdc §2.3).
 *
 * Compare two payloads built via `bookingEditPayloadFromValues` so form
 * defaults (empty ages, trimmed names) match the saved baseline on open.
 * Document replacements use `upload-booking-asset` instead of this payload.
 */
export function hasWorkflowSensitiveGuestFieldDiff(
  baseline: UpdateBookingPayload,
  draft: UpdateBookingPayload,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): boolean {
  if (!sameText(baseline.guest_facebook_name, draft.guest_facebook_name)) {
    return true;
  }
  if (!sameText(baseline.primary_guest_name, draft.primary_guest_name)) {
    return true;
  }
  if (!sameText(baseline.guest_email, draft.guest_email)) return true;
  if (!sameText(baseline.guest_phone_number, draft.guest_phone_number)) {
    return true;
  }

  if (!sameText(baseline.guest2_name, draft.guest2_name ?? null)) return true;
  if (!sameNumber(baseline.guest2_age, draft.guest2_age ?? null)) return true;
  if (!sameText(baseline.guest3_name, draft.guest3_name ?? null)) return true;
  if (!sameNumber(baseline.guest3_age, draft.guest3_age ?? null)) return true;
  if (!sameText(baseline.guest4_name, draft.guest4_name ?? null)) return true;
  if (!sameNumber(baseline.guest4_age, draft.guest4_age ?? null)) return true;
  if (!sameText(baseline.guest5_name, draft.guest5_name ?? null)) return true;
  if (!sameNumber(baseline.guest5_age, draft.guest5_age ?? null)) return true;

  if (normDate(baseline.check_in_date) !== normDate(draft.check_in_date ?? '')) {
    return true;
  }
  if (normDate(baseline.check_out_date) !== normDate(draft.check_out_date ?? '')) {
    return true;
  }

  if (timeForCompare(baseline.check_in_time) !== timeForCompare(draft.check_in_time ?? '')) {
    return true;
  }
  if (timeForCompare(baseline.check_out_time) !== timeForCompare(draft.check_out_time ?? '')) {
    return true;
  }

  if (!sameBool(baseline.guest_requests_surprise_decor, draft.guest_requests_surprise_decor)) {
    return true;
  }

  if (!sameBool(baseline.need_parking, draft.need_parking)) return true;
  if (draft.need_parking) {
    if (!sameText(baseline.car_plate_number, draft.car_plate_number)) return true;
    if (!sameText(baseline.car_brand_model, draft.car_brand_model)) return true;
    if (!sameText(baseline.car_color, draft.car_color)) return true;
  }

  // Pet details only revert the booking to review when a `has_pets`-triggered
  // requirement (or literal id `pet`) is actually configured for this
  // property — otherwise no downstream document workflow depends on them.
  if (petDocumentationConfigured(documentRequirements)) {
    if (!sameBool(baseline.has_pets, draft.has_pets)) return true;
    if (draft.has_pets) {
      if (!sameText(baseline.pet_name, draft.pet_name)) return true;
      if (!sameText(baseline.pet_type, draft.pet_type)) return true;
      if (!sameText(baseline.pet_breed, draft.pet_breed)) return true;
      if (!sameText(baseline.pet_age, draft.pet_age)) return true;
      if (normDate(baseline.pet_vaccination_date) !== normDate(draft.pet_vaccination_date ?? '')) {
        return true;
      }
    }
  }

  return false;
}

/** Clear stored request PDF URLs when an admin edit changes PDF fill content. */
export function requestPdfClearPatchForAdminGuestEdit(
  baseline: UpdateBookingPayload,
  draft: UpdateBookingPayload,
  documentRequirements: DocumentRequirement[] = DEFAULT_DOCUMENT_REQUIREMENTS
): Record<string, null> {
  const patch: Record<string, null> = {};

  if (!sameText(baseline.guest_facebook_name, draft.guest_facebook_name)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.primary_guest_name, draft.primary_guest_name)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest_email, draft.guest_email)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest_phone_number, draft.guest_phone_number)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest2_name, draft.guest2_name ?? null)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameNumber(baseline.guest2_age, draft.guest2_age ?? null)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest3_name, draft.guest3_name ?? null)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameNumber(baseline.guest3_age, draft.guest3_age ?? null)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest4_name, draft.guest4_name ?? null)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameNumber(baseline.guest4_age, draft.guest4_age ?? null)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameText(baseline.guest5_name, draft.guest5_name ?? null)) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameNumber(baseline.guest5_age, draft.guest5_age ?? null)) {
    patch.gaf_request_pdf_url = null;
  } else if (normDate(baseline.check_in_date) !== normDate(draft.check_in_date ?? '')) {
    patch.gaf_request_pdf_url = null;
  } else if (normDate(baseline.check_out_date) !== normDate(draft.check_out_date ?? '')) {
    patch.gaf_request_pdf_url = null;
  } else if (timeForCompare(baseline.check_in_time) !== timeForCompare(draft.check_in_time ?? '')) {
    patch.gaf_request_pdf_url = null;
  } else if (
    timeForCompare(baseline.check_out_time) !== timeForCompare(draft.check_out_time ?? '')
  ) {
    patch.gaf_request_pdf_url = null;
  } else if (
    !sameBool(baseline.guest_requests_surprise_decor, draft.guest_requests_surprise_decor)
  ) {
    patch.gaf_request_pdf_url = null;
  } else if (!sameBool(baseline.need_parking, draft.need_parking)) {
    patch.gaf_request_pdf_url = null;
  } else if (draft.need_parking) {
    if (!sameText(baseline.car_plate_number, draft.car_plate_number)) {
      patch.gaf_request_pdf_url = null;
    } else if (!sameText(baseline.car_brand_model, draft.car_brand_model)) {
      patch.gaf_request_pdf_url = null;
    } else if (!sameText(baseline.car_color, draft.car_color)) {
      patch.gaf_request_pdf_url = null;
    }
  } else if (!sameBool(baseline.has_pets, draft.has_pets)) {
    patch.gaf_request_pdf_url = null;
  }

  if (petDocumentationConfigured(documentRequirements)) {
    if (!sameBool(baseline.has_pets, draft.has_pets)) {
      patch.pet_request_pdf_url = null;
    } else if (draft.has_pets) {
      if (!sameText(baseline.pet_name, draft.pet_name)) patch.pet_request_pdf_url = null;
      else if (!sameText(baseline.pet_type, draft.pet_type)) patch.pet_request_pdf_url = null;
      else if (!sameText(baseline.pet_breed, draft.pet_breed)) patch.pet_request_pdf_url = null;
      else if (!sameText(baseline.pet_age, draft.pet_age)) patch.pet_request_pdf_url = null;
      else if (
        normDate(baseline.pet_vaccination_date) !== normDate(draft.pet_vaccination_date ?? '')
      ) {
        patch.pet_request_pdf_url = null;
      }
    }
  }

  return patch;
}
