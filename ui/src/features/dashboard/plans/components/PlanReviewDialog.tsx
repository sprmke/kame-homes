import { useEffect, useState } from 'react';

import { ArrowRight, Check, Loader2, Minus } from 'lucide-react';

import { PlanTierIconWell } from '@/features/dashboard/plans/components/PlanTierIconWell';
import type {
  OrgBundlePlanDto,
  OrgSubscriptionDto,
} from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  planFeatureGains,
  planFeatureLosses,
  planDisplayName,
  planPrice,
  isPlanDowngrade,
  PESO_WHOLE,
  type PlanFeatureChange,
} from '@/features/dashboard/plans/lib/planPresentation';
import {
  computeOrgSubscriptionTotalPhp,
  discountedPlanPricePhp,
} from '@/features/dashboard/plans/lib/planPricing';
import { computeMidCycleProration } from '@/features/dashboard/plans/lib/planProration';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { cn } from '@/lib/utils';

type PlanReviewDialogProps = {
  open: boolean;
  plan: OrgBundlePlanDto | null;
  currentPlan: OrgBundlePlanDto | null;
  /** Every property in the org — billing always covers the full count. */
  propertyCount: number;
  /** Current org_subscriptions row — used only to preview mid-cycle proration. */
  subscription?: OrgSubscriptionDto | null;
  onOpenChange: (open: boolean) => void;
  /** Paid→Free or paid→lower paid — applied immediately (no PayMongo). */
  onConfirmDowngrade: (planId: string) => Promise<void>;
  /** Upgrade / same-plan billing update — starts PayMongo checkout. */
  onCheckoutPaid: (planId: string) => Promise<void>;
  isSubmitting: boolean;
  /** When set, downgrade confirm is disabled (e.g. past_due must pay first). */
  downgradeBlockedReason?: string | null;
};

function orgPlanTotalPhp(plan: OrgBundlePlanDto, propertyCount: number): number {
  return computeOrgSubscriptionTotalPhp(
    discountedPlanPricePhp(plan.pricePhp, plan.discountPercent),
    plan.volumeDiscountTiers,
    propertyCount,
    {
      volumeRampFloorPhp: plan.volumeRampFloorPhp,
      volumeRampAtCount: plan.volumeRampAtCount,
    }
  );
}

/** Preview only — the server (`orgSubscriptionCheckout.ts`) always recomputes and charges the
 * authoritative amount; this exists so the host sees the credit before confirming. */
function midCycleProrationPreview(
  plan: OrgBundlePlanDto,
  currentPlan: OrgBundlePlanDto | null,
  subscription: OrgSubscriptionDto | null | undefined,
  propertyCount: number
) {
  if (!currentPlan || !subscription) return null;
  if (plan.isDefault || currentPlan.isDefault) return null;
  if (subscription.status !== 'active' && subscription.status !== 'past_due') return null;
  if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) return null;
  const currentPricePhp = subscription.pricePhpSnapshot;
  if (currentPricePhp == null || currentPricePhp <= 0) return null;

  const targetPricePhp = orgPlanTotalPhp(plan, propertyCount);
  if (plan.id === currentPlan.id && targetPricePhp === currentPricePhp) return null;

  return computeMidCycleProration({
    currentPricePhp,
    currentPeriodStartIso: subscription.currentPeriodStart,
    currentPeriodEndIso: subscription.currentPeriodEnd,
    targetPricePhp,
  });
}

function PlanStub({
  plan,
  totalPhp,
  muted,
}: {
  plan: OrgBundlePlanDto;
  totalPhp: number;
  muted?: boolean;
}) {
  const price = planPrice({ ...plan, chargedPricePhp: totalPhp });
  const title = planDisplayName(plan);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PlanTierIconWell planCode={plan.code} size="sm" muted={muted} />
      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-sm font-semibold',
            muted ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {title}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
          {price.amount}
          {price.suffix}
        </p>
      </div>
    </div>
  );
}

