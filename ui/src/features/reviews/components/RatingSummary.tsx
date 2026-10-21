import { Star } from 'lucide-react';

import { AdminMetricCard } from '@/features/dashboard/bookings/components/AdminMetricCard';

import type { PropertyReviewSummary } from '@/features/reviews/lib/propertyReviewsApi';

import { SectionContentSkeleton } from '@/components/skeletons/AdminSkeletons';
import { cn } from '@/lib/utils';

type Props = {
  summary: PropertyReviewSummary | undefined;
  /** Initial fetch: show card skeletons instead of zeros. */
  loading?: boolean;
  onDueClick?: () => void;
};

function formatAvg(value: number | null): string {
  if (value == null || Number.isNaN(Number(value))) return '–';
  return Number(value).toFixed(1);
}

function formatPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function RatingSummary({ summary, loading = false, onDueClick }: Props) {
  if (loading && !summary) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SectionContentSkeleton key={i} rows={2} />
        ))}
      </div>
    );
  }
  const avg = formatAvg(summary?.avgOverall ?? null);
  const count = summary?.count ?? 0;
  const responseRate = formatPct(summary?.responseRate ?? 0);
  const due = summary?.dueCount ?? 0;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4 lg:gap-4">
      <AdminMetricCard title="Average" value={avg} icon={Star} />
      <AdminMetricCard title="Reviews" value={String(count)} />
      <AdminMetricCard title="Response rate" value={responseRate} />
      <AdminMetricCard
        title="To write"
        value={String(due)}
        onClick={onDueClick}
        className={cn(due > 0 && onDueClick ? 'cursor-pointer' : undefined)}
        valueClassName={cn(due > 0 ? 'text-amber-600 dark:text-amber-400' : undefined)}
      />
    </div>
  );
}
