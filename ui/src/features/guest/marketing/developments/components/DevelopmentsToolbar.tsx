import { SlidersHorizontal, LayoutGrid, List, Map, ArrowUpDown } from 'lucide-react';

import { DEVELOPMENT_SORT_OPTIONS } from '@/features/guest/marketing/shared/lib/listingFilterChips';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type DevelopmentViewMode = 'grid' | 'list' | 'map';

interface DevelopmentsToolbarProps {
  viewMode: DevelopmentViewMode;
  onViewModeChange: (mode: DevelopmentViewMode) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  totalResults: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  /** Singular noun for the count label (default: development) */
  resultsNoun?: string;
}

const viewModes: { value: DevelopmentViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { value: 'grid', icon: LayoutGrid, label: 'Grid view' },
  { value: 'list', icon: List, label: 'List view' },
  { value: 'map', icon: Map, label: 'Map view' },
];

export function DevelopmentsToolbar({
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  totalResults,
  filtersOpen,
  onToggleFilters,
  resultsNoun = 'development',
}: DevelopmentsToolbarProps) {
  return (
    <div className="border-border bg-background border-b">
      <div className="flex items-center justify-between gap-2 px-4 py-2 sm:gap-4 sm:px-6 sm:py-3">
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFilters}
            className={cn(
              'hidden h-9 gap-2 lg:inline-flex',
              filtersOpen && 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {filtersOpen ? 'Hide Filters' : 'Show Filters'}
          </Button>

          <span className="text-muted-foreground whitespace-nowrap text-[13px] sm:text-sm">
            <span className="text-foreground font-semibold tabular-nums">{totalResults}</span>{' '}
            {totalResults === 1 ? resultsNoun : `${resultsNoun}s`}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <div className="relative flex min-w-0 items-center gap-2">
            <ArrowUpDown className="text-muted-foreground hidden h-4 w-4 sm:block" aria-hidden />
            <Select value={sortBy} onValueChange={onSortChange}>
              <SelectTrigger
                aria-label="Sort developments"
                className="h-10 min-h-0 w-auto min-w-0 max-w-full gap-1.5 px-3 py-0 text-sm max-lg:h-9 max-lg:px-2.5 max-lg:text-[13px] sm:max-w-none [&>span]:truncate"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="max-w-[calc(100vw-24px)]">
                {DEVELOPMENT_SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-border bg-muted/50 flex shrink-0 rounded-lg border p-0.5">
            {viewModes.map((mode) => {
              const Icon = mode.icon;
              const isActive = viewMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => onViewModeChange(mode.value)}
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-md transition-all before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] lg:size-9 lg:before:content-none",
                    isActive
                      ? 'bg-background text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-label={mode.label}
                  aria-pressed={isActive}
                  title={mode.label}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
