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
  PLANS_TAB_SECTION_TITLES,
  planTabCardHeadingClass,
  subscriptionGraceLabel,
  subscriptionRenewalLabel,
  subscriptionStatusMeta,
  upgradeBannerActionLabel,
} from '@/features/dashboard/plans/lib/planPresentation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { cn } from '@/lib/utils';
import { formatManilaLongDate } from '@/utils/format/dates';

const BILLING_ALERT_ROW =
  'mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3';

type PlanBillingSummaryProps = {
  plan: OrgBundlePlanDto | null;
  subscription: OrgSubscriptionDto | null;
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

type PlanBillingPanelProps = PlanBillingSummaryProps & {
  transactions: OrgPaymentTransactionDto[];
};

function BillingEmptyState() {
  return (
    <FloatingPanel as="section" padding="lg" aria-labelledby="plans-billing-heading">
      <h2 id="plans-billing-heading" className={planTabCardHeadingClass}>
        {PLANS_TAB_SECTION_TITLES.billing}
      </h2>
      <div className="flex flex-col items-center gap-3 px-2 py-10 text-center sm:py-12">
        <div className="bg-muted flex size-12 items-center justify-center rounded-full">
          <Receipt className="text-muted-foreground size-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-foreground text-sm font-semibold">No payments yet</p>
          <p className="text-muted-foreground mx-auto max-w-sm text-sm">
            Paid plan charges will appear here after checkout.
          </p>
        </div>
      </div>
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

/** Subscription summary — pinned above Plans tabs (tab label covers section context). */
export function PlanBillingSummaryCard({
  plan,
  subscription,
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
}: PlanBillingSummaryProps) {
  if (!plan && !subscription) return null;

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
    <section
      className="surface-card min-w-0 p-3 sm:p-3.5"
      aria-labelledby="billing-summary-heading"
    >
      <div className="flex min-w-0 items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <PlanTierIconWell planCode={plan?.code ?? subscription?.planCode ?? 'free'} size="sm" />

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <p id="billing-summary-heading" className="text-card-title truncate">
                {name} plan
              </p>
              {status ? (
                <Badge
                  variant={status.tone}
                  className="h-5 shrink-0 px-1.5 text-[10px] leading-none"
                >
                  {status.label}
                </Badge>
              ) : (
                <Badge variant="default" className="h-5 shrink-0 px-1.5 text-[10px] leading-none">
                  Current
                </Badge>
              )}
            </div>

            {price ? (
              <p className="text-stat-value mt-0.5 truncate tabular-nums">
                {price.amount}
                {price.suffix ? (
                  <span className="text-muted-foreground ml-1 text-xs font-medium sm:text-sm">
                    {price.suffix}
                  </span>
                ) : null}
              </p>
            ) : null}

            {periodValue ? (
              <p className="text-meta mt-0.5 line-clamp-2 sm:line-clamp-1">
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
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {onManagePlans ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] shrink-0 px-2.5 sm:px-3"
                onClick={onManagePlans}
              >
                <Settings className="size-4 shrink-0" aria-hidden />
                <span className="max-sm:hidden">Manage subscription</span>
                <span className="sm:hidden">Manage</span>
              </Button>
            ) : null}
            {upgradePlan && onUpgrade ? (
              <Button
                type="button"
                size="sm"
                className="min-h-[44px] shrink-0 px-2.5 sm:px-3"
                onClick={() => onUpgrade(upgradePlan)}
              >
                <ArrowUpRight className="size-4 shrink-0" aria-hidden />
                <span className="sm:hidden">Upgrade</span>
                <span className="hidden sm:inline">{upgradeBannerActionLabel(upgradePlan)}</span>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {needsAttention ? (
        <div className={cn(BILLING_ALERT_ROW, 'border-destructive/25')}>
          <p className="text-destructive flex items-start gap-2 text-xs sm:text-sm">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
            {subscription?.status === 'suspended'
              ? 'Dashboard access is limited until payment is received.'
              : `Payment is past due. Pay by ${subscriptionGraceLabel(subscription) ?? 'soon'} to keep full access.`}
          </p>
          {showPayNow ? (
            <Button
              type="button"
              size="sm"
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
        <div className={cn(BILLING_ALERT_ROW, 'border-primary/15')}>
          <p className="text-muted-foreground flex items-start gap-2 text-xs sm:text-sm">
            <Sparkles className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />A plan payment
            is waiting to be completed.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
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
        <div className={cn(BILLING_ALERT_ROW, 'border-primary/15')}>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {uncoveredPropertyCount}{' '}
            {uncoveredPropertyCount === 1 ? 'property is' : 'properties are'} not on your plan yet.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-[44px] shrink-0"
            onClick={onCoverUncoveredProperties}
          >
            Update billing
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** Billing tab body — payment history below the pinned summary card. */
export function PlanBillingHistory({
  transactions,
  plans = [],
}: {
  transactions: OrgPaymentTransactionDto[];
  plans?: OrgBundlePlanDto[];
}) {
  if (transactions.length > 0) {
    return <OrgPlanTransactions transactions={transactions} plans={plans} />;
  }

  return <BillingEmptyState />;
}

/** Billing tab — summary card plus payment history (legacy single-column layout). */
export function PlanBillingPanel({ transactions, ...summaryProps }: PlanBillingPanelProps) {
  const hasSummary = Boolean(summaryProps.plan || summaryProps.subscription);
  const plans = summaryProps.plan ? [summaryProps.plan] : [];

  return (
    <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
      {hasSummary ? <PlanBillingSummaryCard {...summaryProps} /> : null}
      <PlanBillingHistory transactions={transactions} plans={plans} />
    </div>
  );
}
