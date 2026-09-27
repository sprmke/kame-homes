import { Link } from 'react-router-dom';

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarOff,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { AiPerformanceReviewGeneratingStage } from '@/features/dashboard/analytics/components/AiPerformanceReviewGeneratingStage';
import { analyticsDeepLinkPageLabel } from '@/features/dashboard/analytics/lib/aiReviewDeepLink';
import {
  AI_REVIEW_PERIOD_LABEL,
  resolveAiReviewCta,
  type AiReviewPeriodKind,
} from '@/features/dashboard/analytics/lib/aiReviewPeriod';
import type {
  AnalyticsAiReviewItem,
  AnalyticsAiReviewRecord,
} from '@/features/dashboard/analytics/lib/aiReviewTypes';
import type { AnalyticsPlaybookArticle } from '@/features/dashboard/analytics/lib/types';
import { TierBadgeAnchor } from '@/features/dashboard/plans/components/TierBadge';

import { AdminSurfaceCardHeader } from '@/components/shared/AdminSurfaceCardHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

const RING_SIZE = 64;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Invisible pad so dense inline controls still hit 44px on phone (same trick as `settings-action`). */
const TOUCH_PAD =
  "before:absolute before:-inset-x-1.5 before:-inset-y-2.5 before:content-[''] sm:before:content-none";

const COLUMN_PANEL =
  'border-border/50 flex h-full min-w-0 flex-col rounded-xl border bg-background/60 p-3 sm:p-3.5';

function ScoreDial({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const dashOffset = RING_CIRCUMFERENCE * (1 - clamped / 100);
  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
      role="img"
      aria-label={`Score ${Math.round(clamped)} out of 100`}
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
          className="stroke-primary fill-none transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <span className="text-foreground absolute text-base font-bold tabular-nums" aria-hidden>
        {Math.round(clamped)}
      </span>
    </div>
  );
}

