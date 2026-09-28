import { useMemo, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { Check, ChevronRight } from 'lucide-react';

import { useResolvedOrgId, useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';
import { PlanTierIconWell } from '@/features/dashboard/plans/components/PlanTierIconWell';
import { useOrgPlan } from '@/features/dashboard/plans/hooks/useOrgPlan';
import {
  planDisplayName,
  planDisplayNameFromSubscription,
  planIncludedFeatureGroups,
  planTierPitch,
  resolveEffectiveCurrentPlan,
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
  /** Row for the mobile More sheet footer. */
  variant?: 'sidebar' | 'more';
  className?: string;
  /** Called when navigating to Plans & Billing (e.g. close the More sheet). */
  onNavigateToPlans?: () => void;
};

type PlansTab = 'plans' | 'compare' | 'billing';

const CHIP_ICON_CLASS = 'size-6 rounded-md [&_svg]:size-3.5';

/**
 * Sidebar / More-sheet row with the org's current plan. Opens a sheet listing
 * every feature on that plan, with links into org Plans & Billing.
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
  const featureGroups = useMemo(
    () => (currentPlan ? planIncludedFeatureGroups(currentPlan) : []),
    [currentPlan]
  );

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
  const status = data.subscription ? subscriptionStatusMeta(data.subscription.status) : null;
  const needsAttention = status?.tone === 'destructive';
  const isFree = currentPlan?.isDefault ?? planCode === 'free';
  const chipLabel = `${planName} plan`;
  const triggerLabel = needsAttention
    ? `${chipLabel}, ${status?.label ?? 'needs attention'}. View features`
    : `${chipLabel}. View features`;

  const goToPlans = (tab: PlansTab) => {
    setOpen(false);
    onNavigateToPlans?.();
    navigate(`${orgSectionPath(orgSlug, 'plans')}?tab=${tab}`);
  };

  const attentionDot = needsAttention ? (
    <span className="bg-destructive size-1.5 shrink-0 rounded-full" aria-hidden />
  ) : null;

  const details = (
    <ResponsiveModal open={open} onOpenChange={setOpen}>
      <ResponsiveModalContent
        sheetLayout="split"
        className={cn(
          'flex max-h-[min(92dvh,52rem)] w-[min(calc(100vw-2rem),56rem)] max-w-none',
          'flex-col gap-0 overflow-hidden p-0 sm:max-w-[56rem] sm:p-0'
        )}
      >
        <ResponsiveModalHeader className="border-border/60 shrink-0 space-y-0 border-b px-5 py-4 text-left sm:px-6">
          <div className="flex items-center gap-3 pr-8">
            <PlanTierIconWell planCode={planCode} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <ResponsiveModalTitle className="truncate text-lg font-semibold tracking-tight sm:text-lg">
                  {chipLabel}
                </ResponsiveModalTitle>
                {needsAttention && status ? (
                  <Badge variant={status.tone} className="shrink-0">
                    {status.label}
                  </Badge>
                ) : null}
              </div>
              {pitch ? (
                <ResponsiveModalDescription className="text-muted-foreground mt-0.5 text-sm leading-snug">
                  {pitch}
                </ResponsiveModalDescription>
              ) : (
                <ResponsiveModalDescription className="sr-only">
                  Features on your plan
                </ResponsiveModalDescription>
              )}
            </div>
          </div>
        </ResponsiveModalHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {featureGroups.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featureGroups.map((group) => (
                <section
                  key={group.group}
                  aria-labelledby={`plan-feature-group-${group.group}`}
                  className="border-border/60 bg-muted/30 rounded-xl border p-4"
                >
                  <h3
                    id={`plan-feature-group-${group.group}`}
                    className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wide"
                  >
                    {group.label}
                  </h3>
                  <ul className="space-y-2">
                    {group.features.map((feature) => (
                      <li
                        key={feature.key}
                        className="text-foreground flex items-start gap-2.5 text-sm leading-snug"
                      >
                        <Check
                          className="text-primary mt-0.5 size-4 shrink-0"
                          strokeWidth={2.25}
                          aria-hidden
                        />
                        <span className="min-w-0">{feature.label}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Feature list unavailable.</p>
          )}
        </div>

        {canOpenPlans ? (
          <ResponsiveModalFooter className="border-border/60 shrink-0 flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:gap-2 sm:space-x-0 sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full sm:min-h-10 sm:w-auto"
              onClick={() => goToPlans('compare')}
            >
              Compare plans
            </Button>
            <Button
              type="button"
              className="min-h-11 w-full sm:min-h-10 sm:w-auto"
              onClick={() => goToPlans(isFree ? 'plans' : 'billing')}
            >
              {isFree ? 'Upgrade plan' : 'Manage plan'}
            </Button>
          </ResponsiveModalFooter>
        ) : null}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );

  const triggerBase = cn(
    'focus-visible:ring-ring transition-colors focus-visible:outline-none focus-visible:ring-2'
  );

  if (variant === 'more') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          className={cn(
            triggerBase,
            'hover:bg-muted/60 active:bg-muted flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left',
            className
          )}
        >
          <PlanTierIconWell planCode={planCode} size="sm" className={CHIP_ICON_CLASS} />
          <span className="text-foreground min-w-0 truncate text-sm font-medium">{chipLabel}</span>
          {attentionDot}
          <ChevronRight className="text-muted-foreground ml-auto size-4 shrink-0" aria-hidden />
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
          onClick={() => setOpen(true)}
          title={chipLabel}
          aria-label={triggerLabel}
          aria-haspopup="dialog"
          className={cn(
            triggerBase,
            'hover:bg-sidebar-accent relative mx-auto flex size-10 items-center justify-center rounded-lg',
            className
          )}
        >
          <PlanTierIconWell planCode={planCode} size="sm" className={CHIP_ICON_CLASS} />
          {needsAttention ? (
            <span
              className="bg-destructive absolute right-1.5 top-1.5 size-1.5 rounded-full"
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
        onClick={() => setOpen(true)}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        className={cn(
          triggerBase,
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left',
          className
        )}
      >
        <PlanTierIconWell planCode={planCode} size="sm" className={CHIP_ICON_CLASS} />
        <span className="min-w-0 truncate text-sm font-medium">{chipLabel}</span>
        {attentionDot}
        <ChevronRight
          className="text-muted-foreground group-hover:text-foreground ml-auto size-4 shrink-0 transition-colors"
          aria-hidden
        />
      </button>
      {details}
    </>
  );
}

function OrgPlanChipSkeleton({
  collapsed,
  variant,
  className,
}: {
  collapsed: boolean;
  variant: 'sidebar' | 'more';
  className?: string;
}) {
  if (collapsed && variant === 'sidebar') {
    return (
      <div
        className={cn('mx-auto flex size-10 items-center justify-center', className)}
        aria-hidden
      >
        <Skeleton className="size-6 rounded-md" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2.5 px-2',
        variant === 'more' ? 'min-h-11 gap-3' : 'h-10',
        className
      )}
      aria-hidden
    >
      <Skeleton className="size-6 shrink-0 rounded-md" />
      <Skeleton className="h-3.5 w-24" />
    </div>
  );
}
