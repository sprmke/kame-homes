/**
 * setup-guide-state — GET/PATCH org Setup Guide meta (`settings.setupGuide`).
 * Auth: JWT + any active org member (no org.settings.basic:edit required).
 * Writes via set_org_setup_guide_state RPC so sibling settings keys are never clobbered.
 */

import { createServiceClient, verifyOrgAccess } from '../_shared/orgAuth.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const ALLOWED_PATCH_KEYS = new Set([
  'dismissedAt',
  'completedAt',
  'lastStepId',
  'skippedSteps',
  'reviewedSteps',
  'version',
]);

function isIsoOrNull(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function sanitizePatch(raw: Record<string, unknown>): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_PATCH_KEYS.has(key)) continue;
    if (key === 'dismissedAt' || key === 'completedAt') {
      if (!isIsoOrNull(value)) return null;
      patch[key] = value;
      continue;
    }
    if (key === 'lastStepId') {
      if (!(value === null || (typeof value === 'string' && value.length > 0))) return null;
      patch[key] = value;
      continue;
    }
    if (key === 'skippedSteps' || key === 'reviewedSteps') {
      if (!isStringArray(value)) return null;
      patch[key] = value;
      continue;
    }
    if (key === 'version') {
      if (value !== 1) return null;
      patch[key] = 1;
    }
  }
  return patch;
}

function readSetupGuideFromSettings(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {};
  }
  const guide = (settings as Record<string, unknown>).setupGuide;
  if (!guide || typeof guide !== 'object' || Array.isArray(guide)) {
    return {};
  }
  return guide as Record<string, unknown>;
}

serveAuthenticated('setup-guide-state', async (req) => {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'PATCH') {
    return jsonError(req, 'Method not allowed', 405);
  }

  let orgId = '';
  let body: Record<string, unknown> = {};

  if (method === 'GET') {
    requireHttpMethod(req, 'GET');
    const url = new URL(req.url);
    orgId = (url.searchParams.get('orgId') ?? '').trim();
  } else {
    requireHttpMethod(req, 'PATCH');
    body = await readJsonBody(req);
    orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  }

  if (!orgId) {
    return jsonError(req, 'orgId is required');
  }

  // Any active org member may dismiss/advance the guide (R6) — no settings edit leaf.
  const { org } = await verifyOrgAccess(req, { orgId });

  if (method === 'GET') {
    return jsonSuccess(req, {
      setupGuide: readSetupGuideFromSettings(org.settings),
    });
  }

  const rawPatch =
    body.patch && typeof body.patch === 'object' && !Array.isArray(body.patch)
      ? (body.patch as Record<string, unknown>)
      : (() => {
          const { orgId: _orgId, patch: _patch, ...rest } = body;
          return rest;
        })();

  const patch = sanitizePatch(rawPatch);
  if (!patch) {
    return jsonError(req, 'Invalid setupGuide patch');
  }
  if (Object.keys(patch).length === 0) {
    return jsonError(req, 'patch must include at least one setupGuide field');
  }

  // Always stamp schema version so older clients stay readable.
  if (patch.version === undefined) {
    patch.version = 1;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('set_org_setup_guide_state', {
    p_org_id: orgId,
    p_patch: patch,
  });

  if (error) {
    console.error('[setup-guide-state]', error.message);
    const notFound = /organization not found/i.test(error.message);
    return jsonError(
      req,
      notFound ? 'Organization not found' : 'Failed to update setup guide',
      notFound ? 404 : 500
    );
  }

  return jsonSuccess(req, {
    setupGuide: data && typeof data === 'object' ? data : patch,
  });
});
