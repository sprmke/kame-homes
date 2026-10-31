/**
 * Smart Pricing — read-side merge helper.
 *
 * Kept separate from smartPricing.ts / smartPricingEngine.ts to avoid an import cycle with
 * propertyPricing.ts (which calls this from loadPropertyPricing). No engine, no history —
 * just "which applied per-date recommendations should the effective nightly rate use".
 *
 * A recommendation is merged only when BOTH hold:
 *   1. property_smart_pricing_settings.enabled = true
 *   2. the property is still entitled to the `smartPricing` plan feature
 * so a downgrade instantly stops smart rates from reaching guests without deleting anything.
 */

import { createServiceClient } from './orgAuth.ts';
import { resolvePropertyEntitlements } from './planEntitlements.ts';

export type AppliedSmartRecommendations = {
  /** enabled AND entitled — the merge is live. */
  active: boolean;
  /** YYYY-MM-DD -> recommended nightly rate (only when active). */
  recommendations: Record<string, number>;
};

const EMPTY: AppliedSmartRecommendations = { active: false, recommendations: {} };

export async function loadAppliedSmartRecommendations(
  propertyId: string,
  options?: { monthStart?: string; monthEnd?: string }
): Promise<AppliedSmartRecommendations> {
  const supabase = createServiceClient();

  const { data: settings, error: settingsError } = await supabase
    .from('property_smart_pricing_settings')
    .select('enabled')
    .eq('property_id', propertyId)
    .maybeSingle();
  if (settingsError) {
    console.warn('[smartPricingRead] settings load failed (non-fatal):', settingsError.message);
    return EMPTY;
  }
  if (!settings || settings.enabled !== true) return EMPTY;

  // Only the paid subset pays this extra check.
  let entitled = false;
  try {
    entitled = (await resolvePropertyEntitlements(propertyId)).smartPricing === true;
  } catch (err) {
    console.warn(
      '[smartPricingRead] entitlement check failed (non-fatal):',
      (err as Error).message
    );
    return EMPTY;
  }
  if (!entitled) return EMPTY;

  let query = supabase
    .from('property_smart_pricing_recommendations')
    .select('pricing_date, recommended_rate')
    .eq('property_id', propertyId)
    .eq('applied', true);
  if (options?.monthStart) query = query.gte('pricing_date', options.monthStart);
  if (options?.monthEnd) query = query.lte('pricing_date', options.monthEnd);

  const { data, error } = await query;
  if (error) {
    console.warn('[smartPricingRead] recommendations load failed (non-fatal):', error.message);
    return EMPTY;
  }

  const recommendations: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = String(row.pricing_date).slice(0, 10);
    const rate = Number(row.recommended_rate);
    // Never merge a non-positive rate into a guest quote.
    if (Number.isFinite(rate) && rate > 0) recommendations[key] = rate;
  }
  return { active: true, recommendations };
}

/**
 * How many applied recommendations are still live from `fromDate` (YYYY-MM-DD) forward.
 * The Smart Pricing modal uses this to decide whether to show the "applied / Undo"
 * affordances — `last_run_at` alone lingers after a clear and would mislead.
 * Fail-safe: 0 on any error.
 */
export async function countAppliedSmartRecommendations(
  propertyId: string,
  fromDate: string
): Promise<number> {
  try {
    const supabase = createServiceClient();
    const { count, error } = await supabase
      .from('property_smart_pricing_recommendations')
      .select('pricing_date', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('applied', true)
      .gte('pricing_date', fromDate);
    if (error) {
      console.warn('[smartPricingRead] applied count failed (non-fatal):', error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn('[smartPricingRead] applied count threw (non-fatal):', (err as Error).message);
    return 0;
  }
}
