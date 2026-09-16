/**
 * Superhost quarterly assessment — evaluate org criteria and patch settings.superhost.
 */

import type { SupabaseClient } from './supabaseJs.ts';
import { verifyCronSecret } from './cronSecretGate.ts';

import { manilaNowIso, manilaTodayYmd } from './calendarAvailabilityManila.ts';
import { readOrgSuperhostFromSettings, type OrgSuperhostSettings } from './orgSuperhost.ts';
import { sendSuperhostEarnedEmail, sendSuperhostLostEmail } from './superhostNotifications.ts';
import {
  allSuperhostCriteriaMet,
  isSuperhostAssessmentDayYmd,
  loadAndComputeOrgSuperhostCriteria,
  nextSuperhostAssessmentAtIso,
  superhostAssessmentKeyFromYmd,
  type SuperhostCriteriaSnapshot,
} from './superhostMetrics.ts';
import { verifySuperAdminJwt } from './superAdminAuth.ts';

export type SuperhostAssessmentTrigger = 'cron' | 'manual';

export type SuperhostAssessmentResult = {
  orgId: string;
  assessmentKey: string;
  earned: boolean;
  previousEarned: boolean;
  criteria: SuperhostCriteriaSnapshot;
  skipped?: boolean;
  reason?: string;
};

function mergeSuperhostSettings(
  current: Record<string, unknown> | null | undefined,
  patch: Partial<
    OrgSuperhostSettings & {
      criteria: SuperhostCriteriaSnapshot;
      lastAssessmentKey: string;
      history?: unknown[];
    }
  >
): Record<string, unknown> {
  const base =
    current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
  const existing = readOrgSuperhostFromSettings(base);
  const raw = base.superhost;
  const prior =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};

  const next = {
    ...prior,
    ...existing,
    ...patch,
  };

  return { ...base, superhost: next };
}

