import { PencilLine, Quote, Reply, Star } from 'lucide-react';

import {
  formatReviewAverage,
  type PropertyReviewSummary,
} from '@/features/reviews/lib/propertyReviewsApi';

import { StatCard, StatCardGrid, StatCardSkeleton } from '@/components/shared/StatCard';

/** Response rate is meaningless without reviews — show a dash, not 0%. */
function formatResponseRate(summary: PropertyReviewSummary): string {
  if (summary.count === 0) return '–';
  return `${Math.round(summary.responseRate * 100)}%`;
}

const REVIEW_METRICS = [
  { title: 'Average rating', icon: Star },
  { title: 'Reviews', icon: Quote },
  { title: 'Responded', icon: Reply },
  { title: 'To write', icon: PencilLine },
];

export function ReviewsSummaryCardsSkeleton() {
  return (
    <StatCardGrid>
      {REVIEW_METRICS.map((metric) => (
        <StatCardSkeleton key={metric.title} title={metric.title} icon={metric.icon} />
      ))}
    </StatCardGrid>
  );
}

type Props = {
  summary: PropertyReviewSummary | undefined;
  /** Opens the rating breakdown (distribution + category averages). */
  onOpenBreakdown: () => void;
  onShowToWrite: () => void;
  toWriteActive: boolean;
};

export function ReviewsSummaryCards({
  summary,
  onOpenBreakdown,
  onShowToWrite,
  toWriteActive,
}: Props) {
  const count = summary?.count ?? 0;
  const dueCount = summary?.dueCount ?? 0;

  return (
    <StatCardGrid>
      <StatCard
        title="Average rating"
        value={formatReviewAverage(summary?.avgOverall)}
        icon={Star}
        iconClassName="text-amber-500 dark:text-amber-400"
        iconBgClassName="bg-amber-100 dark:bg-amber-500/15"
        onClick={count > 0 ? onOpenBreakdown : undefined}
      />
      <StatCard title="Reviews" value={String(count)} icon={Quote} />
      <StatCard
        title="Responded"
        value={summary ? formatResponseRate(summary) : '–'}
        icon={Reply}
      />
      <StatCard
        title="To write"
        value={String(dueCount)}
        icon={PencilLine}
        valueClassName={dueCount > 0 ? 'text-amber-600 dark:text-amber-400' : undefined}
        onClick={onShowToWrite}
        active={toWriteActive}
      />
    </StatCardGrid>
  );
}
