import { useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { ArrowUpRight, Check, ChevronRight } from 'lucide-react';

import { useResolvedOrgId, useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';
import { PlanTierIconWell } from '@/features/dashboard/plans/components/PlanTierIconWell';
import { useOrgPlan } from '@/features/dashboard/plans/hooks/useOrgPlan';
import {
  buildPlanTiers,
  nextUpgradePlan,
  planDisplayName,
  planDisplayNameFromSubscription,
  planPrice,
  planTierPitch,
  resolveEffectiveCurrentPlan,
  resolveEffectiveCurrentPlanId,
  subscriptionStatusMeta,
} from '@/features/dashboard/plans/lib/planPresentation';
import { useOrgPermissions } from '@/features/dashboard/team/hooks/useOrgPermissions';
import { hasOrgPermission, orgSectionPath } from '@/features/dashboard/team/lib/orgPermissions';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  collapsed?: boolean;
  /** Dense row for the mobile More sheet footer. */
  variant?: 'sidebar' | 'more';
  className?: string;
  /** Called when navigating to Plans & Billing (e.g. close the More sheet). */
  onNavigateToPlans?: () => void;
};

function OrgPlanChipSkeleton({
  collapsed,
  variant,
  className,
}: {
  collapsed: boolean;
  variant: 'sidebar' | 'more';
  className?: string;
}) {
  if (variant === 'more') {
    return (
      <div
        className={cn(
          'flex min-h-[44px] w-full items-center gap-2.5 rounded-lg px-2 py-1.5',
          className
        )}
        aria-hidden
      >
        <Skeleton className="size-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-2.5 w-10" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      </div>
    );
  }

  if (collapsed) {
    return (
      <Skeleton className={cn('mx-auto size-10 shrink-0 rounded-xl', className)} aria-hidden />
    );
  }

  return (
    <div
      className={cn(
        'border-border/40 flex min-h-[3.25rem] w-full items-center gap-2.5 rounded-xl border px-2.5 py-2',
        className
      )}
      aria-hidden
    >
      <Skeleton className="size-9 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-2.5 w-14" />
        <Skeleton className="h-3.5 w-20" />
      </div>
    </div>
  );
}

/**
 * Sidebar / More-sheet control: current org plan name. Opens a sheet with
 * included features and a link to org Plans & Billing.
 */
export function OrgPlanSidebarEntry({
  collapsed = false,
  variant = 'sidebar',
  className,
  onNavigateToPlans,
}: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const orgId = useResolvedOrgId();
  const orgSlug = useOrgSlugParam();
  const { data, isLoading, isError } = useOrgPlan(orgId);
  const { data: orgAccess } = useOrgPermissions();
  const canOpenPlans = hasOrgPermission(orgAccess?.permissions, 'org.plans:view');

  const currentPlan = useMemo(
    () => (data ? resolveEffectiveCurrentPlan(data.plans, data.subscription?.planId) : null),
    [data]
  );

  const currentTier = useMemo(() => {
    if (!data || !currentPlan) return null;
    const planId = resolveEffectiveCurrentPlanId(data.plans, data.subscription?.planId);
    return buildPlanTiers(data.plans, planId).find((tier) => tier.isCurrent) ?? null;
  }, [data, currentPlan]);

  const upgradePlan = useMemo(() => {
    if (!data || !currentPlan) return null;
    const planId = resolveEffectiveCurrentPlanId(data.plans, data.subscription?.planId);
    return nextUpgradePlan(data.plans, planId);
  }, [data, currentPlan]);

  if (!orgId || !orgSlug) return null;
  if (isLoading) {
    return <OrgPlanChipSkeleton collapsed={collapsed} variant={variant} className={className} />;
  }
  if (isError || !data) return null;

  const planName = currentPlan
    ? planDisplayName(currentPlan)
    : planDisplayNameFromSubscription(data.subscription) || 'Free';
  const planCode = currentPlan?.code ?? data.subscription?.planCode ?? 'free';
  const pitch = currentPlan ? planTierPitch(currentPlan) : null;
  const gains = currentTier?.gains ?? [];
  const inheritsFrom = currentTier?.inheritsFrom ?? null;
  const price = currentPlan
    ? planPrice(
        data.subscription?.pricePhpSnapshot != null && data.subscription.pricePhpSnapshot > 0
          ? { ...currentPlan, chargedPricePhp: data.subscription.pricePhpSnapshot }
          : currentPlan
      )
    : null;
  const status = data.subscription ? subscriptionStatusMeta(data.subscription.status) : null;
  const needsAttention = status?.tone === 'destructive';
  const ctaLabel = upgradePlan && currentPlan?.isDefault ? 'Upgrade' : 'Plans & billing';

  const openDetails = () => setOpen(true);

  const goToPlans = () => {
    setOpen(false);
    onNavigateToPlans?.();
    navigate(orgSectionPath(orgSlug, 'plans'));
  };

  const triggerLabel = needsAttention
    ? `Current plan ${planName}, ${status?.label ?? 'needs attention'}`
    : `Current plan, ${planName}`;

  const details = (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalContent
        sheetLayout="split"
        className={cn(
          'flex max-h-[min(92dvh,40rem)] w-[min(calc(100vw-1.5rem),28rem)] max-w-none',
          'flex-col gap-0 overflow-hidden p-0 sm:max-w-[28rem] sm:p-0'
        )}
      >
        <ResponsiveModalHeader className="border-border/60 from-primary/[0.06] to-card shrink-0 border-b bg-gradient-to-b px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex items-start gap-3.5 pr-8">
            <PlanTierIconWell planCode={planCode} size="lg" className="rounded-2xl shadow-sm" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <ResponsiveModalTitle className="truncate text-lg sm:text-xl">
                  {planName}
                </ResponsiveModalTitle>
                {needsAttention && status ? (
                  <Badge
                    variant={status.tone}
                    className="h-5 shrink-0 px-1.5 text-[10px] leading-none"
                  >
                    {status.label}
                  </Badge>
                ) : (
                  <Badge variant="success" className="h-5 shrink-0 px-1.5 text-[10px] leading-none">
                    Current
                  </Badge>
                )}
              </div>
              {price ? (
                <p className="text-foreground text-sm font-semibold tabular-nums tracking-tight">
                  {price.amount}
                  {price.suffix ? (
                    <span className="text-muted-foreground ml-1 text-xs font-medium">
                      {price.suffix}
                      {!currentPlan?.isDefault ? ' per property' : null}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {pitch ? (
                <ResponsiveModalDescription className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                  {pitch}
                </ResponsiveModalDescription>
              ) : (
                <ResponsiveModalDescription className="sr-only">
                  Features included in your plan
                </ResponsiveModalDescription>
              )}
            </div>
          </div>
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {inheritsFrom ? (
            <p className="text-foreground mb-3 text-sm font-semibold leading-snug">
              Everything in {inheritsFrom}, plus
            </p>
          ) : (
            <p className="text-foreground mb-3 text-sm font-semibold leading-snug">Included</p>
          )}
          {gains.length > 0 ? (
            <ul className="space-y-1">
              {gains.map((gain) => (
                <li
                  key={gain.key}
                  className="hover:bg-muted/40 flex items-start gap-3 rounded-lg px-1.5 py-2 text-sm leading-snug transition-colors"
                >
                  <span
                    className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full"
                    aria-hidden
                  >
                    <Check className="size-3 stroke-[2.5]" />
                  </span>
                  <span className="text-foreground min-w-0 flex-1">{gain.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              No feature list for this plan yet.
            </p>
          )}
        </div>

        {canOpenPlans ? (
          <ResponsiveModalFooter className="border-border/60 bg-card/80 shrink-0 gap-2 border-t px-4 py-3 sm:flex-col sm:px-5 sm:py-4">
            <Button type="button" className="min-h-11 w-full" onClick={goToPlans}>
              {upgradePlan ? <ArrowUpRight className="size-4 shrink-0" aria-hidden /> : null}
              {ctaLabel}
            </Button>
          </ResponsiveModalFooter>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );

  if (variant === 'more') {
    return (
      <>
        <button
          type="button"
          onClick={openDetails}
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            'hover:bg-muted/60 active:bg-muted focus-visible:ring-ring flex min-h-[48px] w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            className
          )}
        >
          <PlanTierIconWell planCode={planCode} size="sm" className="size-9 rounded-xl shadow-sm" />
          <span className="min-w-0 flex-1">
            <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium leading-tight">
              Current plan
              {needsAttention && status ? (
                <Badge variant={status.tone} className="h-4 px-1 text-[9px] leading-none">
                  {status.label}
                </Badge>
              ) : null}
            </span>
            <span className="text-foreground mt-0.5 block truncate text-[13px] font-semibold leading-tight">
              {planName}
            </span>
          </span>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </button>
        {details}
      </>
    );
  }

  if (collapsed) {
    return (
      <>
        <button
          type="button"
          onClick={openDetails}
          title={planName}
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            'border-primary/25 from-primary/[0.14] to-primary/[0.04] text-primary',
            'hover:from-primary/20 hover:to-primary/[0.08] focus-visible:ring-ring',
            'relative mx-auto flex size-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br shadow-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            className
          )}
        >
          <PlanTierIconWell
            planCode={planCode}
            size="sm"
            className="size-8 rounded-lg border-0 bg-transparent shadow-none"
          />
          {needsAttention ? (
            <span
              className="bg-destructive absolute right-0.5 top-0.5 size-2 rounded-full ring-2 ring-[hsl(var(--sidebar-background))]"
              aria-hidden
            />
          ) : null}
        </button>
        {details}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openDetails}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'border-primary/20 from-primary/[0.10] via-primary/[0.04] group to-transparent',
          'hover:border-primary/30 hover:from-primary/[0.14] focus-visible:ring-ring',
          'flex min-h-[3.25rem] w-full items-center gap-2.5 rounded-xl border bg-gradient-to-br px-2.5 py-2.5 text-left shadow-sm',
          'transition-[border-color,background-color,box-shadow] duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          needsAttention && 'border-destructive/30 from-destructive/[0.08]',
          className
        )}
      >
        <PlanTierIconWell planCode={planCode} size="sm" className="size-9 rounded-xl shadow-sm" />
        <span className="min-w-0 flex-1">
          <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[11px] font-medium leading-tight">
            <span className="truncate">Current plan</span>
            {needsAttention && status ? (
              <Badge variant={status.tone} className="h-4 shrink-0 px-1 text-[9px] leading-none">
                {status.label}
              </Badge>
            ) : (
              <Badge variant="success" className="h-4 shrink-0 px-1 text-[9px] leading-none">
                Active
              </Badge>
            )}
          </span>
          <span className="text-foreground mt-0.5 block truncate text-sm font-semibold leading-tight tracking-tight">
            {planName}
          </span>
          {price && !currentPlan?.isDefault ? (
            <span className="text-muted-foreground mt-0.5 block truncate text-[11px] tabular-nums leading-tight">
              {price.amount}
              {price.suffix ? `${price.suffix}` : null}
            </span>
          ) : null}
        </span>
        <ChevronRight
          className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
          aria-hidden
        />
      </button>
      {details}
    </>
  );
}
