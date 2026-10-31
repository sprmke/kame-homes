import { useEffect } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  ChatContextCatalogRow,
  ChatContextLoadMoreRow,
} from '@/features/dashboard/ai-assistant/components/ChatContextCatalogRow';
import { ChatContextPricingCalendar } from '@/features/dashboard/ai-assistant/components/ChatContextPricingCalendar';
import { useAssistantContextCatalog } from '@/features/dashboard/ai-assistant/hooks/useAssistantContextCatalog';
import { useContextPickerListWindow } from '@/features/dashboard/ai-assistant/hooks/useContextPickerListWindow';
import { useContextPickerNavigation } from '@/features/dashboard/ai-assistant/hooks/useContextPickerNavigation';
import {
  attachedContextKey,
  type AttachedContextItem,
} from '@/features/dashboard/ai-assistant/lib/attachedContext';
import { ATTACHED_CONTEXT_ICONS } from '@/features/dashboard/ai-assistant/lib/contextPickerIcons';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: AttachedContextItem) => void;
  selectedKeys: ReadonlySet<string>;
};

export function ChatContextCommandPalette({ open, onOpenChange, onSelect, selectedKeys }: Props) {
  const propertyId = usePropertyIdParam();
  const { groups, isLoading } = useAssistantContextCatalog();
  const { view, search, setSearch, moduleRows, filteredItems, openModule, backToModules, reset } =
    useContextPickerNavigation(groups, { includePricingModule: Boolean(propertyId) });

  const listResetKey =
    view.level === 'items' ? `${view.moduleType}:${search.trim().toLowerCase()}` : 'modules';
  const { visibleItems, hasMore, remaining, loadMore } = useContextPickerListWindow(
    filteredItems,
    listResetKey
  );

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const showSkeleton = isLoading && groups.length === 0;

  const pick = (item: AttachedContextItem) => {
    onSelect(item);
    onOpenChange(false);
    reset();
  };

  const isPricingView = view.level === 'items' && view.moduleType === 'pricing_date';

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label={view.level === 'modules' ? 'Search all modules' : view.moduleLabel}
    >
      <Command shouldFilter={false} value={search} onValueChange={setSearch}>
        {view.level === 'items' ? (
          <div className="border-border/60 flex items-center gap-0.5 border-b px-1 py-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] shrink-0"
              aria-label="Back to modules"
              onClick={backToModules}
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Button>
            <span className="text-foreground min-w-0 flex-1 truncate px-1 text-sm font-medium">
              {view.moduleLabel}
            </span>
          </div>
        ) : null}

        {isPricingView ? null : (
          <CommandInput
            placeholder={
              view.level === 'modules'
                ? 'Search modules'
                : `Search ${view.moduleLabel.toLowerCase()}`
            }
            aria-label={view.level === 'modules' ? 'Search modules' : `Search ${view.moduleLabel}`}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && search === '' && view.level === 'items') {
                e.preventDefault();
                backToModules();
              }
            }}
          />
        )}

        <CommandList>
          {showSkeleton ? (
            <div className="space-y-1 p-1" aria-busy="true">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ) : isPricingView ? (
            <ChatContextPricingCalendar compact selectedKeys={selectedKeys} onSelect={pick} />
          ) : view.level === 'modules' ? (
            <>
              <CommandEmpty>No modules</CommandEmpty>
              {moduleRows.map((module) => {
                const Icon = ATTACHED_CONTEXT_ICONS[module.type];
                return (
                  <CommandItem
                    key={module.type}
                    value={module.type}
                    keywords={[module.label]}
                    onSelect={() => openModule(module.type, module.label)}
                  >
                    <span className="bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{module.label}</span>
                    {module.count != null ? (
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                        {module.count}
                      </span>
                    ) : null}
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
                  </CommandItem>
                );
              })}
            </>
          ) : (
            <>
              <CommandEmpty>No matches</CommandEmpty>
              {visibleItems.map((entry) => {
                const selected = selectedKeys.has(attachedContextKey(entry.item));
                return (
                  <CommandItem
                    key={attachedContextKey(entry.item)}
                    value={attachedContextKey(entry.item)}
                    keywords={[entry.item.label, ...entry.keywords.split(/\s+/)].filter(Boolean)}
                    onSelect={() => pick(entry.item)}
                    className="p-0 aria-selected:bg-transparent data-[selected=true]:bg-transparent"
                  >
                    <ChatContextCatalogRow
                      entry={entry}
                      selected={selected}
                      interactive={false}
                      trailing={
                        entry.status ? (
                          <StatusBadge
                            status={entry.status}
                            className="max-w-[7rem] shrink-0 px-1.5 py-0 text-[10px] font-semibold"
                          />
                        ) : undefined
                      }
                    />
                  </CommandItem>
                );
              })}
              {hasMore ? (
                <div className="p-1">
                  <ChatContextLoadMoreRow remaining={remaining} onClick={loadMore} />
                </div>
              ) : null}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
