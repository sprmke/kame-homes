/**
 * Shared shell for workflow rail sub-forms (`WorkflowPanel`) — matches the
 * **Guest SD refund form** card: rounded border, header strip, padded body.
 */

import type { ReactNode } from 'react';

import { WorkflowAdvanceModeBadge } from '@/features/dashboard/bookings/components/workflow-panel/WorkflowAdvanceModeBadge';
import type {
  WorkflowAdvanceDisplay,
  WorkflowAdvanceMode,
} from '@/features/dashboard/bookings/lib/workflowAdvanceMode';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  /** Merged with default body padding; include vertical rhythm, e.g. `space-y-4`. */
  bodyClassName?: string;
  /** Flat layout for dialogs — no nested card chrome. */
  plain?: boolean;
  /** How this step advances — shown next to the card title on the rail. */
  advanceMode?: WorkflowAdvanceMode | null;
  /** Plan-aware badge label + tooltip; takes precedence over `advanceMode` alone. */
  advanceDisplay?: WorkflowAdvanceDisplay | null;
  /** Links "upgrade" in the advance-mode tooltip when plan-gated. */
  upgradeFeature?: PlanFeatureKey;
};

export function WorkflowSubFormCard({
  title,
  description,
  children,
  bodyClassName,
  plain = false,
  advanceMode,
  advanceDisplay,
  upgradeFeature,
}: Props) {
  const badge: { mode: WorkflowAdvanceMode; label?: string; hint?: string } | null =
    advanceDisplay ?? (advanceMode ? { mode: advanceMode } : null);

  if (plain) {
    return (
      <div className={cn('min-w-0 space-y-3', bodyClassName)}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-foreground min-w-0 truncate text-sm font-semibold leading-snug">
            {title}
          </h3>
          {badge ? (
            <WorkflowAdvanceModeBadge
              mode={badge.mode}
              label={badge.label}
              hint={badge.hint}
              upgradeFeature={upgradeFeature}
            />
          ) : null}
        </div>
        {description ? (
          <p className="text-muted-foreground text-xs leading-snug">{description}</p>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm ring-1 ring-slate-950/[0.04]">
      <div className="border-separator bg-muted/50/80 border-b px-4 py-3.5 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-muted-foreground min-w-0 truncate text-xs font-bold uppercase tracking-wider">
            {title}
          </h3>
          {badge ? (
            <WorkflowAdvanceModeBadge
              mode={badge.mode}
              label={badge.label}
              hint={badge.hint}
              upgradeFeature={upgradeFeature}
            />
          ) : null}
        </div>
        {description ? (
          <p className="text-muted-foreground mt-1 text-[11px] leading-snug">{description}</p>
        ) : null}
      </div>
      <div className={cn('px-4 py-3.5 sm:px-5', bodyClassName ?? 'space-y-3')}>{children}</div>
    </div>
  );
}
