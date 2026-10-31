import { useRef, useState, type ReactNode } from 'react';

import { Search } from 'lucide-react';

import { useChatComposerSearchAll } from '@/features/dashboard/ai-assistant/components/ChatComposerSearchAllContext';
import { ChatComposerSearchAllRow } from '@/features/dashboard/ai-assistant/components/ChatComposerSearchAllRow';

import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type ContextPickerGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

type RowState = {
  selected: boolean;
  hint?: string;
  onSelect: () => void;
};

type Props<T> = {
  trigger: ReactNode;
  items: T[];
  getItemId: (item: T) => string;
  searchHaystack: (item: T) => string;
  groupBy?: (items: T[]) => ContextPickerGroup<T>[];
  pageEntityId?: string | null;
  pageEntityHint?: string;
  renderRow: (item: T, state: RowState) => ReactNode;
  selectedIds: ReadonlySet<string>;
  onSelect: (item: T) => void;
  searchPlaceholder: string;
  searchAriaLabel: string;
  listAriaLabel: string;
  emptyLabel: string;
  isLoading?: boolean;
  overlayContainer?: HTMLElement | null;
  toolbar?: ReactNode;
  footer?: ReactNode;
};

export function ChatComposerContextPicker<T>({
  trigger,
  items,
  getItemId,
  searchHaystack,
  groupBy,
  pageEntityId,
  pageEntityHint = 'This page',
  renderRow,
  selectedIds,
  onSelect,
  searchPlaceholder,
  searchAriaLabel,
  listAriaLabel,
  emptyLabel,
  isLoading,
  overlayContainer,
  toolbar,
  footer,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const onSearchAll = useChatComposerSearchAll();
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? items.filter((item) => searchHaystack(item).toLowerCase().includes(needle))
    : items;
  const pageItem =
    !needle && pageEntityId ? items.find((item) => getItemId(item) === pageEntityId) : undefined;
  const rest = pageItem
    ? filtered.filter((item) => getItemId(item) !== getItemId(pageItem))
    : filtered;
  const groups = groupBy
    ? groupBy(rest)
    : rest.length > 0
      ? [{ key: 'all', label: '', items: rest }]
      : [];

  const selectItem = (item: T) => {
    onSelect(item);
    setOpen(false);
    setQ('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQ('');
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        container={overlayContainer}
        className="w-[min(calc(100vw-2rem),24rem)] p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onWheel={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="border-border/60 relative border-b p-2">
          <Search
            className="text-muted-foreground pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
            className="h-10 ps-9"
          />
        </div>
        {toolbar}

        <div
          role="listbox"
          aria-label={listAriaLabel}
          className="max-h-72 touch-pan-y overflow-y-auto overscroll-contain p-1.5 [-webkit-overflow-scrolling:touch]"
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          {isLoading ? (
            <div className="space-y-1 p-1" aria-busy="true">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">{emptyLabel}</p>
          ) : (
            <>
              {pageItem
                ? renderRow(pageItem, {
                    selected: selectedIds.has(getItemId(pageItem)),
                    hint: pageEntityHint,
                    onSelect: () => selectItem(pageItem),
                  })
                : null}
              {groups.map((group) => (
                <section
                  key={group.key}
                  className={cn(group.label ? 'mt-1 first:mt-0' : undefined)}
                >
                  {group.label ? (
                    <h3 className="text-muted-foreground bg-popover sticky top-0 z-[1] px-2 py-1.5 text-xs font-medium">
                      {group.label}
                    </h3>
                  ) : null}
                  <ul>
                    {group.items.map((item) => (
                      <li key={getItemId(item)}>
                        {renderRow(item, {
                          selected: selectedIds.has(getItemId(item)),
                          onSelect: () => selectItem(item),
                        })}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </div>
        {footer || onSearchAll ? (
          <div className="border-border/60 border-t p-1.5">
            {footer}
            {onSearchAll ? (
              <ChatComposerSearchAllRow
                onClick={() => {
                  setOpen(false);
                  onSearchAll();
                }}
              />
            ) : null}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
