import * as React from 'react';

import { ChevronRight, FolderOpen, Plus, Search, X } from 'lucide-react';

import { TemplateLibraryCategoryFilter } from '@/features/dashboard/bookings/components/property-templates/TemplateLibraryCategoryFilter';
import {
  applyTemplateLibraryFilters,
  templateRowStatusParts,
  type TemplateCategoryFilter,
  type TemplateLibraryEntry,
  type TemplateLibraryGroup,
} from '@/features/dashboard/bookings/lib/templateLibrary';
import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';

import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { ResponsiveOverflowMenu } from '@/components/mobile/ResponsiveOverflowMenu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SlidingActivePill } from '@/components/ui/SlidingActivePill';
import { useSlidingActivePill } from '@/hooks/useSlidingActivePill';
import { cn } from '@/lib/utils';

/** Overflow trigger sized like the rest of the admin chrome: 32px visual, 44px hit. */
const railMenuTriggerClassName =
  'relative size-8 shrink-0 rounded-md before:absolute before:-inset-1.5 before:content-[""] sm:before:content-none';

/** Template rows hide ⋯ until hover/focus; section headings keep ⋯ visible. */
const templateRowMenuTriggerClassName = cn(
  railMenuTriggerClassName,
  '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity',
  '[@media(hover:hover)]:group-focus-within/row:opacity-100 [@media(hover:hover)]:group-hover/row:opacity-100'
);

export type TemplateRailHandlers = {
  onRenameTemplate: (entry: TemplateLibraryEntry) => void;
  onMoveTemplate: (entry: TemplateLibraryEntry) => void;
  onDeleteTemplate: (entry: TemplateLibraryEntry) => void;
  onRenameFolder: (group: TemplateLibraryGroup) => void;
  onDeleteFolder: (group: TemplateLibraryGroup) => void;
  onAddTemplateToGroup?: (group: TemplateLibraryGroup) => void;
};

export type TemplateRailPermissions = {
  canAddCustom: boolean;
  canEditCustom: boolean;
  canDeleteCustom: boolean;
};

type TemplateLibraryRailProps = {
  groups: TemplateLibraryGroup[];
  /** Highlighted row on desktop; null on phone, where the list is the whole page. */
  selectedKey: string | null;
  onSelect: (templateKey: string) => void;
  query: string;
  onQueryChange: (query: string) => void;
  categoryFilter: TemplateCategoryFilter;
  onCategoryFilterChange: (filter: TemplateCategoryFilter) => void;
  /** Phone rows get a chevron and no active pill, since tapping navigates away. */
  variant: 'rail' | 'list';
  permissions: TemplateRailPermissions;
  handlers: TemplateRailHandlers;
  /** Bump when a sheet/modal over the workbench opens or closes (scroll-lock layout). */
  overlayRemeasureKey?: string | number | boolean;
};

function TemplateRowMeta({ entry, active }: { entry: TemplateLibraryEntry; active: boolean }) {
  const parts = React.useMemo(() => templateRowStatusParts(entry), [entry]);
  if (parts.length === 0) return null;

  return (
    <span
      className={cn(
        'block truncate text-xs',
        /* On the brand pill, tint from the fill's own foreground — never gray. */
        active ? 'text-primary-foreground/75' : 'text-muted-foreground'
      )}
    >
      {parts.join(' · ')}
    </span>
  );
}

const TemplateRow = React.forwardRef<
  HTMLDivElement,
  {
    entry: TemplateLibraryEntry;
    active: boolean;
    showChevron: boolean;
    onSelect: (templateKey: string) => void;
    permissions: TemplateRailPermissions;
    handlers: TemplateRailHandlers;
  }
