import { ChevronRight } from 'lucide-react';

import {
  activityActorLabel,
  activityCategoryIcon,
  ACTIVITY_SEVERITY_META,
  type ActivityEvent,
} from '@/features/dashboard/activity/lib/activityCatalog';
import {
  activityAbsoluteTime,
  activityRelativeTime,
  activitySummaryWithoutLeadingActor,
  changeSummary,
  friendlyActivitySummary,
} from '@/features/dashboard/activity/lib/activityFormat';

import { cn } from '@/lib/utils';

type Props = {
  event: ActivityEvent;
  onSelect: (event: ActivityEvent) => void;
  variant?: 'default' | 'compact';
};

export function ActivityRow({ event, onSelect, variant = 'default' }: Props) {
  const Icon = activityCategoryIcon(event.category);
  const severity = ACTIVITY_SEVERITY_META[event.severity];
  const actor =
    event.actorDisplayName?.trim() ||
    event.actorEmail?.trim() ||
    activityActorLabel(event.actorType);
  const changes = changeSummary(event.changes);
  const compact = variant === 'compact';
  const isDestructive = event.severity === 'destructive';
  const rawSummary = friendlyActivitySummary(event.summary, event.metadata);
  const summaryIncludesActor =
    Boolean(actor) && rawSummary.toLowerCase().startsWith(actor.toLowerCase());
  const summary = summaryIncludesActor
    ? activitySummaryWithoutLeadingActor(rawSummary, actor)
    : rawSummary;

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className={cn(
        'flex w-full items-start gap-3 text-left transition-colors',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
        'min-h-[44px]',
        compact ? 'px-1 py-2.5' : 'px-3 py-3 sm:px-3.5',
        !compact && 'hover:bg-muted/40 active:bg-muted/50',
        isDestructive && !compact && 'bg-destructive/[0.03] hover:bg-destructive/[0.06]'
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full',
          compact ? 'mt-0.5 size-7' : 'mt-0.5 size-8',
          isDestructive
            ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className={compact ? 'size-3.5' : 'size-4'} aria-hidden />
      </span>

      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-start gap-2">
          <span
            className={cn(
              'text-foreground min-w-0 flex-1 font-medium',
              compact
                ? 'line-clamp-2 text-[13px] leading-snug'
                : 'line-clamp-2 text-sm leading-snug'
            )}
          >
            {summary}
          </span>
          {event.severity !== 'info' ? (
            <span
              className={cn(
                'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide',
                severity.badge
              )}
            >
              {severity.label}
            </span>
          ) : null}
        </span>
        <span
          className={cn(
            'text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5',
            compact ? 'text-[11px]' : 'text-xs'
          )}
        >
          <span className="text-foreground/80 font-medium">{actor}</span>
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <span title={activityAbsoluteTime(event.createdAt)}>
            {activityRelativeTime(event.createdAt)}
          </span>
          {event.targetLabel ? (
            <>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span className="max-w-[10rem] truncate sm:max-w-[14rem]">{event.targetLabel}</span>
            </>
          ) : null}
          {changes && !compact ? (
            <>
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <span className="text-muted-foreground/90 max-w-[10rem] truncate sm:max-w-xs">
                {changes}
              </span>
            </>
          ) : null}
        </span>
      </span>

      {!compact ? (
        <ChevronRight className="text-muted-foreground/40 mt-1 size-4 shrink-0" aria-hidden />
      ) : null}
    </button>
  );
}
