/**
 * Creates PayMongo checkout links for org subscription purchases, renewals, and mid-cycle
 * changes (adding/removing properties and/or switching tiers). The only checkout path in the
 * system — billing is org-level only, see planEntitlements.ts.
 */

import { createClient } from './supabaseJs.ts';

import {
  createPaymongoCheckoutSession,
  getPaymongoProviderPaymentState,
  isPaymongoCheckoutSessionRef,
  isPaymongoPaymentLinkRef,
  phpToCentavos,
} from './paymongoClient.ts';
import { orgPlansBillingCheckoutUrl } from './orgBillingUrls.ts';
import { reconcilePendingOrgPaymentTransaction } from './orgPaymentReconcile.ts';
import {
  computeOrgSubscriptionTotalPhp,
  discountedPlanPricePhp,
  normalizeVolumeDiscountTiers,
} from './planPricing.ts';
import { computeMidCycleProration, type ProrationQuote } from './subscriptionProration.ts';
import { getPlatformPaymentSettings } from './platformPaymentSettings.ts';
import { selectInIdChunks } from './postgrestInChunks.ts';

export type OrgCheckoutPurpose = 'initial' | 'renewal' | 'retry' | 'change';

/** PayMongo requires a positive minimum charge — floor for the rare case where a downgrade's
 * unused-time credit would otherwise fully (or more than) cover the new total. Not a
 * zero-dollar-checkout bypass; that would need its own finance-reporting reconciliation. */
const MINIMUM_CHECKOUT_AMOUNT_PHP = 20;

export type OrgCheckoutResult = {
  checkoutUrl: string;
  transactionId: string;
  reused: boolean;
  /** Present when this checkout is a mid-cycle change off an existing subscription. */
  proration?: ProrationQuote;
};

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

