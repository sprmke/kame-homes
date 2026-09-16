import { Check, Minus } from 'lucide-react';

import { PlanPriceLine } from '@/features/dashboard/plans/components/PlanPriceLine';
import type { OrgBundlePlanDto } from '@/features/dashboard/plans/lib/orgPlanApi';
import {
  MANAGED_PLAN_CODE,
  planActionLabel,
  planDisplayName,
  planFeatureMatrixGroups,
  planPrice,
  planSelectButtonVariant,
  type PlanFeatureRow,
  type PlanFeatureValue,
  type PlanTier,
} from '@/features/dashboard/plans/lib/planPresentation';

import { FloatingPanel } from '@/components/mobile/FloatingPanel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PlanFeatureMatrixProps = {
  tiers: PlanTier[];
  hasCurrentPlan: boolean;
  canSelect: boolean;
  onSelectPlan: (plan: OrgBundlePlanDto) => void;
  className?: string;
};

const STICKY_COLUMN = 'bg-card border-border/60 sticky left-0 z-10 border-r';
const CURRENT_COLUMN_BG = 'bg-primary/[0.06] dark:bg-primary/10';
const GROUP_HEADER_BG = 'bg-muted/40';

function MatrixValue({ value }: { value: PlanFeatureValue }) {
  if (value.kind === 'on') {
    return (
      <>
        <Check className="text-primary mx-auto size-3.5 sm:size-4" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">Included</span>
      </>
    );
  }

  if (value.kind === 'off') {
    return (
      <>
        <Minus className="text-muted-foreground/50 mx-auto size-3.5 sm:size-4" aria-hidden />
        <span className="sr-only">Not included</span>
      </>
    );
  }

  return <span className="text-xs font-semibold tabular-nums sm:text-sm">{value.text}</span>;
}

/** Full capability comparison across tiers — the detail behind the cards. */
export function PlanFeatureMatrix({
  tiers,
  hasCurrentPlan,
  canSelect,
  onSelectPlan,
  className,
}: PlanFeatureMatrixProps) {
  const groups = planFeatureMatrixGroups(tiers.map((tier) => tier.plan));

  return (
    <FloatingPanel
      as="section"
      padding="none"
      aria-labelledby="plan-compare-heading"
      className={cn('min-w-0 max-w-full overflow-hidden', className)}
    >
      <h2 id="plan-compare-heading" className="sr-only">
        Compare features across plans
      </h2>

      <div className="scrollbar-thin w-full min-w-0 max-w-full overflow-x-auto">
        <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-xs sm:min-w-[44rem] sm:text-sm">
          <caption className="sr-only">
            Feature availability for each subscription tier, with the current plan marked.
          </caption>

          <thead>
            <tr>
              <th
                scope="col"
                className={cn(
                  STICKY_COLUMN,
                  'border-border z-20 border-b px-3 py-3 text-left align-bottom sm:px-5 sm:py-4'
                )}
              >
                <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide sm:text-xs">
                  Feature
                </span>
              </th>
              {tiers.map(({ plan, isCurrent }) => {
                const price = planPrice(plan);
                const title = planDisplayName(plan);
                return (
                  <th
                    key={plan.id}
                    scope="col"
                    aria-current={isCurrent ? 'true' : undefined}
                    className={cn(
                      'border-border min-w-[7.5rem] border-y px-1.5 py-3 text-center align-bottom sm:min-w-[9.5rem] sm:px-3 sm:py-4',
                      isCurrent ? CURRENT_COLUMN_BG : 'bg-card'
                    )}
                  >
                    <div className="flex flex-col items-center gap-1 sm:gap-2">
                      <span
                        className={cn(
                          'block text-xs font-semibold leading-tight sm:text-sm',
                          isCurrent && 'text-primary'
                        )}
                      >
                        {title}
                      </span>
                      <PlanPriceLine price={price} variant="compact" />
                      {isCurrent ? <span className="sr-only">Current plan</span> : null}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {groups.map((group) => (
            <tbody key={group.group}>
              <tr>
                <th
                  scope="row"
                  className={cn(
                    STICKY_COLUMN,
                    GROUP_HEADER_BG,
                    'border-border/70 border-b px-3 py-1.5 text-left sm:px-5 sm:py-2'
                  )}
                >
                  <span className="text-muted-foreground text-[10px] font-semibold tracking-wide sm:text-xs">
                    {group.label}
                  </span>
                </th>
                {tiers.map(({ plan, isCurrent }) => (
                  <td
                    key={plan.id}
                    aria-hidden
                    className={cn(
                      'border-border/70 border-b py-1.5 sm:py-2',
                      isCurrent ? CURRENT_COLUMN_BG : GROUP_HEADER_BG
                    )}
                  />
                ))}
              </tr>

              {group.rows.map((row) => {
                const isBaseline = 'baseline' in row && row.baseline === true;
                const minSortOrder = 'minSortOrder' in row ? row.minSortOrder : null;
                const managedOnly = 'managedOnly' in row && row.managedOnly === true;
                return (
                  <tr key={row.key} className="group/row">
                    <th
                      scope="row"
                      className={cn(
                        STICKY_COLUMN,
                        'group-hover/row:bg-muted/40 border-border/60 border-b px-3 py-2 text-left align-middle text-xs font-medium leading-snug transition-colors sm:px-5 sm:py-3 sm:text-sm'
                      )}
                    >
                      {row.label}
                    </th>
                    {tiers.map(({ plan, isCurrent }) => {
                      let value: PlanFeatureValue;
                      if (isBaseline) {
                        value = { kind: 'on' };
                      } else if (managedOnly) {
                        value = plan.code === MANAGED_PLAN_CODE ? { kind: 'on' } : { kind: 'off' };
                      } else if (minSortOrder !== null) {
                        value = plan.sortOrder >= minSortOrder ? { kind: 'on' } : { kind: 'off' };
                      } else {
                        value = (row as PlanFeatureRow).value(plan.features);
                      }

                      return (
                        <td
                          key={plan.id}
                          className={cn(
                            'border-border/60 border-b px-1.5 py-2 text-center align-middle transition-colors sm:px-3 sm:py-3',
                            isCurrent ? CURRENT_COLUMN_BG : 'group-hover/row:bg-muted/40'
                          )}
                        >
                          <MatrixValue value={value} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          ))}

          {canSelect ? (
            <tfoot>
              <tr>
                <th
                  scope="row"
                  className={cn(STICKY_COLUMN, 'px-3 py-3 text-left sm:px-5 sm:py-4')}
                >
                  <span className="sr-only">Change plan</span>
                </th>
                {tiers.map(({ plan, isCurrent, direction }) => (
                  <td
                    key={plan.id}
                    className={cn(
                      'px-1.5 py-3 align-middle sm:px-2 sm:py-4',
                      isCurrent && CURRENT_COLUMN_BG
                    )}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant={planSelectButtonVariant(isCurrent, direction, plan.code)}
                      disabled={isCurrent}
                      onClick={() => onSelectPlan(plan)}
                      aria-label={
                        isCurrent
                          ? `${planDisplayName(plan)} is your current plan`
                          : `${planActionLabel(direction, hasCurrentPlan, plan.code)} to ${planDisplayName(plan)}`
                      }
                      className="settings-action w-full"
                    >
                      {isCurrent
                        ? 'Current'
                        : planActionLabel(direction, hasCurrentPlan, plan.code)}
                    </Button>
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </FloatingPanel>
  );
}
