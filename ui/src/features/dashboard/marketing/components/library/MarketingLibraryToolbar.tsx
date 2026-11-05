import { useState, type ReactNode } from 'react';

import {
  CheckSquare,
  History,
  ListFilter,
  MoreHorizontal,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';

import {
  AdminListRefineSheet,
  AdminMobileSearchFilterRow,
} from '@/components/mobile/AdminListRefineSheet';
import {
  ResponsiveOverflowMenu,
  type ResponsiveOverflowAction,
} from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

/** One filter group (Size, Sort, Theme, Type…): a single choice from a few options. */
export type LibraryFilterField = {
  id: string;
  label: string;
  value: string;
  defaultValue: string;
  options: Array<{ value: string; label: string; icon?: ReactNode }>;
  onChange: (value: string) => void;
};

type Props = {
  title: string;
  /** Shown beside the title when the full count is known. */
  count?: number | null;
  /** Create actions (New, Create with AI) — replaces the title/count block. */
  startActions?: ReactNode;
  query: string;
  onQueryChange: (query: string) => void;
  searchPlaceholder?: string;
  fields: LibraryFilterField[];
  onReset: () => void;
  canSelect: boolean;
  onStartSelect: () => void;
  onOpenDeleted?: () => void;
  onOpenPublishes?: () => void;
};

export function activeFilterCount(fields: readonly LibraryFilterField[]): number {
  return fields.filter((field) => field.value !== field.defaultValue).length;
}

/**
 * Library header row, the same on every Marketing tab: what you are looking at, then
 * find (search, Filters), then act on many (Select). Recent publishes and Recently
 * deleted sit behind one History button. On phones Select joins that menu, so the
 * trigger stays the generic More control. Active filters show as chips you can clear.
 */
export function MarketingLibraryToolbar({
  title,
  count,
  startActions,
  query,
  onQueryChange,
  searchPlaceholder = 'Search by name',
  fields,
  onReset,
  canSelect,
  onStartSelect,
  onOpenDeleted,
  onOpenPublishes,
}: Props) {
  const isBelowLg = useIsBelowLg();
  const [refineOpen, setRefineOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const filterCount = activeFilterCount(fields);

  const search = (
    <div className="relative min-w-0">
      <Search
        className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
        aria-hidden
      />
      <Input
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="h-10 pl-9 text-[13px] lg:text-sm"
      />
    </div>
  );

  const fieldsBody = (
    <div className="space-y-4">
      {fields.map((field) => (
        <FilterChoice key={field.id} field={field} />
      ))}
    </div>
  );

  const heading = startActions ?? (
    <h2 className="text-section-title flex min-w-0 items-baseline gap-2">
      <span className="truncate">{title}</span>
      {count != null ? (
        <span className="text-muted-foreground text-xs font-medium tabular-nums">{count}</span>
      ) : null}
    </h2>
  );

  const selectButton = canSelect ? (
    <Button
      type="button"
      variant="ghost"
      className="min-h-[44px] gap-2 px-3 lg:min-h-10"
      onClick={onStartSelect}
    >
      <CheckSquare className="size-4" aria-hidden />
      Select
    </Button>
  ) : null;

  const selectAction: ResponsiveOverflowAction[] = canSelect
    ? [
        {
          key: 'select',
          label: 'Select',
          icon: <CheckSquare className="size-4" aria-hidden />,
          onSelect: onStartSelect,
        },
      ]
    : [];

  const historyActions: ResponsiveOverflowAction[] = [
    ...(onOpenPublishes
      ? [
          {
            key: 'publishes',
            label: 'Recent publishes',
            icon: <Send className="size-4" aria-hidden />,
            onSelect: onOpenPublishes,
          },
        ]
      : []),
    ...(onOpenDeleted
      ? [
          {
            key: 'deleted',
            label: 'Recently deleted',
            icon: <Trash2 className="size-4" aria-hidden />,
            onSelect: onOpenDeleted,
          },
        ]
      : []),
  ];

  // Desktop menu is only the two history views, so the trigger is a clock.
  // Phones fold Select into the same menu, which stays a generic More control.
  const overflowMenu = (groups: ResponsiveOverflowAction[][]) => {
    if (!groups.some((group) => group.length > 0)) return null;
    const historyOnly = groups
      .flat()
      .every((action) => action.key === 'publishes' || action.key === 'deleted');
    const label = historyOnly ? 'History' : 'More';
    return (
      <ResponsiveOverflowMenu
        label={label}
        actionGroups={groups}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="admin-overflow-trigger"
            aria-label={label}
            title={label}
          >
            {historyOnly ? (
              <History className="size-4" aria-hidden />
            ) : (
              <MoreHorizontal className="size-4" aria-hidden />
            )}
          </Button>
        }
      />
    );
  };

  const chips =
    filterCount > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
        {fields
          .filter((field) => field.value !== field.defaultValue)
          .map((field) => {
            const option = field.options.find((item) => item.value === field.value);
            return (
              <button
                key={field.id}
                type="button"
                onClick={() => field.onChange(field.defaultValue)}
                className="bg-muted text-foreground hover:bg-muted/70 focus-visible:ring-ring relative inline-flex h-8 items-center gap-1 rounded-full pl-3 pr-2 text-xs font-medium transition-colors before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] focus-visible:outline-none focus-visible:ring-2"
                aria-label={`Remove filter ${option?.label ?? field.value}`}
              >
                {option?.label ?? field.value}
                <X className="size-3.5 opacity-70" aria-hidden />
              </button>
            );
          })}
        {filterCount > 1 ? (
          <button
            type="button"
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs font-medium"
          >
            Clear all
          </button>
        ) : null}
      </div>
    ) : null;

  if (isBelowLg) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">{heading}</div>
          {overflowMenu([selectAction, historyActions])}
        </div>
        <AdminMobileSearchFilterRow
          search={search}
          filterCount={filterCount}
          filtersOpen={refineOpen}
          onFiltersOpenChange={setRefineOpen}
        />
        {chips}
        <AdminListRefineSheet
          open={refineOpen}
          onOpenChange={setRefineOpen}
          title="Filters"
          activeCount={filterCount}
          onClear={onReset}
        >
          {fieldsBody}
        </AdminListRefineSheet>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="mr-auto min-w-0">{heading}</div>
        <div className="w-60">{search}</div>
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-10 gap-2">
              <ListFilter className="size-4" aria-hidden />
              Filters
              {filterCount > 0 ? (
                <span className="bg-primary-strong text-primary-foreground flex size-5 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums">
                  {filterCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-4">
            {fieldsBody}
            <div className="border-border mt-4 flex justify-end border-t pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={filterCount === 0}
                onClick={onReset}
              >
                Reset
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        {selectButton || historyActions.length > 0 ? (
          <div className="border-border ml-1 flex items-center gap-0.5 border-l pl-2">
            {selectButton}
            {overflowMenu([historyActions])}
          </div>
        ) : null}
      </div>
      {chips}
    </div>
  );
}

function FilterChoice({ field }: { field: LibraryFilterField }) {
  const labelId = `library-filter-${field.id}`;
  return (
    <div className="space-y-2">
      <p id={labelId} className="text-muted-foreground text-xs font-medium">
        {field.label}
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {field.options.map((option) => {
          const selected = option.value === field.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => field.onChange(option.value)}
              className={cn(
                'relative inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
                "before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']",
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
                selected
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-foreground hover:bg-muted/60'
              )}
            >
              {option.icon}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
