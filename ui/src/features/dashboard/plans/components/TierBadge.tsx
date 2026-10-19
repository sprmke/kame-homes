import type { ReactNode } from 'react';

import { useResolvedOrgId } from '@/features/dashboard/org/lib/adminApiScope';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';
import { useOrgPlan } from '@/features/dashboard/plans/hooks/useOrgPlan';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';
import {
  planDisplayName,
  resolveEffectiveCurrentPlanId,
  resolveGateBadgePlan,
  resolveMinimumPlanForFeature,
  resolveUpgradePlanForFeature,
} from '@/features/dashboard/plans/lib/planPresentation';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type TierBadgeProps = {
  feature: PlanFeatureKey;
  className?: string;
  /**
   * `inline` — sits next to a title/label.
   * `corner` — absolute top-right on a `relative` parent (use with `TierBadgeAnchor` on buttons).
   */
  placement?: 'inline' | 'corner';
};

/**
 * Solid plan pill naming the plan that unlocks `feature` — only renders when the current
 * property is below that tier. Prefer section/card titles; on buttons use `TierBadgeAnchor` so the
 * pill sits on the top-right corner, not inside the button label.
 *
 * When the org subscription already includes the feature but the property is still Free
 * (unenrolled), the pill shows the org's current plan — not the ladder minimum (Starter).
 */
export function TierBadge({ feature, className, placement = 'inline' }: TierBadgeProps) {
  const { allowed, isLoading: gateLoading } = useFeatureGate(feature);
  const orgId = useResolvedOrgId();
  const { data, isLoading: plansLoading } = useOrgPlan(orgId);

  if (gateLoading || plansLoading || allowed || !data) return null;

  const currentPlanId = resolveEffectiveCurrentPlanId(data.plans, data.subscription?.planId);
  const requiredPlan = resolveGateBadgePlan(data.plans, feature, currentPlanId);
  if (!requiredPlan) return null;

  const planName = planDisplayName(requiredPlan);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-tier-badge
          className={cn(
            'bg-primary-strong text-primary-foreground inline-flex shrink-0 cursor-help items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide',
            placement === 'corner' && 'absolute -right-1.5 -top-1.5 z-10',
            className
          )}
        >
          {planName}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">Available on the {planName} plan and above</TooltipContent>
    </Tooltip>
  );
}

type TierBadgeAnchorProps = {
  feature: PlanFeatureKey;
  children: ReactNode;
  className?: string;
  badgeClassName?: string;
};

/** Wraps a button (or control) so the plan pill anchors to the top-right corner. */
export function TierBadgeAnchor({
  feature,
  children,
  className,
  badgeClassName,
}: TierBadgeAnchorProps) {
  return (
    <span className={cn('relative inline-flex', className)}>
      {children}
      <TierBadge feature={feature} placement="corner" className={badgeClassName} />
    </span>
  );
}

type TeamInviteTierBadgeProps = {
  /** From `teamInviteCapacity.canInvite` — omit while team data is still loading. */
  canInvite?: boolean;
  className?: string;
  placement?: 'inline' | 'corner';
};

/**
 * Plan pill for Invite Member — shows when team management is gated or the org is at its seat cap
 * (Free with one seat filled needs Starter, not a silent no-op).
 */
export function TeamInviteTierBadge({
  canInvite,
  className,
  placement = 'inline',
}: TeamInviteTierBadgeProps) {
  const { allowed, isLoading: gateLoading } = useFeatureGate('teamManagement');
  const orgId = useResolvedOrgId();
  const { data, isLoading: plansLoading } = useOrgPlan(orgId);

  if (gateLoading || plansLoading || !data) return null;

  const atCapacity = allowed && canInvite === false;
  const featureBlocked = !allowed;
  if (!featureBlocked && !atCapacity) return null;

  const currentPlanId = resolveEffectiveCurrentPlanId(data.plans, data.subscription?.planId);
  const requiredPlan = featureBlocked
    ? resolveMinimumPlanForFeature(data.plans, 'teamManagement')
    : resolveUpgradePlanForFeature(data.plans, 'teamManagement', currentPlanId);

  if (!requiredPlan) return null;

  const planName = planDisplayName(requiredPlan);
  const tooltip = atCapacity
    ? `Upgrade to ${planName} to add more team members`
    : `Available on the ${planName} plan and above`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-tier-badge
          className={cn(
            'bg-primary-strong text-primary-foreground inline-flex shrink-0 cursor-help items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tracking-wide',
            placement === 'corner' && 'absolute -right-1.5 -top-1.5 z-10',
            className
          )}
        >
          {planName}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

type TeamInviteTierBadgeAnchorProps = {
  canInvite?: boolean;
  children: ReactNode;
  className?: string;
  badgeClassName?: string;
};

/** Wraps Invite Member so the plan pill sits on the button corner. */
export function TeamInviteTierBadgeAnchor({
  canInvite,
  children,
  className,
  badgeClassName,
}: TeamInviteTierBadgeAnchorProps) {
  return (
    <span className={cn('relative inline-flex', className)}>
      {children}
      <TeamInviteTierBadge canInvite={canInvite} placement="corner" className={badgeClassName} />
    </span>
  );
}
