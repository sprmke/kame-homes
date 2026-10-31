import { useMemo } from 'react';

import type { OrgListingAssignments } from '@/features/dashboard/team/components/OrgListingAssignmentPicker';
import { orgListingScopeSummary } from '@/features/dashboard/team/lib/orgRoleListingScope';
import { findMatchingTemplate } from '@/features/dashboard/team/lib/permissionTreeState';
import {
  getCatalogPageNodes,
  getDescendantLeafIds,
  type PermissionCatalog,
} from '@/features/dashboard/team/lib/propertyPermissionCatalog';
import { CUSTOM_ROLE_COLOR } from '@/features/dashboard/team/lib/teamRoleHelpers';
import type { TeamScope } from '@/features/dashboard/team/lib/teamScopeConfig';
import type { CustomPropertyRole } from '@/features/dashboard/team/types/propertyTeam';

import { cn } from '@/lib/utils';

type ModuleSummary = {
  label: string;
  selected: number;
  total: number;
};

function buildModuleSummaries(
  permissions: readonly string[],
  catalog: PermissionCatalog
): ModuleSummary[] {
  const selected = new Set(permissions);
  return getCatalogPageNodes(catalog)
    .map((page) => {
      const leafIds = getDescendantLeafIds(page.key, catalog);
      const count = leafIds.filter((id) => selected.has(id)).length;
      return { label: page.label, selected: count, total: leafIds.length };
    })
    .filter((row) => row.total > 0);
}

type Props = {
  scope: TeamScope;
  name: string;
  permissions: string[];
  roles: CustomPropertyRole[];
  catalog?: PermissionCatalog;
  categorySummaries?: ModuleSummary[];
  allListings?: boolean;
  listingAssignments?: OrgListingAssignments;
  className?: string;
};

export function CustomRoleFormPreview({
  scope,
  name,
  permissions,
  roles,
  catalog,
  categorySummaries,
  allListings = true,
  listingAssignments,
  className,
}: Props) {
  const displayName = name.trim() || 'Untitled role';
  const matched = useMemo(() => findMatchingTemplate(permissions, roles), [permissions, roles]);
  const baselineLabel = matched?.name ?? 'Custom';
  const moduleRows = useMemo(() => {
    if (categorySummaries) return categorySummaries;
    if (catalog) return buildModuleSummaries(permissions, catalog);
    return [];
  }, [catalog, categorySummaries, permissions]);

  const listingLine =
    scope === 'org' ? orgListingScopeSummary(allListings, listingAssignments) : null;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-lg border px-3 py-3">
        <div className="flex items-start gap-3">
          <div className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', CUSTOM_ROLE_COLOR)} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="text-muted-foreground text-xs">
              {permissions.length} permission
              {permissions.length === 1 ? '' : 's'}
              {listingLine ? ` · ${listingLine}` : null}
            </p>
            <p className="text-muted-foreground text-xs">Based on {baselineLabel}</p>
          </div>
        </div>
      </div>

      {moduleRows.length > 0 ? (
        <ul className="divide-border divide-y rounded-lg border">
          {moduleRows.map((row) => (
            <li
              key={row.label}
              className="flex min-h-11 items-center justify-between gap-3 px-3 py-2"
            >
              <span className="text-sm">{row.label}</span>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  row.selected === 0 ? 'text-muted-foreground' : 'text-foreground font-medium'
                )}
              >
                {row.selected}/{row.total}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
