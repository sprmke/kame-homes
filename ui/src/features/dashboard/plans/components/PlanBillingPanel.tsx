import { ArrowRight, ArrowUpRight, Receipt, Settings, Sparkles } from 'lucide-react';

import { OrgPlanTransactions } from '@/features/dashboard/plans/components/OrgPlanTransactions';
import { PlanTierIconWell } from '@/features/dashboard/plans/components/PlanTierIconWell';
import type {
  OrgBundlePlanDto,
  OrgPaymentTransactionDto,
  OrgSubscriptionDto,
} from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  planDisplayName,
  planDisplayNameFromSubscription,
  planPrice,
  subscriptionGraceLabel,
  subscriptionRenewalLabel,
  subscriptionStatusMeta,
  upgradeBannerActionLabel,
} from '@/features/dashboard/plans/lib/planPresentation';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatManilaLongDate } from '@/utils/format/dates';

type PlanBillingPanelProps = {
  plan: OrgBundlePlanDto | null;
  subscription: OrgSubscriptionDto | null;
  transactions: OrgPaymentTransactionDto[];
  canManage?: boolean;
  pendingCheckoutUrl?: string | null;
  onPayNow?: () => void;
  onResumePayment?: () => void;
  isPaying?: boolean;
  upgradePlan?: OrgBundlePlanDto | null;
  onManagePlans?: () => void;
  onUpgrade?: (plan: OrgBundlePlanDto) => void;
  uncoveredPropertyCount?: number;
  onCoverUncoveredProperties?: () => void;
};

function BillingEmptyState() {
  return (
    <FloatingPanel padding="lg" className="py-12 text-center">
      <Receipt className="text-muted-foreground mx-auto size-8" aria-hidden />
      <p className="text-foreground mt-3 text-sm font-semibold">No payments yet</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
        Paid plan charges will appear here after checkout.
      </p>
    </FloatingPanel>
  );
}

function resolveBillingPrice(
  plan: OrgBundlePlanDto | null,
  subscription: OrgSubscriptionDto | null
) {
  if (plan) {
    return planPrice(
      subscription?.pricePhpSnapshot != null && subscription.pricePhpSnapshot > 0
        ? { ...plan, chargedPricePhp: subscription.pricePhpSnapshot }
        : plan
    );
  }

  if (!subscription) return null;

  return planPrice({
    isDefault: (subscription.pricePhpSnapshot ?? 0) <= 0,
    pricePhp: subscription.pricePhpSnapshot ?? 0,
    pricingModel: subscription.pricingModel ?? 'subscription',
    code: subscription.planCode ?? '',
    discountPercent: 0,
  });
}

