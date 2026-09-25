/**
 * analytics-ai-review — Host Analytics Phase 3.
 * GET: latest review for the property (or null). POST: regenerate on demand (rate-limited,
 * feature + AI-quota gated). Advisory only — never mutates a rate or setting.
 */

import { logActivity } from '../_shared/activityLog.ts';
import { computeAnalyticsBundle } from '../_shared/analyticsService.ts';
import {
  maybeRunAnalyticsAiReview,
  writeLatestAnalyticsReview,
} from '../_shared/analyticsAiReview.ts';
import { manilaTodayIso } from '../_shared/bookingsListSort.ts';
import { matchPlaybookArticles } from '../_shared/hostPlaybook.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { readPropertyIdFromUrl, resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { rateLimitGate } from '../_shared/rateLimit.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadRecentActivitySummaries(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  organizationId: string,
  propertyId: string,
  since: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('created_at, category, summary')
    .eq('organization_id', organizationId)
    .eq('property_id', propertyId)
    .in('category', ['pricing', 'booking', 'public_pages'])
    .gte('created_at', `${since}T00:00:00Z`)
    .order('created_at', { ascending: false })
    .limit(15);
  if (error) throw new Error(error.message);

  return (data ?? []).map(
    (row: { created_at: string; summary: string }) =>
      `${row.created_at.slice(0, 10)}: ${row.summary}`
  );
}

serveAuthenticated('analytics-ai-review', async (req) => {
  const url = new URL(req.url);
  const explicitPropertyId = readPropertyIdFromUrl(url);
  const { property, org, user } = await resolveScopedPropertyAccess(
    req,
    'analytics:view',
    explicitPropertyId
  );

  const supabase = createServiceClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('property_analytics_reviews')
      .select('id, generated_at, model, headline, score, score_delta, payload')
      .eq('property_id', property.id)
      .eq('is_latest', true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return jsonSuccess(req, { review: data ?? null });
  }

  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  try {
    await requirePropertyFeature(property.id, 'analyticsInsights');
  } catch (err) {
    const gate = catchPlanFeatureError(req, err);
    if (gate) return gate;
    throw err;
  }

  const limited = await rateLimitGate(req, {
    scope: 'analytics_ai_review_regenerate',
    identity: property.id,
    limit: 1,
    windowSec: 3600,
  });
  if (limited) return limited;

  const today = manilaTodayIso();
  const from = addDaysIso(today, -29);
  const bundle = await computeAnalyticsBundle({ propertyId: property.id, from, to: today });

  const [activitySummaries, previous, playbookArticles] = await Promise.all([
    loadRecentActivitySummaries(supabase, org.id, property.id, from),
    supabase
      .from('property_analytics_reviews')
      .select('score')
      .eq('property_id', property.id)
      .eq('is_latest', true)
      .maybeSingle(),
    matchPlaybookArticles(bundle).catch(() => []),
  ]);

  const result = await maybeRunAnalyticsAiReview({
    organizationId: org.id,
    propertyId: property.id,
    propertyName: property.name,
    orgSlug: org.slug,
    propertySlug: property.slug,
    bundle,
    activitySummaries,
    playbookArticles: playbookArticles.map((a) => ({ slug: a.slug, title: a.title })),
  });

  if (!result) {
    return jsonSuccess(req, { review: null, available: false });
  }

  const previousScore = previous.data?.score ?? null;
  const scoreDelta = previousScore != null ? result.output.score - previousScore : null;

  const inserted = await writeLatestAnalyticsReview(supabase, {
    propertyId: property.id,
    organizationId: org.id,
    periodStart: bundle.period.from,
    periodEnd: bundle.period.to,
    generatedBy: user.id,
    model: result.model,
    output: result.output,
    scoreDelta,
    metricsSnapshot: { kpis: bundle.kpis, stateAssessment: bundle.stateAssessment },
  });

  await logActivity({
    action: 'analytics.review_regenerated',
    organizationId: org.id,
    propertyId: property.id,
    actor: {
      actorType: 'team_member',
      source: 'dashboard',
      userId: user.id,
      email: user.email,
    },
    targetType: 'property_analytics_review',
    targetId: inserted.id,
    targetLabel: property.name,
  });

  return jsonSuccess(req, { review: inserted, available: true });
});
