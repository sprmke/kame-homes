export type SuperAdminHostsFilters = {
  search: string;
};

import type { SuperAdminListViewMode } from '@/features/dashboard/super-admin/lib/superAdminListViewMode';

export type SuperAdminHostsViewMode = SuperAdminListViewMode;

export function superAdminHostsHasActiveFilters(filters: SuperAdminHostsFilters): boolean {
  return filters.search.trim() !== '';
}

export function hostDisplayInitial(name: string, email: string): string {
  const source = name.trim() || email.split('@')[0] || 'H';
  return source[0]?.toUpperCase() ?? 'H';
}
