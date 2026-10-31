/**
 * Mid-cycle plan-switch proration — Phase 7 of docs/workflow/in-progress/tier-feature-alignment-audit.md.
 *
 * Model: switching plans mid-cycle starts a **fresh** billing period from today (not a partial
 * period tacked onto the old renewal date). The host is credited for the unused portion of their
 * current period, applied against the new plan's full price — never a cash refund, never below ₱0.
 * Mirror on the client (preview only — server always recomputes the authoritative charge):
 * `ui/src/features/dashboard/plans/lib/planProration.ts`.
 */

export type ProrationQuote = {
  /** Whole days left in the current period, floored at 0 and capped at the period length. */
  remainingDays: number;
  /** Whole days in the current period (period end − period start). */
  totalPeriodDays: number;
  /** PHP credited for unused time on the current plan, capped at the target plan's price. */
  creditPhp: number;
  /** Target plan's full price (already tier-discounted), for display alongside the credit. */
  targetPricePhp: number;
  /** max(0, targetPricePhp − creditPhp), rounded to the nearest peso. */
  netDuePhp: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeMidCycleProration(input: {
  currentPricePhp: number;
  currentPeriodStartIso: string;
  currentPeriodEndIso: string;
  targetPricePhp: number;
  now?: Date;
}): ProrationQuote {
  const now = input.now ?? new Date();
  const periodStart = new Date(input.currentPeriodStartIso);
  const periodEnd = new Date(input.currentPeriodEndIso);

  const totalPeriodDays = Math.max(
    1,
    Math.round((periodEnd.getTime() - periodStart.getTime()) / MS_PER_DAY)
  );
  const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
  const remainingDays = Math.min(totalPeriodDays, Math.round(remainingMs / MS_PER_DAY));

  const dailyRate = input.currentPricePhp / totalPeriodDays;
  const creditPhpRaw = Math.max(0, dailyRate * remainingDays);
  // Never credit more than the new plan actually costs — no cash-back, only a floor at ₱0 due.
  const creditPhp = Math.round(Math.min(creditPhpRaw, input.targetPricePhp));
  const netDuePhp = Math.max(0, Math.round(input.targetPricePhp - creditPhp));

  return {
    remainingDays,
    totalPeriodDays,
    creditPhp,
    targetPricePhp: Math.round(input.targetPricePhp),
    netDuePhp,
  };
}
