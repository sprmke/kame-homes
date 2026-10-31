import { useParams } from 'react-router-dom';

import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';

/** True when the signed-in host can open an announcements archive for the current org. */
export function useHasHostAnnouncementsArchiveScope(): boolean {
  const { orgSlug: routeOrgSlug } = useParams<{ orgSlug?: string }>();
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();
  const orgSlug = orgContext?.orgSlug ?? parkingContext?.orgSlug ?? routeOrgSlug ?? null;
  return Boolean(orgSlug);
}

/** Base `/announcements` path for the current admin scope. */
export function useHostAnnouncementsBasePath(): string | null {
  const { orgSlug: routeOrgSlug } = useParams<{ orgSlug?: string }>();
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();
  const orgSlug = orgContext?.orgSlug ?? parkingContext?.orgSlug ?? routeOrgSlug ?? null;
  if (!orgSlug) return null;

  if (parkingContext) {
    return `/org/${orgSlug}/parking/${parkingContext.parkingSlug}/announcements`;
  }
  if (orgContext) {
    return `/org/${orgSlug}/property/${orgContext.propertySlug}/announcements`;
  }
  return `/org/${orgSlug}/announcements`;
}

/** Map Help & Support announcements URLs to the org announcements archive. */
export function hostAnnouncementsPathFromHelpSupport(helpSupportPath: string): string {
  const match = helpSupportPath.match(/^\/org\/([^/]+)/);
  if (match) {
    return `/org/${match[1]}/announcements`;
  }
  return helpSupportPath.replace(/\/help-support\/?$/, '/announcements');
}

export function hostAnnouncementDetailPath(basePath: string, announcementId: string): string {
  return `${basePath}/${encodeURIComponent(announcementId)}`;
}

export function isHostAnnouncementDetailPath(pathname: string, basePath: string | null): boolean {
  if (!basePath || !pathname.startsWith(`${basePath}/`)) return false;
  const suffix = pathname.slice(basePath.length + 1);
  return suffix.length > 0 && !suffix.includes('/');
}
