/**
 * smart-pricing-apply — persist a previewed Smart Pricing run, or clear all recommendations.
 * Plan: docs/workflow/in-progress/smart-pricing-ai.md · architecture/smart-pricing.md
 *
 * POST ?property=<id|slug>   (pricing.rates:edit + smartPricing plan)
 *   { runId, ranges?: [{ start, end }] }   → apply the frozen run (all, or only the given ranges)
 *   { clear: true }                        → drop every applied recommendation (back to manual rates)
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { applyRun, clearRecommendations } from '../_shared/smartPricingRun.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serveAuthenticated('smart-pricing-apply', async (req) => {
  if (req.method !== 'POST') return jsonError(req, 'Method not allowed', 405);

  const access = await resolveScopedPropertyAccess(req, 'pricing.smartPricing:edit');
  const { property, user } = access;

  try {
    await requirePropertyFeature(property.id, 'smartPricing');
  } catch (err) {
    const gate = catchPlanFeatureError(req, err);
    if (gate) return gate;
    throw err;
  }

  const body = await readJsonBody(req);

  if (body.clear === true) {
    try {
      await clearRecommendations(property.id);
      await logAssetActivity({
        req,
        user,
        action: 'pricing.smart_config_changed',
        propertyId: property.id,
        organizationId: access.org.id,
        accessKind: access.accessKind,
        memberId: access.memberId,
        targetId: property.id,
        targetLabel: property.name ?? null,
        metadata: { operation: 'cleared_recommendations' },
      });
      return jsonSuccess(req, { cleared: true });
    } catch (err) {
      return jsonError(req, (err as Error).message, 400);
    }
  }

  const runId = String(body.runId ?? '');
  if (!UUID_RE.test(runId)) return jsonError(req, 'runId is required', 400);

  let ranges: Array<{ start: string; end: string }> | undefined;
  if (body.ranges !== undefined) {
    if (!Array.isArray(body.ranges)) return jsonError(req, 'ranges must be an array', 400);
    ranges = [];
    for (const raw of body.ranges) {
      const r = (raw ?? {}) as Record<string, unknown>;
      const start = String(r.start ?? '');
      const end = String(r.end ?? '');
      if (!YMD_RE.test(start) || !YMD_RE.test(end) || start > end) {
        return jsonError(req, 'each range needs start <= end as YYYY-MM-DD', 400);
      }
      ranges.push({ start, end });
    }
    if (ranges.length === 0) ranges = undefined;
  }

  try {
    const result = await applyRun(property.id, runId, { ranges, createdBy: user.id });
    await logAssetActivity({
      req,
      user,
      action: 'pricing.smart_applied',
      propertyId: property.id,
      organizationId: access.org.id,
      accessKind: access.accessKind,
      memberId: access.memberId,
      targetId: property.id,
      targetLabel: property.name ?? null,
      metadata: {
        run_id: runId,
        count: result.applied,
        skipped_unavailable: result.skippedUnavailable,
        partial: Boolean(ranges),
        related_event_ref: { table: 'property_smart_pricing_runs', id: runId },
      },
    });
    return jsonSuccess(req, result);
  } catch (err) {
    return jsonError(req, (err as Error).message, 400);
  }
});
