/** Guest-facing mirror — keep in sync with org + edge `_shared/voucherRevealStyle.ts`. */

export type VoucherRevealStyle = 'reel' | 'wheel' | 'flip';

export const DEFAULT_VOUCHER_REVEAL_STYLE: VoucherRevealStyle = 'reel';

export function normalizeVoucherRevealStyle(raw: unknown): VoucherRevealStyle {
  if (raw === 'wheel' || raw === 'flip' || raw === 'reel') return raw;
  return DEFAULT_VOUCHER_REVEAL_STYLE;
}
