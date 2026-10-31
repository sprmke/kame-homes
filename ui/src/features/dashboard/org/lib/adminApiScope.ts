import { useParams } from 'react-router-dom';

import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { useOptionalParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';

/** Current property id from nested admin route context (null on org-only pages). */
export function usePropertyIdParam(): string | null {
  return useOptionalOrgContext()?.property.id ?? null;
}

/** Current parking id from nested parking admin route (null elsewhere). */
export function useParkingIdParam(): string | null {
  return useOptionalParkingContext()?.parking.id ?? null;
}

/** Org slug from route or tenant context. */
export function useOrgSlugParam(): string | null {
  const { orgSlug } = useParams<{ orgSlug?: string }>();
  const orgContext = useOptionalOrgContext();
  return orgSlug ?? orgContext?.org.slug ?? null;
}

/** Org id from tenant context (may be null on org slug routes until org list loads). */
export function useOrgIdParam(): string | null {
  return useOptionalOrgContext()?.org.id ?? null;
}

/** Org id from route context or organizations list — for org-only pages without property shell. */
export function useResolvedOrgId(): string | null {
  const orgId = useOrgIdParam();
  const orgSlug = useOrgSlugParam();
  const { data: orgsData } = useOrganizations();
  if (orgId) return orgId;
  if (!orgSlug) return null;
  return orgsData?.organizations.find((entry) => entry.slug === orgSlug)?.id ?? null;
}

export function useOrgScopeKey(): { orgSlug: string | null; orgId: string | null } {
  return { orgSlug: useOrgSlugParam(), orgId: useOrgIdParam() };
}

export function appendPropertyId(
  params: URLSearchParams,
  propertyId: string | null
): URLSearchParams {
  if (propertyId) params.set('property_id', propertyId);
  return params;
}

export function appendParkingId(
  params: URLSearchParams,
  parkingId: string | null
): URLSearchParams {
  if (parkingId) params.set('parking_id', parkingId);
  return params;
}

export function adminApiPath(
  path: string,
  params: URLSearchParams,
  propertyId: string | null
): string {
  const qs = appendPropertyId(params, propertyId).toString();
  return qs ? `${path}?${qs}` : path;
}

/** Append property_id query param to an edge function path (GET/POST/PATCH). */
export function scopedAdminPath(path: string, propertyId: string | null): string {
  if (!propertyId || path.includes('property_id=')) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}property_id=${encodeURIComponent(propertyId)}`;
}

/** Full Supabase functions URL with optional property scope. */
export function scopedFunctionsUrl(path: string, propertyId: string | null): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${scopedAdminPath(normalizedPath, propertyId)}`;
}

function appendOrgScope(
  params: URLSearchParams,
  orgSlug: string | null,
  orgId: string | null
): URLSearchParams {
  if (orgId) params.set('org_id', orgId);
  else if (orgSlug) params.set('org_slug', orgSlug);
  return params;
}

/** Append org_slug or org_id for org-scoped edge function calls. */
export function appendOrgId(
  params: URLSearchParams,
  orgSlug: string | null,
  orgId: string | null
): URLSearchParams {
  return appendOrgScope(params, orgSlug, orgId);
}

/** Full Supabase functions URL scoped to an organization. */
export function scopedOrgFunctionsUrl(
  path: string,
  orgSlug: string | null,
  orgId: string | null
): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const params = appendOrgScope(new URLSearchParams(), orgSlug, orgId);
  const qs = params.toString();
  return qs ? `${base}${normalizedPath}?${qs}` : `${base}${normalizedPath}`;
}
