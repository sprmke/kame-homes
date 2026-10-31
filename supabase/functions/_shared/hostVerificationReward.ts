/**
 * Host Recommended-verification reward grants (trialing Pro via source=reward).
 * Separate from createOrgSubscription so purchase/admin paths stay untouched.
 */

import { createServiceClient } from './orgAuth.ts';
import { chunkIds } from './postgrestInChunks.ts';
import { parsePlanFeatures } from './planFeatures.ts';
import {
  reconcileTeamSeatsForProperty,
  syncAiCreditsFromPlan,
} from './planEntitlements.ts';
import { orgHasLivePaidSubscription } from './planEntitlements.ts';

const PLAN_SELECT =
  'id, code, name, pricing_model, price_php, discount_percent, volume_discount_tiers, volume_ramp_floor_php, volume_ramp_at_count, commission_rate_percent, features, is_default';

type RewardSettings = {
  enabled: boolean;
  planCode: string;
  durationDays: number;
  trigger: 'recommended_verification_submitted' | 'recommended_verification_approved';
  campaignStart: string | null;
  campaignEnd: string | null;
  maxPerOrg: number;
  applyToPaidOrg: 'skip' | 'extend';
};

export type HostRewardOffer = {
  enabled: boolean;
  eligible: boolean;
  reason: string | null;
  planCode: string | null;
  durationDays: number;
  trigger: string;
  grantsUsed: number;
  maxPerOrg: number;
};

export type HostRewardGrantResult =
  | { outcome: 'granted' | 'extended'; orgSubscriptionId: string }
  | { outcome: 'skipped'; reason: string };

function db() {
  return createServiceClient();
}

async function loadRewardSettings(): Promise<RewardSettings | null> {
  const { data, error } = await db()
    .from('platform_settings')
    .select(
      'host_reward_enabled, host_reward_plan_code, host_reward_duration_days, host_reward_trigger, host_reward_campaign_start, host_reward_campaign_end, host_reward_max_per_org, host_reward_apply_to_paid_org'
    )
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const trigger =
    data.host_reward_trigger === 'recommended_verification_submitted'
      ? 'recommended_verification_submitted'
      : 'recommended_verification_approved';
  return {
    enabled: data.host_reward_enabled === true,
    planCode: String(data.host_reward_plan_code ?? 'growth'),
    durationDays: Math.max(1, Number(data.host_reward_duration_days ?? 30)),
    trigger,
    campaignStart: (data.host_reward_campaign_start as string | null) ?? null,
    campaignEnd: (data.host_reward_campaign_end as string | null) ?? null,
    maxPerOrg: Math.max(1, Number(data.host_reward_max_per_org ?? 1)),
    applyToPaidOrg: data.host_reward_apply_to_paid_org === 'extend' ? 'extend' : 'skip',
  };
}

export function isHostRewardCampaignOpen(settings: RewardSettings, now = new Date()): boolean {
  if (settings.campaignStart && now < new Date(settings.campaignStart)) return false;
  if (settings.campaignEnd && now > new Date(settings.campaignEnd)) return false;
  return true;
}

async function countRewardGrants(organizationId: string): Promise<number> {
  const sb = db();
  const { data: subs, error } = await sb
    .from('org_subscriptions')
    .select('id')
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  const ids = (subs ?? []).map((row) => row.id as string);
  if (ids.length === 0) return 0;
  let total = 0;
  for (const chunk of chunkIds(ids)) {
    const { count, error: countError } = await sb
      .from('org_subscription_events')
      .select('id', { count: 'exact', head: true })
      .in('org_subscription_id', chunk)
      .eq('event_type', 'reward_granted');
    if (countError) throw new Error(countError.message);
    total += count ?? 0;
  }
  return total;
}

async function listOrgPropertyIds(organizationId: string): Promise<string[]> {
  const { data, error } = await db()
    .from('properties')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id as string);
}

