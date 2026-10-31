import { useParams } from 'react-router-dom';

import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';

/** Which dashboard shell Help & Support is mounted under. */
export type HelpSupportAdminScope = 'org' | 'property' | 'parking';

/**
 * Org / property / parking scope for the current Help & Support mount.
 * Property context is `RequireOrgContext` (property shell); parking is
 * `RequireParkingContext`; otherwise org portfolio.
 */
export function useHelpSupportAdminScope(): HelpSupportAdminScope {
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();
  if (parkingContext) return 'parking';
  if (orgContext) return 'property';
  return 'org';
}

/**
 * Base `/help-support` path for whichever admin scope the page is mounted under
 * (org, property, or parking). Route registration itself is Phase 6 — see
 * docs/workflow/in-progress/help-support-center.md "Nav + routing wiring".
 */
export function useHelpSupportBasePath(): string | null {
  const { orgSlug: routeOrgSlug } = useParams<{ orgSlug?: string }>();
  const orgContext = useOptionalOrgContext();
  const parkingContext = useOptionalParkingContext();
  const orgSlug = orgContext?.orgSlug ?? parkingContext?.orgSlug ?? routeOrgSlug ?? null;
  if (!orgSlug) return null;

  if (parkingContext) return `/org/${orgSlug}/parking/${parkingContext.parkingSlug}/help-support`;
  if (orgContext) return `/org/${orgSlug}/property/${orgContext.propertySlug}/help-support`;
  return `/org/${orgSlug}/help-support`;
}

export function helpSupportDocsPath(basePath: string): string {
  return `${basePath}/docs`;
}

export function helpSupportTicketsPath(basePath: string): string {
  return `${basePath}/tickets`;
}

export function helpSupportNewTicketPath(basePath: string, options?: { subject?: string }): string {
  const path = `${basePath}/tickets/new`;
  const subject = options?.subject?.trim();
  if (!subject) return path;
  return `${path}?subject=${encodeURIComponent(subject)}`;
}

export function helpSupportTicketDetailPath(basePath: string, ticketId: string): string {
  return `${basePath}/tickets/${ticketId}`;
}

const SUPPORT_TICKET_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSupportTicketId(value: string): boolean {
  return SUPPORT_TICKET_ID_RE.test(value);
}

/** First segment after `{basePath}/tickets/` — prefers router splat, falls back to pathname. */
export function resolveTicketsRouteSegment(
  basePath: string | null,
  pathname: string,
  splatParam: string | undefined
): string {
  const fromParam = splatParam?.replace(/\/$/, '').split('/')[0] ?? '';
  if (fromParam) return fromParam;

  if (!basePath) return '';
  const ticketsRoot = helpSupportTicketsPath(basePath);
  const prefix = `${ticketsRoot}/`;
  if (!pathname.startsWith(prefix)) return '';
  return pathname.slice(prefix.length).replace(/\/$/, '').split('/')[0] ?? '';
}

export function ticketsComposeSearchParam(): URLSearchParams {
  return new URLSearchParams({ compose: '1' });
}

export type HelpSupportSection = 'faqs' | 'guides' | 'tickets';

export function helpSupportSectionFromPath(pathname: string): HelpSupportSection {
  if (pathname.includes('/help-support/tickets')) return 'tickets';
  if (pathname.includes('/help-support/docs')) return 'guides';
  return 'faqs';
}
