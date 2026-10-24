import { SlidersHorizontal } from 'lucide-react';

import { PARKING_SORT_OPTIONS } from '@/features/guest/marketing/shared/lib/listingFilterChips';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { ParkingSortKey } from '../lib/parkingSlotFilters';

interface ParkingToolbarProps {
  sortBy: ParkingSortKey;
  onSortChange: (sort: ParkingSortKey) => void;
  totalResults: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}

export function ParkingToolbar({
  sortBy,
  onSortChange,
  totalResults,
  filtersOpen,
  onToggleFilters,
}: ParkingToolbarProps) {
  const showSort = PARKING_SORT_OPTIONS.length > 1;
  const safeSort = PARKING_SORT_OPTIONS.some((o) => o.value === sortBy)
    ? sortBy
    : PARKING_SORT_OPTIONS[0]!.value;

  return (
    <div className="border-border bg-background/95 z-20 border-b backdrop-blur-sm lg:sticky lg:top-[var(--public-nav-h)]">
      <div className="flex items-center justify-between gap-2 px-4 py-2 sm:gap-4 sm:px-6 sm:py-3">
        <div className="flex shrink-0 items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFilters}
            className={cn(
              'hidden h-9 gap-2 lg:flex',
              filtersOpen && 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {filtersOpen ? 'Hide Filters' : 'Show Filters'}
          </Button>

          <span className="text-muted-foreground text-[13px] sm:text-sm">
            <span className="text-foreground font-semibold">{totalResults}</span>{' '}
            {totalResults === 1 ? 'slot' : 'slots'}
          </span>
        </div>

        {showSort ? (
          <div className="flex min-w-0 items-center gap-2">
            <Select
              value={safeSort}
              onValueChange={(value) => onSortChange(value as ParkingSortKey)}
            >
              <SelectTrigger
                aria-label="Sort parking slots"
                className="h-10 min-h-0 w-auto min-w-0 max-w-full gap-1.5 px-3 py-0 text-sm max-lg:h-9 max-lg:px-2.5 max-lg:text-[13px] sm:max-w-none [&>span]:truncate"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="max-w-[calc(100vw-24px)]">
                {PARKING_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </div>
  );
}
