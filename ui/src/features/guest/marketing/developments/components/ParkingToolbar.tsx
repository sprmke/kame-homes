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
    <div className="border-border bg-background/95 z-20 border-b backdrop-blur-sm lg:sticky lg:top-16">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFilters}
            className={cn(
              'hidden min-h-[44px] gap-2 lg:flex',
              filtersOpen && 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {filtersOpen ? 'Hide Filters' : 'Show Filters'}
          </Button>

          <span className="text-muted-foreground text-sm">
            <span className="text-foreground font-semibold">{totalResults}</span>{' '}
            {totalResults === 1 ? 'slot' : 'slots'}
          </span>
        </div>

        {showSort ? (
          <div className="flex items-center gap-2">
            <Select
              value={safeSort}
              onValueChange={(value) => onSortChange(value as ParkingSortKey)}
            >
              <SelectTrigger
                aria-label="Sort parking slots"
                className="h-11 min-h-[44px] w-auto gap-2 px-3 py-2 text-sm"
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
