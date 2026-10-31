/**
 * SD refund cron lead-window math — shared with Deno unit tests.
 * Parses Manila check-out datetime and decides when the lead window opens.
 */

export const MANILA_TZ = 'Asia/Manila';

/**
 * Parse a booking's check-out date + time into a Date in Asia/Manila.
 *
 * check_out_date is stored as MM-DD-YYYY text.
 * check_out_time is stored as HH:MM AM/PM (e.g. "11:00 AM") or 24h (e.g. "11:00").
 */
export function parseCheckoutManila(checkOutDate: string, checkOutTime: string): Date | null {
  try {
    let isoDate: string;
    if (/^\d{2}-\d{2}-\d{4}$/.test(checkOutDate)) {
      const [m, d, y] = checkOutDate.split('-');
      isoDate = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(checkOutDate)) {
      isoDate = checkOutDate;
    } else {
      return null;
    }

    let hour24 = 0;
    let minute = 0;

    const ampm = checkOutTime?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (ampm) {
      let h = parseInt(ampm[1], 10);
      const m = parseInt(ampm[2], 10);
      const period = ampm[3].toUpperCase();
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      hour24 = h;
      minute = m;
    } else {
      const plain = checkOutTime?.match(/(\d{1,2}):(\d{2})/);
      if (plain) {
        hour24 = parseInt(plain[1], 10);
        minute = parseInt(plain[2], 10);
      }
    }

    const localStr = `${isoDate}T${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
    return new Date(`${localStr}+08:00`);
  } catch {
    return null;
  }
}

export function normalizeSdRefundLeadMinutes(raw: number): number {
  if (Number.isNaN(raw) || raw < 0) return 180;
  return raw;
}

export function computeSdRefundLeadEligibleAtMs(checkoutDt: Date, leadMinutes: number): number {
  const lead = normalizeSdRefundLeadMinutes(leadMinutes);
  return checkoutDt.getTime() - lead * 60 * 1000;
}

export type SdRefundLeadWindowResult =
  | {
      due: true;
      checkoutDt: Date;
      eligibleAtMs: number;
      minutesRemaining: 0;
    }
  | {
      due: false;
      checkoutDt: Date;
      eligibleAtMs: number;
      minutesRemaining: number;
    }
  | {
      due: false;
      checkoutDt: null;
      eligibleAtMs: null;
      minutesRemaining: 0;
      reason: 'unparseable_checkout_datetime';
    };

export function evaluateSdRefundLeadWindow(input: {
  checkOutDate: string;
  checkOutTime: string;
  leadMinutes: number;
  nowMs: number;
}): SdRefundLeadWindowResult {
  const checkoutDt = parseCheckoutManila(input.checkOutDate, input.checkOutTime);
  if (!checkoutDt) {
    return {
      due: false,
      checkoutDt: null,
      eligibleAtMs: null,
      minutesRemaining: 0,
      reason: 'unparseable_checkout_datetime',
    };
  }

  const leadMinutes = normalizeSdRefundLeadMinutes(input.leadMinutes);
  const eligibleAtMs = computeSdRefundLeadEligibleAtMs(checkoutDt, leadMinutes);
  const isDue = input.nowMs >= eligibleAtMs;

  if (isDue) {
    return { due: true, checkoutDt, eligibleAtMs, minutesRemaining: 0 };
  }

  return {
    due: false,
    checkoutDt,
    eligibleAtMs,
    minutesRemaining: Math.max(1, Math.ceil((eligibleAtMs - input.nowMs) / 60000)),
  };
}
