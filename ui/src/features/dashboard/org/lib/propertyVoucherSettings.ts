/**
 * Property voucher prize helpers — mirror `supabase/functions/_shared/voucher.ts`.
 */

export type PropertyVoucherPrize = {
  code: string;
  percentOff: number;
  /** Relative weight — real odds = weight / sum(weights). Host UI never requires a 100 sum. */
  chancePercent: number;
};

export const VOUCHER_PRESET_PERCENTS = [5, 10, 15, 20, 25, 50, 100] as const;

/** Default relative weights per discount tier (sum = 100 for readable defaults; not required). */
export const DEFAULT_VOUCHER_CHANCE_BY_PERCENT: Readonly<Record<number, number>> = {
  5: 25,
  10: 34,
  15: 20,
  20: 12,
  25: 5,
  50: 3,
  100: 1,
};

export const DEFAULT_PROPERTY_VOUCHER_PRIZES: ReadonlyArray<PropertyVoucherPrize> =
  VOUCHER_PRESET_PERCENTS.map((percentOff) => ({
    code: percentOff >= 100 ? 'FREE-STAY' : `OFF-${percentOff}`,
    percentOff,
    chancePercent: DEFAULT_VOUCHER_CHANCE_BY_PERCENT[percentOff] ?? 1,
  }));

export function defaultChanceForPercent(percentOff: number): number {
  return DEFAULT_VOUCHER_CHANCE_BY_PERCENT[percentOff] ?? 1;
}

export function suggestPropertyVoucherCode(
  percentOff: number,
  existing: ReadonlyArray<PropertyVoucherPrize>
): string {
  const base = percentOff >= 100 ? 'FREE-STAY' : `OFF-${percentOff}`;
  if (!existing.some((p) => p.code === base)) return base;
  let i = 2;
  while (existing.some((p) => p.code === `${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function normalizePropertyVoucherPrizes(raw: unknown): PropertyVoucherPrize[] {
  if (!Array.isArray(raw)) return [];
  const out: PropertyVoucherPrize[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const percentOff = Number(rec.percentOff ?? rec.percent_off);
    const chancePercent = Number(rec.chancePercent ?? rec.chance_percent);
    if (
      !Number.isFinite(percentOff) ||
      !Number.isInteger(percentOff) ||
      percentOff < 1 ||
      percentOff > 100
    ) {
      continue;
    }
    if (
      !Number.isFinite(chancePercent) ||
      !Number.isInteger(chancePercent) ||
      chancePercent <= 0 ||
      chancePercent > 10_000
    ) {
      continue;
    }
    let code = typeof rec.code === 'string' ? rec.code.trim().toUpperCase() : '';
    if (!code || code.length > 32) {
      code = suggestPropertyVoucherCode(percentOff, out);
    }
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ code, percentOff, chancePercent });
  }
  return out;
}

/** Empty / legacy amount-weight rows → show platform % defaults in the editor. */
export function voucherPrizesForEditor(stored: unknown): PropertyVoucherPrize[] {
  const normalized = normalizePropertyVoucherPrizes(stored);
  return normalized.length > 0
    ? normalized
    : DEFAULT_PROPERTY_VOUCHER_PRIZES.map((p) => ({ ...p }));
}

export function voucherPrizesEqual(a: PropertyVoucherPrize[], b: PropertyVoucherPrize[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (row, i) =>
      row.code === b[i]?.code &&
      row.percentOff === b[i]?.percentOff &&
      row.chancePercent === b[i]?.chancePercent
  );
}

export function voucherChanceSum(prizes: ReadonlyArray<PropertyVoucherPrize>): number {
  return prizes.reduce((sum, p) => sum + p.chancePercent, 0);
}

/** Normalized odds (0–100) for display — always sums ≈ 100 when weights &gt; 0. */
export function voucherDisplayPercents(prizes: ReadonlyArray<PropertyVoucherPrize>): number[] {
  const total = voucherChanceSum(prizes);
  if (total <= 0) return prizes.map(() => 0);
  return prizes.map((p) => Math.round((p.chancePercent / total) * 1000) / 10);
}

export function formatVoucherOddsLabel(oddsPercent: number): string {
  if (!Number.isFinite(oddsPercent) || oddsPercent <= 0) return '0%';
  const rounded = Math.round(oddsPercent * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function formatVoucherPrizeSummary(prizes: ReadonlyArray<PropertyVoucherPrize>): string {
  if (prizes.length === 0) return 'No prizes';
  const percents = [...new Set(prizes.map((p) => p.percentOff))].sort((a, b) => a - b);
  const hasFree = percents.includes(100);
  const paid = percents.filter((p) => p < 100);
  const range =
    paid.length === 0
      ? null
      : paid.length === 1
        ? `${paid[0]}% off`
        : `${paid[0]}–${paid[paid.length - 1]}% off`;
  const parts = [
    `${prizes.length} prize${prizes.length === 1 ? '' : 's'}`,
    range,
    hasFree ? 'free stay' : null,
  ].filter(Boolean);
  return parts.join(' · ');
}
