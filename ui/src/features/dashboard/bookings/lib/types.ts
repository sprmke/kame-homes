import type { SdBank } from '@/features/guest/sd-form/lib/sdFormSchema';

import type { BookingStatus } from './bookingStatus';

/** One labeled amount row in the admin SD settlement form (JSONB on `guest_submissions`). */
export type SdSettlementLineItem = { label: string; amount: number };

/**
 * Snake-case row shape matching the Supabase `guest_submissions` table.
 * Admin UI speaks snake_case to stay aligned with the raw DB columns.
 * Fields added in Phase 0 migrations may be `null` on legacy rows.
 */
export type BookingKind = 'property' | 'parking';

export type BookingRow = {
  id: string;
  created_at: string;
  updated_at: string | null;

  /** property | parking — set by list-bookings. */
  booking_kind?: BookingKind | null;

  /** Populated on org-scoped list-bookings responses. */
  property_id?: string | null;
  property_name?: string | null;
  property_slug?: string | null;

  /** Populated on parking-scoped / org parking rows. */
  parking_id?: string | null;
  parking_name?: string | null;
  parking_slug?: string | null;

  // ── Guest identity ────────────────────────────────────────────────────────
  guest_facebook_name: string;
  primary_guest_name: string;
  guest_email: string;
  guest_phone_number: string;
  guest_address: string | null;
  nationality: string | null;

  // ── Additional guests ─────────────────────────────────────────────────────
  primary_guest_age: number | null;
  guest2_name: string | null;
  guest2_age: number | null;
  guest3_name: string | null;
  guest3_age: number | null;
  guest4_name: string | null;
  guest4_age: number | null;
  guest5_name: string | null;
  guest5_age: number | null;
  guest2_valid_id_url: string | null;
  guest3_valid_id_url: string | null;
  guest4_valid_id_url: string | null;
  guest5_valid_id_url: string | null;

  // ── Stay details ──────────────────────────────────────────────────────────
  check_in_date: string; // MM-DD-YYYY
  check_out_date: string; // MM-DD-YYYY
  check_in_time: string | null;
  check_out_time: string | null;
  number_of_adults: number;
  number_of_children: number | null;
  number_of_nights: number;

  // ── Parking ───────────────────────────────────────────────────────────────
  need_parking: boolean | null;
  car_plate_number: string | null;
  car_brand_model: string | null;
  car_color: string | null;
  parking_endorsement_url: string | null;
  parking_fee_included_in_downpayment?: boolean | null;
  parking_payment_receipt_url?: string | null;
  parking_receipt_ai_verdict?: string | null;
  parking_receipt_ai_summary?: string | null;

  // ── Parking broadcast (Phase 1: PENDING_HOST_ACCEPTANCE race-to-claim) ─────
  /** TTL deadline while status is PENDING_HOST_ACCEPTANCE — null once claimed/terminal. */
  parking_broadcast_expires_at?: string | null;
  parking_claimed_at?: string | null;
  parking_endorsement_note?: string | null;
  parking_request_organization_id?: string | null;
  /** TTL while status is PENDING_PAYMENT — null once paid or released. */
  parking_payment_expires_at?: string | null;

  // ── Parking endorsement automation (Phase 5) ────────────────────────────────
  endorsement_sent_at?: string | null;

  // ── Pets ──────────────────────────────────────────────────────────────────
  has_pets: boolean | null;
  pet_name: string | null;
  pet_type: string | null;
  pet_breed: string | null;
  pet_age: string | null;
  pet_vaccination_date: string | null;

  // ── How found / requests ──────────────────────────────────────────────────
  find_us: string | null;
  find_us_details: string | null;
  booking_source: string | null;
  guest_requests_surprise_decor?: boolean | null;
  surprise_decor_staff_acknowledged?: boolean | null;
  guest_special_requests: string | null;

  // ── Documents ─────────────────────────────────────────────────────────────
  valid_id_url: string | null;
  payment_receipt_url: string | null;
  pet_vaccination_url: string | null;
  pet_image_url: string | null;
  pdf_url: string | null;

  // ── Status & workflow ─────────────────────────────────────────────────────
  status: BookingStatus | string; // defensive against unknown values in the wild
  status_updated_at?: string | null;

  // Phase 0 additive columns — may be absent on prod until migration applied.
  booking_rate?: number | string | null;
  down_payment?: number | string | null;
  balance?: number | string | null;
  security_deposit?: number | string | null;
  parking_rate_guest?: number | string | null;
  parking_rate_paid?: number | string | null;
  parking_check_in_date?: string | null;
  parking_check_out_date?: string | null;
  parking_owner?: string | null;
  pet_fee?: number | string | null;
  guest_additional_fee?: number | string | null;
  approved_gaf_pdf_url?: string | null;
  approved_pet_pdf_url?: string | null;
  gaf_request_pdf_url?: string | null;
  pet_request_pdf_url?: string | null;
  gaf_completed_at?: string | null;
  parking_completed_at?: string | null;
  pet_completed_at?: string | null;
  /** Per-requirement-id completion map — see `lib/documentRequirements.ts#DocumentRequirementCompletion`. */
  document_requirement_completions?: Record<string, unknown> | null;
  sd_additional_expense_items?: SdSettlementLineItem[] | null;
  sd_additional_profit_items?: SdSettlementLineItem[] | null;
  sd_additional_expenses?: number[] | null;
  sd_additional_profits?: number[] | null;
  sd_refund_amount?: number | string | null;
  sd_refund_receipt_url?: string | null;
  sd_refund_receipt_ai_verdict?: string | null;
  sd_refund_receipt_ai_summary?: string | null;
  guest_balance_paid_amount?: number | string | null;
  guest_balance_payment_receipt_url?: string | null;
  dp_receipt_ai_verdict?: string | null;
  dp_receipt_ai_summary?: string | null;
  balance_receipt_ai_verdict?: string | null;
  balance_receipt_ai_summary?: string | null;
  valid_id_ai_verdict?: string | null;
  valid_id_ai_summary?: string | null;
  guest2_valid_id_ai_verdict?: string | null;
  guest2_valid_id_ai_summary?: string | null;
  guest3_valid_id_ai_verdict?: string | null;
  guest3_valid_id_ai_summary?: string | null;
  guest4_valid_id_ai_verdict?: string | null;
  guest4_valid_id_ai_summary?: string | null;
  guest5_valid_id_ai_verdict?: string | null;
  guest5_valid_id_ai_summary?: string | null;
  sd_refund_guest_feedback?: string | null;
  sd_refund_method?: 'same_phone' | 'other_bank' | 'cash' | null;
  sd_refund_phone_confirmed?: boolean | null;
  sd_refund_bank?: SdBank | null;
  sd_refund_account_name?: string | null;
  sd_refund_account_number?: string | null;
  sd_refund_form_submitted_at?: string | null;
  sd_refund_form_emailed_at?: string | null;
  /** Kind → last successful manual send ISO — Free-tier resend cooldown. */
  workflow_email_manual_sent_at?: Record<string, string> | null;
  stay_guide_token?: string | null;
  stay_guide_valid_from?: string | null;
  stay_guide_valid_until?: string | null;
  document_share_token?: string | null;
  settled_at?: string | null;

  // Calendar sync — OTA-ingested reservation provenance + guest-form completion link (Phase 2)
  external_source?: 'airbnb' | 'booking_com' | 'vrbo' | 'other' | null;
  external_uid?: string | null;
  external_feed_id?: string | null;
  guest_form_token?: string | null;
  guest_form_token_issued_at?: string | null;
  guest_form_completed_at?: string | null;

  // Next-stay Facebook-review voucher (awarded on /sd-form). Visible to admin
  // on the Pricing card once status = COMPLETED so it can be honoured later.
  next_stay_voucher_code?: string | null;
  next_stay_voucher_amount?: number | string | null;
  next_stay_voucher_awarded_at?: string | null;
  next_stay_voucher_redeemed_at?: string | null;
  next_stay_voucher_redeemed_booking_id?: string | null;
  /** Voucher applied to this booking (from a prior stay). */
  applied_voucher_source_booking_id?: string | null;
  applied_voucher_code?: string | null;
  applied_voucher_percent?: number | string | null;
  applied_voucher_discount_php?: number | string | null;
};

