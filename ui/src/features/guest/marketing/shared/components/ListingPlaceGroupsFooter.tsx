import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';

type ListingPlaceGroupsFooterProps = {
  hasMore: boolean;
  isLoading: boolean;
  hasError: boolean;
  onLoadMore: () => void;
};

export function ListingPlaceGroupsFooter({
  hasMore,
  isLoading,
  hasError,
  onLoadMore,
}: ListingPlaceGroupsFooterProps) {
  if (!hasMore && !hasError) return null;

  return (
    <div className="flex flex-col items-center gap-3 pt-1" aria-live="polite">
      {hasError ? (
        <p className="text-muted-foreground text-sm" role="alert">
          Could not load more places.
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="min-h-[44px] min-w-40"
        onClick={onLoadMore}
        disabled={isLoading}
        aria-busy={isLoading}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {isLoading ? 'Loading…' : hasError ? 'Try again' : 'Show more places'}
      </Button>
    </div>
  );
}
