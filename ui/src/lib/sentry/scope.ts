import * as Sentry from '@sentry/react';

import { isSentrySdkEnabled } from './init';

/**
 * Scope setters for Sentry. Small on purpose: `setUser` and tenant tags are the only
 * context the app pushes, and keeping them here gives the `@sentry/*` import one home.
 *
 * Tenant values are UUIDs only. Names, addresses and guest details never become tags —
 * they are PII and they make issue grouping useless.
 */

export function setSentryUser(user: { id: string } | null): void {
  if (!isSentrySdkEnabled) return;
  try {
    // No email / username even if the caller has them: plan D10 is user id only.
    Sentry.setUser(user ? { id: user.id } : null);
  } catch {
    // telemetry must never break the app
  }
}

export type SentryTenantScope = {
  orgId?: string | null;
  propertyId?: string | null;
  parkingId?: string | null;
};

/**
 * Sets the current tenant tags, and clears any that this scope left behind so a navigation
 * from one property to another cannot inherit the previous property's tags.
 */
export function setSentryTenantScope(scope: SentryTenantScope): void {
  if (!isSentrySdkEnabled) return;
  try {
    Sentry.setTags({
      org_id: scope.orgId ?? undefined,
      property_id: scope.propertyId ?? undefined,
      parking_id: scope.parkingId ?? undefined,
    });
  } catch {
    // telemetry must never break the app
  }
}

/** The surface tag used by filters and alert routing (`host_dashboard`, `guest_booking`, …). */
export function setSentrySurface(surface: string | undefined): void {
  if (!isSentrySdkEnabled) return;
  try {
    Sentry.setTag('surface', surface ?? undefined);
  } catch {
    // telemetry must never break the app
  }
}
