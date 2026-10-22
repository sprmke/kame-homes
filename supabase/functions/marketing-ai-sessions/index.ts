/**
 * marketing-ai-sessions — AI Studio conversations and their versions.
 *
 * GET    ?output=&q=&deleted=1&cursor=&limit=   Home list (one row per conversation, cover
 *                                                = newest finished version) + Premium flags
 * GET    ?id=…                                  One conversation with its versions (photo /
 *                                                clip jobs + post versions), oldest first
 * POST   { action: 'post-versions', … }         Save rendered post versions (first turn: 4,
 *                                                refinement / layout change: 1); creates the
 *                                                conversation when sessionId is missing
 * POST   { action: 'restore', ids }             Restore from Recently deleted
 * PATCH  { id, title }                          Rename
 * DELETE { ids, permanent? }                    Soft delete, or delete forever (outputs too)
 * DELETE { postVersionId }                      Remove one post version
 *
 * Photo and clip versions are created by generate-marketing-media (sessionId /
 * parentJobId) and removed through marketing-generations.
 *
 * Auth: reading is `marketing:view` with no plan gate (your own output survives a
 * downgrade). Writes need an AI generate leaf; saving post versions also needs
 * `marketing.generate:add` + `aiMarketingGeneration`, like generating them.
 */

import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import type { SupabaseClient } from '../_shared/supabaseJs.ts';
import { isMarketingThemeKey } from '../_shared/marketingTheme.ts';
import {
  MARKETING_GENERATION_JOB_COLUMNS,
  toMarketingGenerationJobDto,
} from '../_shared/marketingGenerationJobs.ts';
import { removeGenerationObjects } from '../_shared/marketingGenerationStorage.ts';
import { peekMarketingGenerationOverrides } from '../_shared/marketingGenerationFeatureConfig.ts';
import {
  removeTemplateThumbnail,
  templateThumbnailUrl,
  uploadTemplateThumbnail,
} from '../_shared/marketingTemplateThumbnails.ts';
import { isUuid, parseIdList, recentlyDeletedCutoff } from '../_shared/marketingTemplateLibrary.ts';
import {
  normalizeSessionTitle,
  normalizeTurnPrompt,
  pageSessionRows,
  parsePostVersionInputs,
  parseSessionListQuery,
  serializePostVersion,
  serializeSessionRow,
  sessionTitleFromPrompt,
  type AiSessionRpcRow,
} from '../_shared/marketingAiSessions.ts';

const GENERATE_LEAVES = [
  'marketing.generate:add',
  'marketing.generate.image:add',
  'marketing.generate.video:add',
] as const;

const SESSION_COLUMNS =
  'id, organization_id, property_id, output, title, theme_key, created_by, created_at, updated_at, deleted_at';
const POST_VERSION_COLUMNS =
  'id, session_id, turn_id, prompt, goal, format, spec, photo_urls, preview_path, parent_version_id, created_at';
/** Expired Recently deleted conversations removed (with their files) per list request. */
const LAZY_PURGE_PER_REQUEST = 25;

