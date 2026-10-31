/**
 * activity-log-export — CSV export of the org activity / audit timeline.
 *
 * Same auth + scoped visibility as `list-activity-log` (serveAuthenticated →
 * verifyOrgAccess; owner / org-admin / platform-admin only — listing-scoped
 * members get 403 to keep the export a whole-org artifact). Streams a bounded
 * CSV (default last 90 days, cap 20k rows). Read-only.
 */

import { createServiceClient, verifyOrgAccess } from '../_shared/orgAuth.ts';
import { catchPlanFeatureError, requireOrgFeature } from '../_shared/planEntitlements.ts';
import { jsonError, requireHttpMethod } from '../_shared/httpResponse.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const MAX_ROWS = 20_000;
const DEFAULT_WINDOW_DAYS = 90;
const ISO_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const COLUMNS = [
  'created_at',
  'scope',
  'category',
  'action',
  'severity',
  'actor_type',
  'actor_email',
  'actor_display_name',
  'actor_role',
  'summary',
  'target_type',
  'target_id',
  'target_label',
  'property_id',
  'parking_id',
  'source',
  'ip_prefix',
  'request_id',
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

serveAuthenticated('activity-log-export', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const p = url.searchParams;
  const orgId = p.get('orgId')?.trim() ?? '';
  const orgSlug = p.get('orgSlug')?.trim() ?? '';
  if (!orgId && !orgSlug) return jsonError(req, 'orgId or orgSlug is required');

  const { org, accessKind } = await verifyOrgAccess(req, {
    orgId: orgId || undefined,
    orgSlug: orgSlug || undefined,
  });

  if (accessKind !== 'owner' && accessKind !== 'platform_admin' && accessKind !== 'org_admin') {
    return jsonError(req, 'Export is limited to org owners and admins', 403);
  }

  // Plan gate — CSV export is Starter+; in-app viewing (list-activity-log) stays free.
  // Platform admins bypass (they act cross-org, not on a plan).
  if (accessKind !== 'platform_admin') {
    try {
      await requireOrgFeature(org.id, 'activityLogExport');
    } catch (err) {
      const planErr = catchPlanFeatureError(req, err);
      if (planErr) return planErr;
      throw err;
    }
  }

  const supabase = createServiceClient();
  let query = supabase
    .from('activity_log')
    .select(COLUMNS.join(','))
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(MAX_ROWS);

  const scope = p.get('scope')?.trim();
  if (scope && ['org', 'property', 'parking'].includes(scope)) query = query.eq('scope', scope);
  const category = (p.get('category') ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (category.length === 1) query = query.eq('category', category[0]);
  else if (category.length > 1) query = query.in('category', category);
  const severity = p.get('severity')?.trim();
  if (severity && ['info', 'notice', 'warning', 'destructive'].includes(severity)) {
    query = query.eq('severity', severity);
  }
  const propertyId = p.get('propertyId')?.trim();
  if (propertyId) query = query.eq('property_id', propertyId);
  const parkingId = p.get('parkingId')?.trim();
  if (parkingId) query = query.eq('parking_id', parkingId);

  const dateFrom = p.get('dateFrom')?.trim();
  if (dateFrom && ISO_RE.test(dateFrom)) {
    query = query.gte('created_at', dateFrom);
  } else if (!dateFrom) {
    const since = new Date(Date.now() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    query = query.gte('created_at', since.toISOString());
  }
  const dateTo = p.get('dateTo')?.trim();
  if (dateTo && ISO_RE.test(dateTo)) query = query.lte('created_at', dateTo);

  const { data, error } = await query;
  if (error) {
    console.error('[activity-log-export]', error.message);
    return jsonError(req, 'Failed to export activity', 500);
  }

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const lines = [COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(COLUMNS.map((col) => csvCell(row[col])).join(','));
  }
  const csv = lines.join('\r\n');
  const filename = `activity-${org.slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders(req),
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
});
