import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';
import { useOrgSlugParam } from '@/features/dashboard/org/lib/adminApiScope';
import { readOrgSettingsString } from '@/features/dashboard/org/lib/orgSettingsValidation';

import { DEFAULT_ORG_BRAND_COLOR } from '@/lib/theme/brandColor';

/** Resolved org brand color for the current admin route (defaults to blue-green theme base). */
export function useOrgBrandColor(): string {
  const orgSlug = useOrgSlugParam();
  const { data } = useOrganizations();
  const org = data?.organizations.find((item) => item.slug === orgSlug);
  if (!org) return DEFAULT_ORG_BRAND_COLOR;
  return readOrgSettingsString(org.settings, 'brandColor') || DEFAULT_ORG_BRAND_COLOR;
}
