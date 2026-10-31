/**
 * Next-stay voucher display helpers for SD / guest-review reveal.
 * Server catalog: `supabase/functions/_shared/voucher.ts`.
 */

export type VoucherCode = string;

export interface Voucher {
  code: VoucherCode;
  /**
   * For OFF-* / FREE-STAY: percent off (1–100).
   * For legacy KAME-*: peso discount.
   */
  amount: number;
}

const DEFAULT_PERCENT_POOL: ReadonlyArray<Voucher> = [
  { code: 'OFF-5', amount: 5 },
  { code: 'OFF-10', amount: 10 },
  { code: 'OFF-15', amount: 15 },
  { code: 'OFF-20', amount: 20 },
  { code: 'OFF-25', amount: 25 },
  { code: 'OFF-50', amount: 50 },
  { code: 'FREE-STAY', amount: 100 },
];

export function isPercentOffVoucher(v: { code: string }): boolean {
  const c = v.code.trim().toUpperCase();
  if (c === 'FREE-STAY' || c === 'KAME-STAY') return true;
  return /^OFF-\d+(-\d+)?$/.test(c);
}

/** PHP liability for host finance — percent-off awards count as 0 until redeemed. */
export function voucherLiabilityPhp(code: string | null | undefined, amount: unknown): number {
  const c = typeof code === 'string' ? code.trim() : '';
  if (!c) return 0;
  if (isPercentOffVoucher({ code: c }) || isStaycationVoucher({ code: c })) return 0;
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

export function isStaycationVoucher(v: { code: string; amount?: number }): boolean {
  const c = v.code.trim().toUpperCase();
  if (c === 'FREE-STAY' || c === 'KAME-STAY' || c === 'OFF-100') return true;
  return isPercentOffVoucher(v) && v.amount === 100;
}

export function formatVoucherPrizeLabel(v: Pick<Voucher, 'code' | 'amount'>): string {
  if (isStaycationVoucher(v)) return 'Free stay';
  if (isPercentOffVoucher(v)) return `${v.amount}% off`;
  return `₱${v.amount.toLocaleString('en-PH')}`;
}

export function formatVoucherDiscountMaxLabel(prizes?: ReadonlyArray<Voucher>): string {
  const pool = prizes?.length ? prizes : DEFAULT_PERCENT_POOL;
  const paid = pool.filter((v) => !isStaycationVoucher(v)).map((v) => v.amount);
  const max = paid.length > 0 ? Math.max(...paid) : 50;
  if (pool.some(isPercentOffVoucher) || !prizes?.length) {
    return `up to ${max}% off`;
  }
  return `up to ₱${max.toLocaleString('en-PH')} discount`;
}

/** Max paid % in the default pool — for static teaser copy outside the reveal. */
export const VOUCHER_DISCOUNT_MAX_PERCENT = 50;

/** Slot reel decoys — property prizes when provided, else platform defaults. */
export function voucherReelPool(prizes?: ReadonlyArray<Voucher>): ReadonlyArray<Voucher> {
  if (prizes?.length) return prizes;
  return DEFAULT_PERCENT_POOL;
}

function voucherPrizeRank(v: Pick<Voucher, 'code' | 'amount'>): number {
  if (isStaycationVoucher(v)) return 10_000;
  return v.amount;
}

function dedupeVouchersByCode(vouchers: ReadonlyArray<Voucher>): Voucher[] {
  const seen = new Set<VoucherCode>();
  const out: Voucher[] = [];
  for (const v of vouchers) {
    if (seen.has(v.code)) continue;
    seen.add(v.code);
    out.push(v);
  }
  return out;
}

/**
 * Three ascending, non-redundant decoys in the slow pin before `winner`.
 */
export function pickPreWinnerTeasers(
  winner: Voucher,
  pool?: ReadonlyArray<Voucher>
): [Voucher, Voucher, Voucher] {
  const catalog = voucherReelPool(pool);
  const winnerRank = voucherPrizeRank(winner);

  const belowWinner = dedupeVouchersByCode(
    catalog.filter((v) => voucherPrizeRank(v) < winnerRank)
  ).sort((a, b) => voucherPrizeRank(a) - voucherPrizeRank(b));

  if (belowWinner.length >= 3) {
    return [
      belowWinner[belowWinner.length - 3]!,
      belowWinner[belowWinner.length - 2]!,
      belowWinner[belowWinner.length - 1]!,
    ];
  }

  const picked = new Map<VoucherCode, Voucher>();
  for (const v of belowWinner) {
    picked.set(v.code, v);
  }

  const fillers = dedupeVouchersByCode(catalog)
    .filter((v) => v.code !== winner.code && !picked.has(v.code))
    .sort((a, b) => voucherPrizeRank(a) - voucherPrizeRank(b));

  for (const v of fillers) {
    if (picked.size >= 3) break;
    picked.set(v.code, v);
  }

  const floor = catalog[0] ?? { code: 'OFF-5', amount: 5 };
  if (picked.size < 3 && !picked.has(floor.code)) {
    picked.set(floor.code, floor);
  }

  while (picked.size < 3) {
    const padCode = `OFF-PAD-${picked.size}`;
    picked.set(padCode, { code: padCode, amount: Math.max(1, winner.amount - picked.size) });
  }

  const ordered = [...picked.values()].sort((a, b) => voucherPrizeRank(a) - voucherPrizeRank(b));

  return [ordered[0]!, ordered[1]!, ordered[2]!];
}

export function findVoucher(code: string, amount?: number | null): Voucher | null {
  const normalized =
    code === 'FREE-STAY' || code === 'KAME-STAY' ? code : code.trim().toUpperCase();
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    return { code: normalized === 'KAME-STAY' ? 'FREE-STAY' : normalized, amount };
  }
  if (isStaycationVoucher({ code: normalized })) {
    return { code: normalized === 'KAME-STAY' ? 'FREE-STAY' : normalized, amount: 100 };
  }
  const m = /^OFF-(\d+)/i.exec(normalized);
  if (m) {
    return { code: normalized, amount: Number(m[1]) };
  }
  return null;
}

export function prizesToVouchers(
  prizes: ReadonlyArray<{ code: string; percentOff: number }>
): Voucher[] {
  return prizes.map((p) => ({ code: p.code, amount: p.percentOff }));
}

/** @deprecated Prefer voucherReelPool — kept for any leftover imports. */
export const VOUCHER_REEL_POOL = DEFAULT_PERCENT_POOL;
