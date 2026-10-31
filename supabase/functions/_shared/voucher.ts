/**
 * Next-stay voucher catalog and weighted roll (% off).
 *
 * Server is the source of truth. Property `app_settings.voucher_prizes` may
 * override the default pool; empty/invalid stored prizes fall back to defaults.
 * Keep UI mirrors in sync:
 * - `ui/.../org/lib/propertyVoucherSettings.ts`
 * - `ui/.../sd-form/lib/voucher.ts`
 *
 * Prize shape: `{ code, percentOff, chancePercent }`.
 * Awarded bookings store `next_stay_voucher_amount` = percentOff (1–100).
 * Legacy peso awards (`KAME-*` codes) still read amount as PHP.
 */

export type VoucherPrize = {
  code: string;
  /** Discount percent for the next stay (1–100). 100 = free stay. */
  percentOff: number;
  /** Relative weight — real odds = weight / sum(weights). No host sum-to-100 required. */
  chancePercent: number;
};

/** Legacy fixed codes still accepted when reading awarded bookings. */
export type VoucherCode =
  | 'OFF-5'
  | 'OFF-10'
  | 'OFF-15'
  | 'OFF-20'
  | 'OFF-25'
  | 'OFF-50'
  | 'FREE-STAY'
  | 'KAME-STAY'
  | string;

const PRESET_PERCENTS = [5, 10, 15, 20, 25, 50, 100] as const;

/** Default relative weights per tier (sum = 100 for readable defaults; roll uses ratios). */
export const DEFAULT_VOUCHER_CHANCE_BY_PERCENT: Readonly<Record<number, number>> = {
  5: 25,
  10: 34,
  15: 20,
  20: 12,
  25: 5,
  50: 3,
  100: 1,
};

/** Platform % off catalog — all presets with rarity-weighted chances. */
export const DEFAULT_VOUCHER_PRIZES: ReadonlyArray<VoucherPrize> = PRESET_PERCENTS.map(
  (percentOff) => ({
    code: percentOff >= 100 ? 'FREE-STAY' : `OFF-${percentOff}`,
    percentOff,
    chancePercent: DEFAULT_VOUCHER_CHANCE_BY_PERCENT[percentOff] ?? 1,
  })
);

function isFinitePosInt(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isInteger(value)
  );
}

function isFinitePercentOff(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 100
  );
}

export function suggestVoucherCode(
  percentOff: number,
  existing: ReadonlyArray<VoucherPrize>
): string {
  const base = percentOff >= 100 ? 'FREE-STAY' : `OFF-${percentOff}`;
  if (!existing.some((p) => p.code === base)) return base;
  let i = 2;
  while (existing.some((p) => p.code === `${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function normalizeVoucherPrizes(raw: unknown): VoucherPrize[] {
  if (!Array.isArray(raw)) return [];
  const out: VoucherPrize[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const percentOffRaw =
      typeof rec.percentOff === 'number'
        ? rec.percentOff
        : typeof rec.percent_off === 'number'
          ? rec.percent_off
          : Number(rec.percentOff ?? rec.percent_off);
    const chanceRaw =
      typeof rec.chancePercent === 'number'
        ? rec.chancePercent
        : typeof rec.chance_percent === 'number'
          ? rec.chance_percent
          : Number(rec.chancePercent ?? rec.chance_percent);
    // Legacy amount/weight rows are ignored — hosts get platform % defaults.
    if (!isFinitePercentOff(percentOffRaw)) continue;
    if (!isFinitePosInt(chanceRaw) || chanceRaw > 10_000) continue;
    let code = typeof rec.code === 'string' ? rec.code.trim().toUpperCase() : '';
    if (!code || code.length > 32) {
      code = suggestVoucherCode(percentOffRaw, out);
    }
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ code, percentOff: percentOffRaw, chancePercent: chanceRaw });
  }
  return out;
}

/** Empty / unparseable stored list → platform defaults. */
export function resolveVoucherPrizes(stored: unknown): VoucherPrize[] {
  const normalized = normalizeVoucherPrizes(stored);
  return normalized.length > 0 ? normalized : [...DEFAULT_VOUCHER_PRIZES];
}

export function isPercentOffVoucherCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  if (c === 'FREE-STAY' || c === 'KAME-STAY') return true;
  return /^OFF-\d+(-\d+)?$/.test(c);
}

export function isStaycationVoucherCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  return c === 'FREE-STAY' || c === 'KAME-STAY' || c === 'OFF-100';
}

/**
 * PHP liability for host finance. Percent-off awards have unknown peso value
 * until redeemed — count as 0. Legacy KAME-* peso awards still use amount.
 */
export function voucherLiabilityPhp(code: string | null | undefined, amount: unknown): number {
  const c = typeof code === 'string' ? code.trim() : '';
  if (!c) return 0;
  if (isPercentOffVoucherCode(c) || isStaycationVoucherCode(c)) return 0;
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

export function voucherPercentFor(code: string, prizes?: ReadonlyArray<VoucherPrize>): number {
  if (isStaycationVoucherCode(code)) return 100;
  if (prizes?.length) {
    const hit = prizes.find((p) => p.code === code);
    if (hit) return hit.percentOff;
  }
  const m = /^OFF-(\d+)/i.exec(code.trim());
  if (m) return Math.min(100, Math.max(1, Number(m[1])));
  return 0;
}

/**
 * Pick one voucher from the given prizes (or platform defaults).
 * Uses Web Crypto when available so the result is not predictable.
 * Returns `amount` = percentOff for persistence on the booking.
 */
export function rollVoucher(storedPrizes?: unknown): { code: string; amount: number } {
  const weights = resolveVoucherPrizes(storedPrizes);
  const total = weights.reduce((sum, row) => sum + row.chancePercent, 0);
  if (total <= 0) {
    const fallback = DEFAULT_VOUCHER_PRIZES[1] ?? DEFAULT_VOUCHER_PRIZES[0]!;
    return { code: fallback.code, amount: fallback.percentOff };
  }

  let roll = 0;
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    roll = buf[0] % total;
  } else {
    roll = Math.floor(Math.random() * total);
  }

  for (const { code, chancePercent, percentOff } of weights) {
    if (roll < chancePercent) {
      return { code, amount: percentOff };
    }
    roll -= chancePercent;
  }

  const fallback = weights[weights.length - 1]!;
  return { code: fallback.code, amount: fallback.percentOff };
}

export function voucherChanceSum(prizes: ReadonlyArray<VoucherPrize>): number {
  return prizes.reduce((sum, p) => sum + p.chancePercent, 0);
}

export function voucherDisplayPercents(prizes: ReadonlyArray<VoucherPrize>): number[] {
  const total = voucherChanceSum(prizes);
  if (total <= 0) return prizes.map(() => 0);
  return prizes.map((p) => Math.round((p.chancePercent / total) * 1000) / 10);
}

export function voucherPresetPercents(): ReadonlyArray<number> {
  return PRESET_PERCENTS;
}
