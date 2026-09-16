/**
 * Apply a previously awarded next-stay voucher onto a new booking (same property).
 */

import type { SupabaseClient } from './supabaseJs.ts';

import { isPercentOffVoucherCode, isStaycationVoucherCode, voucherPercentFor } from './voucher.ts';

export type AppliedVoucherSnapshot = {
  sourceBookingId: string;
  code: string;
  percent: number;
  /** Legacy peso-only awards when percent is 0. */
  legacyDiscountPhp: number | null;
};

export function resolveAwardPercent(code: string, amount: unknown): number {
  if (isStaycationVoucherCode(code)) return 100;
  if (isPercentOffVoucherCode(code)) {
    const fromAmount =
      typeof amount === 'number'
        ? amount
        : typeof amount === 'string'
          ? Number(amount)
          : Number.NaN;
    if (Number.isFinite(fromAmount) && fromAmount >= 1 && fromAmount <= 100) {
      return Math.round(fromAmount);
    }
    return voucherPercentFor(code);
  }
  return 0;
}

export function computeVoucherDiscountPhp(
  grossStayPhp: number,
  code: string,
  amount: unknown
): number {
  const gross = Number(grossStayPhp);
  if (!Number.isFinite(gross) || gross < 0) return 0;
  const percent = resolveAwardPercent(code, amount);
  if (percent > 0) {
    return Math.round(((gross * percent) / 100) * 100) / 100;
  }
  const peso = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(peso) || peso < 0) return 0;
  return Math.min(gross, Math.round(peso * 100) / 100);
}

type AwardRow = {
  id: string;
  property_id: string | null;
  guest_user_id: string | null;
  guest_email: string | null;
  next_stay_voucher_code: string | null;
  next_stay_voucher_amount: number | string | null;
  next_stay_voucher_redeemed_at: string | null;
};

function voucherOwnershipOk(award: AwardRow, guestUserId: string, guestEmail: string): boolean {
  const email = guestEmail.trim().toLowerCase();
  const ownsByUser = award.guest_user_id === guestUserId;
  const ownsByEmail =
    !award.guest_user_id &&
    typeof award.guest_email === 'string' &&
    award.guest_email.trim().toLowerCase() === email;
  return ownsByUser || ownsByEmail;
}

function snapshotFromAward(award: AwardRow): AppliedVoucherSnapshot {
  const code = String(award.next_stay_voucher_code).trim().toUpperCase();
  const percent = resolveAwardPercent(code, award.next_stay_voucher_amount);
  const legacyDiscountPhp =
    percent <= 0
      ? (() => {
          const n = Number(award.next_stay_voucher_amount);
          return Number.isFinite(n) && n > 0 ? n : null;
        })()
      : null;
  return {
    sourceBookingId: award.id,
    code,
    percent,
    legacyDiscountPhp,
  };
}

/**
 * Read-only eligibility check (call before persisting a new booking).
 */
export async function assertVoucherEligible(
  supabase: SupabaseClient,
  opts: {
    redeemingBookingId: string;
    propertyId: string;
    guestUserId: string;
    guestEmail: string;
    sourceBookingId: string;
  }
): Promise<AppliedVoucherSnapshot> {
  const sourceId = opts.sourceBookingId.trim();
  if (!sourceId) throw new Error('VOUCHER_INVALID: Missing voucher selection.');
  if (sourceId === opts.redeemingBookingId) {
    throw new Error('VOUCHER_INVALID: Cannot apply a voucher from the same booking.');
  }

  const { data: redeeming, error: redeemingErr } = await supabase
    .from('guest_submissions')
    .select('id, applied_voucher_source_booking_id')
    .eq('id', opts.redeemingBookingId)
    .maybeSingle();

  if (redeemingErr) throw new Error(`Failed to load booking: ${redeemingErr.message}`);
  // New booking may not exist yet — only check lock when the row is present.
  if (redeeming) {
    const alreadySource = (redeeming as { applied_voucher_source_booking_id?: string | null })
      .applied_voucher_source_booking_id;
    if (alreadySource && alreadySource !== sourceId) {
      throw new Error('VOUCHER_LOCKED: A voucher is already applied to this booking.');
    }
    if (alreadySource === sourceId) {
      const { data: existing } = await supabase
        .from('guest_submissions')
        .select('applied_voucher_code, applied_voucher_percent, applied_voucher_discount_php')
        .eq('id', opts.redeemingBookingId)
        .maybeSingle();
      const code = String(
        (existing as { applied_voucher_code?: string } | null)?.applied_voucher_code ?? ''
      );
      const percent = Number(
        (existing as { applied_voucher_percent?: number } | null)?.applied_voucher_percent ?? 0
      );
      const legacy =
        (existing as { applied_voucher_discount_php?: number } | null)
          ?.applied_voucher_discount_php ?? null;
      return {
        sourceBookingId: sourceId,
        code,
        percent,
        legacyDiscountPhp: percent <= 0 && legacy != null ? Number(legacy) : null,
      };
    }
  }

  const { data: source, error: sourceErr } = await supabase
    .from('guest_submissions')
    .select(
      'id, property_id, guest_user_id, guest_email, next_stay_voucher_code, next_stay_voucher_amount, next_stay_voucher_redeemed_at'
    )
    .eq('id', sourceId)
    .maybeSingle();

  if (sourceErr) throw new Error(`Failed to load voucher: ${sourceErr.message}`);
  const award = source as AwardRow | null;
  if (!award?.next_stay_voucher_code) {
    throw new Error('VOUCHER_INVALID: That voucher is not available.');
  }
  if (award.next_stay_voucher_redeemed_at) {
    throw new Error('VOUCHER_USED: That voucher was already redeemed.');
  }
  if (!award.property_id || award.property_id !== opts.propertyId) {
    throw new Error('VOUCHER_PROPERTY: Vouchers can only be used at the same property.');
  }
  if (!voucherOwnershipOk(award, opts.guestUserId, opts.guestEmail)) {
    throw new Error('VOUCHER_FORBIDDEN: This voucher belongs to another guest.');
  }

  return snapshotFromAward(award);
}