export type BookingsSort =
  | 'status_priority:asc'
  | 'check_in_date:asc'
  | 'check_in_date:desc'
  | 'created_at:desc'
  | 'created_at:asc';

export type BookingsQuery = {
  /** Free-text search (ilike across guest name + email). */
  q: string;
  /** Selected statuses. Empty = "any". */
  status: ReadonlyArray<string>;
  /** Check-in date range, ISO (YYYY-MM-DD). Unused until Phase 3's list-bookings endpoint lands. */
  from: string | null;
  to: string | null;
  hasPets: boolean | null;
  needParking: boolean | null;
  /** Org list: filter property stays vs parking reservations. */
  bookingKind: BookingKind | null;
  /**
   * When true, list includes COMPLETED rows. Default false hides completed
   * (cancelled stays hidden unless the status filter includes them). Active
   * stays from past check-in dates remain visible.
   */
  showCompletedBookings: boolean;
  sort: BookingsSort;
  page: number; // 1-indexed
  limit: number;
  /** When true and status includes IMPORTED, also match imported_from_batch_id rows. */
  expandImportedBatch?: boolean;
};

export const DEFAULT_BOOKINGS_QUERY: BookingsQuery = {
  q: '',
  status: [],
  from: null,
  to: null,
  hasPets: null,
  needParking: null,
  bookingKind: null,
  showCompletedBookings: false,
  sort: 'status_priority:asc',
  page: 1,
  limit: 31,
  expandImportedBatch: false,
};

export type BookingAiReviewSectionStatus =
  'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export type BookingAiReviewJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type BookingAiReviewFlag = {
  message: string;
  severity: 'info' | 'warning' | 'blocking';
};

export type BookingAiReviewSectionResult = {
  summary: string;
  flags: BookingAiReviewFlag[];
  fingerprint: string;
  reused: boolean;
  updated_at: string;
};

export type BookingAiReviewSectionId = 'stay_details' | 'guests' | 'parking' | 'pets' | 'pricing';

export type BookingAiReview = {
  id?: string;
  booking_id: string;
  property_id?: string | null;
  job_status: BookingAiReviewJobStatus;
  stay_details_status: BookingAiReviewSectionStatus;
  guests_status: BookingAiReviewSectionStatus;
  parking_status: BookingAiReviewSectionStatus;
  pets_status: BookingAiReviewSectionStatus;
  pricing_status: BookingAiReviewSectionStatus;
  stay_details_result?: BookingAiReviewSectionResult | null;
  guests_result?: BookingAiReviewSectionResult | null;
  parking_result?: BookingAiReviewSectionResult | null;
  pets_result?: BookingAiReviewSectionResult | null;
  pricing_result?: BookingAiReviewSectionResult | null;
  flag_count: number;
  has_blocking_flag: boolean;
  triggered_by?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Computed by GET/POST — sections whose inputs no longer match the stored run. */
  stale_sections?: BookingAiReviewSectionId[];
};
