import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { ChevronDown, ChevronRight, Search } from 'lucide-react';

import { TierBadge } from '@/features/dashboard/plans/components/TierBadge';
import {
  catalogHasAnyVisible,
  filterCatalogBySearch,
  parentTriState,
  type TriState,
} from '@/features/dashboard/team/lib/permissionTreeState';
import {
  getCatalogChildren,
  getCatalogPageNodes,
  getDescendantLeafIds,
  PROPERTY_PERMISSION_CATALOG,
  type PermissionCatalog,
  type PermissionCatalogNode,
} from '@/features/dashboard/team/lib/propertyPermissionCatalog';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type Props = {
  permissions: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
  catalog?: PermissionCatalog;
  className?: string;
  /**
   * When set, only this catalog page is shown (wizard step mode).
   * Hides search and the mobile page chip strip.
   */
  pageKey?: string;
  /** Called before enabling a sensitive leaf; return false to cancel. */
  onSensitiveEnable?: (permissionId: string) => boolean | Promise<boolean>;
};

function moduleOpenPageId(module: string): string {
  return `${module}:view`;
}

function moduleViewPermissionId(module: string, catalog: PermissionCatalog): string | null {
  const orgScoped = `org.${module}:view`;
  if (catalog.some((entry) => entry.id === orgScoped)) return orgScoped;
  const plain = moduleOpenPageId(module);
  if (catalog.some((entry) => entry.id === plain)) return plain;
  return null;
}

function isAccessLeaf(node: PermissionCatalogNode, catalog: PermissionCatalog): boolean {
  if (!node.id) return false;
  const viewId = moduleViewPermissionId(node.module, catalog);
  if (viewId && node.id === viewId) return true;
  return node.id.endsWith('export:view');
}

function TriCheckbox({
  state,
  disabled,
  onChange,
  id,
  label,
}: {
  state: TriState;
  disabled: boolean;
  onChange: (next: boolean) => void;
  id: string;
  label: string;
}) {
  return (
    <Checkbox
      id={id}
      checked={state === 'indeterminate' ? 'indeterminate' : state === 'on'}
      disabled={disabled}
      onCheckedChange={(value) => onChange(value === true)}
      aria-label={label}
      className="size-5 shrink-0"
    />
  );
}

