import { Link } from 'react-router-dom';

import { AlertTriangle, CheckCircle2, Sparkles, TrendingUp } from 'lucide-react';

import type {
  AnalyticsAiReviewItem,
  AnalyticsAiReviewRecord,
} from '@/features/dashboard/analytics/lib/aiReviewTypes';
import type { AnalyticsPlaybookArticle } from '@/features/dashboard/analytics/lib/types';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const RING_SIZE = 64;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ScoreDial({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const dashOffset = RING_CIRCUMFERENCE * (1 - clamped / 100);
  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          strokeWidth={RING_STROKE}
          className="stroke-muted fill-none"
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          className="stroke-primary fill-none transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="text-foreground absolute text-sm font-bold tabular-nums">
        {Math.round(clamped)}
      </span>
    </div>
  );
}

function ItemList({
  title,
  icon: Icon,
  iconClassName,
  items,
  emptyLabel,
  articleTitleBySlug,
}: {
  title: string;
  icon: typeof CheckCircle2;
  iconClassName: string;
  items: AnalyticsAiReviewItem[] | Array<{ title: string; evidence: string }>;
  emptyLabel: string;
  articleTitleBySlug?: Map<string, string>;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className={cn('size-4', iconClassName)} aria-hidden />
        <p className="text-foreground text-sm font-semibold">{title}</p>
      </div>
      {items.length > 0 ? (
        <ul className="space-y-2.5">
          {items.map((item, index) => {
            const deepLink = 'deepLink' in item ? item.deepLink : null;
            const detail = 'evidence' in item ? item.evidence : (item as AnalyticsAiReviewItem).why;
            const action = 'action' in item ? (item as AnalyticsAiReviewItem).action : undefined;
            const articleSlugs =
              'articleSlugs' in item ? (item.articleSlugs ?? []) : ([] as string[]);
            return (
              <li
                key={`${item.title}-${index}`}
                className="border-border/60 rounded-md border p-2.5"
              >
                <p className="text-foreground text-sm font-medium">{item.title}</p>
                {detail ? <p className="text-muted-foreground mt-1 text-xs">{detail}</p> : null}
                {action ? (
                  <p className="text-foreground mt-1 text-xs font-medium">→ {action}</p>
                ) : null}
                {deepLink ? (
                  <Link
                    to={deepLink}
                    className="text-primary mt-1 inline-block text-xs font-medium hover:underline"
                  >
                    Go there
                  </Link>
                ) : null}
                {articleTitleBySlug && articleSlugs.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {articleSlugs.map((slug) => {
                      const articleTitle = articleTitleBySlug.get(slug);
                      if (!articleTitle) return null;
                      return (
                        <a
                          key={slug}
                          href={`#playbook-${slug}`}
                          className="bg-muted text-muted-foreground hover:text-foreground inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                        >
                          Playbook: {articleTitle}
                        </a>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">{emptyLabel}</p>
      )}
    </div>
  );
}

type Props = {
  review: AnalyticsAiReviewRecord | null;
  isLoading: boolean;
  /** Matched Improvement Playbook articles, so improvements[].articleSlugs can link by title. */
  playbookArticles?: AnalyticsPlaybookArticle[];
  className?: string;
};

export function AiPerformanceReviewCard({
  review,
  isLoading,
  playbookArticles = [],
  className,
}: Props) {
  const articleTitleBySlug = new Map(playbookArticles.map((a) => [a.slug, a.title]));

  return (
    <section
      className={cn(
        'surface-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden p-3 sm:p-4',
        className
      )}
    >
      <AdminSurfaceCardHeader
        icon={Sparkles}
        title="AI Performance Review"
        description="Refreshes weekly from your numbers"
        iconClassName="bg-muted/80"
      />

      {isLoading ? (
        <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading review">
          <div className="flex items-center gap-3" aria-hidden>
            <Skeleton className="size-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
            ))}
          </div>
        </div>
      ) : !review ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="bg-muted/60 flex size-10 items-center justify-center rounded-full">
            <Sparkles className="text-muted-foreground size-5" aria-hidden />
          </div>
          <p className="text-foreground text-sm font-semibold">No review yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Your first review will appear here after the weekly refresh runs.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <ScoreDial score={review.score} />
            <div className="min-w-0">
              <p className="text-foreground text-sm font-semibold">{review.headline}</p>
              {review.score_delta != null ? (
                <p
                  className={cn(
                    'text-xs',
                    review.score_delta >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  )}
                >
                  {review.score_delta >= 0 ? '+' : ''}
                  {review.score_delta} pts vs last review
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <ItemList
              title="Working"
              icon={CheckCircle2}
              iconClassName="text-emerald-600 dark:text-emerald-400"
              items={review.payload.strengths}
              emptyLabel="Nothing flagged this period."
            />
            <ItemList
              title="Improve"
              icon={TrendingUp}
              iconClassName="text-amber-600 dark:text-amber-400"
              items={review.payload.improvements}
              emptyLabel="Nothing flagged this period."
              articleTitleBySlug={articleTitleBySlug}
            />
            <ItemList
              title="Avoid"
              icon={AlertTriangle}
              iconClassName="text-rose-600 dark:text-rose-400"
              items={review.payload.avoid}
              emptyLabel="Nothing flagged this period."
            />
          </div>
        </>
      )}
    </section>
  );
}
