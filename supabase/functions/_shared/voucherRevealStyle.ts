/**
 * Guest voucher reveal animation style — keep UI mirror in sync:
 * `ui/src/features/dashboard/org/lib/voucherRevealStyle.ts`
 */

export type VoucherRevealStyle = 'reel' | 'wheel' | 'flip';

export const VOUCHER_REVEAL_STYLES: ReadonlyArray<VoucherRevealStyle> = ['reel', 'wheel', 'flip'];

export const DEFAULT_VOUCHER_REVEAL_STYLE: VoucherRevealStyle = 'reel';

export function isVoucherRevealStyle(value: unknown): value is VoucherRevealStyle {
  return (
    typeof value === 'string' && (VOUCHER_REVEAL_STYLES as ReadonlyArray<string>).includes(value)
  );
}

/** Coerce unknown stored/API values to a safe style (reads + bootstrap). */
export function normalizeVoucherRevealStyle(raw: unknown): VoucherRevealStyle {
  if (isVoucherRevealStyle(raw)) return raw;
  return DEFAULT_VOUCHER_REVEAL_STYLE;
}