type SessionRow = {
  id: string;
  organization_id: string;
  property_id: string;
  output: string;
  title: string;
  theme_key: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function serializeSession(row: SessionRow) {
  return {
    id: row.id,
    output: row.output,
    title: row.title,
    themeKey: row.theme_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

serveAuthenticated('marketing-ai-sessions', async (req, user) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return jsonError(req, 'Method not allowed', 405);
  }
  const url = new URL(req.url);
  const body = req.method === 'GET' ? {} : await readJsonBody(req);
  const action = typeof body.action === 'string' ? body.action : '';
  const savesPosts = req.method === 'POST' && action === 'post-versions';

  let propertyId: string;
  let organizationId: string;
  let accessKind: string;
  try {
    const scoped = await resolveScopedPropertyAccess(req, 'marketing:view');
    propertyId = scoped.property.id;
    organizationId = String(scoped.property.organization_id);
    const access = savesPosts
      ? await requirePropertyPermissionAndFeature(
          req,
          propertyId,
          'marketing.generate:add',
          'aiMarketingGeneration'
        )
      : await requirePropertyPermissionAndFeature(req, propertyId, 'marketing:view');
    accessKind = access.accessKind;
    if (
      req.method !== 'GET' &&
      !GENERATE_LEAVES.some((leaf) => access.permissions.includes(leaf))
    ) {
      return jsonError(req, 'You do not have permission to change AI creations', 403);
    }
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const sb = createServiceClient();
  const publicUrl = (path: string | null) => templateThumbnailUrl(sb, path);
  const logBase = {
    req,
    user,
    propertyId,
    organizationId,
    accessKind,
    targetType: 'marketing_ai_session' as const,
  };

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const id = url.searchParams.get('id');
    if (id) {
      if (!isUuid(id)) return jsonError(req, 'id must be a UUID', 400);
      const session = await loadSession(sb, id, propertyId);
      if (!session) return jsonError(req, 'Not found', 404);
      const [jobs, posts] = await Promise.all([
        sb
          .from('marketing_generation_jobs')
          .select(MARKETING_GENERATION_JOB_COLUMNS)
          .eq('session_id', id)
          .order('created_at', { ascending: true })
          .limit(200),
        sb
          .from('marketing_ai_post_versions')
          .select(POST_VERSION_COLUMNS)
          .eq('session_id', id)
          .order('created_at', { ascending: true })
          .limit(200),
      ]);
      if (jobs.error) return jsonError(req, jobs.error.message, 500);
      if (posts.error) return jsonError(req, posts.error.message, 500);
      return jsonSuccess(req, {
        session: serializeSession(session),
        jobs: (jobs.data ?? []).map((row) => toMarketingGenerationJobDto(row)),
        postVersions: (posts.data ?? []).map((row) => serializePostVersion(row, publicUrl)),
      });
    }

    const query = parseSessionListQuery(url.searchParams);
    if (typeof query === 'string') return jsonError(req, query, 400);
    if (query.deleted) await purgeExpiredSessions(sb, propertyId);
    const { data, error } = await sb.rpc('list_marketing_ai_sessions', {
      p_property_id: propertyId,
      p_output: query.output,
      p_query: query.query,
      p_deleted: query.deleted,
      p_cursor_at: query.cursor?.at ?? null,
      p_cursor_id: query.cursor?.id ?? null,
      p_limit: query.limit + 1,
    });
    if (error) return jsonError(req, error.message, 500);
    const page = pageSessionRows((data ?? []) as AiSessionRpcRow[], query.limit);
    // Premium quality is a per-property switch; the composer needs it before any job.
    const overrides = await peekMarketingGenerationOverrides(propertyId);
    return jsonSuccess(req, {
      items: page.rows.map((row) => serializeSessionRow(row, publicUrl)),
      nextCursor: page.nextCursor,
      allowPremiumImage: overrides.allowPremiumImage,
      allowPremiumVideo: overrides.allowPremiumVideo,
    });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (action === 'restore') {
      const ids = parseIdList(body);
      if (typeof ids === 'string') return jsonError(req, ids, 400);
      const { data, error } = await sb
        .from('marketing_ai_sessions')
        .update({ deleted_at: null })
        .eq('property_id', propertyId)
        .in('id', ids)
        .not('deleted_at', 'is', null)
        .select('id, title');
      if (error) return jsonError(req, error.message, 500);
      const restored = data ?? [];
      if (restored.length > 0) {
        await logAssetActivity({
          ...logBase,
          action: 'marketing.ai_session_restored',
          targetId: restored[0]!.id,
          targetLabel: restored.length === 1 ? restored[0]!.title : null,
          metadata: { count: restored.length, ids: restored.map((row) => row.id) },
        });
      }
      return jsonSuccess(req, { restored: restored.map((row) => row.id) });
    }

    if (action === 'post-versions') {
      return await savePostVersions(req, sb, body, {
        propertyId,
        organizationId,
        userId: user.id,
        publicUrl,
      });
    }

    return jsonError(req, 'Unknown action', 400);
  }

  // ── PATCH (rename) ───────────────────────────────────────────────────────
  // activity-log: N/A — renaming an AI creation is editor housekeeping, like autosave.
  if (req.method === 'PATCH') {
    const id = typeof body.id === 'string' ? body.id : '';
    if (!isUuid(id)) return jsonError(req, 'id is required', 400);
    const title = normalizeSessionTitle(body.title);
    if (!title) return jsonError(req, 'Name is required', 400);
    const { data, error } = await sb
      .from('marketing_ai_sessions')
      .update({ title })
      .eq('id', id)
      .eq('property_id', propertyId)
      .select(SESSION_COLUMNS)
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    if (!data) return jsonError(req, 'Not found', 404);
    return jsonSuccess(req, { session: serializeSession(data as SessionRow) });
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (typeof body.postVersionId === 'string') {
    // activity-log: N/A — dropping one draft version inside a conversation.
    const versionId = body.postVersionId;
    if (!isUuid(versionId)) return jsonError(req, 'postVersionId must be a UUID', 400);
    const { data, error } = await sb
      .from('marketing_ai_post_versions')
      .delete()
      .eq('id', versionId)
      .eq('property_id', propertyId)
      .select('id, session_id, preview_path')
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    if (!data) return jsonError(req, 'Not found', 404);
    await removeTemplateThumbnail(sb, data.preview_path as string | null);
    return jsonSuccess(req, { deleted: versionId });
  }

  const ids = parseIdList(body);
  if (typeof ids === 'string') return jsonError(req, ids, 400);
  const permanent = body.permanent === true;

  const { data: rows, error: rowsError } = await sb
    .from('marketing_ai_sessions')
    .select('id, title')
    .eq('property_id', propertyId)
    .in('id', ids);
  if (rowsError) return jsonError(req, rowsError.message, 500);
  const found = rows ?? [];
  if (found.length === 0) return jsonError(req, 'Not found', 404);
  const foundIds = found.map((row) => row.id as string);

  if (permanent) {
    // A clip still rendering holds credits and will be finished by the sweeper; its row
    // must survive until then.
    const { data: inFlight, error: flightError } = await sb
      .from('marketing_generation_jobs')
      .select('id')
      .in('session_id', foundIds)
      .in('job_status', ['pending', 'processing', 'finalizing'])
      .limit(1);
    if (flightError) return jsonError(req, flightError.message, 500);
    if ((inFlight ?? []).length > 0) {
      return jsonError(req, 'A clip is still being made. Delete it when it finishes.', 409);
    }
    await removeSessionFiles(sb, foundIds);
    const { error } = await sb.from('marketing_ai_sessions').delete().in('id', foundIds);
    if (error) return jsonError(req, error.message, 500);
  } else {
    const { error } = await sb
      .from('marketing_ai_sessions')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', foundIds)
      .is('deleted_at', null);
    if (error) return jsonError(req, error.message, 500);
  }

  await logAssetActivity({
    ...logBase,
    action: 'marketing.ai_session_deleted',
    targetId: foundIds[0]!,
    targetLabel: found.length === 1 ? (found[0]!.title as string) : null,
    metadata: { count: found.length, ids: foundIds, permanent },
  });
  return jsonSuccess(req, { deleted: foundIds, permanent });
});

async function loadSession(
  sb: SupabaseClient,
  id: string,
  propertyId: string
): Promise<SessionRow | null> {
  const { data } = await sb
    .from('marketing_ai_sessions')
    .select(SESSION_COLUMNS)
    .eq('id', id)
    .eq('property_id', propertyId)
    .maybeSingle();
  return (data as SessionRow | null) ?? null;
}

async function savePostVersions(
  req: Request,
  sb: SupabaseClient,
  body: Record<string, unknown>,
  ctx: {
    propertyId: string;
    organizationId: string;
    userId: string;
    publicUrl: (path: string | null) => string | null;
  }
): Promise<Response> {
  const versions = parsePostVersionInputs(body.versions);
  if (typeof versions === 'string') return jsonError(req, versions, 400);
  const prompt = normalizeTurnPrompt(body.prompt);
  const themeKey =
    typeof body.themeKey === 'string' && isMarketingThemeKey(body.themeKey) ? body.themeKey : null;

  let parentVersionId: string | null = null;
  if (body.parentVersionId !== undefined && body.parentVersionId !== null) {
    if (!isUuid(body.parentVersionId)) return jsonError(req, 'parentVersionId must be a UUID', 400);
    parentVersionId = body.parentVersionId;
  }

  let session: SessionRow | null = null;
  if (body.sessionId !== undefined && body.sessionId !== null) {
    if (!isUuid(body.sessionId)) return jsonError(req, 'sessionId must be a UUID', 400);
    session = await loadSession(sb, body.sessionId, ctx.propertyId);
    if (!session) return jsonError(req, 'Conversation not found', 404);
    if (session.output !== 'post') return jsonError(req, 'That conversation is not a post', 400);
    if (session.deleted_at)
      return jsonError(req, 'Restore this creation to keep working on it', 409);
  } else {
    const { data, error } = await sb
      .from('marketing_ai_sessions')
      .insert({
        organization_id: ctx.organizationId,
        property_id: ctx.propertyId,
        output: 'post',
        title: normalizeSessionTitle(body.title) ?? sessionTitleFromPrompt(prompt, 'post'),
        theme_key: themeKey,
        created_by: ctx.userId,
      })
      .select(SESSION_COLUMNS)
      .single();
    if (error) return jsonError(req, error.message, 500);
    session = data as SessionRow;
  }

  if (parentVersionId) {
    const { data: parent } = await sb
      .from('marketing_ai_post_versions')
      .select('id, session_id')
      .eq('id', parentVersionId)
      .maybeSingle();
    if (!parent || parent.session_id !== session.id) {
      return jsonError(req, 'That version belongs to another conversation', 400);
    }
  }

  const turnId = crypto.randomUUID();
  const rows = versions.map((version) => ({
    id: crypto.randomUUID(),
    session_id: session!.id,
    property_id: ctx.propertyId,
    turn_id: turnId,
    prompt,
    goal: version.goal,
    format: version.format,
    spec: version.spec,
    photo_urls: version.photoUrls,
    parent_version_id: parentVersionId,
    created_by: ctx.userId,
  }));

  // Previews are uploaded first so the rows land complete; a bad image only loses
  // its own preview (the client re-renders from the spec).
  const previewPaths = await Promise.all(
    versions.map(async (version, index) => {
      if (!version.previewDataUrl) return null;
      try {
        return await uploadTemplateThumbnail(
          sb,
          ctx.propertyId,
          rows[index]!.id,
          version.previewDataUrl
        );
      } catch {
        return null;
      }
    })
  );

  const { data: inserted, error } = await sb
    .from('marketing_ai_post_versions')
    .insert(rows.map((row, index) => ({ ...row, preview_path: previewPaths[index] })))
    .select(POST_VERSION_COLUMNS);
  if (error) {
    await Promise.all(previewPaths.map((path) => removeTemplateThumbnail(sb, path)));
    return jsonError(req, error.message, 500);
  }
  const { data: touched } = await sb
    .from('marketing_ai_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', session.id)
    .select(SESSION_COLUMNS)
    .maybeSingle();

  // activity-log: N/A — saving rendered drafts inside a conversation; the AI call that
  // made them is the host action (generate-marketing-template).
  const ordered = rows
    .map((row) => (inserted ?? []).find((item) => item.id === row.id))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  return jsonSuccess(req, {
    session: serializeSession((touched as SessionRow | null) ?? session),
    versions: ordered.map((row) => serializePostVersion(row, ctx.publicUrl)),
  });
}

/** Job outputs and post previews for conversations about to be deleted forever. */
async function removeSessionFiles(sb: SupabaseClient, sessionIds: string[]): Promise<void> {
  const [jobs, posts] = await Promise.all([
    sb
      .from('marketing_generation_jobs')
      .select('output_storage_path')
      .in('session_id', sessionIds)
      .not('output_storage_path', 'is', null),
    sb
      .from('marketing_ai_post_versions')
      .select('preview_path')
      .in('session_id', sessionIds)
      .not('preview_path', 'is', null),
  ]);
  const jobPaths = (jobs.data ?? []).map((row) => String(row.output_storage_path));
  if (jobPaths.length > 0) {
    try {
      await removeGenerationObjects(sb, jobPaths);
    } catch (err) {
      console.warn('[marketing-ai-sessions] output cleanup skipped', err);
    }
  }
  await Promise.all(
    (posts.data ?? []).map((row) => removeTemplateThumbnail(sb, row.preview_path as string))
  );
}

/** Conversations past 30 days in Recently deleted: files first, then the rows. */
async function purgeExpiredSessions(sb: SupabaseClient, propertyId: string): Promise<void> {
  try {
    const { data } = await sb
      .from('marketing_ai_sessions')
      .select('id')
      .eq('property_id', propertyId)
      .lt('deleted_at', recentlyDeletedCutoff())
      .limit(LAZY_PURGE_PER_REQUEST);
    const ids = (data ?? []).map((row) => row.id as string);
    if (ids.length === 0) return;
    const { data: inFlight } = await sb
      .from('marketing_generation_jobs')
      .select('session_id')
      .in('session_id', ids)
      .in('job_status', ['pending', 'processing', 'finalizing']);
    const busy = new Set((inFlight ?? []).map((row) => row.session_id as string));
    const purge = ids.filter((id) => !busy.has(id));
    if (purge.length === 0) return;
    await removeSessionFiles(sb, purge);
    await sb.from('marketing_ai_sessions').delete().in('id', purge);
  } catch (err) {
    console.warn('[marketing-ai-sessions] purge skipped', err);
  }
}
