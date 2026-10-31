import { useMemo, useRef, useState } from 'react';

import { Bookmark, ChevronLeft } from 'lucide-react';

import { ChatComposerPickerTrigger } from '@/features/dashboard/ai-assistant/components/ChatComposerPickerRow';
import {
  ChatContextCatalogRow,
  ChatContextLoadMoreRow,
} from '@/features/dashboard/ai-assistant/components/ChatContextCatalogRow';
import { ChatContextModuleRow } from '@/features/dashboard/ai-assistant/components/ChatContextModuleRow';
import { ChatContextPickerPanel } from '@/features/dashboard/ai-assistant/components/ChatContextPickerPanel';
import { ChatContextPricingCalendar } from '@/features/dashboard/ai-assistant/components/ChatContextPricingCalendar';
import { useAssistantContextCatalog } from '@/features/dashboard/ai-assistant/hooks/useAssistantContextCatalog';
import { useAssistantContextPicker } from '@/features/dashboard/ai-assistant/hooks/useAssistantContextPicker';
import { useContextPickerListWindow } from '@/features/dashboard/ai-assistant/hooks/useContextPickerListWindow';
import { useContextPickerNavigation } from '@/features/dashboard/ai-assistant/hooks/useContextPickerNavigation';
import {
  attachedContextKey,
  type AttachedContextItem,
} from '@/features/dashboard/ai-assistant/lib/attachedContext';
import { ATTACHED_CONTEXT_ICONS } from '@/features/dashboard/ai-assistant/lib/contextPickerIcons';
import { PICKER_ATTACHED_TYPE } from '@/features/dashboard/ai-assistant/lib/contextPickerRegistry';
import { StatusBadge } from '@/features/dashboard/bookings/components/StatusBadge';
import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  selectedKeys: ReadonlySet<string>;
  onSelect: (item: AttachedContextItem) => void;
  disabled?: boolean;
  overlayContainer?: HTMLElement | null;
};

export function ChatComposerContextHub({
  selectedKeys,
  onSelect,
  disabled,
  overlayContainer,
}: Props) {
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const propertyId = usePropertyIdParam();
  const { groups, isLoading } = useAssistantContextCatalog();
  const { picker } = useAssistantContextPicker();
  const preferredModuleType = PICKER_ATTACHED_TYPE[picker];
  const {
    view,
    search,
    setSearch,
    moduleRows,
    filteredItems,
    activeGroup,
    openModule,
    backToModules,
    reset,
  } = useContextPickerNavigation(groups, { includePricingModule: Boolean(propertyId) });

  const listResetKey =
    view.level === 'items' ? `${view.moduleType}:${search.trim().toLowerCase()}` : 'modules';
  const { visibleItems, hasMore, remaining, loadMore } = useContextPickerListWindow(
    filteredItems,
    listResetKey
  );

  const sortedModuleRows = useMemo(() => {
    const preferred = moduleRows.find((row) => row.type === preferredModuleType);
    if (!preferred) return moduleRows;
    return [preferred, ...moduleRows.filter((row) => row.type !== preferredModuleType)];
  }, [moduleRows, preferredModuleType]);

  const isPricingView = view.level === 'items' && view.moduleType === 'pricing_date';

  const selectItem = (item: AttachedContextItem) => {
    onSelect(item);
    setOpen(false);
    reset();
  };

  const stopBubble = (event: React.SyntheticEvent) => event.stopPropagation();

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>
        <ChatComposerPickerTrigger
          icon={Bookmark}
          label="Pin context"
          pressed={selectedKeys.size > 0}
          disabled={disabled}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        container={overlayContainer}
        className={cn(
          'p-0',
          isPricingView ? 'w-[min(calc(100vw-2rem),22rem)]' : 'w-[min(calc(100vw-2rem),24rem)]'
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onWheel={stopBubble}
        onPointerDown={stopBubble}
      >
        {isPricingView ? (
          <div className="flex flex-col">
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
            <ChatContextPricingCalendar
              compact
              selectedKeys={selectedKeys}
              onSelect={(item) => selectItem(item)}
            />
          </div>
        ) : (
          <ChatContextPickerPanel
            view={view.level}
            moduleTitle={view.level === 'items' ? view.moduleLabel : undefined}
            onBack={view.level === 'items' ? backToModules : undefined}
            searchRef={searchRef}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={
              view.level === 'modules'
                ? 'Search modules'
                : `Search ${view.moduleLabel.toLowerCase()}`
            }
            searchAriaLabel={
              view.level === 'modules' ? 'Search modules' : `Search ${view.moduleLabel}`
            }
            listAriaLabel={view.level === 'modules' ? 'Context modules' : view.moduleLabel}
            isLoading={isLoading && groups.length === 0}
            emptyLabel={view.level === 'modules' ? 'No modules' : 'No matches'}
            hasRows={
              view.level === 'modules' ? sortedModuleRows.length > 0 : filteredItems.length > 0
            }
            onWheelStop={stopBubble}
            onPointerDownStop={stopBubble}
          >
            {view.level === 'modules' ? (
              sortedModuleRows.map((module, index) => {
                const Icon = ATTACHED_CONTEXT_ICONS[module.type];
                const isPreferred = module.type === preferredModuleType && index === 0;
                return (
                  <ChatContextModuleRow
                    key={module.type}
                    icon={Icon}
                    label={module.label}
                    count={module.count}
                    hint={isPreferred ? 'This page' : undefined}
                    onSelect={() => openModule(module.type, module.label)}
                  />
                );
              })
            ) : (
              <>
                {visibleItems.map((entry) => {
                  const selected = selectedKeys.has(attachedContextKey(entry.item));
                  return (
                    <ChatContextCatalogRow
                      key={attachedContextKey(entry.item)}
                      entry={entry}
                      selected={selected}
                      onSelect={() => selectItem(entry.item)}
                      trailing={
                        entry.status ? (
                          <StatusBadge
                            status={entry.status}
                            className="max-w-[7rem] shrink-0 px-1.5 py-0 text-[10px] font-semibold"
                          />
                        ) : undefined
                      }
                    />
                  );
                })}
                {hasMore ? (
                  <ChatContextLoadMoreRow remaining={remaining} onClick={loadMore} />
                ) : null}
                {activeGroup && activeGroup.totalCount > filteredItems.length ? (
                  <p className="text-muted-foreground px-2 pb-1 pt-0.5 text-center text-xs tabular-nums">
                    Showing {filteredItems.length} of {activeGroup.totalCount}
                  </p>
                ) : null}
              </>
            )}
          </ChatContextPickerPanel>
        )}
      </PopoverContent>
    </Popover>
  );
}
