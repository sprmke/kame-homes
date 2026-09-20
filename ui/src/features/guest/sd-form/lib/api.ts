import {
  appendGuestBookingAccess,
  guestBookingAccessFields,
  guestReviewFetchUrl,
  guestSdFormFetchUrl,
} from '@/features/guest/form/lib/guestBookingAccess';

import { prepareUpload } from '@/lib/media/prepareUpload';
import {
  appendAntiSpamToFormData,
  withAntiSpam,
  type AntiSpamRequestFields,
} from '@/lib/security/antiSpamRequest';
import { antiSpamErrorMessage, isAntiSpamFailure } from '@/lib/security/antiSpamResponse';


import type { SdBank } from './sdFormSchema';
import type { VoucherRevealStyle } from './voucherRevealStyle';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function fnHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    apikey: ANON,
    Authorization: `Bearer ${ANON}`,
  };
}

export type GuestReviewBootstrap = {
  bookingId: string;
  primary_guest_name: string;
  check_in_date: string;
  check_out_date: string;
  guest_review_submitted?: boolean;
  email_logo_url?: string;
  brand_color?: string;
  next_stay_voucher_code: string | null;
  next_stay_voucher_amount: number | null;
  review_path: 'airbnb_post_stay';
  vouchers_enabled?: boolean;
  voucher_prizes?: Array<{ code: string; percentOff: number; chancePercent: number }>;
  voucher_reveal_style?: VoucherRevealStyle;
};

export async function fetchGuestReview(bookingId: string): Promise<GuestReviewBootstrap> {
  const url = guestReviewFetchUrl(FUNCTIONS_URL, bookingId);
  const res = await fetch(url, { headers: fnHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data) {
    const msg =
      json.message ??
      json.error ??
      'This review link is not available. Please contact your host if you think this is a mistake.';
    throw new Error(typeof msg === 'string' ? msg : 'Review unavailable');
  }
  return json.data as GuestReviewBootstrap;
}

export type SdFormBootstrap = {
  bookingId: string;
  primary_guest_name: string;
  guest_phone_number: string;
  security_deposit: number;
  check_in_date: string;
  check_out_date: string;
  guest_review_submitted?: boolean;
  email_logo_url?: string;
  brand_color?: string;
  /** Persisted voucher (if guest already revealed it on a prior visit). */
  next_stay_voucher_code: string | null;
  next_stay_voucher_amount: number | null;
  /**
   * True while status is still Ready for check-in but the check-out email already went out;
   * refund submit stays closed until the stay moves to Ready for check-out.
   */
  awaiting_balance_settlement?: boolean;
  vouchers_enabled?: boolean;
  voucher_prizes?: Array<{ code: string; percentOff: number; chancePercent: number }>;
  voucher_reveal_style?: VoucherRevealStyle;
};

export type ClaimVoucherResponse = {
  code: string;
  amount: number;
  /** True if the booking already had a voucher (no new roll). */
  alreadyAwarded: boolean;
};

export async function claimSdVoucher(
  bookingId: string,
  antiSpam?: AntiSpamRequestFields
): Promise<ClaimVoucherResponse> {
  const res = await fetch(`${FUNCTIONS_URL}/claim-sd-voucher`, {
    method: 'POST',
    headers: fnHeaders(),
    body: JSON.stringify(
      withAntiSpam({ bookingId, ...guestBookingAccessFields(bookingId) }, antiSpam)
    ),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data) {
    if (isAntiSpamFailure(res.status, json)) {
      throw new Error(antiSpamErrorMessage(res.status, json));
    }
    throw new Error(json.error ?? json.message ?? `Could not claim voucher (${res.status})`);
  }
  return json.data as ClaimVoucherResponse;
}

export async function fetchSdForm(bookingId: string): Promise<SdFormBootstrap> {
  const url = guestSdFormFetchUrl(FUNCTIONS_URL, bookingId);
  const res = await fetch(url, { headers: fnHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data) {
    const msg =
      json.message ??
      json.error ??
      'This form is not available. Please use the link from your email or contact us on Facebook.';
    throw new Error(typeof msg === 'string' ? msg : 'Form unavailable');
  }
  return json.data as SdFormBootstrap;
}

export type SubmitSdRefundBody = {
  bookingId: string;
  /** Optional; omitted or empty stores null on the booking. */
  guestFeedback?: string | null;
  refund: {
    method: 'same_phone' | 'other_bank' | 'cash';
    phoneConfirmed?: boolean;
    bank?: SdBank;
    accountName?: string;
    accountNumber?: string;
  };
};

export async function submitGuestReview(
  input: {
    bookingId: string;
    starRating: number;
    reviewText?: string;
    feedbackTags?: string[];
    media?: File[];
  },
  antiSpam?: AntiSpamRequestFields
): Promise<void> {
  const form = new FormData();
  form.set('bookingId', input.bookingId);
  form.set('starRating', String(input.starRating));
  if (input.reviewText?.trim()) form.set('reviewText', input.reviewText.trim());
  if (input.feedbackTags?.length) {
    form.set('feedbackTags', JSON.stringify(input.feedbackTags));
  }
  for (const file of input.media ?? []) {
    const prepared = await prepareUpload(file, {
      imagePreset: 'CONTENT',
      surface: 'guest-review-media',
    });
    if (prepared.error) throw new Error(prepared.error);
    form.append('media', prepared.file);
  }
  appendGuestBookingAccess(form, input.bookingId);
  appendAntiSpamToFormData(form, antiSpam);

  const res = await fetch(`${FUNCTIONS_URL}/submit-guest-review`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    if (isAntiSpamFailure(res.status, json)) {
      throw new Error(antiSpamErrorMessage(res.status, json));
    }
    throw new Error(json.error ?? json.message ?? `Review submit failed (${res.status})`);
  }
}

export async function submitSdForm(
  body: SubmitSdRefundBody,
  antiSpam?: AntiSpamRequestFields
): Promise<void> {
  const res = await fetch(`${FUNCTIONS_URL}/submit-sd-form`, {
    method: 'POST',
    headers: fnHeaders(),
    body: JSON.stringify(
      withAntiSpam({ ...body, ...guestBookingAccessFields(body.bookingId) }, antiSpam)
    ),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    if (isAntiSpamFailure(res.status, json)) {
      throw new Error(antiSpamErrorMessage(res.status, json));
    }
    throw new Error(json.error ?? json.message ?? `Submit failed (${res.status})`);
  }
}
