import type { SupabaseClient } from './supabaseJs.ts';
import {
  ALL_PROPERTY_TOWERS,
  DEFAULT_RESIDENCE_NAME,
  getTowersForResidence,
  isTowerInResidence,
} from './propertyResidences.ts';

export { isTowerInResidence } from './propertyResidences.ts';

export const PROPERTY_TOWERS = ALL_PROPERTY_TOWERS;
export type PropertyTower = (typeof ALL_PROPERTY_TOWERS)[number];

export function isPropertyTower(value: string): value is PropertyTower {
  return (ALL_PROPERTY_TOWERS as readonly string[]).includes(value);
}

export function isValidUnitNumber(value: string): boolean {
  return /^\d{4}$/.test(value.trim());
}

export function formatTowerAndUnit(tower: string, unitNumber: string): string {
  return `${tower} ${unitNumber.trim()}`;
}

export type ParsedPropertyTowerUnit =
  | {
      ok: true;
      tower: PropertyTower;
      unitNumber: string;
      towerAndUnit: string;
    }
  | { ok: false; error: string };

function towerValidationError(residenceName: string): string {
  const towers = getTowersForResidence(residenceName);
  if (towers.length > 0) {
    return `Tower must be one of: ${towers.join(', ')}`;
  }
  return 'Tower is not valid for the selected residence';
}

/** Parse tower + unitNumber from request body (preferred) or legacy towerAndUnit. */
export function parsePropertyTowerUnitFromBody(
  body: Record<string, unknown>,
  options?: { residenceName?: string | null }
): ParsedPropertyTowerUnit {
  const residenceName =
    options?.residenceName?.trim() ||
    (typeof body.residenceName === 'string' ? body.residenceName.trim() : '') ||
    DEFAULT_RESIDENCE_NAME;

  const towerRaw = typeof body.tower === 'string' ? body.tower.trim() : '';
  const unitRaw = typeof body.unitNumber === 'string' ? body.unitNumber.trim() : '';

  const towerIsValid = (tower: string) =>
    residenceName ? isTowerInResidence(tower, residenceName) : isPropertyTower(tower);

  if (towerRaw || unitRaw) {
    if (!towerRaw || !unitRaw) {
      return { ok: false, error: 'Tower and unit number are both required' };
    }
    if (!towerIsValid(towerRaw)) {
      return { ok: false, error: towerValidationError(residenceName) };
    }
    if (!isValidUnitNumber(unitRaw)) {
      return { ok: false, error: 'Unit must be a 4-digit number' };
    }
    return {
      ok: true,
      tower: towerRaw as PropertyTower,
      unitNumber: unitRaw,
      towerAndUnit: formatTowerAndUnit(towerRaw, unitRaw),
    };
  }

  const legacy = typeof body.towerAndUnit === 'string' ? body.towerAndUnit.trim() : '';
  if (!legacy) {
    return { ok: false, error: 'Tower and unit number are required' };
  }

  for (const tower of ALL_PROPERTY_TOWERS) {
    const match = legacy.match(new RegExp(`^${tower}\\s+(\\d{4})$`));
    if (match) {
      if (!towerIsValid(tower)) {
        return { ok: false, error: towerValidationError(residenceName) };
      }
      return {
        ok: true,
        tower,
        unitNumber: match[1]!,
        towerAndUnit: formatTowerAndUnit(tower, match[1]!),
      };
    }
  }

  return {
    ok: false,
    error: 'Unit must use a valid tower and a 4-digit unit number',
  };
}

export type PropertyTowerUnitPeer = {
  id: string;
  name: string;
  status: string;
  organizationId: string | null;
  orgName: string | null;
};

function orgNameFromJoin(
  organizations: { name?: string } | { name?: string }[] | null | undefined
): string | null {
  if (!organizations) return null;
  return Array.isArray(organizations)
    ? (organizations[0]?.name ?? null)
    : (organizations.name ?? null);
}

/** ACTIVE peer only — at most one public listing per tower+unit. */
export async function lookupPropertyTowerUnitConflict(
  supabase: SupabaseClient,
  tower: string,
  unitNumber: string,
  excludePropertyId?: string
): Promise<{ id: string; name: string; orgName: string | null } | null> {
  let query = supabase
    .from('properties')
    .select('id, name, organizations(name)')
    .eq('tower', tower)
    .eq('unit_number', unitNumber)
    .eq('status', 'ACTIVE')
    .limit(1);

  if (excludePropertyId) {
    query = query.neq('id', excludePropertyId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[propertyTowerUnit] conflict lookup:', error.message);
    throw new Error('Failed to verify tower and unit availability');
  }

  const row = data?.[0];
  if (!row) return null;

  return {
    id: row.id as string,
    name: row.name as string,
    orgName: orgNameFromJoin(row.organizations as { name?: string } | { name?: string }[] | null),
  };
}

export async function findPropertyTowerUnitConflict(
  supabase: SupabaseClient,
  tower: string,
  unitNumber: string,
  excludePropertyId?: string
): Promise<boolean> {
  const conflict = await lookupPropertyTowerUnitConflict(
    supabase,
    tower,
    unitNumber,
    excludePropertyId
  );
  return conflict !== null;
}

/** All properties sharing tower+unit (any status), for Approvals succession peers. */
export async function listPropertyTowerUnitPeers(
  supabase: SupabaseClient,
  tower: string,
  unitNumber: string,
  excludePropertyId?: string
): Promise<PropertyTowerUnitPeer[]> {
  let query = supabase
    .from('properties')
    .select('id, name, status, organization_id, organizations(name)')
    .eq('tower', tower)
    .eq('unit_number', unitNumber)
    .order('status', { ascending: true });

  if (excludePropertyId) {
    query = query.neq('id', excludePropertyId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[propertyTowerUnit] peer list:', error.message);
    throw new Error('Failed to list tower and unit peers');
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    status: String(row.status ?? ''),
    organizationId: (row.organization_id as string | null) ?? null,
    orgName: orgNameFromJoin(row.organizations as { name?: string } | { name?: string }[] | null),
  }));
}