async function writeEvent(input: {
  orgSubscriptionId: string;
  eventType: 'reward_granted' | 'reward_expired' | 'reward_revoked' | 'property_added';
  previousPlanId?: string | null;
  newPlanId?: string | null;
  previousStatus?: string | null;
  newStatus?: string | null;
  propertyId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const { error } = await db()
    .from('org_subscription_events')
    .insert({
      org_subscription_id: input.orgSubscriptionId,
      event_type: input.eventType,
      previous_plan_id: input.previousPlanId ?? null,
      new_plan_id: input.newPlanId ?? null,
      previous_status: input.previousStatus ?? null,
      new_status: input.newStatus ?? null,
      property_id: input.propertyId ?? null,
      note: input.note ?? null,
      created_by: input.createdBy ?? null,
    });
  if (error) throw new Error(error.message);
}

async function loadFreePlan(): Promise<{ id: string; code: string; features: unknown }> {
  const sb = db();
  const { data: byDefault, error } = await sb
    .from('pricing_plans')
    .select('id, code, features')
    .eq('is_default', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (byDefault) return byDefault as { id: string; code: string; features: unknown };
  const { data: byCode, error: codeError } = await sb
    .from('pricing_plans')
    .select('id, code, features')
    .eq('code', 'free')
    .maybeSingle();
  if (codeError) throw new Error(codeError.message);
  if (!byCode) throw new Error('Free plan not found');
  return byCode as { id: string; code: string; features: unknown };
}

async function cancelRewardToFree(input: {
  orgSubscriptionId: string;
  organizationId: string;
  previousPlanId: string;
  previousStatus: string;
  changedBy: string | null;
  eventType: 'reward_expired' | 'reward_revoked';
  note: string;
}): Promise<void> {
  const free = await loadFreePlan();
  const { error: rpcError } = await db().rpc('cancel_org_subscription_to_free', {
    p_org_subscription_id: input.orgSubscriptionId,
    p_target_plan_id: free.id,
    p_previous_status: input.previousStatus,
    p_changed_by: input.changedBy,
  });
  if (rpcError) throw new Error(rpcError.message);

  await writeEvent({
    orgSubscriptionId: input.orgSubscriptionId,
    eventType: input.eventType,
    previousPlanId: input.previousPlanId,
    newPlanId: free.id,
    previousStatus: input.previousStatus,
    newStatus: 'canceled',
    note: input.note,
    createdBy: input.changedBy,
  });
}

/** True when Free hosts may submit Recommended without the Pro feature gate. */
export async function isOrgEligibleForHostRewardGateBypass(
  organizationId: string
): Promise<boolean> {
  const settings = await loadRewardSettings();
  if (!settings?.enabled) return false;
  if (!isHostRewardCampaignOpen(settings)) return false;
  if (await orgHasLivePaidSubscription(organizationId)) return false;
  const grants = await countRewardGrants(organizationId);
  return grants < settings.maxPerOrg;
}

export async function getHostRewardOfferForOrg(organizationId: string): Promise<HostRewardOffer> {
  const settings = await loadRewardSettings();
  if (!settings) {
    return {
      enabled: false,
      eligible: false,
      reason: 'settings_missing',
      planCode: null,
      durationDays: 30,
      trigger: 'recommended_verification_approved',
      grantsUsed: 0,
      maxPerOrg: 1,
    };
  }
  const grantsUsed = await countRewardGrants(organizationId);
  const base = {
    enabled: settings.enabled,
    planCode: settings.planCode,
    durationDays: settings.durationDays,
    trigger: settings.trigger,
    grantsUsed,
    maxPerOrg: settings.maxPerOrg,
  };
  if (!settings.enabled) return { ...base, eligible: false, reason: 'reward_disabled' };
  if (!isHostRewardCampaignOpen(settings))
    return { ...base, eligible: false, reason: 'outside_campaign_window' };
  if (grantsUsed >= settings.maxPerOrg) return { ...base, eligible: false, reason: 'max_per_org' };
  if (await orgHasLivePaidSubscription(organizationId)) {
    return { ...base, eligible: false, reason: 'already_subscribed' };
  }
  return { ...base, eligible: true, reason: null };
}

export async function grantOrgSubscriptionReward(
  organizationId: string,
  input: { planId: string; durationDays: number; assignedBy: string | null }
): Promise<{ orgSubscriptionId: string }> {
  const sb = db();
  const { data: plan, error: planError } = await sb
    .from('pricing_plans')
    .select(PLAN_SELECT)
    .eq('id', input.planId)
    .eq('is_active', true)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) throw new Error('Pricing plan not found or inactive');
  if (plan.pricing_model === 'commission') throw new Error('Commission pricing is not available');

  const { data: existing, error: existingError } = await sb
    .from('org_subscriptions')
    .select('id')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing', 'past_due'])
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) throw new Error('Organization already has a live subscription');

  const propertyIds = await listOrgPropertyIds(organizationId);
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + input.durationDays * 24 * 60 * 60 * 1000);

  const { data: inserted, error: insertError } = await sb
    .from('org_subscriptions')
    .insert({
      organization_id: organizationId,
      plan_id: input.planId,
      pricing_model: 'subscription',
      price_php_snapshot: 0,
      status: 'trialing',
      source: 'reward',
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .select('id')
    .single();
  if (insertError) throw new Error(insertError.message);
  const orgSubscriptionId = inserted.id as string;

  try {
    await writeEvent({
      orgSubscriptionId,
      eventType: 'reward_granted',
      newPlanId: input.planId,
      newStatus: 'trialing',
      note: `Host verification reward (${input.durationDays} days)`,
      createdBy: input.assignedBy,
    });

    for (const chunk of chunkIds(propertyIds)) {
      const { error: assignError } = await sb.from('org_subscription_properties').insert(
        chunk.map((propertyId) => ({
          org_subscription_id: orgSubscriptionId,
          property_id: propertyId,
          assigned_by: input.assignedBy,
        }))
      );
      if (assignError) throw new Error(assignError.message);

      for (const propertyId of chunk) {
        await writeEvent({
          orgSubscriptionId,
          eventType: 'property_added',
          propertyId,
          createdBy: input.assignedBy,
        });
      }
    }
    const features = parsePlanFeatures(plan.features);
    await syncAiCreditsFromPlan(
      organizationId,
      String(plan.code),
      features.aiMonthlyCreditAllowance,
      input.assignedBy ?? 'system',
    );
    if (propertyIds.length > 0) {
      await reconcileTeamSeatsForProperty(propertyIds[0]);
    }
  } catch (err) {
    await sb.from('org_subscriptions').delete().eq('id', orgSubscriptionId);
    throw err;
  }

  return { orgSubscriptionId };
}

export async function maybeGrantHostVerificationReward(
  organizationId: string,
  input: {
    trigger: 'recommended_verification_submitted' | 'recommended_verification_approved';
    assignedBy?: string | null;
  }
): Promise<HostRewardGrantResult> {
  const settings = await loadRewardSettings();
  if (!settings?.enabled) return { outcome: 'skipped', reason: 'reward_disabled' };
  if (settings.trigger !== input.trigger) return { outcome: 'skipped', reason: 'trigger_mismatch' };
  if (!isHostRewardCampaignOpen(settings)) return { outcome: 'skipped', reason: 'outside_campaign_window' };

  const grants = await countRewardGrants(organizationId);
  if (grants >= settings.maxPerOrg) return { outcome: 'skipped', reason: 'max_per_org' };

  const sb = db();
  const { data: plan, error: planError } = await sb
    .from('pricing_plans')
    .select(PLAN_SELECT)
    .eq('code', settings.planCode)
    .eq('is_active', true)
    .maybeSingle();
  if (planError) throw new Error(planError.message);
  if (!plan) return { outcome: 'skipped', reason: 'plan_not_found' };

  const { data: liveSub, error: liveError } = await sb
    .from('org_subscriptions')
    .select('id, status, source, current_period_end, plan_id')
    .eq('organization_id', organizationId)
    .in('status', ['active', 'trialing', 'past_due'])
    .maybeSingle();
  if (liveError) throw new Error(liveError.message);

  if (liveSub) {
    if (settings.applyToPaidOrg !== 'extend') {
      return { outcome: 'skipped', reason: 'already_subscribed' };
    }
    const base = liveSub.current_period_end
      ? new Date(String(liveSub.current_period_end))
      : new Date();
    const now = new Date();
    const from = base.getTime() > now.getTime() ? base : now;
    const nextEnd = new Date(from.getTime() + settings.durationDays * 24 * 60 * 60 * 1000);
    const { error: extendError } = await sb
      .from('org_subscriptions')
      .update({ current_period_end: nextEnd.toISOString() })
      .eq('id', liveSub.id);
    if (extendError) throw new Error(extendError.message);
    await writeEvent({
      orgSubscriptionId: liveSub.id as string,
      eventType: 'reward_granted',
      newPlanId: liveSub.plan_id as string,
      newStatus: String(liveSub.status),
      note: `Extended period by ${settings.durationDays} days (host verification reward)`,
      createdBy: input.assignedBy ?? null,
    });
    return { outcome: 'extended', orgSubscriptionId: liveSub.id as string };
  }

  const granted = await grantOrgSubscriptionReward(organizationId, {
    planId: plan.id as string,
    durationDays: settings.durationDays,
    assignedBy: input.assignedBy ?? null,
  });
  return { outcome: 'granted', orgSubscriptionId: granted.orgSubscriptionId };
}

export async function expireHostVerificationRewards(): Promise<{
  expired: number;
  errors: number;
}> {
  const sb = db();
  const { data: rows, error } = await sb
    .from('org_subscriptions')
    .select('id, organization_id, plan_id, status')
    .eq('status', 'trialing')
    .eq('source', 'reward')
    .lte('current_period_end', new Date().toISOString());
  if (error) throw new Error(error.message);

  let expired = 0;
  let errors = 0;
  for (const row of rows ?? []) {
    try {
      await cancelRewardToFree({
        orgSubscriptionId: row.id as string,
        organizationId: row.organization_id as string,
        previousPlanId: row.plan_id as string,
        previousStatus: 'trialing',
        changedBy: null,
        eventType: 'reward_expired',
        note: 'Host verification reward expired',
      });
      expired += 1;
    } catch (err) {
      console.error('[expireHostVerificationRewards]', row.id, err);
      errors += 1;
    }
  }
  return { expired, errors };
}

export async function revokeHostVerificationReward(
  orgSubscriptionId: string,
  changedBy: string | null
): Promise<void> {
  const { data: row, error } = await db()
    .from('org_subscriptions')
    .select('id, organization_id, plan_id, status, source')
    .eq('id', orgSubscriptionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error('Subscription not found');
  if (row.source !== 'reward') throw new Error('Subscription is not a reward grant');
  if (!['trialing', 'active'].includes(String(row.status))) {
    throw new Error('Reward subscription is not live');
  }

  await cancelRewardToFree({
    orgSubscriptionId: row.id as string,
    organizationId: row.organization_id as string,
    previousPlanId: row.plan_id as string,
    previousStatus: String(row.status),
    changedBy,
    eventType: 'reward_revoked',
    note: 'Host verification reward revoked by super admin',
  });
}
