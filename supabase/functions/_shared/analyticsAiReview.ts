/**
 * AI Performance Review — Host Analytics Phase 3.
 *
 * Takes the deterministic AnalyticsBundle (incl. the state-assessment axes) + recent
 * activity_log evidence and asks Gemini for a headline score, strengths, improvements, and
 * things to avoid — each grounded in the actual numbers, state-appropriate (yield guidance
 * when fully booked, not a generic occupancy-boosting tip), and citing *why* a metric moved
 * when a matching activity_log event exists. Advisory only — NEVER writes a setting or rate.
 * Any failure (no keys, quota, kill switch, invalid output) -> null; caller shows the
 * deterministic bundle only. Calls go through the AI gateway (_shared/ai/llmClient.ts).
 */

import { z } from 'zod';

import { generateStructured } from './ai/llmClient.ts';
import { definePrompt } from './ai/prompt.ts';
import type { AnalyticsBundle } from './analyticsService.ts';
import { assertOrgAndPropertyAiQuota } from './aiUsageService.ts';

const FEATURE = 'host_analytics' as const;

export const ANALYTICS_REVIEW_PROMPT = definePrompt({
  id: 'host_analytics_review',
  version: '2026-09-24.1',
});

/** Small allow-list the model picks from — never lets it emit an arbitrary URL. */
export const ANALYTICS_DEEP_LINK_ROUTES = {
  pricing: 'pricing',
  analytics: 'analytics',
  marketing: 'marketing',
  public_pages: 'public-pages',
  settings: 'settings',
  inbox: 'inbox',
  none: null,
} as const;

export type AnalyticsDeepLinkRouteKey = keyof typeof ANALYTICS_DEEP_LINK_ROUTES;

const ROUTE_KEY_ENUM = Object.keys(ANALYTICS_DEEP_LINK_ROUTES);

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    score: { type: 'NUMBER' },
    strengths: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          evidence: { type: 'STRING' },
        },
        required: ['title', 'evidence'],
      },
    },
    improvements: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          why: { type: 'STRING' },
          action: { type: 'STRING' },
          expectedImpact: { type: 'STRING' },
          deepLinkRoute: { type: 'STRING', enum: ROUTE_KEY_ENUM },
          articleSlugs: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description:
              'Slugs from the provided Playbook article list only, when directly relevant.',
          },
        },
        required: ['title', 'why', 'action', 'deepLinkRoute'],
      },
    },
    avoid: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          why: { type: 'STRING' },
          deepLinkRoute: { type: 'STRING', enum: ROUTE_KEY_ENUM },
        },
        required: ['title', 'why', 'deepLinkRoute'],
      },
    },
  },
  required: ['headline', 'score', 'strengths', 'improvements', 'avoid'],
} as const;

export type AnalyticsAiReviewItem = {
  title: string;
  why?: string;
  evidence?: string;
  action?: string;
  expectedImpact?: string;
  deepLink: string | null;
  /** Allow-listed Playbook article slugs this item cites — never trusted from the model as-is. */
  articleSlugs?: string[];
};

export type AnalyticsPlaybookHint = { slug: string; title: string };

export type AnalyticsAiReviewOutput = {
  headline: string;
  score: number;
  strengths: Array<{ title: string; evidence: string }>;
  improvements: AnalyticsAiReviewItem[];
  avoid: AnalyticsAiReviewItem[];
};

export type AnalyticsAiReviewResult = {
  output: AnalyticsAiReviewOutput;
  creditsConsumed: number;
  /** Model that actually produced the review (router model or override). */
  model: string;
};

/** Structural contract; field-level caps and allow-lists are applied in shapeOutput. */
const AnalyticsReviewResponse = z
  .object({
    headline: z.string(),
    score: z.number(),
    strengths: z.array(z.unknown()),
    improvements: z.array(z.unknown()),
    avoid: z.array(z.unknown()).default([]),
  })
  .passthrough();

