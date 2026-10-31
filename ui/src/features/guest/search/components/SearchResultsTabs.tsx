import { orderListingCategories } from '@/features/guest/marketing/shared/lib/listingSearchPreferType';
import type {
  SearchListingsType,
  SearchListingsTotals,
} from '@/features/guest/search/types/search';

import { cn } from '@/lib/utils';

const CATEGORY_TABS: Array<{ id: Exclude<SearchListingsType, 'all'>; label: string }> = [
  { id: 'properties', label: 'Properties' },
  { id: 'developments', label: 'Developments' },
  { id: 'parkings', label: 'Parkings' },
];

type CategoryId = Exclude<SearchListingsType, 'all'>;

type Props = {
  active: SearchListingsType;
  totals: SearchListingsTotals;
  onChange: (type: SearchListingsType) => void;
  /** Origin page category — preferred tab appears first after All. */
  focus?: CategoryId | null;
};

function countFor(type: SearchListingsType, totals: SearchListingsTotals): number {
  if (type === 'all') return totals.all;
  return totals[type];
}

/** Categories that currently have at least one match (default order). */
export function categoriesWithResults(
  totals: SearchListingsTotals,
  focus: CategoryId | null = null
): CategoryId[] {
  const ids = CATEGORY_TABS.map((tab) => tab.id).filter((id) => totals[id] > 0);
  return orderListingCategories(focus, ids);
}

export function SearchResultsTabs({ active, totals, onChange, focus = null }: Props) {
  const populated = categoriesWithResults(totals, focus);
  const showAllTab = populated.length >= 2;

  // Nothing matched — keep the chrome quiet; empty state handles copy.
  if (populated.length === 0) return null;

  // Single category: no tab strip — the page shows that category directly.
  if (populated.length === 1) return null;

  const tabs: Array<{ id: SearchListingsType; label: string }> = [
    ...(showAllTab ? [{ id: 'all' as const, label: 'All' }] : []),
    ...populated.map((id) => ({
      id,
      label: CATEGORY_TABS.find((tab) => tab.id === id)?.label ?? id,
    })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Result types"
      className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        const count = countFor(tab.id, totals);
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              'min-h-[44px] shrink-0 cursor-pointer rounded-full px-4 text-sm font-medium transition-colors',
              selected
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            )}
          >
            {tab.label}
            <span className={cn('ml-1.5 tabular-nums', selected ? 'opacity-80' : 'opacity-70')}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
