/**
 * analytics-ai-review-cron — weekly AI Performance Review sweep.
 * Plan: docs/workflow/in-progress/host-analytics-module.md (Phase 3)
 * Schedule: hosted pg_cron + pg_net (see docs/archive/operations/scheduled-jobs-and-testing.md),
 * NOT config.toml. Optional header X-Analytics-Ai-Review-Cron-Secret when
 * ANALYTICS_AI_REVIEW_CRON_SECRET is set.
 *
 * For every ACTIVE property with a live `analyticsInsights` entitlement AND enough booking
 * history: regenerate the AI Performance Review (oldest-reviewed-first), set is_latest, and
 * notify the org on a material score change. Idempotent — safe to re-run.
 */

import {
  maybeRunAnalyticsAiReview,
  writeLatestAnalyticsReview,
} from '../_shared/analyticsAiReview.ts';
import { computeAnalyticsBundle } from '../_shared/analyticsService.ts';
import { manilaTodayIso } from '../_shared/bookingsListSort.ts';
import { matchPlaybookArticles } from '../_shared/hostPlaybook.ts';
import { createOrCoalesceNotification } from '../_shared/notificationService.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolvePropertyEntitlements } from '../_shared/planEntitlements.ts';
import { serveCronPost } from '../_shared/serveEdge.ts';
import { verifyCronSecret } from '../_shared/cronSecretGate.ts';

const BATCH = 50;
const TIME_BUDGET_MS = 55_000;
/** Notify only when the score actually moved meaningfully. */
const NOTIFY_MIN_SCORE_DELTA = 8;

function cronSecretOk(req: Request): boolean {
  // Fail-closed in production when the secret is unset (shared gate) — never burn AI credits or
  // run destructive jobs for an anonymous caller.
  return verifyCronSecret(req, { envKey: 'ANALYTICS_AI_REVIEW_CRON_SECRET', headerName: 'x-analytics-ai-review-cron-secret' });
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

serveCronPost('analytics-ai-review-cron', cronSecretOk, async () => {
  const supabase = createServiceClient();
  const startedAt = Date.now();
  const today = manilaTodayIso();
  const from = addDaysIso(today, -29);

  const { data: properties, error: propertiesError } = await supabase
    .from('properties')
    .select('id, organization_id, name, slug')
    .eq('status', 'ACTIVE')
    // Postgres gives no ordering guarantee without this — without a deterministic tie-break,
    // properties that tie on lastGeneratedAt (every property, before any review has ever been
    // generated) sort in whatever order the query happened to return, which is not guaranteed
    // stable across runs. `id` just needs to be *some* fixed order so "oldest-reviewed-first"
    // actually cycles through every property over successive weekly runs instead of favoring
    // whatever the DB's default scan order surfaces first every time.
    .order('id', { ascending: true })
    .limit(500);
  if (propertiesError) throw new Error(propertiesError.message);

  const { data: latestReviews, error: reviewsError } = await supabase
    .from('property_analytics_reviews')
    .select('property_id, generated_at, score')
    .eq('is_latest', true);
  if (reviewsError) throw new Error(reviewsError.message);

  const latestByProperty = new Map(
    (latestReviews ?? []).map((r: { property_id: string; generated_at: string; score: number }) => [
      r.property_id,
      r,
    ])
  );

  const candidates = (properties ?? [])
    .map((p) => ({ ...p, lastGeneratedAt: latestByProperty.get(p.id)?.generated_at ?? null }))
    .sort((a, b) => {
      if (a.lastGeneratedAt === b.lastGeneratedAt) return 0;
      if (!a.lastGeneratedAt) return -1;
      if (!b.lastGeneratedAt) return 1;
      return a.lastGeneratedAt.localeCompare(b.lastGeneratedAt);
    })
    .slice(0, BATCH);

  const orgIds = [...new Set(candidates.map((p) => p.organization_id))];
  const { data: orgs, error: orgsError } = await supabase
    .from('organizations')
    .select('id, slug')
    .in('id', orgIds.length > 0 ? orgIds : ['00000000-0000-0000-0000-000000000000']);
  if (orgsError) throw new Error(orgsError.message);
  const orgSlugById = new Map(
    (orgs ?? []).map((o: { id: string; slug: string }) => [o.id, o.slug])
  );

  let processed = 0;
  let generated = 0;
  let notified = 0;
  let skippedNotEntitled = 0;
  let skippedInsufficientData = 0;
  const errors: Array<{ propertyId: string; error: string }> = [];

  for (const property of candidates) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break;

    try {
      const entitlements = await resolvePropertyEntitlements(property.id);
      if (entitlements.analyticsInsights !== true) {
        skippedNotEntitled += 1;
        continue;
      }

      const bundle = await computeAnalyticsBundle({ propertyId: property.id, from, to: today });
      if (!bundle.sufficiency.enough) {
        skippedInsufficientData += 1;
        continue;
      }

      const orgSlug = orgSlugById.get(property.organization_id);
      if (!orgSlug) continue;

      const { data: activityRows } = await supabase
        .from('activity_log')
        .select('created_at, summary')
        .eq('organization_id', property.organization_id)
        .eq('property_id', property.id)
        .in('category', ['pricing', 'booking', 'public_pages'])
        .gte('created_at', `${from}T00:00:00Z`)
        .order('created_at', { ascending: false })
        .limit(15);
      const activitySummaries = (activityRows ?? []).map(
        (row: { created_at: string; summary: string }) =>
          `${row.created_at.slice(0, 10)}: ${row.summary}`
      );

      const playbookArticles = await matchPlaybookArticles(bundle).catch(() => []);

      const result = await maybeRunAnalyticsAiReview({
        organizationId: property.organization_id,
        propertyId: property.id,
        propertyName: property.name,
        orgSlug,
        propertySlug: property.slug,
        bundle,
        activitySummaries,
        playbookArticles: playbookArticles.map((a) => ({ slug: a.slug, title: a.title })),
      });
      processed += 1;
      if (!result) continue;

      const previousScore = latestByProperty.get(property.id)?.score ?? null;
      const scoreDelta = previousScore != null ? result.output.score - previousScore : null;

      const inserted = await writeLatestAnalyticsReview(supabase, {
        propertyId: property.id,
        organizationId: property.organization_id,
        periodStart: bundle.period.from,
        periodEnd: bundle.period.to,
        generatedBy: null,
        model: result.model,
        output: result.output,
        scoreDelta,
        metricsSnapshot: { kpis: bundle.kpis, stateAssessment: bundle.stateAssessment },
      });

      generated += 1;

      if (scoreDelta != null && Math.abs(scoreDelta) >= NOTIFY_MIN_SCORE_DELTA) {
        const sign = scoreDelta >= 0 ? '+' : '';
        await createOrCoalesceNotification({
          organizationId: property.organization_id,
          propertyId: property.id,
          type: 'analytics_review_updated',
          title: 'Your Analytics performance review updated',
          body: `Score moved ${sign}${scoreDelta} points. ${result.output.headline}`,
          dedupeKey: `analytics_review:${property.id}:${today}`,
          metadata: { score: result.output.score, scoreDelta, reviewId: inserted.id },
        });
        notified += 1;
      }
    } catch (err) {
      errors.push({ propertyId: property.id, error: (err as Error).message });
    }
  }

  return {
    candidates: candidates.length,
    processed,
    generated,
    notified,
    skippedNotEntitled,
    skippedInsufficientData,
    errors,
  };
});
