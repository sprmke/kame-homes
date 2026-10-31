/**
 * Import access — property-scoped only.
 *
 * Booking CSV/Excel import lives on the property bookings list and is gated by
 * `bookings.import:add` (+ plan feature `bookingImport`). There is no org-hub
 * import UI; `property_id` is required on every `import-*` endpoint.
 */

import {
  requirePropertyPermissionAndFeature,
  verifyPropertyAccess,
  type PropertyAccessContext,
} from './orgAuth.ts';
import { catchPlanFeatureError, requirePropertyFeature } from './planEntitlements.ts';
import type { TeamPermissionId } from './propertyTeamPermissions.ts';
import { readPropertyIdFromUrl } from './propertyScope.ts';

const SCOPE_PERM: TeamPermissionId = 'bookings.import:add';

export type ImportAccessContext = PropertyAccessContext & {
  orgId: string;
  propertyId: string;
};

/** @internal Documents the property permission used by import endpoints. */
export const IMPORT_ACCESS_PERMISSIONS = {
  property: SCOPE_PERM,
} as const;

async function readRequiredPropertyId(req: Request): Promise<string> {
  const url = new URL(req.url);
  const propertyId = readPropertyIdFromUrl(url);
  if (!propertyId) {
    throw new Response(JSON.stringify({ success: false, error: 'property_id is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return propertyId;
}

/** Permission gate only (upload / list / cancel stay open without plan). */
export async function resolveImportAccess(req: Request): Promise<ImportAccessContext> {
  const propertyId = await readRequiredPropertyId(req);
  const ctx = await verifyPropertyAccess(req, propertyId, SCOPE_PERM);
  return {
    ...ctx,
    orgId: ctx.org.id,
    propertyId,
  };
}

/**
 * Permission + bookingImport plan gate (D17) — use for match / preview / commit / mapping.
 */
export async function resolveImportAccessWithPlan(req: Request): Promise<ImportAccessContext> {
  const propertyId = await readRequiredPropertyId(req);
  const ctx = await requirePropertyPermissionAndFeature(
    req,
    propertyId,
    SCOPE_PERM,
    'bookingImport'
  );
  return {
    ...ctx,
    orgId: ctx.org.id,
    propertyId,
  };
}

/** Plan-only check when access was already resolved. */
export async function requireImportPlanFeature(
  req: Request,
  propertyId: string
): Promise<Response | null> {
  try {
    await requirePropertyFeature(propertyId, 'bookingImport');
    return null;
  } catch (err) {
    return catchPlanFeatureError(req, err);
  }
}
