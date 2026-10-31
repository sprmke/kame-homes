/**
 * Permission tree selection helpers — three-state parent toggles, template match.
 */

import {
  getCatalogLeafIds,
  getDescendantLeafIds,
  type PermissionCatalog,
  PROPERTY_PERMISSION_CATALOG,
} from '@/features/dashboard/team/lib/propertyPermissionCatalog';
import type { CustomPropertyRole } from '@/features/dashboard/team/types/propertyTeam';

export type TriState = 'on' | 'off' | 'indeterminate';

export function permissionSetEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = new Set(a);
  return b.every((id) => left.has(id));
}

export function findMatchingTemplate(
  permissions: readonly string[],
  templates: CustomPropertyRole[]
): CustomPropertyRole | null {
  for (const template of templates) {
    if (permissionSetEqual(permissions, template.permissions)) {
      return template;
    }
  }
  return null;
}

export function parentTriState(
  parentKey: string,
  selected: ReadonlySet<string>,
  catalog: PermissionCatalog = PROPERTY_PERMISSION_CATALOG
): TriState {
  const leafIds = getDescendantLeafIds(parentKey, catalog);
  if (leafIds.length === 0) return 'off';
  let onCount = 0;
  for (const id of leafIds) {
    if (selected.has(id)) onCount += 1;
  }
  if (onCount === 0) return 'off';
  if (onCount === leafIds.length) return 'on';
  return 'indeterminate';
}

export function toggleLeafPermission(
  permissions: readonly string[],
  permissionId: string,
  nextChecked: boolean
): string[] {
  const set = new Set(permissions);
  if (nextChecked) {
    set.add(permissionId);
  } else {
    set.delete(permissionId);
  }
  return [...set];
}

export function toggleParentPermissions(
  permissions: readonly string[],
  parentKey: string,
  nextChecked: boolean,
  catalog: PermissionCatalog = PROPERTY_PERMISSION_CATALOG
): string[] {
  const leafIds = getDescendantLeafIds(parentKey, catalog);
  const set = new Set(permissions);
  for (const id of leafIds) {
    if (nextChecked) {
      set.add(id);
    } else {
      set.delete(id);
    }
  }
  return [...set];
}

export function filterCatalogBySearch(catalog: PermissionCatalog, query: string): Set<string> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return new Set(catalog.map((node) => node.key));
  }

  const visible = new Set<string>();
  for (const node of catalog) {
    const haystack = `${node.label} ${node.description ?? ''} ${node.id ?? ''}`.toLowerCase();
    if (!haystack.includes(normalized)) continue;
    visible.add(node.key);
    let parent = node.parentKey;
    while (parent) {
      visible.add(parent);
      const parentNode = catalog.find((entry) => entry.key === parent);
      parent = parentNode?.parentKey ?? null;
    }
  }
  return visible;
}

export function filterPagesDifferingFromTemplate(
  permissions: readonly string[],
  templatePermissions: readonly string[] | null,
  catalog: PermissionCatalog = PROPERTY_PERMISSION_CATALOG
): Set<string> {
  if (!templatePermissions) {
    return new Set(catalog.map((node) => node.key));
  }
  const selected = new Set(permissions);
  const template = new Set(templatePermissions);
  const visible = new Set<string>();

  for (const page of catalog.filter((node) => node.parentKey === null)) {
    const leafIds = getDescendantLeafIds(page.key, catalog);
    const differs = leafIds.some((id) => selected.has(id) !== template.has(id));
    if (!differs) continue;
    visible.add(page.key);
    for (const id of leafIds) {
      const leaf = catalog.find((node) => node.id === id);
      if (leaf) visible.add(leaf.key);
    }
  }
  return visible;
}

export function catalogHasAnyVisible(
  visibleKeys: Set<string>,
  catalog: PermissionCatalog = PROPERTY_PERMISSION_CATALOG
): boolean {
  return getCatalogLeafIds(catalog).some((id) => {
    const node = catalog.find((entry) => entry.id === id);
    return node ? visibleKeys.has(node.key) : false;
  });
}
