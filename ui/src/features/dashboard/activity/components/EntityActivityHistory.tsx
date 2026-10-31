import { useMemo, useState } from 'react';

import { ActivityDetailSheet } from '@/features/dashboard/activity/components/ActivityDetailSheet';
import { ActivityFeedList } from '@/features/dashboard/activity/components/ActivityFeedList';
import { useActivityLog } from '@/features/dashboard/activity/hooks/useActivityLog';
import type { ActivityEvent } from '@/features/dashboard/activity/lib/activityCatalog';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Props = {
  /** e.g. "booking", "property", "member", "expense" */
  targetType: string;
  targetId: string;
  className?: string;
  /** Rows shown before "Show more". */
  initialLimit?: number;
  /** Section heading; pass `null` when the surrounding container already has one. */
  heading?: string | null;
};

/** Compact activity feed for one entity — embed in a booking / settings / member detail page. */
export function EntityActivityHistory({
  targetType,
  targetId,
  className,
  initialLimit = 6,
  heading = 'Activity',
}: Props) {
  const query = useActivityLog({ targetType, targetId });
  const [selected, setSelected] = useState<ActivityEvent | null>(null);
  const [expanded, setExpanded] = useState(false);

  const events = useMemo(() => query.data?.pages.flatMap((p) => p.events) ?? [], [query.data]);
  const visible = expanded ? events : events.slice(0, initialLimit);

  return (
    <section className={className}>
      {heading ? <h3 className="text-section-title text-foreground mb-2">{heading}</h3> : null}

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : query.isError ? (
        <p className="text-muted-foreground text-sm">Could not load activity.</p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground text-sm">No recorded activity yet.</p>
      ) : (
        <ActivityFeedList
          events={visible}
          onSelect={setSelected}
          variant="compact"
          className={cn('border-border/60 bg-muted/20 rounded-lg border')}
        />
      )}

      {!expanded && events.length > initialLimit ? (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-8 px-2 text-xs"
          onClick={() => {
            setExpanded(true);
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
        >
          Show more
        </Button>
      ) : null}

      <ActivityDetailSheet event={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </section>
  );
}
