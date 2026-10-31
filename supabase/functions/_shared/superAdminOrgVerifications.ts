/**
 * Shared org verification queue rows for super-admin approvals.
 */

import { loadAuthUserProfile } from './authUserProfile.ts';
import { createServiceClient, type OrgRow } from './orgAuth.ts';
import { readOrgVerificationFromSettings } from './orgVerification.ts';
import {
  collectUnitConflictsForOrgProperties,
  listPropertyTowerUnitPeers,
  type PropertyTowerUnitPeer,
} from './propertyTowerUnit.ts';

export type OrgVerificationApprovalRow = {
  type: 'org_verification';
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  hostModes: string[];
  ownerName: string;
  ownerEmail: string;
  baseStatus: ReturnType<typeof readOrgVerificationFromSettings>['baseStatus'];
  baseSubmittedAt: string | null;
  baseRejectionReason: string | null;
  baseRejectionKind: ReturnType<typeof readOrgVerificationFromSettings>['baseRejectionKind'];
  enhancedStatus: ReturnType<typeof readOrgVerificationFromSettings>['enhancedStatus'];
  enhancedSubmittedAt: string | null;
  createdAt: string;
  unitConflicts: Awaited<ReturnType<typeof collectUnitConflictsForOrgProperties>>['unitConflicts'];
  hasActiveUnitConflict: boolean;
  propertyConsiderationStatus: ReturnType<
    typeof readOrgVerificationFromSettings
  >['propertyLifecycle']['consideration']['status'];
  parkingConsiderationStatus: ReturnType<
    typeof readOrgVerificationFromSettings
  >['parkingLifecycle']['consideration']['status'];
  hasPendingConsideration: boolean;
  propertyAccessLocked: boolean;
  parkingAccessLocked: boolean;
};

export type OrgVerificationApprovalRowFilters = {
  /** Narrows to orgs whose `host_modes` array includes this mode — pushed down via `.contains()`. */
  hostMode?: 'property' | 'parking';
};

export async function listOrgVerificationApprovalRows(
  filters: OrgVerificationApprovalRowFilters = {}
): Promise<OrgVerificationApprovalRow[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from('organizations')
    .select('id, name, slug, owner_id, host_modes, settings, created_at');

  if (filters.hostMode) {
    query = query.contains('host_modes', [filters.hostMode]);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[listOrgVerificationApprovalRows]', error.message);
    throw new Error('Failed to list organizations');
  }

  const rows = (data ?? []) as Pick<
    OrgRow,
    'id' | 'name' | 'slug' | 'owner_id' | 'host_modes' | 'settings' | 'created_at'
  >[];

  const submitted = rows.filter((row) => {
    const verification = readOrgVerificationFromSettings(row.settings);
    return verification.baseStatus !== 'none' || verification.enhancedStatus !== 'none';
  });

  const submittedIds = submitted.map((row) => row.id);
  const propsByOrg = new Map<
    string,
    Array<{ id: string; tower: string | null; unit_number: string | null }>
  >();
  const peersByPair = new Map<string, PropertyTowerUnitPeer[]>();

  if (submittedIds.length > 0) {
    const { data: propRows, error: propError } = await supabase
      .from('properties')
      .select('id, organization_id, tower, unit_number')
      .in('organization_id', submittedIds);

    if (propError) {
      console.error('[listOrgVerificationApprovalRows] properties:', propError.message);
      throw new Error('Failed to load organization properties');
    }

    const pairKeys = new Set<string>();
    for (const row of propRows ?? []) {
      const orgId = row.organization_id as string;
      const list = propsByOrg.get(orgId) ?? [];
      list.push({
        id: row.id as string,
        tower: (row.tower as string | null) ?? null,
        unit_number: (row.unit_number as string | null) ?? null,
      });
      propsByOrg.set(orgId, list);

      const tower = typeof row.tower === 'string' ? row.tower.trim() : '';
      const unitNumber = typeof row.unit_number === 'string' ? row.unit_number.trim() : '';
      if (tower && unitNumber) {
        pairKeys.add(`${tower}\0${unitNumber}`);
      }
    }

    await Promise.all(
      [...pairKeys].map(async (key) => {
        const [tower, unitNumber] = key.split('\0') as [string, string];
        peersByPair.set(key, await listPropertyTowerUnitPeers(supabase, tower, unitNumber));
      })
    );
  }

  const approvals = await Promise.all(
    submitted.map(async (row) => {
      const verification = readOrgVerificationFromSettings(row.settings);
      const owner = await loadAuthUserProfile(supabase, row.owner_id);
      const { unitConflicts, hasActiveUnitConflict } = await collectUnitConflictsForOrgProperties(
        supabase,
        row.id,
        propsByOrg.get(row.id) ?? [],
        peersByPair
      );
      return {
        type: 'org_verification' as const,
        organizationId: row.id,
        organizationName: row.name,
        organizationSlug: row.slug,
        hostModes: Array.isArray(row.host_modes) ? row.host_modes : [],
        ownerName: owner.name,
        ownerEmail: owner.email,
        baseStatus: verification.baseStatus,
        baseSubmittedAt: verification.baseSubmittedAt,
        baseRejectionReason: verification.baseRejectionReason,
        baseRejectionKind: verification.baseRejectionKind,
        enhancedStatus: verification.enhancedStatus,
        enhancedSubmittedAt: verification.enhancedSubmittedAt,
        createdAt: row.created_at,
        unitConflicts,
        hasActiveUnitConflict,
        propertyConsiderationStatus: verification.propertyLifecycle.consideration.status,
        parkingConsiderationStatus: verification.parkingLifecycle.consideration.status,
        hasPendingConsideration:
          verification.propertyLifecycle.consideration.status === 'pending' ||
          verification.parkingLifecycle.consideration.status === 'pending',
        propertyAccessLocked: Boolean(verification.propertyLifecycle.accessLockedAt),
        parkingAccessLocked: Boolean(verification.parkingLifecycle.accessLockedAt),
      };
    })
  );

  approvals.sort((a, b) => {
    const aRecommendedPending = a.enhancedStatus === 'pending' ? 1 : 0;
    const bRecommendedPending = b.enhancedStatus === 'pending' ? 1 : 0;
    if (bRecommendedPending !== aRecommendedPending) {
      return bRecommendedPending - aRecommendedPending;
    }
    const aTime = a.enhancedSubmittedAt ?? a.baseSubmittedAt ?? '';
    const bTime = b.enhancedSubmittedAt ?? b.baseSubmittedAt ?? '';
    return bTime.localeCompare(aTime);
  });

  return approvals;
}
