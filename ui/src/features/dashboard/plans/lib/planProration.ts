/**
 * Client-side mirror of `_shared/subscriptionProration.ts` — preview only. The server always
 * recomputes and charges the authoritative amount at checkout time; never trust this for billing.
 */

export type ProrationQuote = {
  remainingDays: number;
  totalPeriodDays: number;
  creditPhp: number;
  targetPricePhp: number;
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
