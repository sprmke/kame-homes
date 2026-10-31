/**
 * Resolve property scope for admin + public edge handlers.
 */

import {
  createServiceClient,
  type OrgAccessContext,
  type PropertyAccessContext,
  verifyAuthenticatedUser,
  verifyOrgAccess,
  verifyOrgOwner,
  verifyOrgOwnerBySlug,
  verifyPropertyAccess,
  verifyPropertyOwner,
} from './orgAuth.ts';
import type { OrgPermissionId } from './orgTeamPermissions.ts';
import type { TeamPermissionId } from './propertyTeamPermissions.ts';

const DEFAULT_PROPERTY_SLUG = 'monaco-2604';

let cachedDefaultPropertyId: string | null = null;

export async function getDefaultPropertyId(): Promise<string> {
  if (cachedDefaultPropertyId) return cachedDefaultPropertyId;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('slug', DEFAULT_PROPERTY_SLUG)
    .maybeSingle();
  if (error || !data?.id) {
    const { data: anyProp } = await supabase
      .from('properties')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!anyProp?.id) {
      throw new Error('No property configured — run multi-tenancy migration');
    }
    cachedDefaultPropertyId = anyProp.id;
    return anyProp.id;
  }
  cachedDefaultPropertyId = data.id;
  return data.id;
}

async function getFirstPropertyIdForUser(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!org?.id) return null;
  const { data: prop } = await supabase
    .from('properties')
    .select('id')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return prop?.id ?? null;
}

async function getFirstMemberPropertyId(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('property_members')
    .select('property_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('assigned_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.property_id as string | undefined) ?? null;
}

