import { useEffect, useMemo, useRef, useState } from 'react';

import { Download } from 'lucide-react';
import { toast } from 'sonner';

import { ActivityDetailSheet } from '@/features/dashboard/activity/components/ActivityDetailSheet';
import { ActivityEmptyState } from '@/features/dashboard/activity/components/ActivityEmptyState';
import { ActivityFeedList } from '@/features/dashboard/activity/components/ActivityFeedList';
import { ActivityFilters } from '@/features/dashboard/activity/components/ActivityFilters';
import { useActivityLog } from '@/features/dashboard/activity/hooks/useActivityLog';
import {
  downloadActivityLogCsv,
  type ActivityLogFilters,
} from '@/features/dashboard/activity/lib/activityApi';
import type { ActivityEvent } from '@/features/dashboard/activity/lib/activityCatalog';
import {
  clearActivityFilters,
  hasActivityFilters,
} from '@/features/dashboard/activity/lib/activityFilterUtils';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrgSlugParam, useResolvedOrgId } from '@/features/dashboard/org/lib/adminApiScope';
import { useUpgradeModal } from '@/features/dashboard/plans/components/UpgradeModalProvider';
import { useFeatureGate } from '@/features/dashboard/plans/hooks/useFeatureGate';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type ActivityLogScope = 'org' | 'property' | 'parking';

export const ACTIVITY_LOG_SUBTITLE: Record<ActivityLogScope, string> = {
  org: 'Changes across your organization.',
  property: 'Changes on this property.',
  parking: 'Changes on this parking listing.',
};

type Props = {
  scope: ActivityLogScope;
  className?: string;
};

export function ActivityLogPanel({ scope, className }: Props) {
  const propertyId = useOptionalOrgContext()?.property.id ?? null;
  const parkingId = useOptionalParkingContext()?.parking.id ?? null;

  const [filters, setFilters] = useState<ActivityLogFilters>(() => ({ scope }));

  const effectiveFilters = useMemo<ActivityLogFilters>(
    () => ({
      ...filters,
      scope,
      propertyId: scope === 'property' ? propertyId : undefined,
      parkingId: scope === 'parking' ? parkingId : undefined,
    }),
    [filters, scope, propertyId, parkingId]
  );

  const query = useActivityLog(effectiveFilters);
  const [selected, setSelected] = useState<ActivityEvent | null>(null);

  const orgSlug = useOrgSlugParam();
  const orgId = useResolvedOrgId();
  const { canUse: canExport, isLoading: exportGateLoading } = useFeatureGate('activityLogExport');
  const { open: openUpgradeModal } = useUpgradeModal();
  const [exporting, setExporting] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleExport = async () => {
    if (!canExport) {
      if (!exportGateLoading) openUpgradeModal('activityLogExport');
      return;
    }
    setExporting(true);
    try {
      await downloadActivityLogCsv({ orgSlug, orgId, filters: effectiveFilters });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const events = useMemo(() => query.data?.pages.flatMap((p) => p.events) ?? [], [query.data]);
  const filtersActive = hasActivityFilters(effectiveFilters);

  useEffect(() => {
    const node = sentinelRef.current;
    const root = scrollRef.current;
    if (!node || !query.hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      },
      { root, rootMargin: '320px', threshold: 0 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query, events.length]);

  const exportDisabled = exporting || (canExport && events.length === 0);

  const exportButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-10 min-h-[44px] shrink-0 gap-1.5 rounded-lg px-3 text-[13px] font-semibold lg:text-sm"
      onClick={() => void handleExport()}
      disabled={exportDisabled}
      aria-label={exporting ? 'Exporting CSV' : 'Export CSV'}
    >
      <Download className="size-3.5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">{exporting ? 'Exporting…' : 'Export CSV'}</span>
    </Button>
  );

  const mobileExportButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="size-11 shrink-0 rounded-xl p-0"
      onClick={() => void handleExport()}
      disabled={exportDisabled}
      aria-label={exporting ? 'Exporting CSV' : 'Export CSV'}
    >
      <Download className="size-4" aria-hidden />
    </Button>
  );

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="border-border/60 shrink-0 space-y-2 border-b pb-3">
        <ActivityFilters
          filters={filters}
          onChange={setFilters}
          trailing={exportButton}
          mobileTrailing={mobileExportButton}
        />
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-0 pb-4 pt-3"
      >
        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
            ))}
          </div>
        ) : query.isError ? (
          <ActivityEmptyState
            message="Could not load activity."
            onRetry={() => void query.refetch()}
          />
        ) : events.length === 0 ? (
          <ActivityEmptyState
            message={
              filtersActive ? 'No activity matches these filters.' : 'No activity in this range.'
            }
            onClearFilters={
              filtersActive ? () => setFilters(clearActivityFilters(filters)) : undefined
            }
          />
        ) : (
          <ActivityFeedList events={events} onSelect={setSelected} scrollParentRef={scrollRef} />
        )}

        <div ref={sentinelRef} aria-hidden className="h-px" />
        {query.isFetchingNextPage ? (
          <div className="mt-2 space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
            ))}
          </div>
        ) : null}
      </div>

      <ActivityDetailSheet event={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