/** Billing tab — one subscription summary with actions, plus payment history. */
export function PlanBillingPanel({
  plan,
  subscription,
  transactions,
  canManage = false,
  pendingCheckoutUrl,
  onPayNow,
  onResumePayment,
  isPaying = false,
  upgradePlan,
  onManagePlans,
  onUpgrade,
  uncoveredPropertyCount = 0,
  onCoverUncoveredProperties,
}: PlanBillingPanelProps) {
  if (!plan && !subscription) {
    return transactions.length > 0 ? (
      <OrgPlanTransactions transactions={transactions} />
    ) : (
      <BillingEmptyState />
    );
  }

  const name = plan ? planDisplayName(plan) : planDisplayNameFromSubscription(subscription);
  const price = resolveBillingPrice(plan, subscription);
  const status = subscription ? subscriptionStatusMeta(subscription.status) : null;
  const renewal = subscriptionRenewalLabel(subscription);
  const periodStart = subscription?.currentPeriodStart
    ? formatManilaLongDate(subscription.currentPeriodStart)
    : null;
  const needsAttention = status?.tone === 'destructive';
  const showPayNow =
    canManage &&
    Boolean(onPayNow || onResumePayment) &&
    subscription &&
    !plan?.isDefault &&
    (subscription.status === 'past_due' ||
      subscription.status === 'suspended' ||
      Boolean(pendingCheckoutUrl));
  const showResume = canManage && !needsAttention && Boolean(pendingCheckoutUrl);
  const showActions = canManage && (Boolean(onManagePlans) || (upgradePlan && onUpgrade));

  const openCheckout = () => {
    if (pendingCheckoutUrl) {
      onResumePayment?.();
      return;
    }
    onPayNow?.();
  };

  const periodLabel = renewal ? 'Next renewal' : 'Billing period';
  const periodValue = renewal ?? periodStart ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
      <FloatingPanel as="section" padding="lg" aria-labelledby="billing-summary-heading">
        <div className="flex flex-col gap-4 sm:gap-5">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <PlanTierIconWell planCode={plan?.code ?? subscription?.planCode ?? 'free'} size="md" />

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2
                  id="billing-summary-heading"
                  className="text-foreground truncate text-base font-semibold tracking-tight sm:text-lg"
                >
                  {name} plan
                </h2>
                {status ? (
                  <Badge
                    variant={status.tone}
                    className="h-5 shrink-0 px-1.5 text-[10px] leading-none sm:h-6 sm:px-2 sm:text-xs"
                  >
                    {status.label}
                  </Badge>
                ) : (
                  <Badge
                    variant="default"
                    className="h-5 shrink-0 px-1.5 text-[10px] leading-none sm:h-6 sm:px-2 sm:text-xs"
                  >
                    Current
                  </Badge>
                )}
              </div>

              {price ? (
                <p className="mt-1 truncate text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
                  {price.amount}
                  {price.suffix ? (
                    <span className="text-muted-foreground ml-1 text-sm font-medium">
                      {price.suffix}
                    </span>
                  ) : null}
                </p>
              ) : null}

              {periodValue ? (
                <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                  <span className="font-medium">{periodLabel}</span>
                  <span aria-hidden> · </span>
                  <span className="tabular-nums">{periodValue}</span>
                  {periodStart && renewal ? (
                    <span className="text-muted-foreground/80"> · Since {periodStart}</span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>

          {showActions ? (
            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {onManagePlans ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] w-full justify-center sm:w-auto"
                  onClick={onManagePlans}
                >
                  <Settings className="size-4 shrink-0" aria-hidden />
                  <span className="sm:hidden">Manage</span>
                  <span className="hidden sm:inline">Manage subscription</span>
                </Button>
              ) : null}
              {upgradePlan && onUpgrade ? (
                <Button
                  type="button"
                  size="sm"
                  className="min-h-[44px] w-full justify-center sm:w-auto"
                  onClick={() => onUpgrade(upgradePlan)}
                >
                  <ArrowUpRight className="size-4 shrink-0" aria-hidden />
                  {upgradeBannerActionLabel(upgradePlan)}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {needsAttention ? (
          <div className="border-destructive/25 mt-4 flex flex-col gap-2.5 border-t pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="text-destructive flex items-start gap-2 text-sm">
              <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
              {subscription?.status === 'suspended'
                ? 'Dashboard access is limited until payment is received.'
                : `Payment is past due. Pay by ${subscriptionGraceLabel(subscription) ?? 'soon'} to keep full access.`}
            </p>
            {showPayNow ? (
              <Button
                type="button"
                className="min-h-[44px] shrink-0"
                disabled={isPaying}
                onClick={openCheckout}
              >
                {isPaying ? 'Opening…' : 'Pay now'}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : showResume ? (
          <div className="border-primary/15 mt-4 flex flex-col gap-2.5 border-t pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="text-muted-foreground flex items-start gap-2 text-sm">
              <Sparkles className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />A plan payment
              is waiting to be completed.
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] shrink-0"
              disabled={isPaying}
              onClick={openCheckout}
            >
              Resume payment
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}

        {uncoveredPropertyCount > 0 && onCoverUncoveredProperties ? (
          <div className="border-primary/15 mt-4 flex flex-col gap-2.5 border-t pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <p className="text-muted-foreground text-sm">
              {uncoveredPropertyCount}{' '}
              {uncoveredPropertyCount === 1 ? 'property is' : 'properties are'} not on your plan
              yet.
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] shrink-0"
              onClick={onCoverUncoveredProperties}
            >
              Update billing
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        ) : null}
      </FloatingPanel>

      {transactions.length > 0 ? (
        <OrgPlanTransactions transactions={transactions} />
      ) : (
        <BillingEmptyState />
      )}
    </div>
  );
}
