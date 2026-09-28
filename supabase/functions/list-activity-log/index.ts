/**
 * list-activity-log — GET the org activity / audit timeline for the dashboard
 * Activity routes and the reusable <EntityActivityHistory> panel.
 *
 * Auth: serveAuthenticated → verifyOrgAccess (any org access). Owner / org admin /
 * platform admin see every row; a listing-scoped member sees only rows for their
 * assigned properties / parkings and never `scope = 'org'` rows.
 *
 * Query: ?orgId= | ?orgSlug=  (required)
 *   &scope=org|property|parking  &propertyId=  &parkingId=
 *   &category=booking,team,...   &actorUserId=  &action=  &severity=
 *   &targetType=  &targetId=     &q=  &dateFrom=ISO  &dateTo=ISO
 *   &cursorTs=ISO  &cursorId=uuid   &limit=1..100 (default 50)
 *
 * Keyset pagination on (created_at DESC, id DESC) — never OFFSET.
 */

import {
  activityListingOrFilter,
  resolveActivityVisibility,
} from '../_shared/activityLogVisibility.ts';
import { createServiceClient, verifyOrgAccess } from '../_shared/orgAuth.ts';
import { jsonError, jsonSuccess, requireHttpMethod } from '../_shared/httpResponse.ts';
import { postgrestOrIlikeValue } from '../_shared/publicSearch.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;
const DEFAULT_WINDOW_DAYS = 90;

