/**
 * Listing verification queue rows for super-admin approvals.
 */

import { loadAuthUserProfile } from './authUserProfile.ts';
import { createServiceClient } from './orgAuth.ts';
import {
  resolveListingAuthorization,
  type ListingAuthorizationRejectionKind,
  type ListingAuthorizationStatus,
  type ListingKind,
} from './listingAuthorization.ts';
import { listPropertyTowerUnitPeers, type UnitConflict } from './propertyTowerUnit.ts';
import type { OrgVerificationRights } from './orgVerification.ts';

export type ListingVerificationApprovalRow = {
  type: 'listing_verification';
  listingKind: ListingKind;
  listingId: string;
  listingName: string;
  listingSlug: string;
  listingStatus: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  ownerName: string;
  ownerEmail: string;
  relationship: OrgVerificationRights | null;
  contractEndDate: string | null;
  baseStatus: ListingAuthorizationStatus;
  baseSubmittedAt: string | null;
  baseRejectionReason: string | null;
  baseRejectionKind: ListingAuthorizationRejectionKind | null;
  recommendedStatus: ListingAuthorizationStatus;
  recommendedSubmittedAt: string | null;
  recommendedRejectionReason: string | null;
  recommendedRejectionKind: ListingAuthorizationRejectionKind | null;
  tower: string | null;
  unitNumber: string | null;
  unitConflicts: UnitConflict[];
  hasActiveUnitConflict: boolean;
};

type OrgJoin = {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  settings: Record<string, unknown> | null;
};

type PropertyRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  tower: string | null;
  unit_number: string | null;
  settings: Record<string, unknown> | null;
  organization_id: string;
  organizations: OrgJoin;
};

type ParkingRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown> | null;
  organization_id: string;
  organizations: OrgJoin;
};

async function unitConflictsForProperty(
  supabase: ReturnType<typeof createServiceClient>,
  property: PropertyRow,
  orgId: string
): Promise<UnitConflict[]> {
  const tower = typeof property.tower === 'string' ? property.tower.trim() : '';
  const unitNumber = typeof property.unit_number === 'string' ? property.unit_number.trim() : '';
  if (!tower || !unitNumber) return [];

  const peers = await listPropertyTowerUnitPeers(supabase, tower, unitNumber, property.id);
  const conflicts: UnitConflict[] = [];
  for (const peer of peers) {
    if (peer.status !== 'ACTIVE') continue;
    if (!peer.organizationId || peer.organizationId === orgId) continue;
    conflicts.push({
      propertyId: peer.id,
      organizationId: peer.organizationId,
      orgName: peer.orgName ?? '',
      status: peer.status,
      tower,
      unitNumber,
    });
  }
  return conflicts;
}

async function buildListingRow(
  supabase: ReturnType<typeof createServiceClient>,
  listingKind: ListingKind,
  row: PropertyRow | ParkingRow,
  ownerCache: Map<string, Awaited<ReturnType<typeof loadAuthUserProfile>>>
): Promise<ListingVerificationApprovalRow | null> {
  const org = row.organizations;
  if (!org) return null;

  const authorization = resolveListingAuthorization(row.settings, org.settings, listingKind);
  if (authorization.baseStatus === 'none' && authorization.recommendedStatus === 'none') {
    return null;
  }

  let owner = ownerCache.get(org.owner_id);
  if (!owner) {
    owner = await loadAuthUserProfile(supabase, org.owner_id);
    ownerCache.set(org.owner_id, owner);
  }

  const tower =
    listingKind === 'property' && 'tower' in row
      ? (typeof row.tower === 'string' ? row.tower.trim() : '') || null
      : null;
  const unitNumber =
    listingKind === 'property' && 'unit_number' in row
      ? (typeof row.unit_number === 'string' ? row.unit_number.trim() : '') || null
      : null;

  const unitConflicts =
    listingKind === 'property' && authorization.baseStatus === 'pending'
      ? await unitConflictsForProperty(supabase, row as PropertyRow, org.id)
      : [];

  return {
    type: 'listing_verification',
    listingKind,
    listingId: row.id,
    listingName: row.name,
    listingSlug: row.slug,
    listingStatus: row.status,
    organizationId: org.id,
    organizationName: org.name,
    organizationSlug: org.slug,
    ownerName: owner.name,
    ownerEmail: owner.email,
    relationship: authorization.relationship,
    contractEndDate: authorization.contractEndDate,
    baseStatus: authorization.baseStatus,
    baseSubmittedAt: authorization.baseSubmittedAt,
    baseRejectionReason: authorization.baseRejectionReason,
    baseRejectionKind: authorization.baseRejectionKind,
    recommendedStatus: authorization.recommendedStatus,
    recommendedSubmittedAt: authorization.recommendedSubmittedAt,
    recommendedRejectionReason: authorization.recommendedRejectionReason,
    recommendedRejectionKind: authorization.recommendedRejectionKind,
    tower,
    unitNumber,
    unitConflicts,
    hasActiveUnitConflict: unitConflicts.length > 0,
  };
}

export async function listListingVerificationApprovalRows(): Promise<
  ListingVerificationApprovalRow[]
> {
  const supabase = createServiceClient();

  const [propertiesResult, parkingsResult] = await Promise.all([
    supabase
      .from('properties')
      .select(
        'id, name, slug, status, tower, unit_number, settings, organization_id, organizations!inner(id, name, slug, owner_id, settings)'
      )
      .order('name', { ascending: true }),
    supabase
      .from('parkings')
      .select(
        'id, name, slug, status, settings, organization_id, organizations!inner(id, name, slug, owner_id, settings)'
      )
      .order('name', { ascending: true }),
  ]);

  if (propertiesResult.error || parkingsResult.error) {
    console.error(
      '[listListingVerificationApprovalRows]',
      propertiesResult.error?.message ?? parkingsResult.error?.message
    );
    throw new Error('Failed to load listing verifications');
  }

  const ownerCache = new Map<string, Awaited<ReturnType<typeof loadAuthUserProfile>>>();
  const rows: ListingVerificationApprovalRow[] = [];

  for (const row of (propertiesResult.data ?? []) as PropertyRow[]) {
    const built = await buildListingRow(supabase, 'property', row, ownerCache);
    if (built) rows.push(built);
  }
  for (const row of (parkingsResult.data ?? []) as ParkingRow[]) {
    const built = await buildListingRow(supabase, 'parking', row, ownerCache);
    if (built) rows.push(built);
  }

  rows.sort((a, b) => {
    const aRecommendedPending = a.recommendedStatus === 'pending' ? 1 : 0;
    const bRecommendedPending = b.recommendedStatus === 'pending' ? 1 : 0;
    if (bRecommendedPending !== aRecommendedPending) {
      return bRecommendedPending - aRecommendedPending;
    }
    const aBasePending = a.baseStatus === 'pending' ? 1 : 0;
    const bBasePending = b.baseStatus === 'pending' ? 1 : 0;
    if (bBasePending !== aBasePending) return bBasePending - aBasePending;
    const aTime = a.recommendedSubmittedAt ?? a.baseSubmittedAt ?? '';
    const bTime = b.recommendedSubmittedAt ?? b.baseSubmittedAt ?? '';
    return bTime.localeCompare(aTime);
  });

  return rows;
}
