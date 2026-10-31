/**
 * Kame Superhost — earned org-level badge.
 * Mirrors `supabase/functions/_shared/orgSuperhost.ts`.
 */

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
