import { ArrowUpDown, LayoutGrid, List, Map, SlidersHorizontal } from 'lucide-react';

import type { SearchListingsType } from '@/features/guest/search/types/search';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type SearchViewMode = 'grid' | 'list' | 'map';

type CategoryId = Exclude<SearchListingsType, 'all'>;

type SortOption = { value: string; label: string };

const PROPERTY_SORTS: SortOption[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'reviews', label: 'Most Reviews' },
  { value: 'newest', label: 'Newest' },
];

const DEVELOPMENT_SORTS: SortOption[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'newest', label: 'Newest' },
];

const PARKING_SORTS: SortOption[] = [{ value: 'tower', label: 'Tower' }];

const NOUN: Record<CategoryId, [string, string]> = {
  properties: ['property', 'properties'],
  developments: ['development', 'developments'],
  parkings: ['parking', 'parkings'],
};

type Props = {
  category: CategoryId | 'all';
  totalResults: number;
  sortBy: string;
  onSortChange: (sort: string) => void;
  viewMode: SearchViewMode;
  onViewModeChange: (mode: SearchViewMode) => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  /** Category noun the button will open when All has no sidebar of its own. */
  filtersCategoryLabel?: string | null;
};

function sortOptionsFor(category: CategoryId | 'all'): SortOption[] {
  if (category === 'properties') return PROPERTY_SORTS;
  if (category === 'developments') return DEVELOPMENT_SORTS;
  if (category === 'parkings') return PARKING_SORTS;
  return PROPERTY_SORTS;
}

function viewModesFor(category: CategoryId | 'all'): Array<{
  value: SearchViewMode;
  icon: typeof LayoutGrid;
  label: string;
}> {
  const base: Array<{ value: SearchViewMode; icon: typeof LayoutGrid; label: string }> = [
    { value: 'grid', icon: LayoutGrid, label: 'Grid view' },
    { value: 'list', icon: List, label: 'List view' },
  ];
  if (category !== 'all') {
    base.push({ value: 'map', icon: Map, label: 'Map view' });
  }
  return base;
}

export function SearchResultsToolbar({
  category,
  totalResults,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  filtersOpen,
  onToggleFilters,
  filtersCategoryLabel = null,
}: Props) {
  const sorts = sortOptionsFor(category);
  const modes = viewModesFor(category);
  const safeSort = sorts.some((o) => o.value === sortBy) ? sortBy : (sorts[0]?.value ?? '');
  const nounPair = category === 'all' ? (['result', 'results'] as const) : NOUN[category];
  const noun = totalResults === 1 ? nounPair[0] : nounPair[1];
  const showSort = category !== 'all' && sorts.length > 1;

  return (
    <div className="border-border bg-background shrink-0 border-b">
      <div className="flex items-center justify-between gap-2 px-4 py-2 sm:gap-4 sm:px-6 sm:py-3">
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleFilters}
            className={cn(
              'hidden h-9 gap-2 lg:inline-flex',
              filtersOpen &&
                !filtersCategoryLabel &&
                'border-primary bg-primary/10 text-primary hover:bg-primary/15'
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {filtersCategoryLabel
              ? `Filter ${filtersCategoryLabel}`
              : filtersOpen
                ? 'Hide Filters'
                : 'Show Filters'}
          </Button>

          <span className="text-muted-foreground whitespace-nowrap text-[13px] sm:text-sm">
            <span className="text-foreground font-semibold tabular-nums">{totalResults}</span>{' '}
            {noun}
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          {showSort ? (
            <div className="relative flex min-w-0 items-center gap-2">
              <ArrowUpDown className="text-muted-foreground hidden h-4 w-4 sm:block" aria-hidden />
              <Select value={safeSort} onValueChange={onSortChange}>
                <SelectTrigger
                  aria-label="Sort results"
                  className="h-10 min-h-0 w-auto min-w-0 max-w-full gap-1.5 px-3 py-0 text-sm max-lg:h-9 max-lg:px-2.5 max-lg:text-[13px] sm:max-w-none [&>span]:truncate"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end" className="max-w-[calc(100vw-24px)]">
                  {sorts.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="border-border bg-muted/50 flex shrink-0 rounded-lg border p-0.5">
            {modes.map((mode) => {
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

export function defaultSortForCategory(category: CategoryId | 'all'): string {
  return sortOptionsFor(category)[0]?.value ?? 'recommended';
}