function ChangeList({
  title,
  items,
  tone,
}: {
  title: string;
  items: PlanFeatureChange[];
  tone: 'gain' | 'loss';
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{title}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-2.5 text-sm leading-relaxed">
            {tone === 'gain' ? (
              <Check
                className="text-primary mt-0.5 size-4 shrink-0"
                strokeWidth={2.5}
                aria-hidden
              />
            ) : (
              <Minus className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span className={tone === 'loss' ? 'text-muted-foreground' : undefined}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlanReviewDialog({
  open,
  plan,
  currentPlan,
  propertyCount,
  subscription,
  onOpenChange,
  onConfirmDowngrade,
  onCheckoutPaid,
  isSubmitting,
  downgradeBlockedReason = null,
}: PlanReviewDialogProps) {
  const [freeAcknowledged, setFreeAcknowledged] = useState(false);

  useEffect(() => {
    if (!open) setFreeAcknowledged(false);
  }, [open, plan?.id]);

  if (!plan) return null;

  const isFree = plan.isDefault;
  const isDowngrade = isPlanDowngrade(currentPlan, plan);
  const needsFreeAck = isFree && isDowngrade && !downgradeBlockedReason;
  const gains = planFeatureGains(currentPlan?.features ?? null, plan.features);
  const losses = currentPlan ? planFeatureLosses(currentPlan.features, plan.features) : [];
  const isDownscale = losses.length > 0 && gains.length === 0;
  const proration = midCycleProrationPreview(plan, currentPlan, subscription, propertyCount);
  const targetTotalPhp = orgPlanTotalPhp(plan, propertyCount);
  const effectivePerPropertyPhp =
    propertyCount > 0 ? Math.floor(targetTotalPhp / propertyCount) : 0;
  const currentTotalPhp =
    subscription?.pricePhpSnapshot ??
    (currentPlan ? orgPlanTotalPhp(currentPlan, propertyCount) : 0);

  const planTitle = planDisplayName(plan);
  const isSamePlan = Boolean(currentPlan && plan.id === currentPlan.id);
  const title = !currentPlan
    ? `Choose ${planTitle}`
    : isSamePlan
      ? 'Update billing'
      : isDownscale || isDowngrade
        ? `Move to ${planTitle}`
        : `Upgrade to ${planTitle}`;

  const description = isFree
    ? downgradeBlockedReason && isDowngrade
      ? downgradeBlockedReason
      : isDowngrade
        ? 'Takes effect now. Paid features turn off immediately. Unused time is not refunded.'
        : 'Your organization keeps running on the free tier.'
    : isDowngrade && downgradeBlockedReason
      ? downgradeBlockedReason
      : isDowngrade
        ? 'Takes effect now. Unused time on your current plan is not refunded.'
        : proration
          ? "You're changing mid-cycle. Credited for the unused time on your current plan."
          : 'Review what changes before you continue.';

  const handlePrimaryAction = async () => {
    if (isDowngrade) {
      if (downgradeBlockedReason || (needsFreeAck && !freeAcknowledged)) return;
      await onConfirmDowngrade(plan.id);
      onOpenChange(false);
      return;
    }
    await onCheckoutPaid(plan.id);
    onOpenChange(false);
  };

  const primaryDisabled =
    isSubmitting ||
    (!isFree && !isDowngrade && propertyCount === 0) ||
    (isDowngrade && Boolean(downgradeBlockedReason)) ||
    (needsFreeAck && !freeAcknowledged);
  const primaryLabel = isDowngrade ? 'Confirm downgrade' : 'Continue to payment';

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent
        sheetLayout="split"
        /* Above other dialogs (e.g. Generate calendar) so the modal-scrim blurs them too. */
        overlayClassName="z-[110]"
        className={cn(
          'z-[111] flex max-h-[min(90dvh,40rem)] w-[min(calc(100vw-1.5rem),28rem)] max-w-none flex-col gap-0 overflow-hidden p-0',
          'sm:max-w-[28rem] sm:p-0'
        )}
        aria-describedby="plan-review-description"
      >
        <ResponsiveModalHeader className="border-border shrink-0 space-y-1 border-b px-5 pb-3.5 pr-14 pt-5 text-left sm:px-6">
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription id="plan-review-description">
            {description}
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [-webkit-overflow-scrolling:touch] sm:px-6">
          <div className="space-y-5">
            {currentPlan && !isSamePlan ? (
              <div className="border-border bg-muted/30 flex items-center gap-3 rounded-xl border p-3">
                <PlanStub plan={currentPlan} totalPhp={currentTotalPhp} muted />
                <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <PlanStub plan={plan} totalPhp={targetTotalPhp} />
              </div>
            ) : (
              <div className="border-border bg-muted/30 rounded-xl border p-3">
                <PlanStub plan={plan} totalPhp={targetTotalPhp} />
              </div>
            )}

            {!isFree ? (
              <p className="text-muted-foreground text-xs">
                {propertyCount === 0
                  ? 'Add a property to your organization before subscribing.'
                  : `Billing covers all ${propertyCount} ${
                      propertyCount === 1 ? 'property' : 'properties'
                    } in your organization.`}
              </p>
            ) : null}

            {proration && !isDowngrade ? (
              <div className="border-border space-y-1.5 rounded-xl border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {planTitle} plan ({proration.remainingDays}{' '}
                    {proration.remainingDays === 1 ? 'day' : 'days'} left)
                  </span>
                  <span className="tabular-nums">
                    {PESO_WHOLE.format(proration.targetPricePhp)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Credit for unused time</span>
                  <span className="tabular-nums">
                    &minus;{PESO_WHOLE.format(proration.creditPhp)}
                  </span>
                </div>
                <div className="border-border flex items-center justify-between gap-3 border-t pt-1.5 font-semibold">
                  <span>Due today</span>
                  <span className="tabular-nums">{PESO_WHOLE.format(proration.netDuePhp)}</span>
                </div>
              </div>
            ) : null}

            {gains.length === 0 && losses.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Same features as your current plan. Only the monthly price changes.
              </p>
            ) : (
              <div className="space-y-5">
                <ChangeList title="Unlocks" items={gains} tone="gain" />
                <ChangeList title="Removes" items={losses} tone="loss" />
              </div>
            )}

            {needsFreeAck ? (
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
                <Checkbox
                  checked={freeAcknowledged}
                  onCheckedChange={(checked) => setFreeAcknowledged(checked === true)}
                  className="mt-0.5"
                />
                <span>Paid features turn off immediately.</span>
              </label>
            ) : null}
          </div>
        </div>

        {!isFree && propertyCount > 0 ? (
          <div
            className="border-border bg-background shrink-0 border-t px-5 py-3 sm:px-6"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="flex items-end justify-between gap-3">
              <span className="text-muted-foreground text-sm">
                {propertyCount} {propertyCount === 1 ? 'property' : 'properties'}
              </span>
              <div className="text-right">
                <p className="text-foreground text-base font-semibold tabular-nums sm:text-lg">
                  {planPrice({ ...plan, chargedPricePhp: targetTotalPhp }).amount}
                  <span className="text-muted-foreground text-sm font-normal">/month</span>
                </p>
                {propertyCount > 1 ? (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {PESO_WHOLE.format(effectivePerPropertyPhp)}/property
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <ResponsiveModalFooter className="border-border shrink-0 gap-2 border-t px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-[44px]"
            disabled={primaryDisabled}
            onClick={handlePrimaryAction}
          >
            {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {primaryLabel}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
