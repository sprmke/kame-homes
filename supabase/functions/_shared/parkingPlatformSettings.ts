/**
 * Phase 4 — single resolver for the parkings vertical's platform-level config (commission %,
 * guest rate). Replaces direct reads of the Phase 2/3 interim stubs everywhere except as a
 * fallback here if the config row is somehow missing (shouldn't happen — the migration seeds
 * it). Callers should resolve this ONCE per operation and thread the values through, not
 * re-query per candidate/night — see `parkingBroadcastRanking.ts` and
 * `parkingPaymentOrchestrator.ts` for the established call shape.
 */

import { createServiceClient } from './orgAuth.ts';

/**
 * Fallback-only defaults (the Phase 2/3 interim flat stubs) — used solely if the singleton
 * `platform_parking_settings` row is somehow missing (shouldn't happen — the migration seeds
 * it). Kept here rather than in `parkingPricing.ts` to avoid a circular import between the two
 * modules; `parkingPricing.ts` reads live values through `resolveParkingPlatformSettings()`.
 */
const STUB_COMMISSION_PCT = 0.1;
/** Phase 8 default — half the standard stub, mirrors the migration's column default. */
const STUB_DIRECT_COMMISSION_PCT = 0.05;
const STUB_GUEST_PARKING_RATE_WEEKDAY = 400;
const STUB_GUEST_PARKING_RATE_WEEKEND = 400;

export type ParkingPlatformSettings = {
  commissionPct: number;
  /** Phase 8 — applied instead of commissionPct when a booking's channel is 'direct_link'. */
  directCommissionPct: number;
  guestRateWeekday: number;
  guestRateWeekend: number;
  supportEscalationPhone: string | null;
};

export async function resolveParkingPlatformSettings(): Promise<ParkingPlatformSettings> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('platform_parking_settings')
    .select(
      'commission_pct, direct_commission_pct, guest_rate_weekday, guest_rate_weekend, support_escalation_phone'
    )
    .eq('id', 1)
    .maybeSingle();

  return {
    commissionPct: Number(data?.commission_pct ?? STUB_COMMISSION_PCT),
    directCommissionPct: Number(data?.direct_commission_pct ?? STUB_DIRECT_COMMISSION_PCT),
    guestRateWeekday: Number(data?.guest_rate_weekday ?? STUB_GUEST_PARKING_RATE_WEEKDAY),
    guestRateWeekend: Number(data?.guest_rate_weekend ?? STUB_GUEST_PARKING_RATE_WEEKEND),
    supportEscalationPhone: (data?.support_escalation_phone as string | undefined)?.trim() || null,
  };
}