function buildPrompt(args: {
  bundle: AnalyticsBundle;
  propertyName: string;
  activitySummaries: string[];
  playbookArticles: AnalyticsPlaybookHint[];
}): { system: string; user: string } {
  const { bundle, propertyName, activitySummaries, playbookArticles } = args;
  const { kpis, stateAssessment } = bundle;

  const system = [
    'You are a vacation-rental performance coach. You are given deterministic analytics for one',
    'property (occupancy, ADR, RevPAR, cancellations, guest response time, a two-axis current',
    'state, and recent operational changes). You do NOT set prices or change settings.',
    'Return ONLY JSON matching the schema. Rules:',
    '- Ground every claim in the numbers given — never invent a statistic.',
    '- Be state-appropriate: if forwardOccupancyState is fully_booked or strong, do NOT suggest',
    '  ways to get more bookings — suggest yield actions (raise rates on remaining nights, open',
    '  the calendar further out). If underbooked or building, focus on pricing/marketing gaps.',
    '- If balanceCollectionState is attention_needed or at_risk, ALWAYS include a collections item',
    '  in improvements or avoid regardless of how strong occupancy looks.',
    '- When a recent operational change (a listed activity event) plausibly explains a metric',
    '  move, cite it by date in the evidence/why text instead of describing the change generically.',
    '- strengths: 1-4 items. improvements: 1-4 items, each with a concrete action. avoid: 0-3 items.',
    '- deepLinkRoute must be one of the allowed enum values — "none" when nothing fits.',
    '- articleSlugs on an improvement item must only use slugs from the provided Playbook list —',
    '  at most 2, and only when directly relevant. Omit entirely if none fit; never invent a slug.',
    '- Never tell the host to leave the platform. Keep a professional, encouraging tone.',
  ].join('\n');

  const user = [
    `Property: ${propertyName}.`,
    `Period: ${bundle.period.from} to ${bundle.period.to}.`,
    `State: forwardOccupancyState30d=${stateAssessment.forwardOccupancyState30d}, ` +
      `forwardOccupancyState60d=${stateAssessment.forwardOccupancyState60d}, ` +
      `balanceCollectionState=${stateAssessment.balanceCollectionState} ` +
      `(${stateAssessment.unpaidBalanceUpcomingCount} bookings, ` +
      `PHP ${stateAssessment.unpaidBalanceUpcomingTotal} outstanding).`,
    `Occupancy: ${kpis.occupancyRate.value}% (vs prior ${kpis.occupancyRate.changePctVsPrior ?? 'n/a'} pts).`,
    `ADR: PHP ${kpis.adr.value}. RevPAR: PHP ${kpis.revpar.value}.`,
    `Reservations: ${kpis.reservations.value}. Cancellation rate: ${kpis.cancellationRate.value}%.`,
    `Avg lead time: ${kpis.avgLeadTimeDays.value} days. Avg rating: ${kpis.avgRating.value || 'n/a'}.`,
    `Guest response: ${kpis.avgResponseMinutes.value} min avg, ${kpis.responseWithin24hRate.value}% within 24h.`,
    `Forward ${bundle.forward.windowDays}d: ${bundle.forward.occupancyOnBooks}% on the books, ` +
      `${bundle.forward.gapNights.length} open nights.`,
    playbookArticles.length > 0
      ? `Available Playbook articles (cite by slug in articleSlugs only if directly relevant):\n${playbookArticles.map((a) => `  - ${a.slug}: ${a.title}`).join('\n')}`
      : 'Available Playbook articles: none matched.',
    activitySummaries.length > 0
      ? `Recent changes:\n${activitySummaries.map((s) => `  - ${s}`).join('\n')}`
      : 'Recent changes: none recorded in this period.',
    'Emit one JSON object.',
  ].join('\n');

  return { system, user };
}

function resolveDeepLink(routeKey: unknown, orgSlug: string, propertySlug: string): string | null {
  const key = typeof routeKey === 'string' ? routeKey : 'none';
  if (!(key in ANALYTICS_DEEP_LINK_ROUTES)) return null;
  const segment = ANALYTICS_DEEP_LINK_ROUTES[key as AnalyticsDeepLinkRouteKey];
  if (!segment) return null;
  return `/org/${orgSlug}/property/${propertySlug}/${segment}`;
}

function shapeOutput(
  raw: unknown,
  orgSlug: string,
  propertySlug: string,
  validArticleSlugs: Set<string>
): AnalyticsAiReviewOutput {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const strengths = (Array.isArray(obj.strengths) ? obj.strengths : [])
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .map((s) => ({
      title: String(s.title ?? '').slice(0, 100),
      evidence: String(s.evidence ?? '').slice(0, 300),
    }))
    .filter((s) => s.title && s.evidence)
    .slice(0, 4);

  const mapItem = (raw: unknown, allowArticles: boolean): AnalyticsAiReviewItem | null => {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const title = String(r.title ?? '').slice(0, 100);
    if (!title) return null;
    // Never trust model-emitted slugs directly — allow-list against what was actually offered.
    const articleSlugs = allowArticles
      ? (Array.isArray(r.articleSlugs) ? r.articleSlugs : [])
          .filter((s): s is string => typeof s === 'string' && validArticleSlugs.has(s))
          .slice(0, 2)
      : [];
    return {
      title,
      why: r.why ? String(r.why).slice(0, 300) : undefined,
      action: r.action ? String(r.action).slice(0, 200) : undefined,
      expectedImpact: r.expectedImpact ? String(r.expectedImpact).slice(0, 120) : undefined,
      deepLink: resolveDeepLink(r.deepLinkRoute, orgSlug, propertySlug),
      ...(articleSlugs.length > 0 ? { articleSlugs } : {}),
    };
  };

  const improvements = (Array.isArray(obj.improvements) ? obj.improvements : [])
    .map((item) => mapItem(item, true))
    .filter((i): i is AnalyticsAiReviewItem => i !== null)
    .slice(0, 4);

  const avoid = (Array.isArray(obj.avoid) ? obj.avoid : [])
    .map((item) => mapItem(item, false))
    .filter((i): i is AnalyticsAiReviewItem => i !== null)
    .slice(0, 3);

  const scoreNum = Number(obj.score);

  return {
    headline: String(obj.headline ?? '').slice(0, 160) || 'Performance review',
    score: Number.isFinite(scoreNum) ? Math.max(0, Math.min(100, Math.round(scoreNum))) : 50,
    strengths,
    improvements,
    avoid,
  };
}

