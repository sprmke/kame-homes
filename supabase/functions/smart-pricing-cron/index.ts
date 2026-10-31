/**
 * smart-pricing-cron — nightly autopilot sweep.
 * Plan: docs/workflow/in-progress/smart-pricing-ai.md · architecture/smart-pricing.md
 * Schedule: hosted pg_cron + pg_net (see docs/archive/operations/scheduled-jobs-and-testing.md),
 * NOT config.toml. Optional header X-Smart-Pricing-Cron-Secret when SMART_PRICING_CRON_SECRET is set.
 *
 * For every property with Smart Pricing enabled AND mode='autopilot' AND a live `smartPricing`
 * entitlement: recompute the forward window and re-apply. A material change raises one
 * `smart_pricing_updated` notification (deduped per property per day). Idempotent.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolvePropertyEntitlements } from '../_shared/planEntitlements.ts';
import { createOrCoalesceNotification } from '../_shared/notificationService.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';
import { resolveOrgIdForProperty } from '../_shared/aiUsageService.ts';
import { manilaTodayYmd } from '../_shared/calendarAvailabilityManila.ts';
import { maybeRunSmartPricingAi } from '../_shared/smartPricingAi.ts';
import {
  computeSmartPricingForProperty,
  runAutopilotForProperty,
} from '../_shared/smartPricingRun.ts';

const BATCH = 100;
const TIME_BUDGET_MS = 55_000;
/** Notify only when the sweep moved something meaningfully. */
const NOTIFY_MIN_NIGHTS_CHANGED = 5;
const NOTIFY_MIN_AVG_DELTA_PCT = 3;
/** Re-run the (credit-costing) AI pass at most this often per property. */
const AI_MIN_INTERVAL_DAYS = 6;

function cronSecretOk(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'SMART_PRICING_CRON_SECRET',
    headerName: 'x-smart-pricing-cron-secret',
  });
}

async function aiPassIsDue(propertyId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - AI_MIN_INTERVAL_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from('property_smart_pricing_runs')
    .select('id')
    .eq('property_id', propertyId)
    .eq('ai_used', true)
    .gte('created_at', cutoff)
    .limit(1);
  return !(data && data.length > 0);
}

serveCronPost('smart-pricing-cron', cronSecretOk, async () => {
  const supabase = createServiceClient();
  const startedAt = Date.now();

  const { data: rows, error } = await supabase
    .from('property_smart_pricing_settings')
    .select('property_id, ai_rationale_enabled, last_run_at')
    .eq('enabled', true)
    .eq('mode', 'autopilot')
    .order('last_run_at', { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) throw new Error(error.message);

  let processed = 0;
  let applied = 0;
  let notified = 0;
  let skippedNotEntitled = 0;
  const errors: Array<{ propertyId: string; error: string }> = [];

  for (const row of rows ?? []) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;
    const propertyId = row.property_id as string;

    try {
      const entitlements = await resolvePropertyEntitlements(propertyId);
      if (entitlements.smartPricing !== true) {
        skippedNotEntitled += 1;
        continue;
      }

      const comp = await computeSmartPricingForProperty(propertyId);

      let ai = null;
      let creditsConsumed = 0;
      if (row.ai_rationale_enabled === true && (await aiPassIsDue(propertyId))) {
        const aiResult = await maybeRunSmartPricingAi(propertyId, comp).catch(() => null);
        if (aiResult) {
          ai = aiResult.output;
          creditsConsumed = aiResult.creditsConsumed;
        }
      }

      const result = await runAutopilotForProperty(propertyId, { comp, ai, creditsConsumed });
      processed += 1;
      applied += result.applied;

      const material =
        result.summary.nightsChanged >= NOTIFY_MIN_NIGHTS_CHANGED ||
        Math.abs(result.summary.avgDeltaPct) >= NOTIFY_MIN_AVG_DELTA_PCT;
      if (material) {
        const organizationId = await resolveOrgIdForProperty(propertyId);
        if (organizationId) {
          const sign = result.summary.avgDeltaPct >= 0 ? '+' : '';
          await createOrCoalesceNotification({
            organizationId,
            propertyId,
            type: 'smart_pricing_updated',
            title: 'Smart Pricing updated your rates',
            body: `${result.summary.nightsChanged} night${
              result.summary.nightsChanged === 1 ? '' : 's'
            } adjusted (avg ${sign}${result.summary.avgDeltaPct}%).`,
            dedupeKey: `smart_pricing:${propertyId}:${manilaTodayYmd()}`,
            metadata: {
              nightsChanged: result.summary.nightsChanged,
              avgDeltaPct: result.summary.avgDeltaPct,
              runId: result.runId,
            },
          });
          notified += 1;
        }
      }
    } catch (err) {
      errors.push({ propertyId, error: (err as Error).message });
    }
  }

  return {
    candidates: rows?.length ?? 0,
    processed,
    applied,
    notified,
    skippedNotEntitled,
    errors,
  };
});
