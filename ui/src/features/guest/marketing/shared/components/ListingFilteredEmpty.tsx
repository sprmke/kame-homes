import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';

type Props = {
  noun: string;
  onClearFilters: () => void;
  onOpenFilters?: () => void;
};

/** Main-column empty state when filters yield zero results. */
export function ListingFilteredEmpty({ noun, onClearFilters, onOpenFilters }: Props) {
  return (
    <div className="flex flex-col items-start gap-4 p-6 sm:items-center sm:text-center">
      <div className="bg-muted rounded-full p-4">
        <SlidersHorizontal className="text-muted-foreground h-6 w-6" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-base font-semibold">No {noun} match</p>
        <p className="text-muted-foreground text-sm">Clear filters or adjust them to see more.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onClearFilters} className="min-h-[44px]">
          Clear filters
        </Button>
        {onOpenFilters ? (
          <Button type="button" variant="outline" onClick={onOpenFilters} className="min-h-[44px]">
            Edit filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
