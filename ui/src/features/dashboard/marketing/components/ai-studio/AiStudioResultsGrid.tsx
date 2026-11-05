import type { ReactNode } from 'react';

import { AiStudioJobCard } from '@/features/dashboard/marketing/components/ai-studio/AiStudioJobCard';
import type { MarketingGenerationJob } from '@/features/dashboard/marketing/lib/marketingGenerationTypes';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  jobs: MarketingGenerationJob[];
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  canPublish: boolean;
  canDelete: boolean;
  canGenerate?: boolean;
  onPublish: (payload: { blob: Blob; mediaType: 'image' | 'video' }) => void;
  onRetry?: (job: MarketingGenerationJob) => void;
  onUseAsPhoto?: (job: MarketingGenerationJob) => void;
  usingAsPhotoJobId?: string | null;
  onRefine?: (job: MarketingGenerationJob) => void;
  refiningJobId?: string | null;
  emptyState: ReactNode;
  /** Optimistic generating card while the POST is in flight (before the job row exists). */
  pendingStage?: ReactNode;
};

export function AiStudioResultsGrid({
  jobs,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  canPublish,
  canDelete,
  canGenerate = false,
  onPublish,
  onRetry,
  onUseAsPhoto,
  usingAsPhotoJobId = null,
  onRefine,
  refiningJobId = null,
  emptyState,
  pendingStage,
}: Props) {
  if (isLoading) {
    return (
      <div className="@md:grid-cols-2 @3xl:grid-cols-3 grid grid-cols-1 gap-3" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="border-border/70 overflow-hidden rounded-2xl border">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="flex gap-2 p-3">
              <Skeleton className="h-11 flex-1 rounded-md sm:h-9" />
              <Skeleton className="size-11 shrink-0 rounded-md sm:size-9" />
            </div>
          </article>
        ))}
      </div>
    );
  }

  const loadMore = hasNextPage ? (
    <Button
      variant="outline"
      className="min-h-11 w-full"
      disabled={isFetchingNextPage}
      onClick={onLoadMore}
    >
      {isFetchingNextPage ? 'Loading' : 'Load older'}
    </Button>
  ) : null;

  // Pages mix photos and videos, so this media type can be empty on page one while
  // older pages still hold some: keep Load older reachable under the empty state.
  if (jobs.length === 0) {
    return (
      <div className="space-y-3">
        {emptyState}
        {!pendingStage && loadMore}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="@md:grid-cols-2 @3xl:grid-cols-3 grid grid-cols-1 gap-3">
        {pendingStage}
        {jobs.map((job) => (
          <AiStudioJobCard
            key={job.id}
            job={job}
            canPublish={canPublish}
            canDelete={canDelete}
            canGenerate={canGenerate}
            onPublish={onPublish}
            onRetry={onRetry}
            onUseAsPhoto={onUseAsPhoto}
            usingAsPhoto={usingAsPhotoJobId === job.id}
            onRefine={onRefine}
            refining={refiningJobId === job.id}
          />
        ))}
      </div>

      {loadMore}
    </div>
  );
}