/** Attempt the AI pass. Returns null on any failure — caller shows the deterministic bundle only. */
export async function maybeRunAnalyticsAiReview(args: {
  organizationId: string;
  propertyId: string;
  propertyName: string;
  orgSlug: string;
  propertySlug: string;
  bundle: AnalyticsBundle;
  activitySummaries: string[];
  /** Playbook articles already matched against this bundle (`matchPlaybookArticles`) — the only
   *  slugs the model is allowed to cite in `improvements[].articleSlugs`. Optional; omit or pass
   *  [] to skip article citation for this review. */
  playbookArticles?: AnalyticsPlaybookHint[];
}): Promise<AnalyticsAiReviewResult | null> {
  try {
    await assertOrgAndPropertyAiQuota(args.organizationId, args.propertyId, FEATURE);
  } catch {
    return null;
  }

  const playbookArticles = args.playbookArticles ?? [];
  const validArticleSlugs = new Set(playbookArticles.map((a) => a.slug));

  const { system, user } = buildPrompt({
    bundle: args.bundle,
    propertyName: args.propertyName,
    activitySummaries: args.activitySummaries,
    playbookArticles,
  });
  try {
    const result = await generateStructured({
      feature: FEATURE,
      prompt: ANALYTICS_REVIEW_PROMPT,
      system,
      user,
      temperature: 0.4,
      schema: AnalyticsReviewResponse,
      jsonSchema: RESPONSE_SCHEMA,
      billing: {
        organizationId: args.organizationId,
        propertyId: args.propertyId,
        actorType: 'system',
        quotaChecked: true,
      },
    });
    return {
      output: shapeOutput(result.data, args.orgSlug, args.propertySlug, validArticleSlugs),
      creditsConsumed: result.creditsConsumed,
      model: result.model,
    };
  } catch (err) {
    console.warn('[analyticsAiReview] AI pass failed:', (err as Error).message);
    return null;
  }
}

export type AnalyticsReviewRow = {
  id: string;
  generated_at: string;
  model: string;
  headline: string;
  score: number;
  score_delta: number | null;
  payload: unknown;
};

const REVIEW_ROW_COLUMNS = 'id, generated_at, model, headline, score, score_delta, payload';

/**
 * Unsets the current is_latest row and inserts the new one. Not transactional (two sequential
 * statements) — a cron sweep and a manual regenerate landing on the same property at the same
 * moment can both pass the UPDATE and then collide on the partial unique index
 * (`property_analytics_reviews` has one `is_latest` row per property) at INSERT time. Rather
 * than letting that surface as an unhandled 500, treat a unique-violation (Postgres 23505) as
 * "another writer just won this property" and return whatever row is now actually latest.
 */
export async function writeLatestAnalyticsReview(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  args: {
    propertyId: string;
    organizationId: string;
    periodStart: string;
    periodEnd: string;
    generatedBy: string | null;
    model: string;
    output: AnalyticsAiReviewOutput;
    scoreDelta: number | null;
    metricsSnapshot: Record<string, unknown>;
  }
): Promise<AnalyticsReviewRow> {
  await supabase
    .from('property_analytics_reviews')
    .update({ is_latest: false })
    .eq('property_id', args.propertyId)
    .eq('is_latest', true);

  const { data: inserted, error: insertError } = await supabase
    .from('property_analytics_reviews')
    .insert({
      property_id: args.propertyId,
      organization_id: args.organizationId,
      period_start: args.periodStart,
      period_end: args.periodEnd,
      generated_by: args.generatedBy,
      model: args.model,
      headline: args.output.headline,
      score: args.output.score,
      score_delta: args.scoreDelta,
      payload: {
        strengths: args.output.strengths,
        improvements: args.output.improvements,
        avoid: args.output.avoid,
        metricsSnapshot: args.metricsSnapshot,
      },
      is_latest: true,
    })
    .select(REVIEW_ROW_COLUMNS)
    .single();

  if (!insertError) return inserted as AnalyticsReviewRow;

  // 23505 = unique_violation. Another writer's INSERT landed between our UPDATE and INSERT —
  // fetch whatever is_latest row exists now rather than erroring on a request that, from the
  // host's point of view, still succeeded (a fresh review for this property does exist).
  if (insertError.code === '23505') {
    const { data: current, error: fetchError } = await supabase
      .from('property_analytics_reviews')
      .select(REVIEW_ROW_COLUMNS)
      .eq('property_id', args.propertyId)
      .eq('is_latest', true)
      .single();
    if (!fetchError && current) return current as AnalyticsReviewRow;
  }

  throw new Error(insertError.message);
}
