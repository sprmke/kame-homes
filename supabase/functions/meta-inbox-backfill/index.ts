/**
 * Meta inbox conversation backfill — one Graph page per request.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { resolveInboxAccess } from '../_shared/inboxAccess.ts';
import { createServiceClient, verifyAuthenticatedUser } from '../_shared/orgAuth.ts';
import { resolveSupabaseServiceRoleKey } from '../_shared/supabaseRuntimeEnv.ts';
import type { SocialChannelConnectionRow } from '../_shared/socialInboxTypes.ts';
import { isFeatureAvailable } from '../_shared/featureAvailability.ts';
import { capturePostHogException } from '../_shared/posthog.ts';

function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const key = resolveSupabaseServiceRoleKey();
  return !!key && token === key;
}

async function facebookConnectionForOrg(orgId: string): Promise<SocialChannelConnectionRow | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('social_channel_connections')
    .select('*')
    .eq('organization_id', orgId)
    .eq('platform', 'facebook')
    .eq('status', 'connected')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as SocialChannelConnectionRow | null) ?? null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonError(req, 'Method not allowed', 405);
  }

  let orgId: string;
  let phase: 'messenger' | 'instagram' = 'messenger';
  let nextUrl: string | null = null;
  let finalize = false;
  let light = false;

  try {
    const body = await readJsonBody(req);
    finalize = body.finalize === true;
    light = body.light === true;

    if (isServiceRoleRequest(req)) {
      orgId = String(body.organizationId ?? '').trim();
      if (!orgId) return jsonError(req, 'organizationId required', 400);
    } else {
      await verifyAuthenticatedUser(req);
      const permission = light ? 'view' : 'channels_add';
      const ctx = await resolveInboxAccess(req, permission, body as Record<string, unknown>);
      orgId = ctx.orgId;
    }

    const rawPhase = String(body.phase ?? 'messenger').trim();
    if (rawPhase === 'instagram' || rawPhase === 'messenger') {
      phase = rawPhase;
    }
    const rawNext = body.nextUrl;
    nextUrl = typeof rawNext === 'string' && rawNext.trim() ? rawNext.trim() : null;
  } catch {
    return jsonError(req, 'Unauthorized', 401);
  }

  const facebook = await facebookConnectionForOrg(orgId);
  if (!facebook) {
    return jsonError(req, 'No Meta connection', 404);
  }

  if (!(await isFeatureAvailable('inbox.meta.sync'))) {
    return jsonSuccess(req, {
      done: true,
      phase: 'complete',
      nextUrl: null,
      syncedInChunk: 0,
      metaHasMore: false,
      metaSyncPaused: true,
    });
  }

  try {
    const { backfillOrgMetaInboxChunk, finalizeMetaInboxSync } =
      await import('../_shared/metaInboxBackfill.ts');
    if (finalize) {
      await finalizeMetaInboxSync(orgId);
      return jsonSuccess(req, {
        done: true,
        phase: 'complete',
        nextUrl: null,
        syncedInChunk: 0,
        metaHasMore: false,
      });
    }
    const result = await backfillOrgMetaInboxChunk(
      orgId,
      {
        phase,
        nextUrl,
      },
      { light }
    );
    return jsonSuccess(req, result);
  } catch (e) {
    console.error('[meta-inbox-backfill]', e);
    await capturePostHogException(e, { logPrefix: 'meta-inbox-backfill', request: req });
    return jsonError(req, (e as Error).message, 500);
  }
});
