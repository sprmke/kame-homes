/**
 * property-lifecycle — read a listing's lifecycle state and impact, and run the host
 * lifecycle actions (pause / resume / archive / restore).
 *
 * GET  ?property_id=<uuid>[&impact=1]   settings:view
 * POST { property_id, action }          settings.listingStatus:edit
 *
 * The server owns every rule: the UI renders `allowedActions` / `activationBlock` and never
 * derives them. `update-property` rejects `status`, so this is the only host path.
 *
 * Plan: docs/workflow/in-progress/property-archive-and-delete-lifecycle.md (P2).
 */

import { buildActorContext, logActivity, type ActivityAction } from '../_shared/activityLog.ts';
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  archiveProperty,
  buildPropertyLifecycleDto,
  getPropertyLifecycleImpact,
  loadLifecycleProperty,
  pauseProperty,
  PropertyLifecycleError,
  restoreProperty,
  resolvePropertyLifecycleState,
  resumeProperty,
  type PropertyLifecycleAction,
} from '../_shared/propertyLifecycle.ts';
import { verifyPropertyAccess, type PropertyAccessContext } from '../_shared/orgAuth.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const ACTION_ACTIVITY: Record<PropertyLifecycleAction, ActivityAction> = {
  pause: 'property.paused',
  resume: 'property.resumed',
  archive: 'property.archived',
  restore: 'property.restored',
};

function lifecycleErrorResponse(req: Request, error: unknown): Response {
  if (error instanceof PropertyLifecycleError) {
    if (error.details) {
      return jsonResponse(
        req,
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        },
        error.status,
        'private'
      );
    }
    return jsonError(req, error.message, error.status);
  }
  throw error;
}

function serializeLifecycleProperty(
  property: Awaited<ReturnType<typeof loadLifecycleProperty>>
) {
  return {
    id: property.id,
    status: property.status,
    inactiveReason: property.inactive_reason,
    archivedAt: property.archived_at,
    pausedAt: property.paused_at,
  };
}

async function buildDto(access: PropertyAccessContext) {
  return buildPropertyLifecycleDto(access.property, {
    canDelete: access.accessKind === 'owner' || access.accessKind === 'platform_admin',
  });
}

serveAuthenticated('property-lifecycle', async (req) => {
  // ── GET: state (+ optional impact) ────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const propertyId = (url.searchParams.get('property_id') ?? '').trim();
    if (!propertyId) return jsonError(req, 'property_id is required', 400);

    const access = await verifyPropertyAccess(req, propertyId, 'settings:view');
    const lifecycle = await buildDto(access);

    if (url.searchParams.get('impact') !== '1') {
      return jsonSuccess(req, { lifecycle });
    }

    const impact = await getPropertyLifecycleImpact(propertyId);
    return jsonSuccess(req, { lifecycle, impact });
  }

  if (req.method !== 'POST') return jsonError(req, 'Method not allowed', 405);

  // ── POST: lifecycle action ────────────────────────────────────────────────
  const body = await readJsonBody(req);
  const propertyId = typeof body.property_id === 'string' ? body.property_id.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim() : '';

  if (!propertyId) return jsonError(req, 'property_id is required', 400);
  if (action !== 'pause' && action !== 'resume' && action !== 'archive' && action !== 'restore') {
    return jsonError(req, 'action must be pause, resume, archive, or restore', 400);
  }

  const access = await verifyPropertyAccess(req, propertyId, 'settings.listingStatus:edit');
  const property = access.property;

  // Snapshot before the write so the activity row can say what archiving turned off.
  const impactBefore =
    action === 'archive' ? await getPropertyLifecycleImpact(propertyId) : null;

  let result;
  try {
    switch (action) {
      case 'pause':
        result = await pauseProperty(propertyId);
        break;
      case 'resume':
        result = await resumeProperty(propertyId);
        break;
      case 'archive':
        result = await archiveProperty(propertyId, access.user.id);
        break;
      case 'restore':
        result = await restoreProperty(propertyId);
        break;
    }
  } catch (error) {
    return lifecycleErrorResponse(req, error);
  }

  const changed = result.previousState !== result.state;
  if (changed) {
    await logActivity({
      action: ACTION_ACTIVITY[action],
      organizationId: access.org.id,
      propertyId,
      scope: 'property',
      actor: buildActorContext('dashboard', { propertyAccess: access }, req),
      targetType: 'property',
      targetId: propertyId,
      targetLabel: property.name ?? null,
      metadata:
        action === 'archive' && impactBefore
          ? {
              from_state: result.previousState,
              to_state: result.state,
              billing_removed: impactBefore.subscription.billed,
              scheduled_posts: impactBefore.marketing.scheduledPosts,
              import_feeds: impactBefore.calendar.importFeeds,
              ical_export: impactBefore.calendar.exportEnabled,
            }
          : { from_state: result.previousState, to_state: result.state },
    });
  }

  const refreshed = await loadLifecycleProperty(propertyId);
  const lifecycle = await buildPropertyLifecycleDto(refreshed, {
    canDelete: access.accessKind === 'owner' || access.accessKind === 'platform_admin',
  });

  // A successful archive changed automations and the subscription slot. Return the fresh
  // impact so the success sheet can list exactly what to turn back on after a restore.
  const impact =
    action === 'archive' || action === 'restore'
      ? await getPropertyLifecycleImpact(propertyId)
      : null;

  return jsonSuccess(req, {
    lifecycle,
    property: serializeLifecycleProperty(refreshed),
    state: resolvePropertyLifecycleState(refreshed),
    impact,
  });
});
