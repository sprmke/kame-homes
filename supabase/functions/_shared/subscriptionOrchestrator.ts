/**
 * Org subscription billing state machine — webhook + cron side effects only.
 * Mutates org_subscriptions + org_payment_transactions; never inline in handlers.
 */

import { createClient } from './supabaseJs.ts';

import {
  changeOrgSubscription,
  createOrgSubscription,
  reconcileTeamSeatsForProperty,
} from './planEntitlements.ts';
import { isPaymongoTestMode, getPaymongoProviderPaymentState } from './paymongoClient.ts';
import { createOrgSubscriptionCheckoutLink } from './orgSubscriptionCheckout.ts';
import {
  getPlatformPaymentSettings,
  type PlatformPaymentSettings,
} from './platformPaymentSettings.ts';
import {
  sendOrgSubscriptionPastDueEmail,
  sendOrgSubscriptionPaymentFailedEmail,
  sendOrgSubscriptionReceiptEmail,
  sendOrgSubscriptionRenewalReminderEmail,
  sendOrgSubscriptionSuspendedEmail,
} from './subscriptionBillingEmail.ts';
import { resolvePublicGuestAppOrigin } from './publicAppOrigin.ts';
import {
  extractWebhookInner,
  readMetadataString,
  readWebhookKind,
} from './paymongoWebhookMetadata.ts';
import { handleParkingPaymentWebhookEvent } from './parkingPaymentOrchestrator.ts';
import { expireHostVerificationRewards } from './hostVerificationReward.ts';

export { getPlatformPaymentSettings, type PlatformPaymentSettings };
function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

