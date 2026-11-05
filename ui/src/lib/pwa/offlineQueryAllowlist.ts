import { type Query } from '@tanstack/react-query';

/**
 * Canonical allowlist of query-key roots that may be written to the offline
 * IndexedDB cache. Everything else stays memory-only.
 *
 * Keep this tight — the cache holds operator PII on a possibly shared device
 * (cleared on logout, unencrypted at rest). Only data an operator genuinely
 * needs to *read* while offline belongs here. Adding a row is a deliberate
 * decision — see docs/architecture/pwa.md and `.cursor/rules/pwa.mdc`.
 *
 * Audit rule (PWA v2 task 3.2): a root stays only while a real query uses it, and
 * write-oriented surfaces (editors, marketing studio, team invites, plan checkout,
 * super admin) are never persisted. `offlineQueryAllowlist.test.ts` pins the list so
 * a silent addition fails CI.
 */
const OFFLINE_PERSIST_KEY_ROOTS: ReadonlySet<string> = new Set([
  // Bookings — list + detail for the active tenant
  'bookings',
  'booking',
  'parking-booking-status',
  // Notification Center (first pages only — see MAX_PERSISTED_PAGES)
  'notifications',
  // Guest Inbox (read)
  'inbox-threads',
  'inbox-messages',
  // Dashboards / KPIs
  'dashboard-stats',
  'org-dashboard-stats',
  'parking-dashboard-stats',
  // Operational modules (read views)
  'maintenance-items',
  'maintenance-summary',
  'finance-summary',
  'finance-bookings',
  'finance-line-items',
  'property-pricing',
  'parking-pricing',
  // Modules shipped after the v1 audit (previously unclassified)
  'activity-log',
  'analytics-summary',
  'org-analytics-summary',
  'host-announcements',
  // Settings the shell needs to render offline
  'org-settings',
  'parking-settings',
  'property-templates',
  'app-settings',
  // Tier B — authenticated guest portal (read views)
  'guest-messages',
  'guest-profile',
  'guest-trips',
  'guest-vouchers',
  'guest-my-reviews',
  'support-tickets',
  'support-ticket',
]);

/**
 * An infinite query keeps every page it has loaded. Persisting a deep scroll
 * session would grow without bound, so only the first two pages are written
 * (enough to render the list instantly after a cold start; the rest refetches).
 */
export const MAX_PERSISTED_PAGES = 2;

/** Root string of a query key, if it is a conventional `[root, ...]` array key. */
export function queryKeyRoot(queryKey: unknown): string | null {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return null;
  return typeof queryKey[0] === 'string' ? queryKey[0] : null;
}

/**
 * `shouldDehydrateQuery` for the persister: keep only allowlisted, successfully
 * fetched queries that actually have data. Errored / pending / empty queries are
 * never written, and deep infinite-query page sets are skipped.
 */
export function shouldPersistQuery(query: Query): boolean {
  const root = queryKeyRoot(query.queryKey);
  if (!root || !OFFLINE_PERSIST_KEY_ROOTS.has(root)) return false;
  if (query.state.status !== 'success' || query.state.data === undefined) return false;
  const data = query.state.data as { pages?: unknown } | null;
  if (data && typeof data === 'object' && Array.isArray(data.pages)) {
    if (data.pages.length > MAX_PERSISTED_PAGES) return false;
  }
  return true;
}

/** Exposed for tests and the docs page that lists what works offline. */
export function offlinePersistRoots(): string[] {
  return [...OFFLINE_PERSIST_KEY_ROOTS];
}
