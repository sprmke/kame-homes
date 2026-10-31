/**
 * Guest voucher reveal animation style — mirror `supabase/functions/_shared/voucherRevealStyle.ts`.
 */

export type VoucherRevealStyle = 'reel' | 'wheel' | 'flip';

export const VOUCHER_REVEAL_STYLES: ReadonlyArray<VoucherRevealStyle> = ['reel', 'wheel', 'flip'];

export const DEFAULT_VOUCHER_REVEAL_STYLE: VoucherRevealStyle = 'reel';

export function isVoucherRevealStyle(value: unknown): value is VoucherRevealStyle {
  return (
    typeof value === 'string' && (VOUCHER_REVEAL_STYLES as ReadonlyArray<string>).includes(value)
  );
}

export function normalizeVoucherRevealStyle(raw: unknown): VoucherRevealStyle {
  if (isVoucherRevealStyle(raw)) return raw;
  return DEFAULT_VOUCHER_REVEAL_STYLE;
}

export function voucherRevealStyleLabel(style: VoucherRevealStyle): string {
  switch (style) {
    case 'wheel':
      return 'Wheel';
    case 'flip':
      return 'Flip';
    default:
      return 'Reel';
  }
}