function PermissionRow({
  node,
  checked,
  disabled,
  onToggle,
}: {
  node: PermissionCatalogNode;
  checked: boolean;
  disabled: boolean;
  onToggle: (next: boolean) => void;
}) {
  const inputId = `perm-${node.key}`;
  return (
    <div
      className={cn(
        'hover:bg-muted/50 flex min-h-11 items-start gap-3 rounded-md px-2 py-1.5',
        disabled && 'opacity-60'
      )}
    >
      <Checkbox
        id={inputId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onToggle(value === true)}
        className="mt-0.5 size-5 shrink-0"
      />
      <Label
        htmlFor={inputId}
        className={cn(
          'flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 text-sm font-normal leading-snug',
          disabled && 'pointer-events-none'
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{node.label}</span>
          {node.planFeatureKey ? <TierBadge feature={node.planFeatureKey} /> : null}
          {node.sensitive ? (
            <Badge variant="secondary" className="h-5 shrink-0 px-1.5 text-[10px]">
              Team
            </Badge>
          ) : null}
        </span>
        {node.description ? (
          <span className="text-muted-foreground text-xs font-normal leading-snug">
            {node.description}
          </span>
        ) : null}
      </Label>
    </div>
  );
}

function PermissionGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      {title ? (
        <p className="text-muted-foreground px-2 pb-1 pt-2 text-xs font-medium">{title}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function PermissionsTreeView({
  permissions,
  onChange,
  readOnly = false,
  catalog = PROPERTY_PERMISSION_CATALOG,
  className,
  pageKey,
  onSensitiveEnable,
}: Props) {
  const pages = useMemo(() => getCatalogPageNodes(catalog), [catalog]);
  const selected = useMemo(() => new Set(permissions), [permissions]);
  const singlePageMode = Boolean(pageKey);

  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(pages.map((page) => page.key))
  );
  const [mobilePageKey, setMobilePageKey] = useState<string | null>(
    () => pageKey ?? pages[0]?.key ?? null
  );

  useEffect(() => {
    if (pageKey) {
      setMobilePageKey(pageKey);
      return;
    }
    if (!mobilePageKey && pages[0]) {
      setMobilePageKey(pages[0].key);
    }
  }, [mobilePageKey, pageKey, pages]);

  useEffect(() => {
    setExpanded(new Set(pages.map((page) => page.key)));
  }, [pages]);

  const visibleKeys = useMemo(
    () =>
      singlePageMode ? filterCatalogBySearch(catalog, '') : filterCatalogBySearch(catalog, search),
    [catalog, search, singlePageMode]
  );
  const visiblePages = pages.filter((page) => {
    if (pageKey && page.key !== pageKey) return false;
    return visibleKeys.has(page.key);
  });
  const hasVisible = catalogHasAnyVisible(visibleKeys, catalog);

  const setPageExpanded = (key: string, open: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const ensureOpenPage = (set: Set<string>, module: string) => {
    const viewId = moduleViewPermissionId(module, catalog);
    if (viewId) {
      set.add(viewId);
    }
  };

  const handleToggleLeaf = async (node: PermissionCatalogNode, nextChecked: boolean) => {
    if (!node.id || readOnly) return;
    if (nextChecked && node.sensitive && onSensitiveEnable) {
      const allowed = await onSensitiveEnable(node.id);
      if (!allowed) return;
    }
    const set = new Set(permissions);
    if (nextChecked) {
      set.add(node.id);
      if (node.id !== moduleViewPermissionId(node.module, catalog)) {
        ensureOpenPage(set, node.module);
      }
    } else {
      set.delete(node.id);
    }
    onChange([...set]);
  };

  const handleToggleParent = async (pageKey: string, nextChecked: boolean) => {
    if (readOnly) return;
    const leafIds = getDescendantLeafIds(pageKey, catalog);
    if (nextChecked && onSensitiveEnable) {
      for (const id of leafIds) {
        const node = catalog.find((entry) => entry.id === id);
        if (node?.sensitive) {
          const allowed = await onSensitiveEnable(id);
          if (!allowed) return;
        }
      }
    }
    const set = new Set(permissions);
    for (const id of leafIds) {
      if (nextChecked) set.add(id);
      else set.delete(id);
    }
    if (nextChecked) {
      const page = catalog.find((entry) => entry.key === pageKey);
      if (page) ensureOpenPage(set, page.module);
    }
    onChange([...set]);
  };

  const selectedCountForPage = (pageKey: string) => {
    const leafIds = getDescendantLeafIds(pageKey, catalog);
    return leafIds.filter((id) => selected.has(id)).length;
  };

  const renderLeafRows = (leaves: PermissionCatalogNode[]) =>
    leaves.map((leaf) => (
      <PermissionRow
        key={leaf.key}
        node={leaf}
        checked={selected.has(leaf.id as string)}
        disabled={readOnly}
        onToggle={(next) => {
          void handleToggleLeaf(leaf, next);
        }}
      />
    ));

  const renderPageBody = (page: PermissionCatalogNode) => {
    const children = getCatalogChildren(page.key, catalog).filter((node) =>
      visibleKeys.has(node.key)
    );
    if (children.length === 0) return null;

    const directLeaves = children.filter((node) => node.id);
    const sections = children.filter((node) => !node.id);
    const accessLeaves = directLeaves.filter((node) => isAccessLeaf(node, catalog));
    const otherDirectLeaves = directLeaves.filter((node) => !isAccessLeaf(node, catalog));

    return (
      <div className="space-y-1 pb-1 pt-1">
        {accessLeaves.length > 0 ? (
          <PermissionGroup title="Access">{renderLeafRows(accessLeaves)}</PermissionGroup>
        ) : null}
        {otherDirectLeaves.length > 0 ? (
          <PermissionGroup>{renderLeafRows(otherDirectLeaves)}</PermissionGroup>
        ) : null}
        {sections.map((section) => {
          const leaves = getCatalogChildren(section.key, catalog).filter(
            (node) => node.id && visibleKeys.has(node.key)
          );
          if (leaves.length === 0) return null;
          return (
            <PermissionGroup key={section.key} title={section.label}>
              {renderLeafRows(leaves)}
            </PermissionGroup>
          );
        })}
      </div>
    );
  };

  const renderPageHeader = (
    page: PermissionCatalogNode,
    opts: { open?: boolean; expand?: boolean }
  ) => {
    const state = parentTriState(page.key, selected, catalog);
    const selectedCount = selectedCountForPage(page.key);
    const totalCount = getDescendantLeafIds(page.key, catalog).length;

    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <TriCheckbox
          id={`page-${page.key}`}
          state={state}
          disabled={readOnly}
          label={`Toggle all ${page.label}`}
          onChange={(next) => {
            void handleToggleParent(page.key, next);
          }}
        />
        {opts.expand ? (
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
            >
              {opts.open ? (
                <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
              ) : (
                <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
              )}
              <span className="truncate text-sm font-medium">{page.label}</span>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {selectedCount}/{totalCount}
              </span>
            </button>
          </CollapsibleTrigger>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-sm font-medium">{page.label}</span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {selectedCount}/{totalCount}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (singlePageMode) {
    const page = visiblePages[0];
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        {!page ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No permissions</p>
        ) : (
          <div className="rounded-lg border">
            {renderPageHeader(page, { expand: false })}
            <div className="border-t px-2 pb-2">{renderPageBody(page)}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search permissions"
          className="h-11 pl-9"
          aria-label="Search permissions"
        />
      </div>

      {!hasVisible ? (
        <p className="text-muted-foreground py-6 text-center text-sm">No matches</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {visiblePages.map((page) => (
                <button
                  key={page.key}
                  type="button"
                  className={cn(
                    'h-9 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors',
                    mobilePageKey === page.key
                      ? 'border-primary bg-secondary text-secondary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted/60'
                  )}
                  onClick={() => setMobilePageKey(page.key)}
                >
                  {page.label}
                </button>
              ))}
            </div>
            {visiblePages
              .filter((page) => page.key === mobilePageKey)
              .map((page) => (
                <div key={page.key} className="rounded-lg border">
                  {renderPageHeader(page, { expand: false })}
                  <div className="border-t px-2 pb-2">{renderPageBody(page)}</div>
                </div>
              ))}
          </div>

          <div className="hidden space-y-1.5 md:block">
            {visiblePages.map((page) => {
              const open = expanded.has(page.key);
              return (
                <Collapsible
                  key={page.key}
                  open={open}
                  onOpenChange={(next) => setPageExpanded(page.key, next)}
                >
                  <div className="rounded-lg border">
                    {renderPageHeader(page, { open, expand: true })}
                    <CollapsibleContent>
                      <div className="border-t px-2 pb-2">{renderPageBody(page)}</div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