export async function assessOrganizationSuperhost(
  supabase: SupabaseClient,
  orgId: string,
  opts: {
    trigger?: SuperhostAssessmentTrigger;
    asOfIso?: string;
    force?: boolean;
  } = {}
): Promise<SuperhostAssessmentResult> {
  const trigger = opts.trigger ?? 'manual';
  const asOfIso = opts.asOfIso ?? manilaNowIso();
  const asOfYmd = asOfIso.slice(0, 10);
  const assessmentKey = superhostAssessmentKeyFromYmd(asOfYmd);

  if (trigger === 'cron' && !opts.force && !isSuperhostAssessmentDayYmd(asOfYmd)) {
    return {
      orgId,
      assessmentKey,
      earned: false,
      previousEarned: false,
      criteria: await loadAndComputeOrgSuperhostCriteria(supabase, orgId, asOfIso),
      skipped: true,
      reason: 'not_assessment_day',
    };
  }

  const { data: existingRun } = await supabase
    .from('superhost_assessment_runs')
    .select('id, earned, criteria')
    .eq('organization_id', orgId)
    .eq('assessment_key', assessmentKey)
    .maybeSingle();

  if (existingRun?.id && trigger === 'cron' && !opts.force) {
    return {
      orgId,
      assessmentKey,
      earned: existingRun.earned === true,
      previousEarned: existingRun.earned === true,
      criteria: (existingRun.criteria ?? {}) as SuperhostCriteriaSnapshot,
      skipped: true,
      reason: 'already_assessed',
    };
  }

  const { data: orgRow, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, owner_id, settings')
    .eq('id', orgId)
    .maybeSingle();

  if (orgError) throw new Error(orgError.message);
  if (!orgRow) throw new Error('Organization not found');

  const settings =
    orgRow.settings && typeof orgRow.settings === 'object' && !Array.isArray(orgRow.settings)
      ? (orgRow.settings as Record<string, unknown>)
      : {};

  const previousEarned = readOrgSuperhostFromSettings(settings).earned === true;
  const criteria = await loadAndComputeOrgSuperhostCriteria(supabase, orgId, asOfIso);
  const earned = allSuperhostCriteriaMet(criteria);
  const assessedAt = new Date().toISOString();
  const nextAssessmentAt = nextSuperhostAssessmentAtIso(asOfYmd);

  const historyRaw = settings.superhost;
  const history =
    historyRaw && typeof historyRaw === 'object' && !Array.isArray(historyRaw)
      ? (((historyRaw as Record<string, unknown>).history as unknown[] | undefined) ?? [])
      : [];

  const historyEntry = {
    assessmentKey,
    assessedAt,
    earned,
    criteria,
  };

  const nextSettings = mergeSuperhostSettings(settings, {
    earned,
    earnedAt: earned
      ? previousEarned
        ? (readOrgSuperhostFromSettings(settings).earnedAt ?? assessedAt)
        : assessedAt
      : null,
    lastAssessmentAt: assessedAt,
    lastAssessmentKey: assessmentKey,
    nextAssessmentAt,
    criteria,
    history: [...history, historyEntry].slice(-8),
  });

  const { error: updateError } = await supabase
    .from('organizations')
    .update({ settings: nextSettings })
    .eq('id', orgId);

  if (updateError) throw new Error(updateError.message);

  const { error: runError } = await supabase.from('superhost_assessment_runs').upsert(
    {
      organization_id: orgId,
      assessment_key: assessmentKey,
      assessed_at: assessedAt,
      earned,
      criteria,
      previous_earned: previousEarned,
      trigger,
    },
    { onConflict: 'organization_id,assessment_key' }
  );

  if (runError) throw new Error(runError.message);

  if (earned && !previousEarned) {
    void sendSuperhostEarnedEmail({
      supabase,
      ownerId: String(orgRow.owner_id),
      organizationName: String(orgRow.name ?? 'your organization'),
    }).catch((err) => console.warn('[superhostAssessment] earned email:', err));
  } else if (!earned && previousEarned) {
    void sendSuperhostLostEmail({
      supabase,
      ownerId: String(orgRow.owner_id),
      organizationName: String(orgRow.name ?? 'your organization'),
    }).catch((err) => console.warn('[superhostAssessment] lost email:', err));
  }

  return {
    orgId,
    assessmentKey,
    earned,
    previousEarned,
    criteria,
  };
}

export async function runSuperhostAssessmentCron(
  supabase: SupabaseClient,
  opts: { force?: boolean } = {}
): Promise<{ assessed: number; earned: number; lost: number; skipped: number }> {
  const today = manilaTodayYmd();
  if (!opts.force && !isSuperhostAssessmentDayYmd(today)) {
    return { assessed: 0, earned: 0, lost: 0, skipped: 0 };
  }

  const asOfIso = manilaNowIso();

  const { data: orgRows, error } = await supabase.from('organizations').select('id');
  if (error) throw new Error(error.message);

  let assessed = 0;
  let earned = 0;
  let lost = 0;
  let skipped = 0;

  for (const row of orgRows ?? []) {
    const orgId = row.id as string;
    if (!orgId) continue;
    const result = await assessOrganizationSuperhost(supabase, orgId, {
      trigger: opts.force ? 'manual' : 'cron',
      force: opts.force,
      asOfIso,
    });
    if (result.skipped) {
      skipped += 1;
      continue;
    }
    assessed += 1;
    if (result.earned) earned += 1;
    if (result.previousEarned && !result.earned) lost += 1;
  }

  return { assessed, earned, lost, skipped };
}

export function verifySuperhostAssessmentCronSecret(req: Request): boolean {
  return verifyCronSecret(req, {
    envKey: 'SUPERHOST_ASSESSMENT_CRON_SECRET',
    headerName: 'x-superhost-assessment-cron-secret',
  });
}

/** pg_cron secret header, or super-admin JWT (Org subscriptions → Run Superhost cron). */
export async function verifySuperhostAssessmentCronAccess(req: Request): Promise<boolean> {
  if (verifySuperhostAssessmentCronSecret(req)) return true;
  try {
    await verifySuperAdminJwt(req);
    return true;
  } catch {
    return false;
  }
}