/** ACTIVE listing at the same tower+unit owned by another organization (Approvals succession). */
export type UnitConflict = {
  propertyId: string;
  organizationId: string;
  orgName: string;
  status: string;
  tower: string;
  unitNumber: string;
};

function peerToUnitConflict(
  peer: PropertyTowerUnitPeer,
  tower: string,
  unitNumber: string,
  statusOverride?: string
): UnitConflict | null {
  if (!peer.organizationId) return null;
  return {
    propertyId: peer.id,
    organizationId: peer.organizationId,
    orgName: peer.orgName ?? '',
    status: statusOverride ?? peer.status,
    tower,
    unitNumber,
  };
}

/**
 * ACTIVE peers for an org's tower+unit properties (other orgs only).
 * Dedupes by propertyId across the org's listings.
 */
export async function collectUnitConflictsForOrgProperties(
  supabase: SupabaseClient,
  organizationId: string,
  properties: Array<{ id: string; tower: string | null; unit_number: string | null }>,
  peersByPair?: Map<string, PropertyTowerUnitPeer[]>
): Promise<{ unitConflicts: UnitConflict[]; hasActiveUnitConflict: boolean }> {
  const unitConflicts: UnitConflict[] = [];
  const seen = new Set<string>();

  for (const prop of properties) {
    const tower = typeof prop.tower === 'string' ? prop.tower.trim() : '';
    const unitNumber = typeof prop.unit_number === 'string' ? prop.unit_number.trim() : '';
    if (!tower || !unitNumber) continue;

    const pairKey = `${tower}\0${unitNumber}`;
    const peers =
      peersByPair?.get(pairKey) ??
      (await listPropertyTowerUnitPeers(supabase, tower, unitNumber, prop.id));

    for (const peer of peers) {
      if (peer.id === prop.id) continue;
      if (peer.status !== 'ACTIVE') continue;
      if (peer.organizationId === organizationId) continue;
      if (seen.has(peer.id)) continue;
      const conflict = peerToUnitConflict(peer, tower, unitNumber);
      if (!conflict) continue;
      seen.add(peer.id);
      unitConflicts.push(conflict);
    }
  }

  return {
    unitConflicts,
    hasActiveUnitConflict: unitConflicts.length > 0,
  };
}

export type ActivatePropertyResult = {
  activatedPropertyIds: string[];
  archivedPeers: UnitConflict[];
};

/**
 * Listing Tier 1 approve handoff: archive other ACTIVE listings sharing this property's
 * tower+unit, then set this property ACTIVE. Ordering satisfies the partial unique index.
 */
export async function activatePropertyAfterListingApproval(
  supabase: SupabaseClient,
  propertyId: string
): Promise<ActivatePropertyResult> {
  const { data, error } = await supabase
    .from('properties')
    .select('id, tower, unit_number, status')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    console.error('[propertyTowerUnit] load property:', error.message);
    throw new Error('Failed to load property');
  }
  if (!data) throw new Error('Property not found');

  const tower = typeof data.tower === 'string' ? data.tower.trim() : '';
  const unitNumber = typeof data.unit_number === 'string' ? data.unit_number.trim() : '';
  const status = String(data.status ?? '');

  // No tower+unit identity to contest — activate directly.
  if (!tower || !unitNumber) {
    if (status !== 'ACTIVE') {
      const { error: activateError } = await supabase
        .from('properties')
        .update({ status: 'ACTIVE' })
        .eq('id', propertyId);
      if (activateError) {
        console.error('[propertyTowerUnit] activate property:', activateError.message);
        throw new Error('Failed to activate property after verification approve');
      }
    }
    return { activatedPropertyIds: [propertyId], archivedPeers: [] };
  }

  const archivedPeers: UnitConflict[] = [];
  const peers = await listPropertyTowerUnitPeers(supabase, tower, unitNumber, propertyId);

  for (const peer of peers) {
    if (peer.status !== 'ACTIVE') continue;

    const { error: archiveError } = await supabase
      .from('properties')
      .update({ status: 'INACTIVE' })
      .eq('id', peer.id)
      .eq('status', 'ACTIVE');

    if (archiveError) {
      console.error('[propertyTowerUnit] archive peer:', archiveError.message);
      throw new Error('Failed to archive peer property for unit handoff');
    }

    const archived = peerToUnitConflict(peer, tower, unitNumber, 'INACTIVE');
    if (archived) archivedPeers.push(archived);
  }

  if (status !== 'ACTIVE') {
    const { error: activateError } = await supabase
      .from('properties')
      .update({ status: 'ACTIVE' })
      .eq('id', propertyId);

    if (activateError) {
      if (activateError.code === '23505') {
        throw new Error(DUPLICATE_TOWER_UNIT_MESSAGE);
      }
      console.error('[propertyTowerUnit] activate property:', activateError.message);
      throw new Error('Failed to activate property after verification approve');
    }
  }

  return { activatedPropertyIds: [propertyId], archivedPeers };
}

export const DUPLICATE_TOWER_UNIT_MESSAGE =
  'Another organization already has an active listing for this tower and unit';
