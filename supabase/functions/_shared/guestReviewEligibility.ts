import { manilaTodayYmd, normalizeBookingDateToYmd } from './calendarAvailabilityManila.ts';

export function isAirbnbZeroSdBooking(row: Record<string, unknown>): boolean {
  const source = String(row.booking_source ?? '').trim();
  if (source !== 'Airbnb') return false;
  const sd = row.security_deposit != null ? Number(row.security_deposit) : 1500;
  return sd === 0;
}

export function checkoutOnOrBeforeTodayManila(checkOutDate: string | null | undefined): boolean {
  const ymd = normalizeBookingDateToYmd(String(checkOutDate ?? '').trim());
  if (!ymd) return false;
  return ymd <= manilaTodayYmd();
}

export type GuestReviewPath = 'sd_refund' | 'airbnb_post_stay';

export function resolveGuestReviewPath(row: Record<string, unknown>): GuestReviewPath | null {
  if (isAirbnbZeroSdBooking(row)) return 'airbnb_post_stay';

  const emailedAt =
    typeof row.sd_refund_form_emailed_at === 'string' ? row.sd_refund_form_emailed_at.trim() : '';
  if (row.status === 'READY_FOR_CHECKOUT') return 'sd_refund';
  if (row.status === 'READY_FOR_CHECKIN' && emailedAt) return 'sd_refund';
  return null;
}

export function canAccessGuestReview(row: Record<string, unknown>): boolean {
  const path = resolveGuestReviewPath(row);
  if (!path) return false;

  if (path === 'sd_refund') {
    const emailedAt =
      typeof row.sd_refund_form_emailed_at === 'string' ? row.sd_refund_form_emailed_at.trim() : '';
    const awaitingBalance = row.status === 'READY_FOR_CHECKIN' && emailedAt !== '';
    return row.status === 'READY_FOR_CHECKOUT' || awaitingBalance;
  }

  const status = String(row.status ?? '');
  if (status === 'COMPLETED' || status === 'READY_FOR_CHECKOUT') return true;
  if (status === 'READY_FOR_CHECKIN') {
    return checkoutOnOrBeforeTodayManila(row.check_out_date as string);
  }
  return false;
}

export function canClaimGuestReviewVoucher(row: Record<string, unknown>): boolean {
  if (isAirbnbZeroSdBooking(row)) {
    const status = String(row.status ?? '');
    return status === 'READY_FOR_CHECKOUT' || status === 'COMPLETED';
  }
  return row.status === 'READY_FOR_CHECKOUT';
}