export function requireExplicitPropertyId(propertyId: string | null | undefined): string {
  const id = propertyId?.trim() ?? '';
  if (!id) {
    throw new Response(JSON.stringify({ success: false, error: 'property_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return id;
}

/**
 * Resolve property scope with RBAC. Requires an explicit property id
 * (`property_id` query / body) — never falls back to first owned listing.
 */
export async function resolveScopedPropertyAccess(
  req: Request,
  requiredPermission: TeamPermissionId,
  explicitPropertyId?: string | null
): Promise<PropertyAccessContext> {
  const url = new URL(req.url);
  const propertyId = requireExplicitPropertyId(
    explicitPropertyId?.trim() || readPropertyIdFromUrl(url)
  );
  return verifyPropertyAccess(req, propertyId, requiredPermission);
}

/** Read access without a specific permission gate (any active member / owner). */
export async function resolvePropertyAccessContext(
  req: Request,
  explicitPropertyId?: string | null
): Promise<PropertyAccessContext> {
  const url = new URL(req.url);
  const propertyId = explicitPropertyId?.trim() || readPropertyIdFromUrl(url);
  if (!propertyId) {
    throw new Response(JSON.stringify({ success: false, error: 'property_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return verifyPropertyAccess(req, propertyId);
}

/** Org access — ?org_id= or ?org_slug=; optional permission gate on callers. */
export async function resolveOrgAccessContext(
  req: Request,
  requiredPermission?: OrgPermissionId
): Promise<OrgAccessContext> {
  const url = new URL(req.url);
  const orgId = readOrgIdFromUrl(url);
  const orgSlug = readOrgSlugFromUrl(url);
  if (!orgId && !orgSlug) {
    throw new Response(
      JSON.stringify({ success: false, error: 'org_id or org_slug is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  return verifyOrgAccess(
    req,
    { orgId: orgId || undefined, orgSlug: orgSlug || undefined },
    requiredPermission
  );
}

/** Admin org endpoints — ?org_id= or ?org_slug= (owner verified). */
export async function resolveAdminOrgId(req: Request, adminUserId: string): Promise<string> {
  const url = new URL(req.url);
  const orgId = readOrgIdFromUrl(url);
  if (orgId) {
    const { org } = await verifyOrgOwner(req, orgId);
    return org.id;
  }

  const orgSlug = readOrgSlugFromUrl(url);
  if (orgSlug) {
    const { org } = await verifyOrgOwnerBySlug(req, orgSlug);
    return org.id;
  }

  const propertyId = readPropertyIdFromUrl(url);
  if (propertyId) {
    await verifyPropertyOwner(req, propertyId);
    return resolveOrganizationIdForProperty(propertyId);
  }

  const ownedProperty = await getFirstPropertyIdForUser(adminUserId);
  if (ownedProperty) {
    return resolveOrganizationIdForProperty(ownedProperty);
  }

  const supabase = createServiceClient();
  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', adminUserId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (org?.id) return org.id as string;

  throw new Response(JSON.stringify({ success: false, error: 'Organization not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function readPropertyIdFromUrl(url: URL): string | null {
  const id = url.searchParams.get('property_id')?.trim();
  return id || null;
}

export function readOrgIdFromUrl(url: URL): string | null {
  const id = url.searchParams.get('org_id')?.trim();
  return id || null;
}

export function readOrgSlugFromUrl(url: URL): string | null {
  const slug = url.searchParams.get('org_slug')?.trim();
  return slug || null;
}

/** All property ids belonging to an organization (org bookings list scope). */
export async function listPropertyIdsForOrganization(orgId: string): Promise<string[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('organization_id', orgId);
  if (error) {
    throw new Error(`list org properties failed: ${error.message}`);
  }
  return (data ?? []).map((row) => String(row.id));
}

export async function resolveOrganizationIdForProperty(propertyId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('properties')
    .select('organization_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (error || !data?.organization_id) {
    throw new Error('Property not found');
  }
  return data.organization_id as string;
}

export async function resolvePropertySlugById(propertyId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('properties')
    .select('slug')
    .eq('id', propertyId)
    .maybeSingle();
  return typeof data?.slug === 'string' && data.slug.trim() ? data.slug.trim() : null;
}

export function readPropertySlugFromUrl(url: URL): string | null {
  const slug =
    url.searchParams.get('property')?.trim() || url.searchParams.get('property_slug')?.trim();
  return slug || null;
}

export async function resolvePropertyIdBySlug(slug: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('properties').select('id').eq('slug', slug).maybeSingle();
  return data?.id ?? null;
}

function throwPropertyRequired(status = 400): never {
  throw new Response(JSON.stringify({ success: false, error: 'property is required' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Public guest endpoints — require `?property=` slug or `?property_id=` UUID. */
export async function resolvePublicPropertyId(url: URL): Promise<string> {
  const explicitId = readPropertyIdFromUrl(url);
  if (explicitId) return explicitId;

  const slug = readPropertySlugFromUrl(url);
  if (slug) {
    const id = await resolvePropertyIdBySlug(slug);
    if (id) return id;
    throw new Response(JSON.stringify({ success: false, error: 'Property not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  throwPropertyRequired();
}

/**
 * Legacy owner helper. New admin writes must use `resolveScopedPropertyAccess`.
 * Requires an explicit property id — never first-owned or DEFAULT_PROPERTY.
 */
export async function resolveAdminPropertyId(
  req: Request,
  _adminUserId: string,
  explicitPropertyId?: string | null
): Promise<string> {
  const url = new URL(req.url);
  const propertyId = requireExplicitPropertyId(
    explicitPropertyId?.trim() || readPropertyIdFromUrl(url)
  );
  await verifyPropertyOwner(req, propertyId);
  return propertyId;
}

export function applyPropertyIdFilter<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  propertyId: string
): T {
  return query.eq('property_id', propertyId);
}

export function assertBookingBelongsToProperty(
  bookingPropertyId: string | null,
  expectedPropertyId: string
): void {
  if (bookingPropertyId !== expectedPropertyId) {
    throw new Error('Booking does not belong to this property');
  }
}

/** Ensures a booking row belongs to the resolved property (admin mutations). */
export async function verifyBookingBelongsToProperty(
  bookingId: string,
  propertyId: string
): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('guest_submissions')
    .select('property_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (error || !data) {
    throw new Error('Booking not found');
  }
  assertBookingBelongsToProperty(data.property_id, propertyId);
}
