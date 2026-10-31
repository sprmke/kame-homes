import { useMemo } from 'react';

import { ArrowRight, Check } from 'lucide-react';
import { createPortal } from 'react-dom';

import { PlanTierIconWell } from '@/features/dashboard/plans/components/PlanTierIconWell';
import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  isPlanDowngrade,
  planDisplayName,
  resolveUpgradeCelebrationGains,
} from '@/features/dashboard/plans/lib/planPresentation';

import { ConfettiBurst } from '@/components/shared/ConfettiBurst';
import { Button } from '@/components/ui/button';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';

type PlanUpgradeSuccessModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previousPlan: OrgBundlePlanDto | null;
  targetPlan: OrgBundlePlanDto | null;
  onViewCompare?: () => void;
};

export function PlanUpgradeSuccessModal({
  open,
  onOpenChange,
  previousPlan,
  targetPlan,
  onViewCompare,
}: PlanUpgradeSuccessModalProps) {
  const gains = useMemo(
    () => (targetPlan ? resolveUpgradeCelebrationGains(previousPlan, targetPlan) : []),
    [previousPlan, targetPlan]
  );

  if (!targetPlan) return null;

  const isUpgrade =
    previousPlan != null &&
    previousPlan.id !== targetPlan.id &&
    !isPlanDowngrade(previousPlan, targetPlan);
  const title = isUpgrade
    ? `You're on ${planDisplayName(targetPlan)}`
    : `${planDisplayName(targetPlan)} is active`;

  return (
    <>
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div className="pointer-events-none fixed inset-0 z-[102]" aria-hidden>
              <ConfettiBurst pieceCount={32} />
            </div>,
            document.body
          )
        : null}

      <ResponsiveModal open={open} onOpenChange={onOpenChange}>
        <ResponsiveModalContent
          className="border-border/80 gap-0 overflow-hidden p-0 sm:max-w-md"
          sheetLayout="split"
          sheetBodyClassName="px-0"
        >
          <div className="from-primary/8 via-background to-background bg-gradient-to-b px-6 pb-5 pt-8 sm:px-8">
            <div className="flex flex-col items-center text-center">
              <PlanTierIconWell planCode={targetPlan.code} size="lg" />

              <ResponsiveModalHeader className="mt-4 space-y-1 p-0 text-center sm:text-center">
                <ResponsiveModalTitle className="text-lg font-semibold tracking-tight sm:text-xl">
                  {title}
                </ResponsiveModalTitle>
              </ResponsiveModalHeader>
            </div>
          </div>

          <div className="max-h-[min(42vh,320px)] overflow-y-auto px-6 py-4 sm:px-8">
            {gains.length > 0 ? (
              <ul className="space-y-3">
                {gains.map((gain, index) => (
                  <li
                    key={gain.key}
                    className="animate-fade-in-up flex items-start gap-3 text-left"
                    style={{
                      animationDelay: `${Math.min(index * 60, 360)}ms`,
                      opacity: 0,
                    }}
                  >
                    <span className="bg-primary/10 text-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
                      <Check className="size-3" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className="text-foreground text-sm leading-snug">{gain.label}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <ResponsiveModalFooter className="border-border/60 flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:px-8 sm:pb-0">
            {onViewCompare ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] w-full sm:w-auto"
                onClick={() => {
                  onOpenChange(false);
                  onViewCompare();
                }}
              >
                Compare plans
              </Button>
            ) : null}
            <Button
              type="button"
              className="min-h-[44px] w-full sm:ml-auto sm:w-auto"
              onClick={() => onOpenChange(false)}
            >
              Start exploring
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}
