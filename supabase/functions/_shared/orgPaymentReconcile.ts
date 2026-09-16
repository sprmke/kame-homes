/**
 * Reconcile pending org_payment_transactions against PayMongo when webhooks were missed.
 */

import { createClient } from './supabaseJs.ts';

import {
  getPaymongoProviderPaymentState,
  isPaymongoCheckoutSessionRef,
  isPaymongoPaymentLinkRef,
} from './paymongoClient.ts';
import { fulfillOrgSubscriptionPayment } from './subscriptionOrchestrator.ts';

export type OrgPaymentReconcileResult = 'fulfilled' | 'expired' | 'unchanged' | 'skipped';

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

async function expirePendingTransaction(transactionId: string): Promise<void> {
  const sb = db();
  const { error } = await sb
    .from('org_payment_transactions')
    .update({ status: 'expired' })
    .eq('id', transactionId)
    .eq('status', 'pending');
  if (error) throw new Error(error.message);
}

async function fulfillPaidTransaction(input: {
  transactionId: string;
  providerReference: string;
  paymentMethodType: string | null;
}): Promise<void> {
  await fulfillOrgSubscriptionPayment({
    transactionId: input.transactionId,
    providerReference: input.providerReference,
    paymentMethodType: input.paymentMethodType ?? 'qrph',
    paidAt: new Date().toISOString(),
    rawPayload: { source: 'reconcile', provider_reference: input.providerReference },
  });
}

/**
 * If PayMongo already collected payment, fulfill the subscription. Legacy Payment Links
 * (no redirect back to Kame Homes) are expired when still open so the next checkout uses
 * Hosted Checkout Sessions with success/cancel URLs.
 */
export async function reconcilePendingOrgPaymentTransaction(
  transactionId: string
): Promise<OrgPaymentReconcileResult> {
  const sb = db();
  const { data: txn, error } = await sb
    .from('org_payment_transactions')
    .select('id, status, provider_reference, payment_method_type')
    .eq('id', transactionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!txn || txn.status !== 'pending') return 'skipped';

  const providerRef =
    typeof txn.provider_reference === 'string' ? txn.provider_reference.trim() : '';
  const paymongoState = await getPaymongoProviderPaymentState(providerRef || null);

  if (paymongoState === 'paid') {
    await fulfillPaidTransaction({
      transactionId,
      providerReference: providerRef,
      paymentMethodType:
        typeof txn.payment_method_type === 'string' ? txn.payment_method_type : null,
    });
    return 'fulfilled';
  }

  // Only legacy Payment Links are auto-expired while still open. Hosted Checkout Sessions
  // (`cs_…`) must never be expired here — a transient API miss used to mark paid checkouts
  // expired before fulfillment.
  if (isPaymongoPaymentLinkRef(providerRef) && paymongoState !== 'paid') {
    await expirePendingTransaction(transactionId);
    return 'expired';
  }

  if (isPaymongoCheckoutSessionRef(providerRef) && paymongoState === 'expired') {
    await expirePendingTransaction(transactionId);
    return 'expired';
  }

  return 'unchanged';
}

/** Recover checkouts we wrongly labeled failed/expired when PayMongo already collected payment. */
export async function recoverExpiredOrgPaymentIfPaidOnPaymongo(
  organizationId: string
): Promise<OrgPaymentReconcileResult> {
  const sb = db();
  const { data: txns, error } = await sb
    .from('org_payment_transactions')
    .select('id, status, provider_reference, payment_method_type')
    .eq('organization_id', organizationId)
    .in('status', ['expired', 'failed'])
    .not('provider_reference', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  if (!txns?.length) return 'skipped';

  for (const txn of txns) {
    const providerRef =
      typeof txn.provider_reference === 'string' ? txn.provider_reference.trim() : '';
    if (!providerRef) continue;

    const paymongoState = await getPaymongoProviderPaymentState(providerRef);
    if (paymongoState !== 'paid') continue;

    const { error: reopenError } = await sb
      .from('org_payment_transactions')
      .update({ status: 'pending', failure_reason: null })
      .eq('id', txn.id as string)
      .in('status', ['expired', 'failed']);
    if (reopenError) throw new Error(reopenError.message);

    await fulfillPaidTransaction({
      transactionId: txn.id as string,
      providerReference: providerRef,
      paymentMethodType:
        typeof txn.payment_method_type === 'string' ? txn.payment_method_type : null,
    });
    return 'fulfilled';
  }

  return 'skipped';
}
