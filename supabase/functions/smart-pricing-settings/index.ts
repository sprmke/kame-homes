/**
 * smart-pricing-settings — property Smart Pricing config (Pricing → Smart Pricing modal).
 * Plan: docs/workflow/planned/smart-pricing-ai.md
 *
 * GET   ?property=<id|slug>  → { settings, resolvedBase, history }        (pricing:view — preview-open)
 * PATCH { ...settings fields }                                            (pricing.rates:edit + smartPricing plan)
 *
 * The deterministic engine (`_shared/smartPricingEngine.ts`) and the preview / apply / cron
 * flows land in later phases; this function owns only the settings row + read context.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { manilaTodayYmd } from '../_shared/calendarAvailabilityManila.ts';
import { loadPropertyPricing } from '../_shared/propertyPricing.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import {
  gatherHistoryFeatures,
  loadSmartPricingSettings,
  saveSmartPricingSettings,
  type SmartPricingSettingsPatch,
} from '../_shared/smartPricing.ts';
import { countAppliedSmartRecommendations } from '../_shared/smartPricingRead.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';

serveAuthenticated('smart-pricing-settings', async (req) => {
  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { property } = await resolveScopedPropertyAccess(req, 'pricing:view');
    const [settings, pricing, history, appliedCount] = await Promise.all([
      loadSmartPricingSettings(property.id),
      loadPropertyPricing(property.id),
      gatherHistoryFeatures(property.id).catch(() => null),
      countAppliedSmartRecommendations(property.id, manilaTodayYmd()),
    ]);

    return jsonSuccess(req, {
      settings,
      appliedCount,
      resolvedBase: {
        weekday:
          settings.baseSource === 'custom' && settings.baseWeekday != null
            ? settings.baseWeekday
            : pricing.weekdayNightlyRate,
        weekend:
          settings.baseSource === 'custom' && settings.baseWeekend != null
            ? settings.baseWeekend
            : pricing.weekendNightlyRate,
      },
      history: history
        ? {
            confidence: history.confidence,
            forwardOccupancy: history.forwardOccupancy,
            medianRealisedNightly: history.medianRealisedNightly,
          }
        : null,
    });
  }

  if (req.method !== 'PATCH') return jsonError(req, 'Method not allowed', 405);

  // ── PATCH ────────────────────────────────────────────────────────────────
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
  const patch: SmartPricingSettingsPatch = {};
  const b = body as Record<string, unknown>;

  if (b.enabled !== undefined) patch.enabled = Boolean(b.enabled);
  if (b.mode !== undefined) patch.mode = b.mode as SmartPricingSettingsPatch['mode'];
  if (b.baseSource !== undefined) {
    patch.baseSource = b.baseSource as SmartPricingSettingsPatch['baseSource'];
  }
  if (b.baseWeekday !== undefined) patch.baseWeekday = b.baseWeekday as number | null;
  if (b.baseWeekend !== undefined) patch.baseWeekend = b.baseWeekend as number | null;
  if (b.minPrice !== undefined) patch.minPrice = b.minPrice as number | null;
  if (b.maxPrice !== undefined) patch.maxPrice = b.maxPrice as number | null;
  if (b.aggressiveness !== undefined) {
    patch.aggressiveness = b.aggressiveness as SmartPricingSettingsPatch['aggressiveness'];
  }
  if (b.dowAdjust !== undefined) patch.dowAdjust = b.dowAdjust as Record<string, number>;
  if (b.seasonRules !== undefined) {
    patch.seasonRules = b.seasonRules as SmartPricingSettingsPatch['seasonRules'];
  }
  if (b.leadTime !== undefined)
    patch.leadTime = b.leadTime as SmartPricingSettingsPatch['leadTime'];
  if (b.orphanGapDiscountPct !== undefined) {
    patch.orphanGapDiscountPct = Number(b.orphanGapDiscountPct);
  }
  if (b.occupancyTiltEnabled !== undefined) {
    patch.occupancyTiltEnabled = Boolean(b.occupancyTiltEnabled);
  }
  if (b.losDiscounts !== undefined) {
    patch.losDiscounts = b.losDiscounts as SmartPricingSettingsPatch['losDiscounts'];
  }
  if (b.rounding !== undefined)
    patch.rounding = b.rounding as SmartPricingSettingsPatch['rounding'];
  if (b.windowDays !== undefined) patch.windowDays = Number(b.windowDays);
  if (b.aiRationaleEnabled !== undefined) {
    patch.aiRationaleEnabled = Boolean(b.aiRationaleEnabled);
  }

  if (Object.keys(patch).length === 0) {
    return jsonError(req, 'No valid fields to update', 400);
  }

  try {
    const settings = await saveSmartPricingSettings(property.id, patch, { userId: user.id });
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
      changes: Object.keys(patch).map((field) => ({
        field,
        from: null,
        to: (patch as Record<string, unknown>)[field] ?? null,
      })),
      metadata: {
        fields: Object.keys(patch),
        enabled: patch.enabled,
        mode: patch.mode,
      },
    });
    return jsonSuccess(req, { settings });
  } catch (err) {
    return jsonError(req, (err as Error).message, 400);
  }
});