>(function TemplateRow({ entry, active, showChevron, onSelect, permissions, handlers }, ref) {
  const Icon = entry.icon;
  const canOrganise = entry.organisable && permissions.canEditCustom;
  const canDelete = entry.organisable && permissions.canDeleteCustom;

  return (
    <div
      ref={ref}
      className={cn(
        'group/row relative z-[1] flex min-h-[52px] items-center rounded-lg py-2 pl-2.5 pr-0.5 transition-colors duration-200',
        active
          ? 'text-primary-foreground'
          : 'text-foreground hover:bg-muted active:bg-muted/80 focus-within:bg-muted'
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(entry.templateKey)}
        aria-current={active ? 'true' : undefined}
        className="flex min-w-0 flex-1 items-center gap-2.5 pr-1 text-left outline-none"
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md transition-colors',
            active ? 'bg-primary-foreground/15' : 'bg-muted text-muted-foreground'
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{entry.name}</span>
          <TemplateRowMeta entry={entry} active={active} />
        </span>
        {showChevron && !canOrganise && !canDelete ? (
          <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
        ) : null}
      </button>

      {canOrganise || canDelete ? (
        <ResponsiveOverflowMenu
          label={`Actions for ${entry.name}`}
          sheetTitle={entry.name}
          triggerClassName={cn(
            templateRowMenuTriggerClassName,
            active && 'text-primary-foreground hover:bg-primary-foreground/15'
          )}
          actionGroups={[
            [
              {
                key: 'rename',
                label: 'Rename',
                disabled: !canOrganise,
                onSelect: () => handlers.onRenameTemplate(entry),
              },
              {
                key: 'move',
                label: 'Move',
                disabled: !canOrganise,
                onSelect: () => handlers.onMoveTemplate(entry),
              },
            ],
            [
              {
                key: 'delete',
                label: 'Delete',
                destructive: true,
                disabled: !canDelete,
                onSelect: () => handlers.onDeleteTemplate(entry),
              },
            ],
          ]}
        />
      ) : null}
    </div>
  );
});

function RailFolderEmptyState({
  group,
  permissions,
  handlers,
}: {
  group: TemplateLibraryGroup;
  permissions: TemplateRailPermissions;
  handlers: TemplateRailHandlers;
}) {
  const canAdd =
    permissions.canAddCustom &&
    typeof handlers.onAddTemplateToGroup === 'function' &&
    (group.kind === 'folder' || group.kind === 'builtin');

  const emptyHint =
    group.kind === 'builtin' ? 'Add a custom template here.' : 'Move a template here.';

  return (
    <div
      role="status"
      aria-label={`${group.label} has no templates`}
      className="border-border/70 bg-muted/20 mx-1.5 mb-2 flex flex-col items-center gap-2.5 rounded-lg border border-dashed px-3 py-4 text-center"
    >
      <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-md">
        <FolderOpen className="size-4" aria-hidden />
      </span>
      <p className="text-muted-foreground max-w-[12rem] text-xs leading-snug">{emptyHint}</p>
      {canAdd ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] gap-1.5 text-xs"
          onClick={() => handlers.onAddTemplateToGroup?.(group)}
        >
          <Plus className="size-3.5" aria-hidden />
          Add template
        </Button>
      ) : null}
    </div>
  );
}

function RailGroupHeading({
  group,
  permissions,
  handlers,
}: {
  group: TemplateLibraryGroup;
  permissions: TemplateRailPermissions;
  handlers: TemplateRailHandlers;
}) {
  const isFolder = group.kind === 'folder';
  const canManageFolder = isFolder && permissions.canEditCustom;
  const canDeleteFolder = isFolder && permissions.canDeleteCustom;
  const canAddToGroup =
    permissions.canAddCustom &&
    typeof handlers.onAddTemplateToGroup === 'function' &&
    (group.kind === 'folder' || group.kind === 'builtin' || group.kind === 'ungrouped');

  const actionGroups: Parameters<typeof ResponsiveOverflowMenu>[0]['actionGroups'] = [];

  if (canAddToGroup) {
    actionGroups.push([
      {
        key: 'add-template',
        label: 'Add template',
        onSelect: () => handlers.onAddTemplateToGroup?.(group),
      },
    ]);
  }

  if (canManageFolder || canDeleteFolder) {
    actionGroups.push([
      {
        key: 'rename-folder',
        label: 'Rename folder',
        disabled: !canManageFolder,
        onSelect: () => handlers.onRenameFolder(group),
      },
    ]);
    actionGroups.push([
      {
        key: 'delete-folder',
        label: 'Delete folder',
        destructive: true,
        disabled: !canDeleteFolder,
        onSelect: () => handlers.onDeleteFolder(group),
      },
    ]);
  }

  const showGroupMenu = actionGroups.length > 0;

  return (
    <div className="flex min-h-[32px] items-center gap-1.5 pb-1 pl-2.5 pr-1 pt-3 first:pt-1">
      <p className="text-muted-foreground min-w-0 truncate text-xs font-medium uppercase tracking-wider">
        {group.label}
      </p>
      {group.entries.length > 0 ? (
        <span className="text-muted-foreground/70 shrink-0 text-xs tabular-nums">
          {group.entries.length}
        </span>
      ) : null}
      {group.gated ? <TierBadge feature="customTemplates" /> : null}

      {showGroupMenu ? (
        <ResponsiveOverflowMenu
          label={`Actions for ${group.label}`}
          sheetTitle={group.label}
          triggerClassName={cn(railMenuTriggerClassName, 'ml-auto')}
          actionGroups={actionGroups}
        />
      ) : null}
    </div>
  );
}

