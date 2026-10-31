/**
 * Improvement Playbook matcher — Host Analytics Phase 4.
 * Deterministic matcher: evaluates each `host_playbook_articles.applies_when` condition
 * against the property's own `AnalyticsBundle` and returns the matched, sorted candidate set.
 * Heuristic by nature (these are marketing-style nudges, not scientific thresholds) — false
 * positives/negatives are acceptable; never blocking, never mutates anything.
 */

import type { AnalyticsBundle } from './analyticsService.ts';
import { createServiceClient } from './orgAuth.ts';

export type PlaybookArticle = {
  slug: string;
  category: string;
  title: string;
  bodyMd: string;
  sortOrder: number;
};

type AppliesWhenCondition = {
  metric?: string;
  op?: string;
  value?: unknown;
};

function topChannelSharePct(distributions: AnalyticsBundle['distributions']): number {
  const total = distributions.channelMix.reduce((sum, c) => sum + c.count, 0);
  if (total === 0) return 0;
  const top = Math.max(0, ...distributions.channelMix.map((c) => c.count));
  return top / total;
}

/**
 * Resolves a condition's metric name to a comparable value from the bundle. Percentage-shaped
 * metrics (rates) are normalized to a 0-1 fraction to match how seed thresholds are authored
 * (e.g. 0.8 meaning 80%), even though the KPI itself stores a 0-100 number.
 */
function extractMetricValue(bundle: AnalyticsBundle, metric: string): unknown {
  switch (metric) {
    case 'forwardOccupancyState':
      return bundle.stateAssessment.forwardOccupancyState30d;
    case 'balanceCollectionState':
      return bundle.stateAssessment.balanceCollectionState;
    case 'adr':
      return bundle.kpis.adr.value;
    case 'responseWithin24hRate':
      return bundle.kpis.responseWithin24hRate.value / 100;
    case 'cancellationRate':
      return bundle.kpis.cancellationRate.value / 100;
    case 'ratingTrend':
      return bundle.kpis.avgRating.changePctVsPrior ?? 0;
    case 'channelConcentration':
      return topChannelSharePct(bundle.distributions);
    case 'gapNightsNext14d':
      // gapNights is already the chronological list of unbooked dates starting today.
      return bundle.forward.gapNights.slice(0, 14).length;
    case 'smartPricingEnabled':
      // Not tracked in the bundle today — never matches (no false "you should enable it" spam
      // when we can't actually tell). Revisit once Smart Pricing state is threaded through.
      return null;
    default:
      return null;
  }
}

function evaluateCondition(bundle: AnalyticsBundle, condition: AppliesWhenCondition): boolean {
  if (!condition.metric || !condition.op) return false;
  const actual = extractMetricValue(bundle, condition.metric);
  if (actual === null || actual === undefined) return false;

  switch (condition.op) {
    case 'eq':
      return actual === condition.value;
    case 'gt':
      return (
        typeof actual === 'number' &&
        typeof condition.value === 'number' &&
        actual > condition.value
      );
    case 'gte':
      return (
        typeof actual === 'number' &&
        typeof condition.value === 'number' &&
        actual >= condition.value
      );
    case 'lt':
      return (
        typeof actual === 'number' &&
        typeof condition.value === 'number' &&
        actual < condition.value
      );
    case 'lte':
      return (
        typeof actual === 'number' &&
        typeof condition.value === 'number' &&
        actual <= condition.value
      );
    case 'lt_baseline': {
      // "current is below `value` fraction of the property's own prior-period baseline" —
      // approximated via the KPI's own changePctVsPrior sign/magnitude.
      const kpiChange = condition.metric === 'adr' ? bundle.kpis.adr.changePctVsPrior : null;
      if (kpiChange == null || typeof condition.value !== 'number') return false;
      const dropThresholdPct = (1 - condition.value) * -100;
      return kpiChange <= dropThresholdPct;
    }
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(actual);
    default:
      return false;
  }
}

/** Matches active playbook articles against a property's analytics bundle, sorted, capped. */
export async function matchPlaybookArticles(
  bundle: AnalyticsBundle,
  limit = 6
): Promise<PlaybookArticle[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('host_playbook_articles')
    .select('slug, category, title, body_md, applies_when, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  const matched: PlaybookArticle[] = [];
  for (const row of data ?? []) {
    const condition = (row.applies_when ?? {}) as AppliesWhenCondition;
    if (evaluateCondition(bundle, condition)) {
      matched.push({
        slug: row.slug,
        category: row.category,
        title: row.title,
        bodyMd: row.body_md,
        sortOrder: row.sort_order,
      });
    }
    if (matched.length >= limit) break;
  }

  return matched;
}
