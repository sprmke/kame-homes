/**
 * Intent-based chunk prefetch map for the admin sidebar (production-readiness
 * doc 01, Phase 1.4). Keyed by the nav item's trailing URL path segment
 * (`/org/:orgSlug/property/:propertySlug/finance` -> `finance`), which is a
 * stable identifier shared across org/property/parking sections — see
 * `orgSectionPath`/`propertySectionPath`/`parkingSectionPath` in
 * `@/features/dashboard/org/lib/tenantPaths.ts`.
 *
 * Each entry mirrors the exact `import()` call already made by that page's
 * `React.lazy()` definition in its own `routes/index.tsx` — duplicating the
 * import specifier (not the lazy() wrapper) means calling this map's loader
 * warms the same Vite/Rollup chunk the real route will fetch, without
 * introducing a second lazy boundary or changing what actually renders.
 *
 * Intentionally covers only top-level module destinations (the sidebar's own
 * items) — detail/sub-routes (booking detail, page editor, etc.) are not
 * prefetch targets here.
 *
 * Keep in sync with the `lazy()` specifiers in each module's
 * `routes/index.tsx` / `routes/propertyRoutes.tsx`. A stale entry here is
 * harmless (it just prefetches nothing extra), but a stale import specifier
 * would silently 404 the prefetch — caught immediately by `type-check` since
 * these are real dynamic `import()` expressions, not strings.
 */
export const ADMIN_NAV_PREFETCH: Record<string, () => Promise<unknown>> = {
  dashboard: () => import('@/features/dashboard/org/pages/OrgDashboardPage'),
  bookings: () => import('@/features/dashboard/bookings/pages/BookingsListPage'),
  properties: () => import('@/features/dashboard/org/pages/OrgPropertiesPage'),
  parkings: () => import('@/features/dashboard/org/pages/OrgParkingsPage'),
  analytics: () => import('@/features/dashboard/analytics/pages/OrgAnalyticsPage'),
  team: () => import('@/features/dashboard/team/pages/OrgTeamPage'),
  plans: () => import('@/features/dashboard/plans/pages/OrgPlansPage'),
  settings: () => import('@/features/dashboard/org/pages/OrgSettingsPage'),
  finance: () => import('@/features/dashboard/finance/pages/FinancePage'),
  marketing: () => import('@/features/dashboard/marketing/pages/MarketingStudioPage'),
  maintenance: () => import('@/features/dashboard/maintenance/pages/MaintenancePage'),
  pricing: () => import('@/features/dashboard/pricing/pages/PropertyPricingPage'),
  templates: () => import('@/features/dashboard/bookings/pages/TemplatesPage'),
  notifications: () => import('@/features/dashboard/bookings/pages/NotificationsPage'),
  inbox: () => import('@/features/dashboard/inbox/pages/PropertyInboxPage'),
};

/**
 * Parking-scoped module pages reuse some of the same trailing segments
 * (`bookings`, `finance`, `pricing`, `settings`, `inbox`) but resolve to a
 * *different* lazy chunk than the property equivalents above. Since a single
 * `href` cannot be in two maps at once, resolve by checking whether the path
 * contains `/parking/` before falling back to `ADMIN_NAV_PREFETCH`.
 */
export const PARKING_NAV_PREFETCH: Record<string, () => Promise<unknown>> = {
  dashboard: () => import('@/features/dashboard/parking/pages/ParkingDashboardPage'),
  bookings: () => import('@/features/dashboard/parking/pages/ParkingBookingsPage'),
  finance: () => import('@/features/dashboard/parking/pages/ParkingFinancePage'),
  pricing: () => import('@/features/dashboard/parking/pages/ParkingPricingPage'),
  settings: () => import('@/features/dashboard/parking/pages/ParkingSettingsPage'),
  inbox: () => import('@/features/dashboard/inbox/pages/ParkingInboxPage'),
};

/** Resolve a nav item's `href` to its prefetch loader, or `null` if none is mapped. */
export function resolveAdminNavPrefetch(href: string): (() => Promise<unknown>) | null {
  const trailingSegment = href.split('/').filter(Boolean).pop();
  if (!trailingSegment) return null;

  const isParkingScoped = href.includes('/parking/');
  const map = isParkingScoped ? PARKING_NAV_PREFETCH : ADMIN_NAV_PREFETCH;
  return map[trailingSegment] ?? null;
}
