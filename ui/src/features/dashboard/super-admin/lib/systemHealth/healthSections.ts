import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

export const HEALTH_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'usage', label: 'Usage' },
] as const;

export type HealthSectionId = (typeof HEALTH_SECTIONS)[number]['id'];

export function parseHealthSection(value: string | undefined): HealthSectionId | null {
  if (!value) return 'overview';
  return HEALTH_SECTIONS.some((section) => section.id === value)
    ? (value as HealthSectionId)
    : null;
}

export function healthSectionPath(section: HealthSectionId): string {
  return section === 'overview' ? superAdminPaths.health : superAdminPaths.healthSection(section);
}
