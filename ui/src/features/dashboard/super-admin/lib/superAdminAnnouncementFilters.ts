import { hostAnnouncementBodyPlainText } from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import type {
  HostAnnouncementDraft,
  HostAnnouncementSeverity,
} from '@/features/dashboard/announcements/lib/hostAnnouncementTypes';
import type { SuperAdminListViewMode } from '@/features/dashboard/super-admin/lib/superAdminListViewMode';

export type SuperAdminAnnouncementStatusFilter = 'all' | 'active' | 'inactive';

export type SuperAdminAnnouncementFilters = {
  search: string;
  severity: 'all' | HostAnnouncementSeverity;
  status: SuperAdminAnnouncementStatusFilter;
};

export type SuperAdminAnnouncementViewMode = SuperAdminListViewMode;

export const DEFAULT_SUPER_ADMIN_ANNOUNCEMENT_FILTERS: SuperAdminAnnouncementFilters = {
  search: '',
  severity: 'all',
  status: 'all',
};

export const ANNOUNCEMENT_SEVERITY_LABELS: Record<HostAnnouncementSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

export function filterSuperAdminAnnouncements(
  announcements: HostAnnouncementDraft[],
  filters: SuperAdminAnnouncementFilters
): HostAnnouncementDraft[] {
  const term = filters.search.trim().toLowerCase();
  return announcements.filter((announcement) => {
    if (filters.severity !== 'all' && announcement.severity !== filters.severity) return false;
    if (filters.status === 'active' && !announcement.active) return false;
    if (filters.status === 'inactive' && announcement.active) return false;
    if (!term) return true;
    const haystack =
      `${announcement.title} ${hostAnnouncementBodyPlainText(announcement.body)}`.toLowerCase();
    return haystack.includes(term);
  });
}

export function superAdminAnnouncementHasActiveFilters(
  filters: SuperAdminAnnouncementFilters
): boolean {
  return filters.search.trim() !== '' || filters.severity !== 'all' || filters.status !== 'all';
}

export function superAdminAnnouncementSummaryFromList(announcements: HostAnnouncementDraft[]) {
  const active = announcements.filter((entry) => entry.active).length;
  const critical = announcements.filter((entry) => entry.severity === 'critical').length;
  const warning = announcements.filter((entry) => entry.severity === 'warning').length;

  return { total: announcements.length, active, critical, warning };
}
