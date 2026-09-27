/**
 * smart-pricing-preview — compute a Smart Pricing run without applying it.
 * Plan: docs/workflow/for-testing/smart-pricing-ai.md · architecture/smart-pricing.md
 *
 * POST ?property_id=<uuid>  (or org-route path)   (pricing.rates:edit + smartPricing plan)
 *   body { explain?: boolean }  — default true; false skips the (credit-costing) AI reasons
 *   → { runId, windowStart, windowEnd, base, summary, next30, historyConfidence, diff[], ai }
 *
 * The full result set is frozen on `property_smart_pricing_runs.payload`; the host then calls
 * `smart-pricing-apply` with the returned `runId` to persist it.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { identityFromRequest, rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { maybeRunSmartPricingAi } from '../_shared/smartPricingAi.ts';
import { computeSmartPricingForProperty, persistPreviewRun } from '../_shared/smartPricingRun.ts';

serveAuthenticated('smart-pricing-preview', async (req, user) => {
  if (req.method !== 'POST') return jsonError(req, 'Method not allowed', 405);

  const limited = await rateLimitGate(req, {
    scope: 'smart-pricing-preview',
    identity: identityFromRequest(req, user),
    limit: 20,
    windowSec: 3600,
  });
  if (limited) return limited;

  const { property, user: scopedUser } = await resolveScopedPropertyAccess(
    req,
    'pricing.smartPricing:edit'
  );
  const actorUser = user ?? scopedUser;

  try {
    await requirePropertyFeature(property.id, 'smartPricing');
  } catch (err) {
    const gate = catchPlanFeatureError(req, err);
    if (gate) return gate;
    throw err;
  }

  const body = await readJsonBody(req).catch(() => ({}));
  const explain = (body as Record<string, unknown>).explain !== false;

  try {
    const comp = await computeSmartPricingForProperty(property.id);

    // AI rationale / sanity pass — opt-out via { explain: false }; degrades to null on any error.
    const ai = explain ? await maybeRunSmartPricingAi(property.id, comp).catch(() => null) : null;

    const runId = await persistPreviewRun(property.id, comp, {
      createdBy: actorUser.id,
      ai: ai?.output ?? null,
      creditsConsumed: ai?.creditsConsumed ?? 0,
    });

    const diff = comp.results
      .filter((r) => r.skipped === null)
      .map((r) => ({
        date: r.date,
        weekday: r.weekday,
        baseRate: r.baseRate,
        recommendedRate: r.recommendedRate,
        deltaPct:
          r.baseRate > 0
            ? Math.round(((r.recommendedRate - r.baseRate) / r.baseRate) * 1000) / 10
            : 0,
        clampedBy: r.clampedBy,
        factors: r.factors,
      }));

    // Plain-language headline material — the next 30 eligible nights in ₱, not %.
    const next30 = diff.slice(0, 30).reduce(
      (acc, r) => ({
        nights: acc.nights + 1,
        currentTotal: acc.currentTotal + r.baseRate,
        smartTotal: acc.smartTotal + r.recommendedRate,
      }),
      { nights: 0, currentTotal: 0, smartTotal: 0 }
    );

    return jsonSuccess(req, {
      runId,
      windowStart: comp.windowStart,
      windowEnd: comp.windowEnd,
      base: comp.base,
      summary: comp.summary,
      next30,
      historyConfidence: comp.historyConfidence,
      skippedCount: comp.results.length - diff.length,
      diff,
      ai: ai?.output ?? null,
    });
  } catch (err) {
    return jsonError(req, (err as Error).message, 400);
  }
});
