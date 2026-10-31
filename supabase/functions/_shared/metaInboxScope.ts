/**
 * Org-default vs property/parking Meta connection resolution for Guest Inbox.
 */

import { socialInboxDb } from './socialInboxDb.ts';
import type {
  InboxScopeFilter,
  MetaInboxScopeSource,
  SocialChannelConnectionRow,
} from './socialInboxTypes.ts';

export type EffectiveMetaConnection = {
  connection: SocialChannelConnectionRow | null;
  /** All Meta platform rows for the effective Page (facebook + optional instagram). */
  connections: SocialChannelConnectionRow[];
  source: MetaInboxScopeSource;
};

function isOrgDefault(c: SocialChannelConnectionRow): boolean {
  return !c.property_id && !c.parking_id;
}

/** Connected Facebook org-default for an org (property_id/parking_id null). */
export async function getOrgDefaultFacebookConnection(
  orgId: string
): Promise<SocialChannelConnectionRow | null> {
  const sb = socialInboxDb();
  const { data, error } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('organization_id', orgId)
    .eq('platform', 'facebook')
    .eq('status', 'connected')
    .is('property_id', null)
    .is('parking_id', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SocialChannelConnectionRow | null) ?? null;
}

export async function listOrgDefaultMetaConnections(
  orgId: string
): Promise<SocialChannelConnectionRow[]> {
  const sb = socialInboxDb();
  const { data, error } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('organization_id', orgId)
    .in('platform', ['facebook', 'instagram'])
    .is('property_id', null)
    .is('parking_id', null)
    .order('platform', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SocialChannelConnectionRow[];
}

export async function listPropertyOverrideMetaConnections(
  orgId: string,
  propertyId: string
): Promise<SocialChannelConnectionRow[]> {
  const sb = socialInboxDb();
  const { data, error } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('organization_id', orgId)
    .eq('property_id', propertyId)
    .in('platform', ['facebook', 'instagram'])
    .order('platform', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SocialChannelConnectionRow[];
}

export async function listParkingOverrideMetaConnections(
  orgId: string,
  parkingId: string
): Promise<SocialChannelConnectionRow[]> {
  const sb = socialInboxDb();
  const { data, error } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('organization_id', orgId)
    .eq('parking_id', parkingId)
    .in('platform', ['facebook', 'instagram'])
    .order('platform', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SocialChannelConnectionRow[];
}

/**
 * Effective Meta Page for a scope:
 * - property/parking with connected override → that override
 * - else → org default
 * - org scope (no property/parking) → org default
 */
export async function resolveEffectiveMetaConnection(
  orgId: string,
  scope: InboxScopeFilter = {}
): Promise<EffectiveMetaConnection> {
  if (scope.propertyId) {
    const override = await listPropertyOverrideMetaConnections(orgId, scope.propertyId);
    const connected = override.filter((c) => c.status === 'connected');
    if (connected.some((c) => c.platform === 'facebook')) {
      return {
        connection: connected.find((c) => c.platform === 'facebook') ?? connected[0] ?? null,
        connections: connected,
        source: 'property',
      };
    }
  }

  if (scope.parkingId) {
    const override = await listParkingOverrideMetaConnections(orgId, scope.parkingId);
    const connected = override.filter((c) => c.status === 'connected');
    if (connected.some((c) => c.platform === 'facebook')) {
      return {
        connection: connected.find((c) => c.platform === 'facebook') ?? connected[0] ?? null,
        connections: connected,
        source: 'parking',
      };
    }
  }

  const orgDefault = await listOrgDefaultMetaConnections(orgId);
  const connected = orgDefault.filter((c) => c.status === 'connected');
  return {
    connection: connected.find((c) => c.platform === 'facebook') ?? connected[0] ?? null,
    connections: connected,
    source: 'org',
  };
}

/** Connection ids to show Meta threads for in this scope (1A: inherited = org Page). */
export async function resolveMetaConnectionIdsForScope(
  orgId: string,
  scope: InboxScopeFilter = {}
): Promise<string[]> {
  const includeVisibleStatuses = (rows: SocialChannelConnectionRow[]) =>
    rows
      .filter((row) => row.status === 'connected' || row.status === 'disconnected')
      .map((row) => row.id);

  if (!scope.propertyId && !scope.parkingId) {
    // Org inbox: all Meta connections (org default + every override) so nothing is orphaned.
    const sb = socialInboxDb();
    const { data, error } = await sb
      .from('social_channel_connections')
      .select('id')
      .eq('organization_id', orgId)
      .in('platform', ['facebook', 'instagram'])
      .in('status', ['connected', 'disconnected']);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.id as string);
  }

  if (scope.propertyId) {
    const override = await listPropertyOverrideMetaConnections(orgId, scope.propertyId);
    const overrideIds = includeVisibleStatuses(override);
    if (overrideIds.length > 0) return overrideIds;
  }

  if (scope.parkingId) {
    const override = await listParkingOverrideMetaConnections(orgId, scope.parkingId);
    const overrideIds = includeVisibleStatuses(override);
    if (overrideIds.length > 0) return overrideIds;
  }

  return includeVisibleStatuses(await listOrgDefaultMetaConnections(orgId));
}

export function connectionScopeSource(c: SocialChannelConnectionRow): MetaInboxScopeSource {
  if (c.property_id) return 'property';
  if (c.parking_id) return 'parking';
  return 'org';
}

export { isOrgDefault };
