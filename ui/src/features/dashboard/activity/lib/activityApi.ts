import type {
  ActivityCategory,
  ActivityCursor,
  ActivityLogResponse,
  ActivitySeverity,
} from '@/features/dashboard/activity/lib/activityCatalog';
import { callEdgeFunction, getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';

export type ActivityScopeParam = 'org' | 'property' | 'parking';

export type ActivityLogFilters = {
  scope?: ActivityScopeParam;
  propertyId?: string | null;
  parkingId?: string | null;
  category?: ActivityCategory[];
  actorUserId?: string | null;
  action?: string | null;
  severity?: ActivitySeverity | null;
  targetType?: string | null;
  targetId?: string | null;
  q?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

function buildQuery(
  orgSlug: string | null,
  orgId: string | null,
  filters: ActivityLogFilters,
  cursor: ActivityCursor | null,
  limit: number
): string {
  const p = new URLSearchParams();
  if (orgId) p.set('orgId', orgId);
  else if (orgSlug) p.set('orgSlug', orgSlug);
  if (filters.scope) p.set('scope', filters.scope);
  if (filters.propertyId) p.set('propertyId', filters.propertyId);
  if (filters.parkingId) p.set('parkingId', filters.parkingId);
  if (filters.category?.length) p.set('category', filters.category.join(','));
  if (filters.actorUserId) p.set('actorUserId', filters.actorUserId);
  if (filters.action) p.set('action', filters.action);
  if (filters.severity) p.set('severity', filters.severity);
  if (filters.targetType) p.set('targetType', filters.targetType);
  if (filters.targetId) p.set('targetId', filters.targetId);
  if (filters.q?.trim()) p.set('q', filters.q.trim());
  if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) p.set('dateTo', filters.dateTo);
  if (cursor) {
    p.set('cursorTs', cursor.ts);
    p.set('cursorId', cursor.id);
  }
  p.set('limit', String(limit));
  return p.toString();
}

export async function fetchActivityLog(args: {
  orgSlug: string | null;
  orgId: string | null;
  filters: ActivityLogFilters;
  cursor: ActivityCursor | null;
  limit: number;
}): Promise<ActivityLogResponse> {
  const qs = buildQuery(args.orgSlug, args.orgId, args.filters, args.cursor, args.limit);
  return callEdgeFunction<ActivityLogResponse>(`list-activity-log?${qs}`, { method: 'GET' });
}

/** Owner / admin only — downloads a CSV of the current filtered view (bounded). */
export async function downloadActivityLogCsv(args: {
  orgSlug: string | null;
  orgId: string | null;
  filters: ActivityLogFilters;
}): Promise<void> {
  const qs = buildQuery(args.orgSlug, args.orgId, args.filters, null, 0);
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '');
  const jwt = await getSessionJwt();
  const res = await fetch(`${base}/activity-log-export?${qs}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) {
    const msg = await res
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => null);
    throw new Error(msg ?? 'Export failed');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const name = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? 'activity.csv';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}
