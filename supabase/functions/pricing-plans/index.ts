/**
 * pricing-plans — Super-admin CRUD for the host subscription tier catalog.
 * Commission pricing is retired from the live product (row kept inactive in DB).
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { parsePlanFeatures, type PlanFeatures } from '../_shared/planFeatures.ts';
import {
  DEFAULT_VOLUME_DISCOUNT_TIERS,
  DEFAULT_VOLUME_RAMP_AT_COUNT,
  DEFAULT_VOLUME_RAMP_FLOOR_PHP,
  normalizePlanDiscountPercent,
  normalizeVolumeDiscountTiers,
  normalizeVolumeRampAtCount,
  normalizeVolumeRampFloorPhp,
} from '../_shared/planPricing.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
  parsePageLimit,
} from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';
import { logSuperAdminAction } from '../_shared/superAdminAudit.ts';
import { requireSuperAdminStepUp } from '../_shared/superAdminVerification.ts';

function serializePlan(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    tagline: (row.tagline as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    pricingModel: row.pricing_model as string,
    pricePhp: row.price_php == null ? null : Number(row.price_php),
    discountPercent: normalizePlanDiscountPercent(
      row.discount_percent == null ? 0 : Number(row.discount_percent)
    ),
    volumeDiscountTiers: normalizeVolumeDiscountTiers(row.volume_discount_tiers),
    volumeRampFloorPhp: normalizeVolumeRampFloorPhp(
      row.volume_ramp_floor_php == null ? null : Number(row.volume_ramp_floor_php)
    ),
    volumeRampAtCount: normalizeVolumeRampAtCount(
      row.volume_ramp_at_count == null ? null : Number(row.volume_ramp_at_count)
    ),
    billingInterval: row.billing_interval as string,
    commissionRatePercent:
      row.commission_rate_percent == null ? null : Number(row.commission_rate_percent),
    features: parsePlanFeatures(row.features),
    isActive: Boolean(row.is_active),
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function parseFeaturesInput(raw: unknown): PlanFeatures | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return parsePlanFeatures(raw);
}

function parseVolumeDiscountTiersInput(
  raw: unknown
): ReturnType<typeof normalizeVolumeDiscountTiers> | null {
  if (!Array.isArray(raw)) return null;
  return normalizeVolumeDiscountTiers(raw);
}

serveSuperAdmin('pricing-plans', async (req, user) => {
  const stepUp = await requireSuperAdminStepUp(req, user, 'pricing_plans');
  if (stepUp) return stepUp;

  const supabase = createServiceClient();
  const url = new URL(req.url);
  const planId = url.searchParams.get('planId')?.trim() || null;

  if (req.method === 'GET') {
    if (planId) {
      const { data, error } = await supabase
        .from('pricing_plans')
        .select('*')
        .eq('id', planId)
        .eq('pricing_model', 'subscription')
        .maybeSingle();
      if (error) return jsonError(req, error.message, 500);
      if (!data) return jsonError(req, 'Plan not found', 404);
      return jsonSuccess(req, { plan: serializePlan(data as Record<string, unknown>) });
    }

    const search = url.searchParams.get('search')?.trim() || '';
    const status = url.searchParams.get('status')?.trim() || '';
    const { page, limit } = parsePageLimit(url.searchParams);
    const fromIdx = (page - 1) * limit;
    const toIdx = fromIdx + limit - 1;

    let query = supabase
      .from('pricing_plans')
      .select('*', { count: 'exact' })
      .eq('pricing_model', 'subscription')
      .order('sort_order', { ascending: true });

    if (search) {
      const pattern = postgrestOrIlikeValue(search);
      query = query.or(`name.ilike.${pattern},code.ilike.${pattern},tagline.ilike.${pattern}`);
    }
    if (status === 'active') query = query.eq('is_active', true);
    else if (status === 'inactive') query = query.eq('is_active', false);

    const { data, error, count } = await query.range(fromIdx, toIdx);
    if (error) return jsonError(req, error.message, 500);

    const plans = (data ?? []).map((row) => serializePlan(row as Record<string, unknown>));

    return jsonSuccess(req, { plans, total: count ?? 0, page, limit });
  }

  if (req.method === 'POST') {
    requireHttpMethod(req, 'POST');
    const body = await readJsonBody(req);

    if (body.pricingModel === 'commission') {
      return jsonError(req, 'Commission pricing is not available', 400);
    }

    const code = typeof body.code === 'string' ? body.code.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!code || !name) return jsonError(req, 'code and name are required');
    if (code === 'commission') {
      return jsonError(req, 'Commission pricing is not available', 400);
    }

    const features = parseFeaturesInput(body.features);
    if (!features) return jsonError(req, 'features object is required');

    const isDefault = body.isDefault === true;

    if (isDefault) {
      await supabase.from('pricing_plans').update({ is_default: false }).eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('pricing_plans')
      .insert({
        code,
        name,
        tagline: typeof body.tagline === 'string' ? body.tagline.trim() || null : null,
        sort_order: typeof body.sortOrder === 'number' ? Math.round(body.sortOrder) : 0,
        pricing_model: 'subscription',
        price_php: typeof body.pricePhp === 'number' ? body.pricePhp : null,
        discount_percent:
          typeof body.discountPercent === 'number'
            ? normalizePlanDiscountPercent(body.discountPercent)
            : 0,
        volume_discount_tiers:
          parseVolumeDiscountTiersInput(body.volumeDiscountTiers) ?? DEFAULT_VOLUME_DISCOUNT_TIERS,
        volume_ramp_floor_php:
          typeof body.volumeRampFloorPhp === 'number'
            ? normalizeVolumeRampFloorPhp(body.volumeRampFloorPhp)
            : DEFAULT_VOLUME_RAMP_FLOOR_PHP,
        volume_ramp_at_count:
          typeof body.volumeRampAtCount === 'number'
            ? normalizeVolumeRampAtCount(body.volumeRampAtCount)
            : DEFAULT_VOLUME_RAMP_AT_COUNT,
        billing_interval: 'month',
        commission_rate_percent: null,
        features,
        is_active: body.isActive !== false,
        is_default: isDefault,
      })
      .select('*')
      .single();

    if (error) return jsonError(req, error.message, 500);

    await logSuperAdminAction(user, {
      action: 'pricing_plans.plan_created',
      targetType: 'pricing_plan',
      targetId: typeof data.id === 'string' ? data.id : null,
      summary: 'Created pricing plan',
      metadata: { code },
    });

    return jsonSuccess(req, { plan: serializePlan(data as Record<string, unknown>) });
  }

  if (req.method === 'PATCH') {
    requireHttpMethod(req, 'PATCH');
    const body = await readJsonBody(req);
    const id = typeof body.planId === 'string' ? body.planId.trim() : planId;
    if (!id) return jsonError(req, 'planId is required');

    const { data: existing, error: existingError } = await supabase
      .from('pricing_plans')
      .select('id, code, pricing_model')
      .eq('id', id)
      .maybeSingle();
    if (existingError) return jsonError(req, existingError.message, 500);
    if (!existing) return jsonError(req, 'Plan not found', 404);
    if (existing.pricing_model === 'commission' || existing.code === 'commission') {
      return jsonError(req, 'Commission pricing is not available', 400);
    }
    if (body.pricingModel === 'commission') {
      return jsonError(req, 'Commission pricing is not available', 400);
    }

    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (typeof body.tagline === 'string') patch.tagline = body.tagline.trim() || null;
    if (typeof body.sortOrder === 'number') patch.sort_order = Math.round(body.sortOrder);
    if (body.pricePhp === null) patch.price_php = null;
    else if (typeof body.pricePhp === 'number') patch.price_php = body.pricePhp;
    if (typeof body.discountPercent === 'number') {
      patch.discount_percent = normalizePlanDiscountPercent(body.discountPercent);
    }
    const volumeDiscountTiers = parseVolumeDiscountTiersInput(body.volumeDiscountTiers);
    if (volumeDiscountTiers) patch.volume_discount_tiers = volumeDiscountTiers;
    if (typeof body.volumeRampFloorPhp === 'number') {
      patch.volume_ramp_floor_php = normalizeVolumeRampFloorPhp(body.volumeRampFloorPhp);
    }
    if (typeof body.volumeRampAtCount === 'number') {
      patch.volume_ramp_at_count = normalizeVolumeRampAtCount(body.volumeRampAtCount);
    }
    const features = parseFeaturesInput(body.features);
    if (features) patch.features = features;
    if (typeof body.isActive === 'boolean') patch.is_active = body.isActive;
    if (body.isDefault === true) {
      await supabase.from('pricing_plans').update({ is_default: false }).eq('is_default', true);
      patch.is_default = true;
    } else if (body.isDefault === false) {
      patch.is_default = false;
    }

    if (Object.keys(patch).length === 0) {
      return jsonError(req, 'No fields to update');
    }

    const { data, error } = await supabase
      .from('pricing_plans')
      .update(patch)
      .eq('id', id)
      .eq('pricing_model', 'subscription')
      .select('*')
      .maybeSingle();

    if (error) return jsonError(req, error.message, 500);
    if (!data) return jsonError(req, 'Plan not found', 404);

    await logSuperAdminAction(user, {
      action: 'pricing_plans.plan_updated',
      targetType: 'pricing_plan',
      targetId: id,
      summary: 'Updated pricing plan',
      metadata: { fields: Object.keys(patch) },
    });

    return jsonSuccess(req, { plan: serializePlan(data as Record<string, unknown>) });
  }

  return jsonError(req, 'Method not allowed', 405);
});