export async function createOrgSubscriptionCheckoutLink(input: {
  organizationId: string;
  planId: string;
  /** Ignored — billing always covers every property in the org. Kept for API compatibility. */
  propertyIds?: string[];
  initiatedBy?: string | null;
  purpose?: OrgCheckoutPurpose;
  forceNew?: boolean;
}): Promise<OrgCheckoutResult> {
  const sb = db();
  const purpose = input.purpose ?? 'initial';

  const { data: org, error: orgError } = await sb
    .from('organizations')
    .select('id, name, slug')
    .eq('id', input.organizationId)
    .maybeSingle();
  if (orgError) throw new Error(orgError.message);
  if (!org) throw new Error('Organization not found');

  const { data: plan, error: planError } = await sb
    .from('pricing_plans')
    .select(
      'id, code, name, price_php, discount_percent, volume_discount_tiers, volume_ramp_floor_php, volume_ramp_at_count, pricing_model, is_active, is_default'
    )
    .eq('id', input.planId)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan || !plan.is_active) throw new Error('Plan not found');
  if (plan.pricing_model !== 'subscription') {
    throw new Error('Only subscription plans can be purchased');
  }
  if (plan.is_default) throw new Error('Free plan does not require checkout');

  const { data: orgProperties, error: orgPropsError } = await sb
    .from('properties')
    .select('id')
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: true });
  if (orgPropsError) throw new Error(orgPropsError.message);
  const uniquePropertyIds = (orgProperties ?? []).map((row) => row.id as string);
  if (uniquePropertyIds.length === 0) {
    throw new Error('Add at least one property to your organization before subscribing');
  }

  // Status list kept identical to fulfillOrgSubscriptionPayment's `liveSub` lookup
  // (subscriptionOrchestrator.ts) — a suspended sub's period has always already lapsed, so
  // including it here doesn't change what gets charged, but keeping the two lists in sync avoids
  // this pricing check and the webhook-time period logic silently diverging later.
  const { data: liveSub } = await sb
    .from('org_subscriptions')
    .select('id, plan_id, price_php_snapshot, current_period_start, current_period_end')
    .eq('organization_id', input.organizationId)
    .in('status', ['active', 'trialing', 'past_due', 'suspended'])
    .maybeSingle();

  // A property already slotted into a *different* live org subscription can't be checked out here.
  const conflictingSlots = await selectInIdChunks<{ property_id: string }>(
    uniquePropertyIds,
    (chunk) =>
      sb
        .from('org_subscription_properties')
        .select('property_id')
        .in('property_id', chunk)
        .neq('org_subscription_id', liveSub?.id ?? '00000000-0000-0000-0000-000000000000')
  );
  if (conflictingSlots.length > 0) {
    throw new Error('One or more properties are already covered by a different org subscription');
  }

  let currentPropertyIds: Set<string> = new Set();
  if (liveSub) {
    const { data: currentSlots, error: currentSlotsError } = await sb
      .from('org_subscription_properties')
      .select('property_id')
      .eq('org_subscription_id', liveSub.id as string);
    if (currentSlotsError) throw new Error(currentSlotsError.message);
    currentPropertyIds = new Set((currentSlots ?? []).map((r) => r.property_id as string));
  }

  const targetRatePhp = discountedPlanPricePhp(plan.price_php, plan.discount_percent);
  const targetTotalPhp = computeOrgSubscriptionTotalPhp(
    targetRatePhp,
    normalizeVolumeDiscountTiers(plan.volume_discount_tiers),
    uniquePropertyIds.length,
    {
      volumeRampFloorPhp:
        plan.volume_ramp_floor_php == null ? null : Number(plan.volume_ramp_floor_php),
      volumeRampAtCount:
        plan.volume_ramp_at_count == null ? null : Number(plan.volume_ramp_at_count),
    }
  );

  const sameAsLive =
    liveSub != null &&
    String(liveSub.plan_id) === String(input.planId) &&
    currentPropertyIds.size === uniquePropertyIds.length &&
    uniquePropertyIds.every((id) => currentPropertyIds.has(id));

  let proration: ProrationQuote | undefined;
  let amountPhp: number;

  if (purpose === 'renewal' || sameAsLive) {
    amountPhp =
      liveSub?.price_php_snapshot != null && Number(liveSub.price_php_snapshot) > 0
        ? Number(liveSub.price_php_snapshot)
        : targetTotalPhp;
  } else if (
    liveSub?.price_php_snapshot != null &&
    Number(liveSub.price_php_snapshot) > 0 &&
    liveSub.current_period_start &&
    liveSub.current_period_end
  ) {
    // Mid-cycle change (different plan and/or property set) off an existing subscription — prorate.
    proration = computeMidCycleProration({
      currentPricePhp: Number(liveSub.price_php_snapshot),
      currentPeriodStartIso: String(liveSub.current_period_start),
      currentPeriodEndIso: String(liveSub.current_period_end),
      targetPricePhp: targetTotalPhp,
    });
    amountPhp = Math.max(MINIMUM_CHECKOUT_AMOUNT_PHP, proration.netDuePhp);
  } else {
    amountPhp = targetTotalPhp;
  }

  if (!Number.isFinite(amountPhp) || amountPhp <= 0) {
    throw new Error('Plan has no price configured');
  }

  const orgName = String(org.name ?? 'Organization').trim();
  const orgSlug = String(org.slug ?? '').trim();
  if (!orgSlug) throw new Error('Organization slug is missing');

  if (!input.forceNew) {
    const { data: pendingExisting } = await sb
      .from('org_payment_transactions')
      .select('id, checkout_url, provider_reference')
      .eq('organization_id', input.organizationId)
      .eq('plan_id', input.planId)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingExisting?.id) {
      const reconcileResult = await reconcilePendingOrgPaymentTransaction(
        pendingExisting.id as string
      );
      if (reconcileResult === 'fulfilled') {
        throw new Error('Payment already received — refresh Plans & Billing');
      }
      if (reconcileResult === 'expired') {
        pendingExisting.checkout_url = null;
      }
    }

    if (pendingExisting?.checkout_url) {
      const providerRef = String(pendingExisting.provider_reference ?? '');
      if (isPaymongoCheckoutSessionRef(providerRef)) {
        const paymongoState = await getPaymongoProviderPaymentState(providerRef);
        if (paymongoState === 'open' || paymongoState === 'unknown') {
          return {
            checkoutUrl: pendingExisting.checkout_url as string,
            transactionId: pendingExisting.id as string,
            reused: true,
          };
        }
        if (paymongoState === 'expired') {
          await sb
            .from('org_payment_transactions')
            .update({ status: 'expired' })
            .eq('id', pendingExisting.id as string)
            .eq('status', 'pending');
        }
      } else if (isPaymongoPaymentLinkRef(providerRef)) {
        await sb
          .from('org_payment_transactions')
          .update({ status: 'expired' })
          .eq('id', pendingExisting.id as string)
          .eq('status', 'pending');
      }
    }
  } else {
    await sb
      .from('org_payment_transactions')
      .update({ status: 'expired' })
      .eq('organization_id', input.organizationId)
      .eq('plan_id', input.planId)
      .eq('status', 'pending');
  }

  const { data: txnRow, error: insertError } = await sb
    .from('org_payment_transactions')
    .insert({
      organization_id: input.organizationId,
      plan_id: input.planId,
      property_ids: uniquePropertyIds,
      amount: amountPhp,
      currency: 'PHP',
      status: 'pending',
    })
    .select('id')
    .single();
  if (insertError) throw new Error(insertError.message);

  const transactionId = txnRow.id as string;
  const descriptionSuffix =
    purpose === 'renewal' ? ' renewal' : proration ? ' — mid-cycle change' : '';

  try {
    const paymentSettings = await getPlatformPaymentSettings();
    const lineItemName = `${plan.name} plan (${uniquePropertyIds.length} propert${uniquePropertyIds.length === 1 ? 'y' : 'ies'})`;
    const session = await createPaymongoCheckoutSession({
      amountCentavos: phpToCentavos(amountPhp),
      lineItemName,
      description: `${orgName} — ${lineItemName}${descriptionSuffix}`,
      successUrl: orgPlansBillingCheckoutUrl(orgSlug, 'success'),
      cancelUrl: orgPlansBillingCheckoutUrl(orgSlug, 'cancelled'),
      paymentMethodTypes: paymentSettings.enabledPaymentMethods,
      referenceNumber: transactionId.replace(/-/g, '').slice(0, 32),
      metadata: {
        kind: 'org_subscription',
        transaction_id: transactionId,
        organization_id: input.organizationId,
        plan_id: input.planId,
        purpose: proration ? 'change' : purpose,
        ...(proration ? { proration_credit_php: String(proration.creditPhp) } : {}),
        ...(input.initiatedBy ? { initiated_by: input.initiatedBy } : {}),
      },
    });

    const { error: updateError } = await sb
      .from('org_payment_transactions')
      .update({
        provider_reference: session.id,
        checkout_url: session.checkoutUrl,
      })
      .eq('id', transactionId);
    if (updateError) throw new Error(updateError.message);

    return { checkoutUrl: session.checkoutUrl, transactionId, reused: false, proration };
  } catch (err) {
    await sb
      .from('org_payment_transactions')
      .update({
        status: 'failed',
        failure_reason: (err as Error).message.slice(0, 500),
      })
      .eq('id', transactionId);
    throw err;
  }
}
