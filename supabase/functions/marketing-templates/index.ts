/**
 * marketing-templates — property-scoped Marketing Studio items (designs + templates).
 *
 * GET    ?view=library&content_type=…   Library page (one card per size group, no design_json)
 * GET    ?view=usage&content_type=…     Templates used in the last 30 days (Continue / Start new)
 * GET    ?id=…                          One full row (410 when it is in Recently deleted)
 * GET                                    Legacy full list (theme cards, assistant context)
 * POST   { name, contentType, … }       Create (first edit of a draft, AI result, template)
 * POST   { action: 'duplicate', id, … } Server-side copy (Duplicate, Copy to another size,
 *                                        Save as template), thumbnail copied too
 * POST   { action: 'restore', ids }     Restore from Recently deleted
 * PATCH  { id, …, ifUpdatedAt? }        Autosave / rename; 409 when changed elsewhere
 * DELETE { ids | id, permanent? }       Soft delete (Recently deleted) or delete forever
 *
 * Auth: marketing.* leaves; plan gate customTemplates on create / edit. Reading the
 * Library is open on every tier (your own work); restore / delete are ungated.
 */

import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  resolveOrganizationIdForProperty,
  resolveScopedPropertyAccess,
} from '../_shared/propertyScope.ts';
import type { TeamPermissionId } from '../_shared/propertyTeamPermissions.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import { isMarketingThemeKey } from '../_shared/marketingTheme.ts';
import {
  copyTemplateThumbnail,
  removeTemplateThumbnail,
  splitThumbnail,
  templateThumbnailUrl,
  uploadTemplateThumbnail,
} from '../_shared/marketingTemplateThumbnails.ts';
import {
  duplicateName,
  isMarketingContentType,
  isMarketingItemKind,
  isUuid,
  normalizeItemName,
  pageLibraryRows,
  parseGroupIdField,
  parseIdList,
  parseLibraryQuery,
  parseTemplateRefField,
  patchActivityFields,
  recentlyDeletedCutoff,
  sameInstant,
  serializeLibraryRow,
  templateUsageSince,
  type LibraryRpcRow,
} from '../_shared/marketingTemplateLibrary.ts';
import type { SupabaseClient } from '../_shared/supabaseJs.ts';

