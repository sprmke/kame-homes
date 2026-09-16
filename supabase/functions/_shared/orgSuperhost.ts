/**
 * Kame Superhost — earned org-level badge (Airbnb-style criteria).
 * Keep in sync with `ui/src/features/dashboard/org/lib/orgSuperhost.ts`.
 */

import type { SupabaseClient } from './supabaseJs.ts';

export type OrgSuperhostCriterionSnapshot = {
  value: number;
  required: number;
  met: boolean;
  sampleSize: number;
  metVia?: 'ten_stays' | 'hundred_nights' | null;
  totalNights?: number;
};

export type OrgSuperhostCriteriaSnapshot = {
  rating: OrgSuperhostCriterionSnapshot;
  responseRate: OrgSuperhostCriterionSnapshot;
  cancellationRate: OrgSuperhostCriterionSnapshot;
  activity: OrgSuperhostCriterionSnapshot;
};

export type OrgSuperhostSettings = {
  earned?: boolean;
  earnedAt?: string | null;
  lastAssessmentAt?: string | null;
  lastAssessmentKey?: string | null;
  nextAssessmentAt?: string | null;
  criteria?: OrgSuperhostCriteriaSnapshot;
};

export function readOrgSuperhostFromSettings(
  settings: Record<string, unknown> | null | undefined
): OrgSuperhostSettings {
  const raw = settings?.superhost;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  return {
    earned: row.earned === true,
    earnedAt: typeof row.earnedAt === 'string' ? row.earnedAt : null,
    lastAssessmentAt: typeof row.lastAssessmentAt === 'string' ? row.lastAssessmentAt : null,
    nextAssessmentAt: typeof row.nextAssessmentAt === 'string' ? row.nextAssessmentAt : null,
  };
}

export function isOrgSuperhostEarned(
  settings: Record<string, unknown> | null | undefined
): boolean {
  return readOrgSuperhostFromSettings(settings).earned === true;
}

/** Resolve earned Superhost flag for public listing cards (property → org). */
export async function batchLoadIsSuperhostByPropertyId(
  supabase: SupabaseClient,
  propertyIds: string[]
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (propertyIds.length === 0) return result;

  const { data: propertyRows, error: propertyError } = await supabase
    .from('properties')
    .select('id, organization_id')
    .in('id', propertyIds);

  if (propertyError) {
    console.warn('[orgSuperhost] property lookup failed:', propertyError.message);
    return result;
  }

  const orgIdByPropertyId = new Map<string, string>();
  const orgIds = new Set<string>();
  for (const row of propertyRows ?? []) {
    const propertyId = row.id as string | null;
    const organizationId = row.organization_id as string | null;
    if (!propertyId || !organizationId) continue;
    orgIdByPropertyId.set(propertyId, organizationId);
    orgIds.add(organizationId);
  }

  if (orgIds.size === 0) return result;

  const { data: orgRows, error: orgError } = await supabase
    .from('organizations')
    .select('id, settings')
    .in('id', [...orgIds]);

  if (orgError) {
    console.warn('[orgSuperhost] org lookup failed:', orgError.message);
    return result;
  }

  const earnedByOrgId = new Map<string, boolean>();
  for (const row of orgRows ?? []) {
    const orgId = row.id as string | null;
    if (!orgId) continue;
    const settings =
      row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings)
        ? (row.settings as Record<string, unknown>)
        : {};
    earnedByOrgId.set(orgId, isOrgSuperhostEarned(settings));
  }

  for (const propertyId of propertyIds) {
    const orgId = orgIdByPropertyId.get(propertyId);
    result.set(propertyId, orgId ? (earnedByOrgId.get(orgId) ?? false) : false);
  }

  return result;
}