/**
 * Race-safe redeem: mark source awarded, then stamp redeeming booking.
 */
export async function applyVoucherToBooking(
  supabase: SupabaseClient,
  opts: {
    redeemingBookingId: string;
    propertyId: string;
    guestUserId: string;
    guestEmail: string;
    sourceBookingId: string;
  }
): Promise<AppliedVoucherSnapshot> {
  const snapshot = await assertVoucherEligible(supabase, opts);
  const sourceId = snapshot.sourceBookingId;

  const { data: redeeming } = await supabase
    .from('guest_submissions')
    .select('applied_voucher_source_booking_id')
    .eq('id', opts.redeemingBookingId)
    .maybeSingle();
  if (
    (redeeming as { applied_voucher_source_booking_id?: string | null } | null)
      ?.applied_voucher_source_booking_id === sourceId
  ) {
    return snapshot;
  }

  const { data: source, error: sourceErr } = await supabase
    .from('guest_submissions')
    .select(
      'id, property_id, guest_user_id, guest_email, next_stay_voucher_code, next_stay_voucher_amount, next_stay_voucher_redeemed_at'
    )
    .eq('id', sourceId)
    .maybeSingle();

  if (sourceErr) throw new Error(`Failed to load voucher: ${sourceErr.message}`);
  const award = source as AwardRow | null;
  if (!award?.next_stay_voucher_code) {
    throw new Error('VOUCHER_INVALID: That voucher is not available.');
  }
  if (award.next_stay_voucher_redeemed_at) {
    throw new Error('VOUCHER_USED: That voucher was already redeemed.');
  }

  const fresh = snapshotFromAward(award);
  const redeemedAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from('guest_submissions')
    .update({
      next_stay_voucher_redeemed_at: redeemedAt,
      next_stay_voucher_redeemed_booking_id: opts.redeemingBookingId,
      guest_user_id: award.guest_user_id ?? opts.guestUserId,
      updated_at: redeemedAt,
    })
    .eq('id', sourceId)
    .is('next_stay_voucher_redeemed_at', null)
    .not('next_stay_voucher_code', 'is', null)
    .select('id')
    .maybeSingle();

  if (claimErr) throw new Error(`Failed to redeem voucher: ${claimErr.message}`);
  if (!claimed) {
    throw new Error('VOUCHER_USED: That voucher was already redeemed.');
  }

  const { error: stampErr } = await supabase
    .from('guest_submissions')
    .update({
      applied_voucher_source_booking_id: sourceId,
      applied_voucher_code: fresh.code,
      applied_voucher_percent: fresh.percent > 0 ? fresh.percent : null,
      // Legacy peso awards: persist provisional discount until host review.
      applied_voucher_discount_php: fresh.legacyDiscountPhp,
      updated_at: redeemedAt,
    })
    .eq('id', opts.redeemingBookingId);

  if (stampErr) {
    await supabase
      .from('guest_submissions')
      .update({
        next_stay_voucher_redeemed_at: null,
        next_stay_voucher_redeemed_booking_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sourceId)
      .eq('next_stay_voucher_redeemed_booking_id', opts.redeemingBookingId);
    throw new Error(`Failed to apply voucher: ${stampErr.message}`);
  }

  return fresh;
}

/**
 * When a redeeming booking is cancelled, return the award to the guest wallet.
 */
export async function releaseAppliedVoucherOnCancel(
  supabase: SupabaseClient,
  redeemingBooking: {
    id: string;
    applied_voucher_source_booking_id?: string | null;
  }
): Promise<void> {
  const sourceId =
    typeof redeemingBooking.applied_voucher_source_booking_id === 'string'
      ? redeemingBooking.applied_voucher_source_booking_id.trim()
      : '';
  if (!sourceId) return;

  const now = new Date().toISOString();
  const { error: restoreErr } = await supabase
    .from('guest_submissions')
    .update({
      next_stay_voucher_redeemed_at: null,
      next_stay_voucher_redeemed_booking_id: null,
      updated_at: now,
    })
    .eq('id', sourceId)
    .eq('next_stay_voucher_redeemed_booking_id', redeemingBooking.id);

  if (restoreErr) {
    console.error('[voucherRedemption] restore award on cancel failed:', restoreErr.message);
  }

  const { error: clearErr } = await supabase
    .from('guest_submissions')
    .update({
      applied_voucher_source_booking_id: null,
      applied_voucher_code: null,
      applied_voucher_percent: null,
      applied_voucher_discount_php: null,
      updated_at: now,
    })
    .eq('id', redeemingBooking.id);

  if (clearErr) {
    console.error('[voucherRedemption] clear applied voucher on cancel failed:', clearErr.message);
  }
}