function ScoreDelta({ delta }: { delta: number }) {
  const positive = delta >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <p
      className={cn(
        'mt-1 flex items-center gap-1 text-xs font-medium',
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span>
        {positive ? '+' : ''}
        {delta} pts vs last review
      </span>
    </p>
  );
}

type ReviewListItem = AnalyticsAiReviewItem | { title: string; evidence: string };

function ReviewItem({
  item,
  articleTitleBySlug,
  onOpenPlaybook,
}: {
  item: ReviewListItem;
  articleTitleBySlug?: Map<string, string>;
  onOpenPlaybook?: (slug: string) => void;
}) {
  const deepLink = 'deepLink' in item ? item.deepLink : null;
  const detail = 'evidence' in item ? item.evidence : item.why;
  const action = 'action' in item ? item.action : undefined;
  const articleSlugs = 'articleSlugs' in item ? (item.articleSlugs ?? []) : [];
  const pageLabel = analyticsDeepLinkPageLabel(deepLink);
  const playbookEntries =
    articleTitleBySlug && onOpenPlaybook
      ? articleSlugs.flatMap((slug) => {
          const articleTitle = articleTitleBySlug.get(slug);
          return articleTitle ? [{ slug, articleTitle }] : [];
        })
      : [];
  const hasNext = Boolean(action || deepLink || playbookEntries.length > 0);

  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      {/* Read: insight first */}
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium leading-snug">{item.title}</p>
        {detail ? <p className="text-muted-foreground text-xs leading-relaxed">{detail}</p> : null}
      </div>

      {/* Act: one quiet zone — recommendation, then primary page link, then playbook tip */}
      {hasNext ? (
        <div className="border-border/50 flex flex-col items-start gap-1.5 border-t pt-2">
          {action ? <p className="text-foreground/80 text-xs leading-relaxed">{action}</p> : null}

          {deepLink ? (
            <Link
              to={deepLink}
              className={cn(
                'text-primary focus-visible:ring-ring relative inline-flex items-center gap-1 rounded text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                TOUCH_PAD
              )}
            >
              {pageLabel ? `Go to ${pageLabel}` : 'Go there'}
              <ArrowRight className="size-3.5 shrink-0" aria-hidden />
            </Link>
          ) : null}

          {playbookEntries.map(({ slug, articleTitle }) => (
            <button
              key={slug}
              type="button"
              onClick={() => onOpenPlaybook?.(slug)}
              className={cn(
                'text-muted-foreground hover:text-foreground focus-visible:ring-ring relative inline-flex max-w-full items-start gap-1.5 rounded text-left text-xs leading-snug transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                TOUCH_PAD
              )}
            >
              <BookOpen className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>Playbook: {articleTitle}</span>
            </button>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function ItemList({
  id,
  title,
  icon: Icon,
  iconClassName,
  items,
  emptyLabel,
  articleTitleBySlug,
  onOpenPlaybook,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  iconClassName: string;
  items: ReviewListItem[];
  emptyLabel: string;
  articleTitleBySlug?: Map<string, string>;
  onOpenPlaybook?: (slug: string) => void;
}) {
  return (
    <div className={COLUMN_PANEL}>
      <div className="border-border/50 mb-1 flex items-center gap-1.5 border-b pb-2">
        <Icon className={cn('size-4 shrink-0', iconClassName)} aria-hidden />
        <p id={id} className="text-foreground text-sm font-semibold">
          {title}
        </p>
        {items.length > 0 ? (
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">{items.length}</span>
        ) : null}
      </div>
      {items.length > 0 ? (
        <ul className="divide-border/50 divide-y" aria-labelledby={id}>
          {items.map((item, index) => (
            <ReviewItem
              key={`${item.title}-${index}`}
              item={item}
              articleTitleBySlug={articleTitleBySlug}
              onOpenPlaybook={onOpenPlaybook}
            />
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">{emptyLabel}</p>
      )}
    </div>
  );
}

const EMPTY_COLUMN_LABEL = 'Nothing flagged this period.';

type Props = {
  review: AnalyticsAiReviewRecord | null;
  isLoading: boolean;
  /** False when the date filter is custom or not the current week/month/year. */
  applicable: boolean;
  /** Which current period is selected when `applicable` is true. */
  periodKind?: AiReviewPeriodKind | null;
  /**
   * True when `review` was generated for the selected from/to. When false, the body shows an
   * empty prompt and the CTA offers Analyze for the selection (not Refresh of a stale range).
   */
  reviewMatchesPeriod?: boolean;
  /** Matched Improvement Playbook articles, so improvements[].articleSlugs can link by title. */
  playbookArticles?: AnalyticsPlaybookArticle[];
  /** Opens the matching article in the Improvement Playbook card below. */
  onOpenPlaybook?: (slug: string) => void;
  /** Plan + RBAC gated analyze/refresh. Omit to hide the button. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
  /** True after a successful analyze for *this* period earlier today (Manila). */
  refreshUsedToday?: boolean;
  /**
   * False when the property has fewer than 10 non-cancelled bookings ever (same bar as the
   * AI review cron). Disables Analyze/Refresh so hosts are not sent into rate-limit / AI-down
   * toasts on empty history.
   */
  enoughHistory?: boolean;
  className?: string;
};

export function AiPerformanceReviewCard({
  review,
  isLoading,
  applicable,
  periodKind = null,
  reviewMatchesPeriod = false,
  playbookArticles = [],
  onOpenPlaybook,
  onRefresh,
  isRefreshing = false,
  refreshUsedToday = false,
  enoughHistory = true,
  className,
}: Props) {
  const articleTitleBySlug = new Map(playbookArticles.map((a) => [a.slug, a.title]));
  const periodLabel = periodKind ? AI_REVIEW_PERIOD_LABEL[periodKind] : null;
  const showCta = Boolean(applicable && onRefresh && periodKind);
  const cta = periodKind
    ? resolveAiReviewCta({
        periodKind,
        hasMatchingReview: reviewMatchesPeriod,
        refreshUsedToday,
        isRefreshing,
      })
    : null;
  const ctaDisabled = isRefreshing || refreshUsedToday || !enoughHistory;

  const refreshAction =
    showCta && cta ? (
      <TierBadgeAnchor feature="analyticsInsights">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 max-w-[min(100%,14rem)] gap-1.5 px-2.5 sm:h-8"
          onClick={onRefresh}
          disabled={ctaDisabled}
          aria-label={cta.ariaLabel}
          title={
            !enoughHistory
              ? 'Need 10 bookings first'
              : refreshUsedToday
                ? 'Once a day for this range'
                : undefined
          }
        >
          {cta.kind === 'analyzing' ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
          ) : cta.kind === 'analyze' ? (
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <RefreshCw className="size-3.5 shrink-0" aria-hidden />
          )}
          <span className="truncate text-xs font-medium">{cta.label}</span>
        </Button>
      </TierBadgeAnchor>
    ) : null;

  const matchingReview = reviewMatchesPeriod ? review : null;

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
        description={
          applicable ? (periodLabel ? `Once a day for ${periodLabel}` : 'Once a day') : undefined
        }
        action={refreshAction}
        iconClassName="bg-muted/80"
      />

      {!applicable ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="bg-muted/60 flex size-10 items-center justify-center rounded-full">
            <CalendarOff className="text-muted-foreground size-5" aria-hidden />
          </div>
          <p className="text-foreground text-sm font-semibold">Current period only</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Pick this week, this month, or this year.
          </p>
        </div>
      ) : isRefreshing ? (
        <AiPerformanceReviewGeneratingStage periodKind={periodKind} />
      ) : isLoading ? (
        <div className="space-y-2.5 sm:space-y-3" role="status" aria-label="Loading review">
          <div
            className="border-border/60 bg-muted/30 flex items-center gap-3 rounded-xl border p-3 sm:gap-4 sm:p-3.5"
            aria-hidden
          >
            <Skeleton className="size-16 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-56 max-w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-3" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={COLUMN_PANEL}>
                <div className="border-border/50 mb-1 border-b pb-2">
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !matchingReview ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <div className="bg-muted/60 flex size-10 items-center justify-center rounded-full">
            <Sparkles className="text-muted-foreground size-5" aria-hidden />
          </div>
          <p className="text-foreground text-sm font-semibold">
            {periodLabel ? `No review for ${periodLabel}` : 'No review yet'}
          </p>
          {!enoughHistory ? (
            <p className="text-muted-foreground max-w-sm text-sm">
              Need 10 bookings before AI review.
            </p>
          ) : onRefresh ? (
            <p className="text-muted-foreground max-w-sm text-sm">
              Analyze to generate one for this range.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          <div className="border-border/60 bg-muted/30 flex items-center gap-3 rounded-xl border p-3 sm:gap-4 sm:p-3.5">
            <div className="flex shrink-0 flex-col items-center gap-1">
              <ScoreDial score={matchingReview.score} />
              <span
                className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide"
                aria-hidden
              >
                Score
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground text-sm font-semibold leading-snug sm:text-[15px]">
                {matchingReview.headline}
              </p>
              {matchingReview.score_delta != null ? (
                <ScoreDelta delta={matchingReview.score_delta} />
              ) : null}
            </div>
          </div>

          <div className="grid gap-2.5 sm:gap-3 lg:grid-cols-3">
            <ItemList
              id="ai-review-working"
              title="Working"
              icon={CheckCircle2}
              iconClassName="text-emerald-600 dark:text-emerald-400"
              items={matchingReview.payload.strengths}
              emptyLabel={EMPTY_COLUMN_LABEL}
            />
            <ItemList
              id="ai-review-improve"
              title="Improve"
              icon={TrendingUp}
              iconClassName="text-amber-600 dark:text-amber-400"
              items={matchingReview.payload.improvements}
              emptyLabel={EMPTY_COLUMN_LABEL}
              articleTitleBySlug={articleTitleBySlug}
              onOpenPlaybook={onOpenPlaybook}
            />
            <ItemList
              id="ai-review-avoid"
              title="Avoid"
              icon={AlertTriangle}
              iconClassName="text-rose-600 dark:text-rose-400"
              items={matchingReview.payload.avoid}
              emptyLabel={EMPTY_COLUMN_LABEL}
            />
          </div>
        </div>
      )}
    </section>
  );
}
