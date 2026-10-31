import type { StatusTone } from '@/features/dashboard/bookings/lib/bookingStatus';

/** Mirror of `supabase/functions/_shared/systemHealth/types.ts`. */
export type HealthStatus = 'ok' | 'warn' | 'error' | 'off' | 'unknown';

export type HealthCategory =
  'configuration' | 'security' | 'integrations' | 'jobs' | 'database' | 'usage';

export type HealthCheck = {
  id: string;
  category: HealthCategory;
  group: string;
  label: string;
  status: HealthStatus;
  detail?: string;
  hint?: string;
  features?: string[];
  checkedAt?: string;
  fixHref?: string;
  manageHref?: string;
  probeId?: string;
  items?: HealthCheckItem[];
};

export type HealthCheckItem = { label: string; detail?: string; href?: string };

const SEVERITY: Record<HealthStatus, number> = { error: 4, warn: 3, unknown: 2, ok: 1, off: 0 };

export const HEALTH_STATUS_META: Record<HealthStatus, { label: string; tone: StatusTone }> = {
  ok: { label: 'Healthy', tone: 'green' },
  warn: { label: 'Warning', tone: 'amber' },
  error: { label: 'Error', tone: 'red' },
  unknown: { label: 'Unknown', tone: 'neutral' },
  off: { label: 'Off', tone: 'neutral' },
};

/** Display order for legends and filters (worst first). */
export const HEALTH_STATUS_ORDER: HealthStatus[] = ['error', 'warn', 'unknown', 'ok', 'off'];

export function worstStatus(statuses: HealthStatus[]): HealthStatus {
  let worst: HealthStatus = 'ok';
  let seen = false;
  for (const status of statuses) {
    if (!seen || SEVERITY[status] > SEVERITY[worst]) worst = status;
    seen = true;
  }
  return seen ? worst : 'off';
}

export function countByStatus(checks: Pick<HealthCheck, 'status'>[]): Record<HealthStatus, number> {
  const counts: Record<HealthStatus, number> = { ok: 0, warn: 0, error: 0, off: 0, unknown: 0 };
  for (const check of checks) counts[check.status]++;
  return counts;
}

/** Worst first, then by label. */
export function sortChecks<T extends Pick<HealthCheck, 'status' | 'label'>>(checks: T[]): T[] {
  return [...checks].sort(
    (a, b) => SEVERITY[b.status] - SEVERITY[a.status] || a.label.localeCompare(b.label)
  );
}

export function groupChecks<T extends Pick<HealthCheck, 'group' | 'status' | 'label'>>(
  checks: T[]
): Array<{ group: string; status: HealthStatus; checks: T[] }> {
  const groups = new Map<string, T[]>();
  for (const check of checks) groups.set(check.group, [...(groups.get(check.group) ?? []), check]);
  return [...groups.entries()]
    .map(([group, rows]) => ({
      group,
      status: worstStatus(rows.map((row) => row.status)),
      checks: sortChecks(rows),
    }))
    .sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status] || a.group.localeCompare(b.group));
}

export function isIssue(status: HealthStatus): boolean {
  return status === 'error' || status === 'warn';
}

/** Compact relative time: `just now`, `5m ago`, `3h ago`, `2d ago`. */
export function formatAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export type HealthStatusFilter = 'all' | 'issues' | HealthStatus;

export function matchesFilter(status: HealthStatus, filter: HealthStatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'issues') return isIssue(status);
  return status === filter;
}

/** DOM id for deep links from the Overview issue list. */
export function healthCheckAnchor(id: string): string {
  return `check-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}
