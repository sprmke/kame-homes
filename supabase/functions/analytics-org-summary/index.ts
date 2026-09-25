/**
 * analytics-org-summary — Host Analytics Phase 5, org portfolio rollup.
 * Org scope: ?org_slug=… or ?org_id=…. ?from=&to= (defaults to current calendar month, Manila).
 *
 * Preview-open: `org.analytics:view` is enough to read every active property's numbers.
 * `analyticsInsights` gates Export CSV (client), not this GET.
 */

import { computePropertyPortfolioRow } from '../_shared/analyticsService.ts';
import { manilaTodayIso } from '../_shared/bookingsListSort.ts';
import { jsonError, jsonSuccess } from '../_shared/httpResponse.ts';
import { createServiceClient } from '../_shared/orgAuth.ts';
import { resolveOrgAccessContext } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const MAX_PROPERTIES = 200;

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

serveAuthenticated('analytics-org-summary', async (req) => {
  if (req.method !== 'GET') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const { org } = await resolveOrgAccessContext(req, 'org.analytics:view');

  const today = manilaTodayIso();
  const url = new URL(req.url);
  const defaultRange = defaultMonthRange(today);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');
  const from = isValidIsoDate(fromParam) ? fromParam : defaultRange.from;
  const to = isValidIsoDate(toParam) ? toParam : defaultRange.to;
  if (from > to) {
    return jsonError(req, '`from` must be on or before `to`', 400);
  }

  const supabase = createServiceClient();
  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, name, slug')
    .eq('organization_id', org.id)
    .eq('status', 'ACTIVE')
    .order('name', { ascending: true })
    .limit(MAX_PROPERTIES);
  if (error) throw new Error(error.message);

  const rows = await Promise.all(
    (properties ?? []).map(async (property) => {
      const portfolioRow = await computePropertyPortfolioRow(property.id, from, to);
      return {
        propertyId: property.id,
        propertyName: property.name,
        propertySlug: property.slug,
        locked: false as const,
        ...portfolioRow,
      };
    })
  );

  const totalRevenue = rows.reduce((sum, r) => sum + r.grossRevenue, 0);
  const totalReservations = rows.reduce((sum, r) => sum + r.reservations, 0);
  const avgOccupancy =
    rows.length > 0
      ? Math.round((rows.reduce((sum, r) => sum + r.occupancyRate, 0) / rows.length) * 100) / 100
      : 0;

  return jsonSuccess(req, {
    period: { from, to },
    portfolio: {
      totalRevenue,
      totalReservations,
      avgOccupancy,
      propertyCount: properties?.length ?? 0,
      entitledPropertyCount: rows.length,
    },
    rows,
  });
});