async function assertOrgPaymentTransactionPending(transactionId: string): Promise<boolean> {
  const sb = db();
  const { data, error } = await sb
    .from('org_payment_transactions')
    .select('status')
    .eq('id', transactionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.status === 'pending';
}

function addOneMonth(from: Date): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

function formatManilaDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

async function loadOrgBillingContext(organizationId: string) {
  const sb = db();
  const { data, error } = await sb
    .from('organizations')
    .select('id, owner_id, slug, name')
    .eq('id', organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Organization not found');
  return {
    organizationId: data.id as string,
    ownerId: data.owner_id as string,
    orgSlug: String(data.slug ?? ''),
    orgName: String(data.name ?? 'Organization'),
  };
}

function orgPlansUrl(orgSlug: string): string {
  const appOrigin = resolvePublicGuestAppOrigin(null);
  return `${appOrigin}/org/${orgSlug}/plans`;
}

export async function markOrgPaymentFailed(
  transactionId: string,
  failureReason: string,
  rawPayload?: Record<string, unknown>
): Promise<void> {
  const sb = db();
  const { error } = await sb
    .from('org_payment_transactions')
    .update({
      status: 'failed',
      failure_reason: failureReason.slice(0, 500),
      raw_webhook_payload: rawPayload ?? null,
    })
    .eq('id', transactionId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}

/** When fulfillment partially applied (plan changed) but the txn row was left pending/failed. */
async function tryRepairOrgPaymentLedger(input: {
  transactionId: string;
  organizationId: string;
  planId: string;
  providerReference?: string | null;
  paymentMethodType?: string | null;
  paidAt?: string | null;
  rawPayload?: Record<string, unknown>;
}): Promise<boolean> {
  const sb = db();
  const { data: sub } = await sb
    .from('org_subscriptions')
    .select('id, plan_id, status')
    .eq('organization_id', input.organizationId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();
  if (!sub || String(sub.plan_id) !== input.planId) return false;

  const providerRef = input.providerReference?.trim() ?? '';
  if (providerRef) {
    const paymongoState = await getPaymongoProviderPaymentState(providerRef);
    if (paymongoState !== 'paid') return false;
  } else if (!input.paidAt) {
    return false;
  }

  const paidAt = input.paidAt ?? new Date().toISOString();
  const { data: paidRow, error } = await sb
    .from('org_payment_transactions')
    .update({
      status: 'paid',
      org_subscription_id: sub.id as string,
      provider_reference: input.providerReference ?? null,
      payment_method_type: input.paymentMethodType ?? null,
      paid_at: paidAt,
      failure_reason: null,
      raw_webhook_payload: input.rawPayload ?? null,
    })
    .eq('id', input.transactionId)
    .in('status', ['pending', 'failed'])
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(paidRow);
}

type OrgPaymentTransactionRow = {
  id: string;
  organization_id: string;
  org_subscription_id: string | null;
  plan_id: string;
  property_ids: string[];
  provider_reference: string | null;
  status: string;
  amount: number;
};

/**
 * Fulfills a paid org subscription checkout — fresh purchase, renewal, or a mid-cycle change
 * (property count and/or tier). Detects which by whether the org already has a live subscription
 * and whether the plan/enrolled-property set actually changed: a genuine change starts a fresh
 * billing period (the credit already bought back the unused old-plan time — extending from the
 * old period's end would double-count it); a same-plan-same-properties renewal extends from any
 * remaining time, same as before.
 */
export async function fulfillOrgSubscriptionPayment(input: {
  transactionId: string;
  providerReference?: string | null;
  paymentMethodType?: string | null;
  paidAt?: string | null;
  rawPayload?: Record<string, unknown>;
  assignedByUserId?: string | null;
}): Promise<void> {
  const sb = db();

  const { data: txn, error: txnError } = await sb
    .from('org_payment_transactions')
    .select('*')
    .eq('id', input.transactionId)
    .maybeSingle();
  if (txnError) throw new Error(txnError.message);
  if (!txn) throw new Error('Org payment transaction not found');
  if (txn.status === 'paid') return;
  if (txn.status !== 'pending') return;

  const organizationId = txn.organization_id as string;
  const planId = txn.plan_id as string;
  const propertyIds = (txn.property_ids as string[] | null) ?? [];
  const assignedBy = input.assignedByUserId ?? null;
  const amountPhp = Number(txn.amount ?? 0);

  // PayMongo has already collected payment by the time this runs — a thrown error here must not
  // leave the transaction stuck `pending` forever (indistinguishable from "webhook hasn't arrived
  // yet"). Mark it `failed` with the real reason so it surfaces for manual reconciliation instead.
  try {
    const stillPending = await assertOrgPaymentTransactionPending(input.transactionId);
    if (!stillPending) return;

    const { data: existingSub, error: existingSubError } = await sb
      .from('org_subscriptions')
      .select('id, plan_id, current_period_end, status')
      .eq('organization_id', organizationId)
      .in('status', ['active', 'trialing', 'past_due', 'suspended'])
      .maybeSingle();
    if (existingSubError) throw new Error(existingSubError.message);

    let orgSubscriptionId: string;
    let isChange = false;

    if (!existingSub) {
      const created = await createOrgSubscription(organizationId, planId, propertyIds, assignedBy);
      orgSubscriptionId = created.orgSubscriptionId;
    } else {
      orgSubscriptionId = existingSub.id as string;
      const { data: currentSlots, error: slotsError } = await sb
        .from('org_subscription_properties')
        .select('property_id')
        .eq('org_subscription_id', orgSubscriptionId);
      if (slotsError) throw new Error(slotsError.message);
      const currentPropertyIds = new Set((currentSlots ?? []).map((r) => r.property_id as string));
      const nextPropertyIds = new Set(propertyIds);
      isChange =
        String(existingSub.plan_id) !== planId ||
        currentPropertyIds.size !== nextPropertyIds.size ||
        [...nextPropertyIds].some((id) => !currentPropertyIds.has(id));

      await changeOrgSubscription(orgSubscriptionId, planId, propertyIds, assignedBy);
    }

    const now = new Date();
    const existingEnd =
      existingSub?.current_period_end != null
        ? new Date(String(existingSub.current_period_end))
        : null;
    const periodStart =
      existingSub && !isChange && existingEnd && existingEnd.getTime() > now.getTime()
        ? existingEnd
        : now;
    const periodEnd = addOneMonth(periodStart);

    const { error: subUpdateError } = await sb
      .from('org_subscriptions')
      .update({
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        grace_period_ends_at: null,
        status: 'active',
        source: 'purchase',
      })
      .eq('id', orgSubscriptionId);
    if (subUpdateError) throw new Error(subUpdateError.message);

    const paidAt = input.paidAt ?? new Date().toISOString();
    const { data: paidRow, error: txnUpdateError } = await sb
      .from('org_payment_transactions')
      .update({
        status: 'paid',
        org_subscription_id: orgSubscriptionId,
        provider_reference: input.providerReference ?? txn.provider_reference,
        payment_method_type: input.paymentMethodType ?? null,
        paid_at: paidAt,
        raw_webhook_payload: input.rawPayload ?? null,
      })
      .eq('id', input.transactionId)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (txnUpdateError) throw new Error(txnUpdateError.message);
    if (!paidRow) return;

    try {
      const { data: planRow } = await sb
        .from('pricing_plans')
        .select('name')
        .eq('id', planId)
        .maybeSingle();
      const ctx = await loadOrgBillingContext(organizationId);
      await sendOrgSubscriptionReceiptEmail({
        supabase: sb,
        ownerId: ctx.ownerId,
        orgName: ctx.orgName,
        planName: String(planRow?.name ?? 'Plan'),
        propertyCount: propertyIds.length,
        amountPhp,
        orgSlug: ctx.orgSlug,
      });
    } catch (err) {
      console.error('[subscriptionOrchestrator] receipt email failed', err);
    }
  } catch (err) {
    const repaired = await tryRepairOrgPaymentLedger({
      transactionId: input.transactionId,
      organizationId,
      planId,
      providerReference: input.providerReference ?? (txn.provider_reference as string | null),
      paymentMethodType: input.paymentMethodType ?? null,
      paidAt: input.paidAt ?? null,
      rawPayload: input.rawPayload,
    });
    if (repaired) {
      console.error('[subscriptionOrchestrator] fulfillment error recovered', err);
      return;
    }
    await markOrgPaymentFailed(
      input.transactionId,
      `Fulfillment error (payment was collected — needs manual review): ${(err as Error).message}`,
      input.rawPayload
    );
    throw err;
  }
}

export async function resolveOrgTransactionFromWebhookPayload(
  payload: Record<string, unknown>
): Promise<OrgPaymentTransactionRow | null> {
  const sb = db();
  const { inner, metadata } = extractWebhookInner(payload);

  const transactionId = readMetadataString(metadata, 'transaction_id');
  if (transactionId) {
    const { data } = await sb
      .from('org_payment_transactions')
      .select('*')
      .eq('id', transactionId)
      .maybeSingle();
    return (data as OrgPaymentTransactionRow | null) ?? null;
  }

  const checkoutSessionId =
    (inner?.type === 'checkout_session' ? String(inner.id ?? '') : '') ||
    readMetadataString(metadata, 'checkout_session_id');
  if (checkoutSessionId) {
    const { data } = await sb
      .from('org_payment_transactions')
      .select('*')
      .eq('provider_reference', checkoutSessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as OrgPaymentTransactionRow | null) ?? null;
  }

  const linkId =
    (inner?.type === 'link' ? String(inner.id ?? '') : '') ||
    readMetadataString(metadata, 'link_id');
  const providerRef =
    linkId || (inner?.type === 'payment' && typeof inner.id === 'string' ? inner.id : null) || null;
  if (!providerRef) return null;

  const { data } = await sb
    .from('org_payment_transactions')
    .select('*')
    .eq('provider_reference', providerRef)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as OrgPaymentTransactionRow | null) ?? null;
}

export async function handlePaymongoWebhookEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ handled: boolean; action?: string }> {
  const normalized = eventType.toLowerCase();

  // Dispatch by metadata.kind first — without this, a parking-payment webhook would fall
  // through into the org-subscription lookup below and silently no-op (different table, no
  // match found). 'org_subscription' or absent kind (older links, all pre-Phase-3) both take
  // the existing org path unchanged.
  const kind = readWebhookKind(payload);
  if (kind === 'parking_booking') {
    return handleParkingPaymentWebhookEvent(normalized, payload);
  }

  if (normalized === 'payment.failed') {
    const orgTxn = await resolveOrgTransactionFromWebhookPayload(payload);
    if (!orgTxn || orgTxn.status !== 'pending') return { handled: false };

    const paymongoState = await getPaymongoProviderPaymentState(orgTxn.provider_reference);
    if (paymongoState === 'paid') {
      const { innerAttrs, metadata } = extractWebhookInner(payload);
      const initiatedBy = readMetadataString(metadata, 'initiated_by');
      const source = innerAttrs?.source as Record<string, unknown> | undefined;
      const paymentMethodType = typeof source?.type === 'string' ? source.type : null;
      await fulfillOrgSubscriptionPayment({
        transactionId: orgTxn.id,
        providerReference: orgTxn.provider_reference,
        paymentMethodType,
        paidAt: new Date().toISOString(),
        rawPayload: payload,
        assignedByUserId: initiatedBy,
      });
      return { handled: true, action: 'fulfilled_org_subscription_after_stale_failed_event' };
    }

    await markOrgPaymentFailed(orgTxn.id, 'Payment failed', payload);
    try {
      const ctx = await loadOrgBillingContext(orgTxn.organization_id);
      await sendOrgSubscriptionPaymentFailedEmail({
        supabase: db(),
        ownerId: ctx.ownerId,
        orgName: ctx.orgName,
        plansUrl: orgPlansUrl(ctx.orgSlug),
      });
    } catch (err) {
      console.error('[subscriptionOrchestrator] payment failed email', err);
    }
    return { handled: true, action: 'marked_org_failed' };
  }

  if (
    normalized === 'payment.paid' ||
    normalized === 'link.payment.paid' ||
    normalized === 'checkout_session.payment.paid'
  ) {
    const { innerAttrs, metadata } = extractWebhookInner(payload);
    const initiatedBy = readMetadataString(metadata, 'initiated_by');
    const source = innerAttrs?.source as Record<string, unknown> | undefined;
    const paymentMethodType = typeof source?.type === 'string' ? source.type : null;

    const paidAtEpoch = innerAttrs?.paid_at;
    const paidAt =
      typeof paidAtEpoch === 'number'
        ? new Date(paidAtEpoch * 1000).toISOString()
        : new Date().toISOString();

    const orgTxn = await resolveOrgTransactionFromWebhookPayload(payload);
    if (!orgTxn || orgTxn.status !== 'pending') return { handled: false };

    await fulfillOrgSubscriptionPayment({
      transactionId: orgTxn.id,
      providerReference: orgTxn.provider_reference,
      paymentMethodType,
      paidAt,
      rawPayload: payload,
      assignedByUserId: initiatedBy,
    });
    return { handled: true, action: 'fulfilled_org_subscription' };
  }

  return { handled: false };
}

export function paymongoLivemodeFromEnv(): boolean {
  return !isPaymongoTestMode();
}

type LiveOrgSubscriptionRow = {
  id: string;
  organization_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  pricing_plans: { is_default: boolean; name: string; is_active: boolean };
};

export async function runPlatformBillingCycle(): Promise<Record<string, number>> {
  const sb = db();
  const settings = await getPlatformPaymentSettings();
  const now = new Date();
  const counters = {
    renewalLinks: 0,
    pastDue: 0,
    suspended: 0,
    graceRetries: 0,
    errors: 0,
  };

  const leadMs = settings.renewalLinkLeadDays * 24 * 60 * 60 * 1000;

  const { data: subs, error: subsError } = await sb
    .from('org_subscriptions')
    .select(
      `
      id,
      organization_id,
      plan_id,
      status,
      current_period_end,
      pricing_plans!inner ( is_default, name, is_active )
    `
    )
    .in('status', ['active', 'past_due'])
    .not('current_period_end', 'is', null);
  if (subsError) throw new Error(subsError.message);

  for (const raw of subs ?? []) {
    const sub = raw as unknown as LiveOrgSubscriptionRow;
    if (!sub.pricing_plans?.is_active || sub.pricing_plans.is_default) continue;

    const periodEnd = new Date(String(sub.current_period_end));
    const ctxPromise = loadOrgBillingContext(sub.organization_id);

    const { data: enrolledRows, error: enrolledError } = await sb
      .from('org_subscription_properties')
      .select('property_id')
      .eq('org_subscription_id', sub.id);
    if (enrolledError) {
      counters.errors += 1;
      continue;
    }
    const enrolledPropertyIds = (enrolledRows ?? []).map((r) => r.property_id as string);

    if (sub.status === 'active') {
      const msUntilEnd = periodEnd.getTime() - now.getTime();
      if (msUntilEnd <= leadMs && msUntilEnd > 0) {
        try {
          const checkout = await createOrgSubscriptionCheckoutLink({
            organizationId: sub.organization_id,
            planId: sub.plan_id,
            propertyIds: enrolledPropertyIds,
            purpose: 'renewal',
          });
          const ctx = await ctxPromise;
          await sendOrgSubscriptionRenewalReminderEmail({
            supabase: sb,
            ownerId: ctx.ownerId,
            orgName: ctx.orgName,
            planName: sub.pricing_plans.name,
            periodEndLabel: formatManilaDate(periodEnd.toISOString()),
            checkoutUrl: checkout.checkoutUrl,
          });
          counters.renewalLinks += 1;
        } catch (err) {
          console.error('[platform-billing-cron] renewal link', sub.organization_id, err);
          counters.errors += 1;
        }
      }

      if (periodEnd.getTime() <= now.getTime()) {
        const graceEnd = new Date(now);
        graceEnd.setDate(graceEnd.getDate() + settings.gracePeriodDays);
        const { error } = await sb
          .from('org_subscriptions')
          .update({
            status: 'past_due',
            grace_period_ends_at: graceEnd.toISOString(),
          })
          .eq('id', sub.id)
          .eq('status', 'active');
        if (error) {
          counters.errors += 1;
          continue;
        }
        try {
          const checkout = await createOrgSubscriptionCheckoutLink({
            organizationId: sub.organization_id,
            planId: sub.plan_id,
            propertyIds: enrolledPropertyIds,
            purpose: 'retry',
            forceNew: true,
          });
          const ctx = await ctxPromise;
          await sendOrgSubscriptionPastDueEmail({
            supabase: sb,
            ownerId: ctx.ownerId,
            orgName: ctx.orgName,
            graceEndLabel: formatManilaDate(graceEnd.toISOString()),
            checkoutUrl: checkout.checkoutUrl,
          });
          counters.pastDue += 1;
        } catch (err) {
          console.error('[platform-billing-cron] past due', sub.organization_id, err);
          counters.errors += 1;
        }
      }
      continue;
    }

    if (sub.status === 'past_due') {
      const { data: graceRow } = await sb
        .from('org_subscriptions')
        .select('grace_period_ends_at')
        .eq('id', sub.id)
        .maybeSingle();
      const graceEndRaw = graceRow?.grace_period_ends_at as string | null;
      if (graceEndRaw && new Date(graceEndRaw).getTime() <= now.getTime()) {
        const { error } = await sb
          .from('org_subscriptions')
          .update({ status: 'suspended' })
          .eq('id', sub.id)
          .eq('status', 'past_due');
        if (error) {
          counters.errors += 1;
          continue;
        }
        // Every previously-enrolled property individually falls back to Free now — reconcile
        // each (their pool is no longer the org's, since the subscription is no longer live).
        for (const propertyId of enrolledPropertyIds) {
          try {
            await reconcileTeamSeatsForProperty(propertyId);
          } catch (err) {
            console.error('[platform-billing-cron] team seat reconciliation', propertyId, err);
            counters.errors += 1;
          }
        }
        try {
          const ctx = await ctxPromise;
          await sendOrgSubscriptionSuspendedEmail({
            supabase: sb,
            ownerId: ctx.ownerId,
            orgName: ctx.orgName,
            plansUrl: orgPlansUrl(ctx.orgSlug),
          });
          counters.suspended += 1;
        } catch (err) {
          console.error('[platform-billing-cron] suspended email', sub.organization_id, err);
          counters.errors += 1;
        }
      }
    }
  }

  try {
    const rewardSweep = await expireHostVerificationRewards();
    (counters as Record<string, number>).rewardExpired = rewardSweep.expired;
    (counters as Record<string, number>).rewardExpireErrors = rewardSweep.errors;
  } catch (err) {
    console.error('[platform-billing-cron] host verification reward expiry', err);
    counters.errors += 1;
  }

  return counters;
}

export async function adminExtendOrgSubscription(input: {
  organizationId: string;
  periodEndIso: string;
  status?: 'active' | 'past_due' | 'suspended' | 'canceled';
  note?: string | null;
  adminUserId: string;
}): Promise<void> {
  const sb = db();
  const { data: sub, error } = await sb
    .from('org_subscriptions')
    .select('id')
    .eq('organization_id', input.organizationId)
    .in('status', ['active', 'trialing', 'past_due', 'suspended'])
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!sub) throw new Error('No live subscription for organization');

  const patch: Record<string, unknown> = {
    current_period_end: input.periodEndIso,
    grace_period_ends_at: null,
  };
  if (input.status) patch.status = input.status;

  const { error: updateError } = await sb.from('org_subscriptions').update(patch).eq('id', sub.id);
  if (updateError) throw new Error(updateError.message);

  await sb.from('org_subscription_events').insert({
    org_subscription_id: sub.id,
    event_type: 'status_changed',
    new_status: input.status ?? 'active',
    note: input.note ?? 'Super-admin manual billing extension',
    created_by: input.adminUserId,
  });

  const { data: enrolledRows } = await sb
    .from('org_subscription_properties')
    .select('property_id')
    .eq('org_subscription_id', sub.id as string);
  for (const row of enrolledRows ?? []) {
    await reconcileTeamSeatsForProperty(row.property_id as string);
  }
}
