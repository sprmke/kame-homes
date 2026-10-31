/**
 * Credit conversion + org credit wallet — docs/workflow/done/ai-usage-metering-credits-foundation.md.
 *
 * Credits are derived from estimated_cost_usd, not tracked independently, so the
 * existing $-based quota/cost accounting in aiUsageService.ts stays the source of truth.
 *
 * The wallet (`adjustOrgCreditWallet`) is drawn down once an org's monthly credit
 * allowance is exhausted (Phase 3 enforcement in aiUsageService.ts#recordAiUsage) and is
 * the same code path a future paid top-up flow calls into (Phase 4, deferred — just with
 * entry_type: 'purchase_credit' instead of 'manual_adjustment').
 */

import { createClient } from './supabaseJs.ts';

export type AiCreditLedgerEntryType = 'usage_debit' | 'purchase_credit' | 'manual_adjustment';

function db() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key);
}

/**
 * credits_consumed = cache_hit ? 0 : max(1, ceil(estimated_cost_usd / credit_unit_usd))
 *
 * max(1, ...) prevents very cheap calls (e.g. ai_integration_verify at ~$0.00004) from
 * rounding to 0 and becoming permanently free. Cache hits stay 0 credits (not just $0
 * cost) to preserve the existing cache-reuse incentive.
 */
export function estimateCreditsFromCostUsd(
  costUsd: number,
  creditUnitUsd: number,
  isCacheHit: boolean
): number {
  if (isCacheHit) return 0;
  if (!(creditUnitUsd > 0)) return 0;
  return Math.max(1, Math.ceil(costUsd / creditUnitUsd));
}

export async function getOrgCreditWalletBalance(organizationId: string): Promise<number> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_org_credit_wallet')
    .select('balance_credits')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.balance_credits ?? 0);
}

export async function insertCreditLedgerEntry(input: {
  organizationId: string;
  entryType: AiCreditLedgerEntryType;
  creditsDelta: number;
  relatedUsageEventId?: string | null;
  description?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const sb = db();
  const { error } = await sb.from('ai_platform_org_credit_ledger').insert({
    organization_id: input.organizationId,
    entry_type: input.entryType,
    credits_delta: input.creditsDelta,
    related_usage_event_id: input.relatedUsageEventId ?? null,
    description: input.description ?? null,
    created_by: input.createdBy ?? null,
  });
  if (error) {
    console.warn('[aiCreditLedger] ledger entry insert failed:', error.message);
  }
}

export type AiCreditLedgerRecentEntry = {
  id: string;
  entryType: AiCreditLedgerEntryType;
  creditsDelta: number;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
};

export async function getRecentCreditLedgerEntries(
  organizationId: string,
  limit = 25
): Promise<AiCreditLedgerRecentEntry[]> {
  const sb = db();
  const { data, error } = await sb
    .from('ai_platform_org_credit_ledger')
    .select('id, entry_type, credits_delta, description, created_by, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    entryType: row.entry_type as AiCreditLedgerEntryType,
    creditsDelta: Number(row.credits_delta),
    description: (row.description as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

/**
 * Atomic read-clamp-write (via adjust_ai_platform_org_credit_wallet, a row-locked RPC) +
 * append-only ledger entry. Balance is clamped to >= 0 to satisfy the table's CHECK
 * constraint; the ledger entry records the delta actually applied (post-clamp), not the raw
 * requested delta, so the append-only ledger always reconciles with the real balance history.
 * A delta that would go negative floors at 0 instead of throwing, since this is best-effort
 * accounting — the enforcement gate itself is assertOrgAndPropertyAiQuota, called earlier.
 */
export async function adjustOrgCreditWallet(input: {
  organizationId: string;
  creditsDelta: number;
  entryType: AiCreditLedgerEntryType;
  description?: string | null;
  createdBy?: string | null;
  relatedUsageEventId?: string | null;
}): Promise<{ balanceCredits: number }> {
  const sb = db();
  const { data, error } = await sb
    .rpc('adjust_ai_platform_org_credit_wallet', {
      p_organization_id: input.organizationId,
      p_credits_delta: input.creditsDelta,
    })
    .single();
  if (error) throw new Error(error.message);

  const row = data as { balance_credits: number; applied_delta: number };

  await insertCreditLedgerEntry({
    organizationId: input.organizationId,
    entryType: input.entryType,
    creditsDelta: row.applied_delta,
    relatedUsageEventId: input.relatedUsageEventId ?? null,
    description: input.description ?? null,
    createdBy: input.createdBy ?? null,
  });

  return { balanceCredits: Number(row.balance_credits) };
}
