/**
 * org-plan — GET org subscription state + subscription plans + org properties. Billing is
 * org-level only — every active subscription plan is selectable, priced per enrolled property
 * (rate x count, volume-discounted). See _shared/planPricing.ts#computeOrgSubscriptionTotalPhp.
 */

import { createServiceClient, verifyOrgAccess } from '../_shared/orgAuth.ts';
import {
  reconcilePendingOrgPaymentTransaction,
  recoverExpiredOrgPaymentIfPaidOnPaymongo,
} from '../_shared/orgPaymentReconcile.ts';
import { parsePlanFeatures } from '../_shared/planFeatures.ts';
import {
  normalizePlanDiscountPercent,
  normalizeVolumeDiscountTiers,
  normalizeVolumeRampAtCount,
  normalizeVolumeRampFloorPhp,
} from '../_shared/planPricing.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

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
    features: parsePlanFeatures(row.features),
    isDefault: Boolean(row.is_default),
  };
}

serveAuthenticated('org-plan', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  const orgId = url.searchParams.get('orgId')?.trim() || undefined;
  const orgSlug = url.searchParams.get('orgSlug')?.trim() || undefined;
  if (!orgId && !orgSlug) {
    return jsonError(req, 'orgId or orgSlug is required');
  }

  const { org } = await verifyOrgAccess(req, { orgId, orgSlug });
  const organizationId = org.id as string;

  const supabase = createServiceClient();

  const { data: plans, error: plansError } = await supabase
    .from('pricing_plans')
    .select(
      'id, code, name, tagline, sort_order, pricing_model, price_php, discount_percent, volume_discount_tiers, volume_ramp_floor_php, volume_ramp_at_count, features, is_default'
    )
    .eq('pricing_model', 'subscription')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (plansError) return jsonError(req, plansError.message, 500);

  const { data: properties, error: propertiesError } = await supabase
    .from('properties')
    .select('id, name, slug, status')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });
  if (propertiesError) return jsonError(req, propertiesError.message, 500);

  const { data: orgSubRow, error: orgSubError } = await supabase
    .from('org_subscriptions')
    .select(
      `
      id,
      plan_id,
      pricing_model,
      price_php_snapshot,
      status,
      current_period_start,
      current_period_end,
      grace_period_ends_at,
      pricing_plans!inner ( id, code, name )
    `
    )
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing', 'past_due', 'suspended'])
    .maybeSingle();
  if (orgSubError) return jsonError(req, orgSubError.message, 500);

  let subscription: Record<string, unknown> | null = null;
  let assignedPropertyIds: string[] = [];

  if (orgSubRow) {
    const planJoin = (orgSubRow as Record<string, unknown>).pricing_plans as Record<
      string,
      unknown
    >;
    subscription = {
      id: orgSubRow.id as string,
      planId: orgSubRow.plan_id as string,
      planCode: String(planJoin.code ?? ''),
      planName: String(planJoin.name ?? ''),
      pricingModel: orgSubRow.pricing_model as string,
      status: orgSubRow.status as string,
      pricePhpSnapshot:
        orgSubRow.price_php_snapshot == null ? null : Number(orgSubRow.price_php_snapshot),
      currentPeriodStart: (orgSubRow.current_period_start as string | null) ?? null,
      currentPeriodEnd: (orgSubRow.current_period_end as string | null) ?? null,
      gracePeriodEndsAt: (orgSubRow.grace_period_ends_at as string | null) ?? null,
    };

    const { data: slots, error: slotsError } = await supabase
      .from('org_subscription_properties')
      .select('property_id')
      .eq('org_subscription_id', orgSubRow.id as string);
    if (slotsError) return jsonError(req, slotsError.message, 500);
    assignedPropertyIds = (slots ?? []).map((row) => row.property_id as string);
  }

  const { data: pendingCheckoutRow } = await supabase
    .from('org_payment_transactions')
    .select('id, checkout_url, provider_reference, plan_id')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .not('checkout_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingCheckoutRow?.id) {
    try {
      await reconcilePendingOrgPaymentTransaction(pendingCheckoutRow.id as string);
    } catch (err) {
      console.error('[org-plan] pending checkout reconcile failed', err);
    }
  }

  try {
    await recoverExpiredOrgPaymentIfPaidOnPaymongo(organizationId);
  } catch (err) {
    console.error('[org-plan] mislabeled checkout recovery failed', err);
  }

  const { data: pendingCheckout } = await supabase
    .from('org_payment_transactions')
    .select('checkout_url, plan_id')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .not('checkout_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: transactions, error: transactionsError } = await supabase
    .from('org_payment_transactions')
    .select(
      'id, plan_id, amount, currency, status, payment_method_type, created_at, paid_at, checkout_url'
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (transactionsError) return jsonError(req, transactionsError.message, 500);

  return jsonSuccess(req, {
    plans: (plans ?? []).map((row) => serializePlan(row as Record<string, unknown>)),
    properties: (properties ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      status: row.status as string,
    })),
    subscription,
    assignedPropertyIds,
    transactions: (transactions ?? []).map((row) => ({
      id: row.id as string,
      planId: row.plan_id as string,
      amount: Number(row.amount ?? 0),
      currency: row.currency as string,
      status: row.status as string,
      paymentMethodType: (row.payment_method_type as string | null) ?? null,
      checkoutUrl: (row.checkout_url as string | null) ?? null,
      createdAt: row.created_at as string,
      paidAt: (row.paid_at as string | null) ?? null,
    })),
    pendingCheckoutUrl: (pendingCheckout?.checkout_url as string | null) ?? null,
    pendingCheckoutPlanId: (pendingCheckout?.plan_id as string | null) ?? null,
  });
});