const ISO_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serveAuthenticated('list-activity-log', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const p = url.searchParams;
  const orgId = p.get('orgId')?.trim() ?? '';
  const orgSlug = p.get('orgSlug')?.trim() ?? '';
  if (!orgId && !orgSlug) return jsonError(req, 'orgId or orgSlug is required');

  const { user, org, accessKind, permissions } = await verifyOrgAccess(req, {
    orgId: orgId || undefined,
    orgSlug: orgSlug || undefined,
  });

  // Org admins need `org.activity:view` for the org-wide log; without it (or as a listing-scoped
  // member) they fall back to rows for listings where they hold the listing-level `activity:view`.
  const visibility = await resolveActivityVisibility({
    userId: user.id,
    orgId: org.id,
    accessKind,
    permissions,
  });
  if (visibility.kind === 'none') return jsonSuccess(req, { events: [], nextCursor: null });

  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(p.get('limit') ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  const supabase = createServiceClient();
  let query = supabase
    .from('activity_log')
    .select(
      'id,created_at,organization_id,property_id,parking_id,scope,actor_type,actor_user_id,' +
        'actor_email,actor_display_name,actor_role,actor_member_id,action,category,severity,' +
        'target_type,target_id,target_label,summary,changes,metadata,ip_prefix,user_agent,source,request_id'
    )
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  // ── Listing-scoped visibility ─────────────────────────────────────────────
  if (visibility.kind === 'listings') {
    query = query.neq('scope', 'org').or(activityListingOrFilter(visibility));
  }

  // ── Filters ──────────────────────────────────────────────────────────────
  const scope = p.get('scope')?.trim();
  if (scope && ['org', 'property', 'parking'].includes(scope)) {
    query = query.eq('scope', scope);
  }

  const propertyId = p.get('propertyId')?.trim();
  if (propertyId && UUID_RE.test(propertyId)) query = query.eq('property_id', propertyId);

  const parkingId = p.get('parkingId')?.trim();
  if (parkingId && UUID_RE.test(parkingId)) query = query.eq('parking_id', parkingId);

  const categories = (p.get('category') ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (categories.length === 1) query = query.eq('category', categories[0]);
  else if (categories.length > 1) query = query.in('category', categories);

  const actorUserId = p.get('actorUserId')?.trim();
  if (actorUserId && UUID_RE.test(actorUserId)) query = query.eq('actor_user_id', actorUserId);

  const action = p.get('action')?.trim();
  if (action) query = query.eq('action', action);

  const severity = p.get('severity')?.trim();
  if (severity && ['info', 'notice', 'warning', 'destructive'].includes(severity)) {
    query = query.eq('severity', severity);
  }

  const targetType = p.get('targetType')?.trim();
  if (targetType) query = query.eq('target_type', targetType);

  const targetId = p.get('targetId')?.trim();
  if (targetId) query = query.eq('target_id', targetId);

  // ── Date window ──────────────────────────────────────────────────────────
  const dateFrom = p.get('dateFrom')?.trim();
  const dateTo = p.get('dateTo')?.trim();
  if (dateFrom && ISO_RE.test(dateFrom)) {
    query = query.gte('created_at', dateFrom);
  } else if (!dateFrom) {
    const since = new Date(Date.now() - DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    query = query.gte('created_at', since.toISOString());
  }
  if (dateTo && ISO_RE.test(dateTo)) query = query.lte('created_at', dateTo);

  // ── Text search ──────────────────────────────────────────────────────────
  const search = p.get('q')?.trim();
  if (search) {
    const pattern = postgrestOrIlikeValue(search);
    query = query.or(`summary.ilike.${pattern},target_label.ilike.${pattern}`);
  }

  // ── Keyset cursor ────────────────────────────────────────────────────────
  const cursorTs = p.get('cursorTs')?.trim();
  const cursorId = p.get('cursorId')?.trim();
  if (cursorTs && cursorId && ISO_RE.test(cursorTs) && UUID_RE.test(cursorId)) {
    query = query.or(`created_at.lt.${cursorTs},and(created_at.eq.${cursorTs},id.lt.${cursorId})`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[list-activity-log]', error.message);
    return jsonError(req, 'Failed to load activity', 500);
  }

  // supabase-js can't type-parse the keyset `.or(and(...))`, so `data` widens to
  // an error shape — the query itself is valid; cast to a loose row array.
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  const planIds = new Set<string>();
  for (const row of page) {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    for (const key of ['to_plan', 'from_plan', 'plan_id', 'planId'] as const) {
      const value = metadata[key];
      if (typeof value === 'string' && UUID_RE.test(value)) planIds.add(value);
    }
    const summary = typeof row.summary === 'string' ? row.summary : '';
    for (const match of summary.matchAll(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi
    )) {
      planIds.add(match[0].toLowerCase());
    }
  }

  const planNameById = new Map<string, string>();
  if (planIds.size > 0) {
    const { data: plans } = await supabase
      .from('pricing_plans')
      .select('id, name')
      .in('id', [...planIds]);
    for (const plan of plans ?? []) {
      const id = typeof plan.id === 'string' ? plan.id : '';
      const name = typeof plan.name === 'string' ? plan.name.trim() : '';
      if (id && name) planNameById.set(id.toLowerCase(), name);
    }
  }

  const uuidInText = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

  function enrichSummaryAndMetadata(
    summary: string,
    metadata: Record<string, unknown>
  ): { summary: string; metadata: Record<string, unknown> } {
    const nextMeta = { ...metadata };
    for (const key of ['to_plan', 'from_plan'] as const) {
      const id = nextMeta[key];
      if (typeof id !== 'string' || !UUID_RE.test(id)) continue;
      const name = planNameById.get(id.toLowerCase());
      if (!name) continue;
      if (key === 'to_plan' && !nextMeta.to_plan_name) nextMeta.to_plan_name = name;
      if (key === 'from_plan' && !nextMeta.from_plan_name) nextMeta.from_plan_name = name;
    }

    let nextSummary = summary;
    nextSummary = nextSummary.replace(uuidInText, (id) => {
      return planNameById.get(id.toLowerCase()) ?? 'a plan';
    });
    return { summary: nextSummary, metadata: nextMeta };
  }

  return jsonSuccess(req, {
    events: page.map((row) => {
      const rawMeta = (row.metadata as Record<string, unknown>) ?? {};
      const enriched = enrichSummaryAndMetadata((row.summary as string) ?? '', rawMeta);
      return {
        id: row.id as string,
        createdAt: row.created_at as string,
        organizationId: row.organization_id as string,
        propertyId: (row.property_id as string | null) ?? null,
        parkingId: (row.parking_id as string | null) ?? null,
        scope: row.scope as string,
        actorType: row.actor_type as string,
        actorUserId: (row.actor_user_id as string | null) ?? null,
        actorEmail: (row.actor_email as string | null) ?? null,
        actorDisplayName: (row.actor_display_name as string | null) ?? null,
        actorRole: (row.actor_role as string | null) ?? null,
        actorMemberId: (row.actor_member_id as string | null) ?? null,
        action: row.action as string,
        category: row.category as string,
        severity: row.severity as string,
        targetType: (row.target_type as string | null) ?? null,
        targetId: (row.target_id as string | null) ?? null,
        targetLabel: (row.target_label as string | null) ?? null,
        summary: enriched.summary,
        changes: (row.changes as unknown) ?? null,
        metadata: enriched.metadata,
        ipPrefix: (row.ip_prefix as string | null) ?? null,
        userAgent: (row.user_agent as string | null) ?? null,
        source: row.source as string,
        requestId: (row.request_id as string | null) ?? null,
      };
    }),
    nextCursor: hasMore && last ? { ts: last.created_at as string, id: last.id as string } : null,
  });
});
