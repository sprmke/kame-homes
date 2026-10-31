import type { SupabaseClient } from './supabaseJs.ts';

import { loadAuthUserProfile } from './authUserProfile.ts';

export type HostStats = {
  organizationCount: number;
  propertyCount: number;
  parkingCount: number;
};

export type HostSummary = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  stats: HostStats;
  memberSince: string | null;
};

export function serializeHostSummary(
  userId: string,
  profile: { name: string; email: string; avatarUrl: string | null },
  stats: HostStats,
  memberSince: string | null
): HostSummary {
  return {
    id: userId,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    stats,
    memberSince,
  };
}

export async function hostStatsForOwner(
  supabase: SupabaseClient,
  ownerId: string
): Promise<HostStats & { memberSince: string | null }> {
  const { data: orgs, error: orgError } = await supabase
    .from('organizations')
    .select('id, created_at')
    .eq('owner_id', ownerId);

  if (orgError) {
    console.error('[hostStatsForOwner] orgs', orgError.message);
    throw new Error('Failed to load host organizations');
  }

  const orgRows = orgs ?? [];
  const orgIds = orgRows.map((row) => row.id as string);
  const memberSince =
    orgRows.length > 0
      ? orgRows.reduce(
          (earliest, row) => {
            const createdAt = row.created_at as string;
            return !earliest || createdAt < earliest ? createdAt : earliest;
          },
          null as string | null
        )
      : null;

  if (orgIds.length === 0) {
    return {
      organizationCount: 0,
      propertyCount: 0,
      parkingCount: 0,
      memberSince,
    };
  }

  const [{ count: propertyCount }, { count: parkingCount }] = await Promise.all([
    supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .in('organization_id', orgIds),
    supabase
      .from('parkings')
      .select('id', { count: 'exact', head: true })
      .in('organization_id', orgIds),
  ]);

  return {
    organizationCount: orgIds.length,
    propertyCount: propertyCount ?? 0,
    parkingCount: parkingCount ?? 0,
    memberSince,
  };
}

export async function loadHostSummary(
  supabase: SupabaseClient,
  ownerId: string
): Promise<HostSummary> {
  const [profile, stats] = await Promise.all([
    loadAuthUserProfile(supabase, ownerId),
    hostStatsForOwner(supabase, ownerId),
  ]);

  return serializeHostSummary(ownerId, profile, stats, stats.memberSince);
}

export async function listDistinctHostOwnerIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from('organizations').select('owner_id');

  if (error) {
    console.error('[listDistinctHostOwnerIds]', error.message);
    throw new Error('Failed to list hosts');
  }

  return [...new Set((data ?? []).map((row) => row.owner_id as string).filter(Boolean))].sort();
}

type SuperAdminSearchHostsRow = {
  owner_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  organization_count: number;
  property_count: number;
  parking_count: number;
  member_since: string | null;
  total_count: number;
};

/**
 * Server-side searched + paginated host page, via the `super_admin_search_hosts`
 * RPC (joins organizations -> auth.users in SQL — PostgREST can't `.ilike()` on
 * auth.users directly, and name/email only exist there, not on `organizations`).
 */
export async function searchHostsPage(
  supabase: SupabaseClient,
  params: { search: string; page: number; limit: number }
): Promise<{ hosts: HostSummary[]; total: number }> {
  const fromIdx = (params.page - 1) * params.limit;

  const { data, error } = await supabase.rpc('super_admin_search_hosts', {
    search_query: params.search || null,
    page_limit: params.limit,
    page_offset: fromIdx,
  });

  if (error) {
    console.error('[searchHostsPage]', error.message);
    throw new Error('Failed to list hosts');
  }

  const rows = (data ?? []) as SuperAdminSearchHostsRow[];
  const total = rows[0]?.total_count ?? 0;

  const hosts = rows.map((row) =>
    serializeHostSummary(
      row.owner_id,
      { name: row.full_name, email: row.email, avatarUrl: row.avatar_url },
      {
        organizationCount: row.organization_count,
        propertyCount: row.property_count,
        parkingCount: row.parking_count,
      },
      row.member_since
    )
  );

  return { hosts, total };
}

export type HostsPlatformSummary = {
  total: number;
  totalOrgs: number;
  totalProperties: number;
  totalParking: number;
};

/**
 * Platform-wide summary cards — dimension-scoped `count(*)` queries instead of
 * fetching every host/org/property row into memory. Every org has a NOT NULL
 * owner_id and every property/parking belongs to an org, so `count(*)` on
 * organizations/properties/parkings already equals the sum across all hosts.
 * The only "fetch" here is the owner_id column (not full rows) to size the
 * distinct-host count.
 */
export async function loadHostsPlatformSummary(
  supabase: SupabaseClient
): Promise<HostsPlatformSummary> {
  const [ownerIdsResult, orgCountResult, propertyCountResult, parkingCountResult] =
    await Promise.all([
      supabase.from('organizations').select('owner_id'),
      supabase.from('organizations').select('id', { count: 'exact', head: true }),
      supabase.from('properties').select('id', { count: 'exact', head: true }),
      supabase.from('parkings').select('id', { count: 'exact', head: true }),
    ]);

  if (ownerIdsResult.error) {
    console.error('[loadHostsPlatformSummary] owners', ownerIdsResult.error.message);
    throw new Error('Failed to load host summary');
  }
  if (orgCountResult.error || propertyCountResult.error || parkingCountResult.error) {
    console.error(
      '[loadHostsPlatformSummary] counts',
      orgCountResult.error?.message ??
        propertyCountResult.error?.message ??
        parkingCountResult.error?.message
    );
    throw new Error('Failed to load host summary');
  }

  const distinctHostCount = new Set(
    (ownerIdsResult.data ?? []).map((row) => row.owner_id as string).filter(Boolean)
  ).size;

  return {
    total: distinctHostCount,
    totalOrgs: orgCountResult.count ?? 0,
    totalProperties: propertyCountResult.count ?? 0,
    totalParking: parkingCountResult.count ?? 0,
  };
}
