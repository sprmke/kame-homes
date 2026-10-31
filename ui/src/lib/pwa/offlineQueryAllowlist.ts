import { type Query } from '@tanstack/react-query';

/**
 * Canonical allowlist of query-key roots that may be written to the offline
 * IndexedDB cache. Everything else stays memory-only.
 *
 * Keep this tight — the cache holds operator PII on a possibly shared device
 * (cleared on logout, unencrypted at rest). Only data an operator genuinely
 * needs to *read* while offline belongs here. Adding a row is a deliberate
 * decision — see docs/architecture/pwa.md and .cursor/rules/pwa.mdc.
 */
export const OFFLINE_PERSIST_KEY_ROOTS: ReadonlySet<string> = new Set([
  // Bookings — list + detail for the active tenant
  'bookings',
  'booking',
  'parking-booking-status',
  // Notification Center
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
  'support-tickets',
  'support-ticket',
]);

/** Root string of a query key, if it is a conventional `[root, ...]` array key. */
export function queryKeyRoot(queryKey: unknown): string | null {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return null;
  return typeof queryKey[0] === 'string' ? queryKey[0] : null;
}

/**
 * `shouldDehydrateQuery` for the persister: keep only allowlisted, successfully
 * fetched queries that actually have data. Errored / pending / empty queries are
 * never written.
 */
export function shouldPersistQuery(query: Query): boolean {
  const root = queryKeyRoot(query.queryKey);
  if (!root || !OFFLINE_PERSIST_KEY_ROOTS.has(root)) return false;
  return query.state.status === 'success' && query.state.data !== undefined;
}
