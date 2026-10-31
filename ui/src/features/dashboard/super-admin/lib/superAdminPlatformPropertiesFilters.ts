import { orgPropertiesHasActiveFilters } from '@/features/dashboard/org/lib/orgPropertiesFilters';
import type { OrgPropertiesFilters } from '@/features/dashboard/org/lib/orgPropertiesFilters';
import type { SuperAdminListViewMode } from '@/features/dashboard/super-admin/lib/superAdminListViewMode';
import type { PlatformProperty } from '@/features/dashboard/super-admin/types/platformProperty';

export type SuperAdminPlatformPropertiesViewMode = SuperAdminListViewMode;

export type PlatformPropertiesDevelopmentFilter = 'all' | 'linked' | 'unlinked';

export type SuperAdminPlatformPropertiesFilters = OrgPropertiesFilters & {
  development: PlatformPropertiesDevelopmentFilter;
};

export function superAdminPlatformPropertiesHasActiveFilters(
  filters: SuperAdminPlatformPropertiesFilters
): boolean {
  return orgPropertiesHasActiveFilters(filters) || filters.development !== 'all';
}

export function superAdminPlatformPropertiesSummaryFromList(properties: PlatformProperty[]) {
  const active = properties.filter((property) => property.status === 'ACTIVE').length;
  const linkedDevelopments = properties.filter((property) => property.developmentSlug).length;
  const organizations = new Set(properties.map((property) => property.organizationId)).size;

  return {
    total: properties.length,
    active,
    linkedDevelopments,
    organizations,
  };
}
