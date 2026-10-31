import { detectAnalyticsEnvironment, detectAppTrack } from '@/lib/posthog/env';
import type {
  AnalyticsPersona,
  AnalyticsScope,
  AnalyticsSurface,
  SharedAnalyticsProperties,
} from '@/lib/posthog/types';

let scope: AnalyticsScope = {};

export function setAnalyticsScope(partial: AnalyticsScope): void {
  scope = { ...scope, ...partial };
}

export function clearAnalyticsScope(): void {
  scope = {};
}

function surfaceFromPath(pathname: string): AnalyticsSurface {
  if (pathname.startsWith('/admin')) return 'super_admin';
  if (pathname.startsWith('/account')) return 'guest_account';
  if (pathname.includes('/parking/')) return 'parking_dashboard';
  if (pathname.startsWith('/org')) return 'host_dashboard';
  if (
    pathname.startsWith('/properties/') ||
    pathname.startsWith('/calendar') ||
    pathname.startsWith('/form') ||
    pathname.startsWith('/sd-form') ||
    pathname.startsWith('/guest-review') ||
    pathname.startsWith('/bookings/')
  ) {
    return 'guest_ops';
  }
  return 'marketing';
}

function personaFromPath(pathname: string, signedIn: boolean): AnalyticsPersona {
  if (!signedIn) return 'anonymous_guest';
  if (pathname.startsWith('/admin')) return 'super_admin';
  if (pathname.startsWith('/account')) return 'guest';
  if (pathname.startsWith('/org')) return 'host';
  return 'anonymous_guest';
}

let signedInHint = false;

/** Updated by PostHogIdentitySync when a session exists. */
export function setAnalyticsSignedIn(signedIn: boolean): void {
  signedInHint = signedIn;
}

export function buildSharedAnalyticsProperties(
  overrides?: Partial<SharedAnalyticsProperties>
): SharedAnalyticsProperties {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const surface = scope.surface ?? surfaceFromPath(pathname);
  const persona = scope.persona ?? personaFromPath(pathname, signedInHint);

  return {
    environment: detectAnalyticsEnvironment(),
    app_track: detectAppTrack(),
    persona,
    surface,
    ...(scope.orgId ? { org_id: scope.orgId } : {}),
    ...(scope.propertyId ? { property_id: scope.propertyId } : {}),
    ...(scope.parkingId ? { parking_id: scope.parkingId } : {}),
    ...(scope.planTier ? { plan_tier: scope.planTier } : {}),
    ...overrides,
  };
}