type MarketingTemplateRow = {
  id: string;
  property_id: string;
  organization_id: string;
  name: string;
  content_type: string;
  platform: string | null;
  aspect_preset: string | null;
  design_json: Record<string, unknown>;
  theme_key: string | null;
  thumbnail_path: string | null;
  kind: string;
  group_id: string | null;
  source_template_id: string | null;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Rows migrated per list request (older rows still embed base64 thumbnails). */
const LEGACY_THUMBNAIL_MIGRATIONS_PER_REQUEST = 6;
/** Expired Recently deleted rows removed (with their thumbnails) per list request. */
const LAZY_PURGE_PER_REQUEST = 25;

function serializeTemplate(row: MarketingTemplateRow, sb: SupabaseClient) {
  return {
    id: row.id,
    propertyId: row.property_id,
    organizationId: row.organization_id,
    name: row.name,
    contentType: row.content_type,
    platform: row.platform,
    aspectPreset: row.aspect_preset,
    designJson: row.design_json ?? {},
    themeKey: row.theme_key ?? null,
    thumbnailUrl: templateThumbnailUrl(sb, row.thumbnail_path ?? null),
    kind: row.kind ?? 'design',
    groupId: row.group_id ?? null,
    sourceTemplateId: row.source_template_id ?? null,
    deletedAt: row.deleted_at ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** `undefined` = not sent; `null` = clear; string = validated key; Error = invalid. */
function parseThemeKey(value: unknown): string | null | undefined | Error {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return isMarketingThemeKey(value) ? value : new Error('themeKey is not a valid theme');
}

function parseDesignJson(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function resolveMarketingPropertyId(
  req: Request,
  permission: TeamPermissionId
): Promise<string> {
  const ctx = await resolveScopedPropertyAccess(req, permission);
  return ctx.property.id;
}

/** Team permission for each request shape (POST depends on `action`). */
function permissionFor(method: string, action: string): TeamPermissionId | null {
  switch (method) {
    case 'GET':
      // Seeing your own saved work is not the paid action (plans-feature-matrix): any
      // tier can open its Library; Download / Publish keep their own gates.
      return 'marketing:view';
    case 'POST':
      // Restoring is undoing a delete: same leaf as delete, no paid action.
      return action === 'restore' ? 'marketing.templates:delete' : 'marketing.templates:add';
    case 'PATCH':
      return 'marketing.templates:edit';
    case 'DELETE':
      return 'marketing.templates:delete';
    default:
      return null;
  }
}

serveAuthenticated('marketing-templates', async (req, user) => {
  const url = new URL(req.url);
  const body =
    req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE'
      ? await readJsonBody(req)
      : {};
  const action = typeof body.action === 'string' ? body.action : '';

  const permission = permissionFor(req.method, action);
  if (!permission) return jsonError(req, 'Method not allowed', 405);
  // Creating and editing designs / templates is the paid action (Starter+).
  const writesContent = (req.method === 'POST' && action !== 'restore') || req.method === 'PATCH';
  const planFeature = writesContent ? 'customTemplates' : undefined;

  let propertyId: string;
  let actorUserId: string | null = null;
  try {
    propertyId = await resolveMarketingPropertyId(req, permission);
    const ctx = await requirePropertyPermissionAndFeature(req, propertyId, permission, planFeature);
    actorUserId = ctx.user.id;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const organizationId = await resolveOrganizationIdForProperty(propertyId);
  const sb = createServiceClient();
  const thumbUrl = (path: string | null) => templateThumbnailUrl(sb, path);
  const logBase = { req, user, propertyId, organizationId, targetType: 'template' as const };

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const view = url.searchParams.get('view');

    if (view === 'library') {
      const query = parseLibraryQuery(url.searchParams, isMarketingThemeKey);
      if (typeof query === 'string') return jsonError(req, query, 400);
      if (query.deleted) await purgeExpiredDeleted(sb, propertyId);

      const { data, error } = await sb.rpc('list_marketing_library', {
        p_property_id: propertyId,
        p_content_type: query.contentType,
        p_kind: query.kind,
        p_theme_key: query.themeKey,
        p_query: query.query,
        p_aspect: query.aspect,
        p_deleted: query.deleted,
        p_sort: query.sort,
        p_cursor_key: query.cursor?.key ?? null,
        p_cursor_id: query.cursor?.id ?? null,
        p_limit: query.limit + 1,
      });
      if (error) return jsonError(req, error.message, 500);
      const page = pageLibraryRows((data ?? []) as LibraryRpcRow[], query.limit);
      await migrateLibraryPageThumbnails(sb, propertyId, page.rows);
      return jsonSuccess(req, {
        items: page.rows.map((row) => serializeLibraryRow(row, thumbUrl)),
        nextCursor: page.nextCursor,
      });
    }

    if (view === 'usage') {
      const contentType = url.searchParams.get('content_type');
      if (!isMarketingContentType(contentType)) {
        return jsonError(req, 'content_type must be calendar, design, or video', 400);
      }
      const themeParam = url.searchParams.get('theme_key');
      if (themeParam && !isMarketingThemeKey(themeParam)) {
        return jsonError(req, 'theme_key is not a valid theme', 400);
      }
      const { data, error } = await sb.rpc('marketing_template_usage', {
        p_property_id: propertyId,
        p_content_type: contentType,
        p_theme_key: themeParam || null,
        p_since: templateUsageSince(),
      });
      if (error) return jsonError(req, error.message, 500);
      const usage = (
        (data ?? []) as Array<{
          source_template_id: string;
          use_count: number;
          latest_id: string;
          latest_name: string;
          latest_aspect_preset: string | null;
          latest_updated_at: string;
        }>
      ).map((row) => ({
        sourceTemplateId: row.source_template_id,
        count: row.use_count,
        latestId: row.latest_id,
        latestName: row.latest_name,
        latestAspectPreset: row.latest_aspect_preset,
        latestUpdatedAt: row.latest_updated_at,
      }));
      return jsonSuccess(req, { usage });
    }

    if (view === 'showcase') {
      // Latest live design per theme + type. Theme cards draw sample art and do not call this.
      // Light columns for every row; design_json only for the latest calendar of each theme.
      const { data, error } = await sb
        .from('marketing_templates')
        .select('id, name, content_type, aspect_preset, theme_key, thumbnail_path, updated_at')
        .eq('property_id', propertyId)
        .eq('kind', 'design')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(2000);
      if (error) return jsonError(req, error.message, 500);
      const latest = new Map<string, Record<string, unknown>>();
      for (const row of (data ?? []) as Array<Record<string, unknown>>) {
        const key = `${row.theme_key ?? ''}|${row.content_type}`;
        if (!latest.has(key)) latest.set(key, row);
      }
      const picked = [...latest.values()];
      const ids = picked.map((row) => row.id as string);
      const { data: jsonRows, error: jsonError2 } = ids.length
        ? await sb
            .from('marketing_templates')
            .select('id, content_type, design_json')
            .eq('property_id', propertyId)
            .in('id', ids)
        : { data: [], error: null };
      if (jsonError2) return jsonError(req, jsonError2.message, 500);
      const jsonById = new Map(
        (
          (jsonRows ?? []) as Array<{
            id: string;
            content_type: string;
            design_json: Record<string, unknown>;
          }>
        ).map((row) => {
          const json = row.design_json ?? {};
          // Posts / videos only need their theme hash; calendars need their styles.
          const slim =
            row.content_type === 'calendar'
              ? {
                  styles: json.styles,
                  themeTokens: json.themeTokens,
                  themeHash: json.themeHash,
                  lockedPaths: json.lockedPaths,
                  sourcePresetId: json.sourcePresetId,
                }
              : { themeHash: json.themeHash };
          return [row.id, slim];
        })
      );
      return jsonSuccess(req, {
        templates: picked.map((row) => ({
          id: row.id,
          name: row.name,
          contentType: row.content_type,
          aspectPreset: row.aspect_preset,
          themeKey: row.theme_key,
          thumbnailUrl: thumbUrl((row.thumbnail_path as string | null) ?? null),
          designJson: jsonById.get(row.id as string) ?? {},
          updatedAt: row.updated_at,
          platform: null,
        })),
      });
    }

    const templateId = url.searchParams.get('id')?.trim();
    if (templateId) {
      if (!isUuid(templateId)) return jsonError(req, 'Template not found', 404);
      const { data, error } = await sb
        .from('marketing_templates')
        .select('*')
        .eq('property_id', propertyId)
        .eq('id', templateId)
        .maybeSingle();
      if (error) return jsonError(req, error.message, 500);
      if (!data) return jsonError(req, 'Template not found', 404);
      const row = data as MarketingTemplateRow;
      if (row.deleted_at) {
        return jsonResponse(
          req,
          { success: false, error: 'This design was deleted', code: 'deleted' },
          410,
          'private'
        );
      }
      let groupMembers: Array<{ id: string; aspectPreset: string | null; updatedAt: string }> = [];
      if (row.group_id) {
        const { data: members } = await sb
          .from('marketing_templates')
          .select('id, aspect_preset, updated_at')
          .eq('property_id', propertyId)
          .eq('group_id', row.group_id)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(20);
        groupMembers = (
          (members ?? []) as Array<{ id: string; aspect_preset: string | null; updated_at: string }>
        ).map((member) => ({
          id: member.id,
          aspectPreset: member.aspect_preset,
          updatedAt: member.updated_at,
        }));
      }
      return jsonSuccess(req, { ...serializeTemplate(row, sb), groupMembers });
    }

    let listQuery = sb
      .from('marketing_templates')
      .select('*')
      .eq('property_id', propertyId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });
    const kindFilter = url.searchParams.get('kind');
    if (isMarketingItemKind(kindFilter)) listQuery = listQuery.eq('kind', kindFilter);
    const { data, error } = await listQuery;
    if (error) return jsonError(req, error.message, 500);
    const rows = (data ?? []) as MarketingTemplateRow[];
    await migrateLegacyThumbnails(sb, propertyId, rows);
    return jsonSuccess(req, { templates: rows.map((row) => serializeTemplate(row, sb)) });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (action === 'restore') {
      const ids = parseIdList(body);
      if (typeof ids === 'string') return jsonError(req, ids, 400);
      const { data, error } = await sb
        .from('marketing_templates')
        .update({ deleted_at: null })
        .eq('property_id', propertyId)
        .in('id', ids)
        .not('deleted_at', 'is', null)
        .select('id, name');
      if (error) return jsonError(req, error.message, 500);
      const restored = (data ?? []) as Array<{ id: string; name: string }>;
      if (restored.length > 0) {
        await logAssetActivity({
          ...logBase,
          action: 'marketing.template_restored',
          targetId: restored[0]!.id,
          targetLabel: restored.length === 1 ? restored[0]!.name : null,
          metadata: { count: restored.length, ids: restored.map((row) => row.id) },
        });
      }
      return jsonSuccess(req, { restored: restored.map((row) => row.id) });
    }

    if (action === 'duplicate') {
      return await duplicateItem(req, sb, body, propertyId, actorUserId, logBase);
    }

    if (action) return jsonError(req, 'Unknown action', 400);

    const name = normalizeItemName(body.name);
    const contentType = body.contentType;
    const platform = optionalText(body.platform);
    const aspectPreset = optionalText(body.aspectPreset);
    const designJson = parseDesignJson(body.designJson);
    const themeKey = parseThemeKey(body.themeKey);
    const kind = body.kind === undefined ? 'design' : body.kind;
    const groupId = parseGroupIdField(body.groupId);
    const sourceTemplateId = parseTemplateRefField(body.sourceTemplateId);

    if (!name) return jsonError(req, 'name is required', 400);
    if (themeKey instanceof Error) return jsonError(req, themeKey.message, 400);
    if (groupId instanceof Error) return jsonError(req, groupId.message, 400);
    if (sourceTemplateId instanceof Error) return jsonError(req, sourceTemplateId.message, 400);
    if (!isMarketingContentType(contentType)) {
      return jsonError(req, 'contentType must be calendar, design, or video', 400);
    }
    if (!isMarketingItemKind(kind)) return jsonError(req, 'kind must be design or template', 400);
    if (designJson === null) return jsonError(req, 'designJson must be an object', 400);
    const split = splitThumbnail(designJson);

    const { data, error } = await sb
      .from('marketing_templates')
      .insert({
        property_id: propertyId,
        organization_id: organizationId,
        name,
        content_type: contentType,
        platform,
        aspect_preset: aspectPreset,
        design_json: split.designJson,
        theme_key: themeKey ?? null,
        kind,
        group_id: groupId ?? null,
        source_template_id: sourceTemplateId ?? null,
        created_by: actorUserId,
      })
      .select('*')
      .single();

    if (error) return jsonError(req, error.message, 500);
    const created = await attachThumbnail(
      sb,
      propertyId,
      data as MarketingTemplateRow,
      split.dataUrl
    );
    await logAssetActivity({
      ...logBase,
      action: 'marketing.template_saved',
      targetId: created.id,
      targetLabel: name,
      metadata: { content_type: contentType, kind, operation: 'create' },
    });
    return jsonSuccess(req, serializeTemplate(created, sb));
  }

  // ── PATCH ────────────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const templateId = typeof body.id === 'string' ? body.id.trim() : '';
    if (!isUuid(templateId)) return jsonError(req, 'id is required', 400);

    const patch: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = normalizeItemName(body.name);
      if (!name) return jsonError(req, 'name cannot be empty', 400);
      patch.name = name;
    }
    if (body.contentType !== undefined) {
      if (!isMarketingContentType(body.contentType)) {
        return jsonError(req, 'contentType must be calendar, design, or video', 400);
      }
      patch.content_type = body.contentType;
    }
    if (body.platform !== undefined) patch.platform = optionalText(body.platform);
    if (body.aspectPreset !== undefined) patch.aspect_preset = optionalText(body.aspectPreset);

    let thumbnailDataUrl: string | null = null;
    if (body.designJson !== undefined) {
      const designJson = parseDesignJson(body.designJson);
      if (designJson === null) return jsonError(req, 'designJson must be an object', 400);
      const split = splitThumbnail(designJson);
      patch.design_json = split.designJson;
      thumbnailDataUrl = split.dataUrl;
    }

    const themeKey = parseThemeKey(body.themeKey);
    if (themeKey instanceof Error) return jsonError(req, themeKey.message, 400);
    if (themeKey !== undefined) patch.theme_key = themeKey;

    // A fresh thumbnail can be sent on its own (no need to resend the whole design).
    if (
      !thumbnailDataUrl &&
      typeof body.thumbnailDataUrl === 'string' &&
      body.thumbnailDataUrl.startsWith('data:')
    ) {
      thumbnailDataUrl = body.thumbnailDataUrl;
    }

    if (Object.keys(patch).length === 0 && !thumbnailDataUrl) {
      return jsonError(req, 'No valid fields to update', 400);
    }

    const { data: current, error: currentError } = await sb
      .from('marketing_templates')
      .select('*')
      .eq('id', templateId)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (currentError) return jsonError(req, currentError.message, 500);
    if (!current) return jsonError(req, 'Template not found', 404);
    const currentRow = current as MarketingTemplateRow;
    if (currentRow.deleted_at) {
      return jsonResponse(
        req,
        { success: false, error: 'This design was deleted', code: 'deleted' },
        410,
        'private'
      );
    }

    // Optimistic concurrency: autosave sends the updatedAt it last saw. A thumbnail-only
    // write never conflicts (it does not change the content another tab is editing).
    const ifUpdatedAt = optionalText(body.ifUpdatedAt);
    if (
      ifUpdatedAt &&
      Object.keys(patch).length > 0 &&
      !sameInstant(ifUpdatedAt, currentRow.updated_at)
    ) {
      return jsonResponse(
        req,
        {
          success: false,
          error: 'This design was changed somewhere else',
          code: 'conflict',
          updatedAt: currentRow.updated_at,
        },
        409,
        'private'
      );
    }

    let updatedRow = currentRow;
    if (Object.keys(patch).length > 0) {
      const { data, error } = await sb
        .from('marketing_templates')
        .update(patch)
        .eq('id', templateId)
        .eq('property_id', propertyId)
        .select('*')
        .maybeSingle();
      if (error) return jsonError(req, error.message, 500);
      if (!data) return jsonError(req, 'Template not found', 404);
      updatedRow = data as MarketingTemplateRow;
    }

    const updated = await attachThumbnail(sb, propertyId, updatedRow, thumbnailDataUrl);
    const activityFields = patchActivityFields(patch);
    if (activityFields.length > 0) {
      await logAssetActivity({
        ...logBase,
        action: 'marketing.template_saved',
        targetId: templateId,
        targetLabel: updated.name,
        metadata: {
          kind: updated.kind,
          operation: activityFields.includes('name') ? 'rename' : 'edit',
          fields: activityFields,
        },
      });
    }
    return jsonSuccess(req, serializeTemplate(updated, sb));
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  const ids = parseIdList(body, url.searchParams.get('id'));
  if (typeof ids === 'string') return jsonError(req, ids, 400);
  const permanent = body.permanent === true;

  if (permanent) {
    const { data, error } = await sb
      .from('marketing_templates')
      .delete()
      .eq('property_id', propertyId)
      .in('id', ids)
      .select('id, name, thumbnail_path');
    if (error) return jsonError(req, error.message, 500);
    const removed = (data ?? []) as Array<{
      id: string;
      name: string;
      thumbnail_path: string | null;
    }>;
    if (removed.length === 0) return jsonError(req, 'Template not found', 404);
    await Promise.all(removed.map((row) => removeTemplateThumbnail(sb, row.thumbnail_path)));
    await logAssetActivity({
      ...logBase,
      action: 'marketing.template_deleted',
      targetId: removed[0]!.id,
      targetLabel: removed.length === 1 ? removed[0]!.name : null,
      metadata: { count: removed.length, permanent: true, ids: removed.map((row) => row.id) },
    });
    return jsonSuccess(req, { deleted: true, ids: removed.map((row) => row.id), id: ids[0] });
  }

  const { data, error } = await sb
    .from('marketing_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('property_id', propertyId)
    .in('id', ids)
    .is('deleted_at', null)
    .select('id, name');
  if (error) return jsonError(req, error.message, 500);
  const trashed = (data ?? []) as Array<{ id: string; name: string }>;
  if (trashed.length === 0) return jsonError(req, 'Template not found', 404);
  await logAssetActivity({
    ...logBase,
    action: 'marketing.template_deleted',
    targetId: trashed[0]!.id,
    targetLabel: trashed.length === 1 ? trashed[0]!.name : null,
    metadata: { count: trashed.length, permanent: false, ids: trashed.map((row) => row.id) },
  });
  return jsonSuccess(req, { deleted: true, ids: trashed.map((row) => row.id), id: ids[0] });
});

type LogBase = {
  req: Request;
  user: Parameters<typeof logAssetActivity>[0]['user'];
  propertyId: string;
  organizationId: string;
  targetType: 'template';
};

/**
 * Duplicate, Copy to another size, Save as template.
 *
 * `designJson` / `aspectPreset` override the copied content (Copy to another size: the
 * client resizes the design). `sameGroup` joins the copy to the source's size group
 * (created on the source when it had none). `kind: 'template'` saves a frozen template.
 */
async function duplicateItem(
  req: Request,
  sb: SupabaseClient,
  body: Record<string, unknown>,
  propertyId: string,
  actorUserId: string | null,
  logBase: LogBase
): Promise<Response> {
  const sourceId = typeof body.id === 'string' ? body.id.trim() : '';
  if (!isUuid(sourceId)) return jsonError(req, 'id is required', 400);
  const kind = body.kind === undefined ? 'design' : body.kind;
  if (!isMarketingItemKind(kind)) return jsonError(req, 'kind must be design or template', 400);
  const sameGroup = body.sameGroup === true && kind === 'design';

  const overrideJson = body.designJson === undefined ? undefined : parseDesignJson(body.designJson);
  if (overrideJson === null) return jsonError(req, 'designJson must be an object', 400);

  const { data: sourceData, error: sourceError } = await sb
    .from('marketing_templates')
    .select('*')
    .eq('id', sourceId)
    .eq('property_id', propertyId)
    .maybeSingle();
  if (sourceError) return jsonError(req, sourceError.message, 500);
  if (!sourceData) return jsonError(req, 'Template not found', 404);
  const source = sourceData as MarketingTemplateRow;
  if (source.deleted_at) return jsonError(req, 'This design was deleted', 410);

  let groupId: string | null = null;
  if (sameGroup) {
    groupId = source.group_id ?? crypto.randomUUID();
    if (!source.group_id) {
      // Thumbnail-free metadata write: keep the source's updated_at.
      const { error } = await sb
        .from('marketing_templates')
        .update({ group_id: groupId })
        .eq('id', source.id)
        .eq('property_id', propertyId);
      if (error) return jsonError(req, error.message, 500);
    }
  }

  const split = overrideJson ? splitThumbnail(overrideJson) : null;
  const name =
    normalizeItemName(body.name) ?? (sameGroup ? source.name : duplicateName(source.name));
  const aspectPreset =
    body.aspectPreset !== undefined ? optionalText(body.aspectPreset) : source.aspect_preset;
  const platform = body.platform !== undefined ? optionalText(body.platform) : source.platform;
  const sourceTemplateId = kind === 'template' ? null : (source.source_template_id ?? null);

  const { data, error } = await sb
    .from('marketing_templates')
    .insert({
      property_id: propertyId,
      organization_id: source.organization_id,
      name,
      content_type: source.content_type,
      platform,
      aspect_preset: aspectPreset,
      design_json: split ? split.designJson : (source.design_json ?? {}),
      theme_key: source.theme_key,
      kind,
      group_id: groupId,
      source_template_id: sourceTemplateId,
      created_by: actorUserId,
    })
    .select('*')
    .single();
  if (error) return jsonError(req, error.message, 500);
  let created = data as MarketingTemplateRow;

  if (split?.dataUrl) {
    created = await attachThumbnail(sb, propertyId, created, split.dataUrl);
  } else if (!split && source.thumbnail_path) {
    const path = await copyTemplateThumbnail(sb, propertyId, created.id, source.thumbnail_path);
    if (path) {
      const { data: withThumb } = await sb
        .from('marketing_templates')
        .update({ thumbnail_path: path })
        .eq('id', created.id)
        .eq('property_id', propertyId)
        .select('*')
        .maybeSingle();
      if (withThumb) created = withThumb as MarketingTemplateRow;
      else await removeTemplateThumbnail(sb, path);
    }
  }

  await logAssetActivity({
    ...logBase,
    action: 'marketing.template_saved',
    targetId: created.id,
    targetLabel: created.name,
    metadata: {
      content_type: created.content_type,
      kind,
      operation: kind === 'template' ? 'save_as_template' : sameGroup ? 'copy_size' : 'duplicate',
      source_id: source.id,
    },
  });
  return jsonSuccess(req, serializeTemplate(created, sb));
}

/**
 * Stores a new thumbnail for a saved row and swaps the path in. The previous image is
 * removed only after the new one is linked. Thumbnail problems never fail the save.
 */
async function attachThumbnail(
  sb: SupabaseClient,
  propertyId: string,
  row: MarketingTemplateRow,
  dataUrl: string | null
): Promise<MarketingTemplateRow> {
  if (!dataUrl) return row;
  try {
    const path = await uploadTemplateThumbnail(sb, propertyId, row.id, dataUrl);
    if (!path) return row;
    const { data, error } = await sb
      .from('marketing_templates')
      .update({ thumbnail_path: path })
      .eq('id', row.id)
      .eq('property_id', propertyId)
      .select('*')
      .maybeSingle();
    if (error || !data) {
      await removeTemplateThumbnail(sb, path);
      return row;
    }
    await removeTemplateThumbnail(sb, row.thumbnail_path);
    return data as MarketingTemplateRow;
  } catch (err) {
    console.warn('[marketing-templates] thumbnail not stored', err);
    return row;
  }
}

/**
 * Removes Recently deleted rows past 30 days for this property, thumbnails included.
 * The daily cron does the same in SQL (without Storage); this keeps Storage tidy.
 */
async function purgeExpiredDeleted(sb: SupabaseClient, propertyId: string): Promise<void> {
  try {
    const { data: expired, error } = await sb
      .from('marketing_templates')
      .select('id, thumbnail_path')
      .eq('property_id', propertyId)
      .lt('deleted_at', recentlyDeletedCutoff())
      .limit(LAZY_PURGE_PER_REQUEST);
    if (error || !expired || expired.length === 0) return;
    const rows = expired as Array<{ id: string; thumbnail_path: string | null }>;
    const { error: deleteError } = await sb
      .from('marketing_templates')
      .delete()
      .eq('property_id', propertyId)
      .in(
        'id',
        rows.map((row) => row.id)
      );
    if (deleteError) return;
    await Promise.all(rows.map((row) => removeTemplateThumbnail(sb, row.thumbnail_path)));
  } catch (err) {
    console.warn('[marketing-templates] purge skipped', err);
  }
}

/**
 * Library pages skip design_json, so older rows whose thumbnail is still embedded would
 * show no art. Move a few of the visible ones to Storage per request (same as the list).
 */
async function migrateLibraryPageThumbnails(
  sb: SupabaseClient,
  propertyId: string,
  rows: LibraryRpcRow[]
): Promise<void> {
  const missing = rows.filter((row) => !row.thumbnail_path).map((row) => row.id);
  if (missing.length === 0) return;
  try {
    const { data, error } = await sb
      .from('marketing_templates')
      .select('*')
      .eq('property_id', propertyId)
      .in('id', missing)
      .not('design_json->thumbnailDataUrl', 'is', null)
      .limit(LEGACY_THUMBNAIL_MIGRATIONS_PER_REQUEST);
    if (error || !data || data.length === 0) return;
    const legacy = data as MarketingTemplateRow[];
    await migrateLegacyThumbnails(sb, propertyId, legacy);
    const paths = new Map(legacy.map((row) => [row.id, row.thumbnail_path]));
    for (const row of rows) {
      const path = paths.get(row.id);
      if (path) row.thumbnail_path = path;
    }
  } catch (err) {
    console.warn('[marketing-templates] library thumbnails not migrated', err);
  }
}

/**
 * Moves base64 thumbnails embedded by older saves into Storage, a few rows per list
 * request, and updates the in-memory rows so this response is already light.
 */
async function migrateLegacyThumbnails(
  sb: SupabaseClient,
  propertyId: string,
  rows: MarketingTemplateRow[]
): Promise<void> {
  const legacy = rows
    .map((row, index) => ({ row, index, split: splitThumbnail(row.design_json ?? {}) }))
    .filter((item) => item.split.designJson !== (item.row.design_json ?? {}))
    .slice(0, LEGACY_THUMBNAIL_MIGRATIONS_PER_REQUEST);

  for (const { row, index, split } of legacy) {
    try {
      const path =
        split.dataUrl && !row.thumbnail_path
          ? await uploadTemplateThumbnail(sb, propertyId, row.id, split.dataUrl)
          : null;
      // A thumbnail-only write keeps updated_at (marketing_templates_touch_updated_at),
      // so moving the image to Storage does not reorder the list.
      const { data, error } = await sb
        .from('marketing_templates')
        .update({
          design_json: split.designJson,
          ...(path ? { thumbnail_path: path } : {}),
        })
        .eq('id', row.id)
        .eq('property_id', propertyId)
        .select('*')
        .maybeSingle();
      if (error || !data) {
        await removeTemplateThumbnail(sb, path);
        continue;
      }
      rows[index] = data as MarketingTemplateRow;
    } catch (err) {
      console.warn('[marketing-templates] legacy thumbnail not migrated', err);
    }
  }
}