export function TemplateLibraryRail({
  groups,
  selectedKey,
  onSelect,
  query,
  onQueryChange,
  categoryFilter,
  onCategoryFilterChange,
  variant,
  permissions,
  handlers,
  overlayRemeasureKey,
}: TemplateLibraryRailProps) {
  const filtered = React.useMemo(
    () => applyTemplateLibraryFilters(groups, query, categoryFilter),
    [groups, query, categoryFilter]
  );
  const isList = variant === 'list';
  const searching = query.trim().length > 0;

  /* The pill only tracks a row the rail is actually showing, so a filtered-out
   * selection leaves no orphaned highlight behind. */
  const pillKey = React.useMemo(
    () =>
      !isList &&
      selectedKey &&
      filtered.some((group) => group.entries.some((e) => e.templateKey === selectedKey))
        ? selectedKey
        : null,
    [filtered, isList, selectedKey]
  );

  const structureKey = React.useMemo(
    () =>
      filtered
        .map((group) => `${group.id}:${group.entries.map((e) => e.templateKey).join(',')}`)
        .join('\0'),
    [filtered]
  );

  const { containerRef, setItemRef, bounds, remeasure } = useSlidingActivePill(pillKey, [
    structureKey,
  ]);
  const rowRefs = React.useRef<Record<string, HTMLElement | null>>({});

  const setRowRef = React.useCallback(
    (key: string) => (node: HTMLElement | null) => {
      rowRefs.current[key] = node;
      setItemRef(key)(node);
    },
    [setItemRef]
  );

  /* Keep the open template in view when selection moves from outside the rail
   * (deep link, a delete that re-resolves the selection). */
  React.useEffect(() => {
    if (!pillKey) return;
    const row = rowRefs.current[pillKey];
    const scrollParent = row?.closest('[data-template-rail-scroll]');
    if (!row || !scrollParent) return;
    const rowRect = row.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();
    if (rowRect.top < parentRect.top || rowRect.bottom > parentRect.bottom) {
      row.scrollIntoView({ block: 'nearest' });
      remeasure();
    }
  }, [pillKey, remeasure, structureKey]);

  React.useEffect(() => {
    if (overlayRemeasureKey === undefined) return;
    remeasure();
    const id = requestAnimationFrame(() => remeasure());
    return () => cancelAnimationFrame(id);
  }, [overlayRemeasureKey, remeasure]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-0.5 pb-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search templates"
            aria-label="Search templates"
            className="h-10 pl-9 pr-9 text-[13px] lg:text-sm"
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onQueryChange('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 size-8 -translate-y-1/2 before:absolute before:-inset-1.5 before:content-[''] sm:before:content-none"
            >
              <X className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
        <TemplateLibraryCategoryFilter value={categoryFilter} onChange={onCategoryFilterChange} />
      </div>

      <div
        data-template-rail-scroll
        ref={containerRef}
        className={cn(
          'relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-0.5 pb-1',
          /* As the page's only scrollport on phone, the list clears the tab dock itself. */
          isList && bottomTabBarOffsetClassName()
        )}
      >
        {bounds ? (
          <SlidingActivePill bounds={bounds} className="bg-primary-strong rounded-lg shadow-sm" />
        ) : null}

        {filtered.length === 0 ? (
          <div className="px-2.5 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {searching ? 'No templates match that search.' : 'No templates yet.'}
            </p>
            {searching ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => onQueryChange('')}
              >
                Clear search
              </Button>
            ) : null}
          </div>
        ) : (
          filtered.map((group) => (
            <div key={group.id}>
              <RailGroupHeading group={group} permissions={permissions} handlers={handlers} />
              {group.entries.length === 0 &&
              (group.kind === 'folder' || group.kind === 'builtin') ? (
                <RailFolderEmptyState group={group} permissions={permissions} handlers={handlers} />
              ) : group.entries.length === 0 ? null : (
                group.entries.map((entry) => (
                  <TemplateRow
                    key={entry.templateKey}
                    ref={setRowRef(entry.templateKey)}
                    entry={entry}
                    active={!isList && entry.templateKey === selectedKey}
                    showChevron={isList}
                    onSelect={onSelect}
                    permissions={permissions}
                    handlers={handlers}
                  />
                ))
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
