/**
 * analytics-summary — Host Analytics deterministic bundle.
 * Property scope: ?property_id=…
 * ?from=&to= (ISO yyyy-mm-dd, inclusive). Defaults to the current calendar month (Manila).
 *
 * Preview-open: every entitled `analytics:view` host gets the full AnalyticsBundle.
 * `analyticsInsights` gates export (PDF) and on-demand AI review POST, not this read.
 */

import { computeAnalyticsBundle, computePlatformBenchmark } from '../_shared/analyticsService.ts';
import { manilaTodayIso } from '../_shared/bookingsListSort.ts';
import { matchPlaybookArticles } from '../_shared/hostPlaybook.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { readPropertyIdFromUrl, resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

function defaultMonthRange(today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  const from = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

function isValidIsoDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

serveAuthenticated('analytics-summary', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  const explicitPropertyId = readPropertyIdFromUrl(url);
  const { property } = await resolveScopedPropertyAccess(req, 'analytics:view', explicitPropertyId);

  const today = manilaTodayIso();
  const defaultRange = defaultMonthRange(today);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const from = isValidIsoDate(fromParam) ? fromParam : defaultRange.from;
  const to = isValidIsoDate(toParam) ? toParam : defaultRange.to;

  if (from > to) {
    return jsonError(req, '`from` must be on or before `to`', 400);
  }

  const bundle = await computeAnalyticsBundle({ propertyId: property.id, from, to });

  const playbook = await matchPlaybookArticles(bundle).catch(() => []);
  const benchmark = await computePlatformBenchmark(
    property.id,
    from,
    to,
    bundle.kpis.occupancyRate.value,
    bundle.kpis.adr.value
  ).catch(() => ({
    available: false,
    sampleSize: 0,
    medianOccupancyRate: null,
    medianAdr: null,
    occupancyPercentile: null,
    adrPercentile: null,
  }));

  return jsonSuccess(req, { tier: 'full' as const, ...bundle, playbook, benchmark });
});
