import { SlidersHorizontal, LayoutGrid, List, Map, ArrowUpDown } from 'lucide-react';

import { PROPERTY_SORT_OPTIONS } from '@/features/guest/marketing/shared/lib/listingFilterChips';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type ViewMode = 'grid' | 'list' | 'map';

interface PropertiesToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  totalResults: number;
  filtersOpen: boolean;
  onToggleFilters: () => void;
}

const viewModes: { value: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
  { value: 'grid', icon: LayoutGrid, label: 'Grid view' },
  { value: 'list', icon: List, label: 'List view' },
  { value: 'map', icon: Map, label: 'Map view' },
];

export function PropertiesToolbar({
  viewMode,
  onViewModeChange,
  sortBy,
  onSortChange,
  totalResults,
  filtersOpen,
  onToggleFilters,
}: PropertiesToolbarProps) {
  return (
    <div className="border-border bg-background shrink-0 border-b">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleFilters}
            className={cn(
              'hidden min-h-[44px] gap-2 lg:inline-flex',
              filtersOpen && 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {filtersOpen ? 'Hide Filters' : 'Show Filters'}
          </Button>

          <span className="text-muted-foreground truncate text-sm">
            <span className="text-foreground font-semibold tabular-nums">{totalResults}</span>{' '}
            {totalResults === 1 ? 'property' : 'properties'}
          </span>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          <div className="relative flex items-center gap-2">
            <ArrowUpDown className="text-muted-foreground hidden h-4 w-4 sm:block" aria-hidden />
            <Select value={sortBy} onValueChange={onSortChange}>
              <SelectTrigger
                aria-label="Sort properties"
                className="h-11 min-h-[44px] w-auto gap-2 px-3 py-2 text-sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="max-w-[calc(100vw-24px)]">
                {PROPERTY_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border-border bg-muted/50 flex rounded-lg border p-1">
            {viewModes.map((mode) => {
              const Icon = mode.icon;
              const isActive = viewMode === mode.value;
              return (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => onViewModeChange(mode.value)}
                  className={cn(
                    'min-h-[44px] min-w-[44px] rounded-md p-2 transition-all',
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
