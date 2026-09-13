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
  onPublish: (payload: { blob: Blob; mediaType: 'image' | 'video' }) => void;
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
  onPublish,
  emptyState,
  pendingStage,
}: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="aspect-square rounded-2xl" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0 && !pendingStage) {
    return <>{emptyState}</>;
  }

  if (jobs.length === 0 && pendingStage) {
    return <div className="w-full">{emptyState}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {pendingStage}
        {jobs.map((job) => (
          <AiStudioJobCard
            key={job.id}
            job={job}
            canPublish={canPublish}
            canDelete={canDelete}
            onPublish={onPublish}
          />
        ))}
      </div>

      {hasNextPage && (
        <Button
          variant="outline"
          className="min-h-[44px] w-full"
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
        >
          {isFetchingNextPage ? 'Loading' : 'Load more'}
        </Button>
      )}
    </div>
  );
}
