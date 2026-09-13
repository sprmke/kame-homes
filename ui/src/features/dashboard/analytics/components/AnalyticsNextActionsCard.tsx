import { Link } from 'react-router-dom';

import { ChevronRight, ListChecks } from 'lucide-react';

import type { AnalyticsNextAction } from '@/features/dashboard/analytics/lib/analyticsNextActions';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { cn } from '@/lib/utils';

type Props = {
  actions: AnalyticsNextAction[];
  onOpenReview: () => void;
  className?: string;
};

export function AnalyticsNextActionsCard({ actions, onOpenReview, className }: Props) {
  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
      aria-label="Do next"
    >
      <AdminSurfaceCardHeader icon={ListChecks} title="Do next" iconClassName="bg-muted/80" />
      <ul className="border-border/50 divide-border/50 divide-y overflow-hidden rounded-xl border">
        {actions.map((action) => {
          const rowClass =
            'hover:bg-muted/35 native-press group flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-left transition-colors';
          const body = (
            <>
              <span className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                {action.label}
              </span>
              <ChevronRight
                className="text-muted-foreground size-4 shrink-0 opacity-50 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </>
          );

          return (
            <li key={action.key}>
              {action.to ? (
                <Link to={action.to} className={rowClass}>
                  {body}
                </Link>
              ) : (
                <button type="button" onClick={onOpenReview} className={rowClass}>
                  {body}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
