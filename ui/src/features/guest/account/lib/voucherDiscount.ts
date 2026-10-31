/**
 * Shared voucher discount math for guest estimate + host review.
 */

export function resolveVoucherPercentOff(code: string, amount?: number | null): number {
  const c = code.trim().toUpperCase();
  if (c === 'FREE-STAY' || c === 'KAME-STAY' || c === 'OFF-100') return 100;
  if (typeof amount === 'number' && Number.isFinite(amount) && amount >= 1 && amount <= 100) {
    return Math.round(amount);
  }
  const m = /^OFF-(\d+)/i.exec(c);
  return m ? Math.min(100, Math.max(1, Number(m[1]))) : 0;
}

export function computePercentDiscountPhp(grossStayPhp: number, percentOff: number): number {
  if (!Number.isFinite(grossStayPhp) || grossStayPhp < 0) return 0;
  if (!Number.isFinite(percentOff) || percentOff <= 0) return 0;
  return Math.round(((grossStayPhp * Math.min(100, percentOff)) / 100) * 100) / 100;
}

export function formatVoucherOfferLabel(opts: {
  code: string;
  percentOff: number;
  legacyAmountPhp?: number | null;
}): string {
  if (opts.percentOff >= 100) return 'Free stay';
  if (opts.percentOff > 0) return `${opts.percentOff}% off`;
  if (opts.legacyAmountPhp != null && opts.legacyAmountPhp > 0) {
    return `₱${opts.legacyAmountPhp.toLocaleString('en-PH')} off`;
  }
  return opts.code;
}
