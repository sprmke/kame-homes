/**
 * marketing-themes — CRUD for property-scoped Marketing Studio themes.
 *
 * Built-in themes (Property colors, starter looks) are code-defined on the client;
 * this function stores only the themes a host creates or edits. GET also returns
 * how many saved items use each theme key (built-in keys included), so the UI can
 * show folder counts without listing every template.
 *
 * Auth mirrors marketing-templates: GET marketing:view + marketingStudio;
 * POST/PATCH marketing.templates:add|edit + customTemplates; DELETE
 * marketing.templates:delete. DELETE refuses a theme that items still use unless
 * `moveTo` names another theme for them (409 otherwise).
 */

import { createServiceClient, requirePropertyPermissionAndFeature } from '../_shared/orgAuth.ts';
import { jsonError, jsonResponse, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import {
  resolveOrganizationIdForProperty,
  resolveScopedPropertyAccess,
} from '../_shared/propertyScope.ts';
import type { TeamPermissionId } from '../_shared/propertyTeamPermissions.ts';
import type { PlanFeatureKey } from '../_shared/planFeatures.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import {
  isMarketingThemeKey,
  isMarketingThemeRowId,
  normalizeMarketingThemeName,
  parseMarketingThemeTokens,
} from '../_shared/marketingTheme.ts';

const MAX_THEMES_PER_PROPERTY = 40;
// Folder counts stop at this many saved items per property.
const MAX_COUNTED_TEMPLATES = 5000;
const SOURCES = new Set(['custom', 'starter', 'photos', 'duplicate', 'ai']);
const LEGACY_THEME_KEY = 'property-colors';

type LegacyKeyRow = {
  theme_key: string | null;
  content_type: string;
  source_preset: string | null;
};

/**
 * Same rule as the client's `effectiveTemplateThemeKey`: rows saved before themes
 * have no key. A calendar edited from a designer look belongs to that look's starter
 * theme; everything else belongs to Property colors.
 */
function legacyAwareThemeKey(row: LegacyKeyRow): string {
  if (row.theme_key) return row.theme_key;
  const preset = row.source_preset?.trim();
  if (row.content_type === 'calendar' && preset && preset !== 'custom' && preset !== 'default') {
    return `starter:${preset}`;
  }
  return LEGACY_THEME_KEY;
}

type MarketingThemeRow = {
  id: string;
  property_id: string;
  organization_id: string;
  name: string;
  tokens: Record<string, unknown>;
  source: string;
  source_ref: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function serializeTheme(row: MarketingThemeRow) {
  return {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    tokens: row.tokens,
    source: row.source,
    sourceRef: row.source_ref,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const METHOD_GATES: Record<string, { permission: TeamPermissionId; feature?: PlanFeatureKey }> = {
  GET: { permission: 'marketing:view', feature: 'marketingStudio' },
  POST: { permission: 'marketing.templates:add', feature: 'customTemplates' },
  PATCH: { permission: 'marketing.templates:edit', feature: 'customTemplates' },
  DELETE: { permission: 'marketing.templates:delete' },
};

serveAuthenticated('marketing-themes', async (req, user) => {
  const gate = METHOD_GATES[req.method];
  if (!gate) return jsonError(req, 'Method not allowed', 405);

  let propertyId: string;
  let accessKind: string | null = null;
  try {
    const scoped = await resolveScopedPropertyAccess(req, gate.permission);
    propertyId = scoped.property.id;
    const ctx = await requirePropertyPermissionAndFeature(
      req,
      propertyId,
      gate.permission,
      gate.feature
    );
    accessKind = ctx.accessKind;
  } catch (err) {
    if (err instanceof Response) return err;
    throw err;
  }

  const organizationId = await resolveOrganizationIdForProperty(propertyId);
  const sb = createServiceClient();

  if (req.method === 'GET') {
    const [themesResult, keysResult] = await Promise.all([
      sb
        .from('marketing_themes')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: true })
        .limit(MAX_THEMES_PER_PROPERTY),
      sb
        .from('marketing_templates')
        .select('theme_key, content_type, source_preset:design_json->>sourcePresetId')
        .eq('property_id', propertyId)
        .eq('kind', 'design')
        .is('deleted_at', null)
        .limit(MAX_COUNTED_TEMPLATES),
    ]);
    if (themesResult.error) return jsonError(req, themesResult.error.message, 500);
    if (keysResult.error) return jsonError(req, keysResult.error.message, 500);

    const itemCounts: Record<string, number> = {};
    for (const row of (keysResult.data ?? []) as LegacyKeyRow[]) {
      const key = legacyAwareThemeKey(row);
      itemCounts[key] = (itemCounts[key] ?? 0) + 1;
    }
    return jsonSuccess(req, {
      themes: ((themesResult.data ?? []) as MarketingThemeRow[]).map(serializeTheme),
      itemCounts,
    });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const name = normalizeMarketingThemeName(body.name);
    if (!name) return jsonError(req, 'Name must be 1 to 60 characters', 400);
    const tokens = parseMarketingThemeTokens(body.tokens);
    if (!tokens) return jsonError(req, 'Invalid theme', 400);
    const source =
      typeof body.source === 'string' && SOURCES.has(body.source) ? body.source : 'custom';
    const sourceRef =
      typeof body.sourceRef === 'string' && body.sourceRef.trim()
        ? body.sourceRef.trim().slice(0, 80)
        : null;

    const { count, error: countError } = await sb
      .from('marketing_themes')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId);
    if (countError) return jsonError(req, countError.message, 500);
    if ((count ?? 0) >= MAX_THEMES_PER_PROPERTY) {
      return jsonError(req, `You can save up to ${MAX_THEMES_PER_PROPERTY} themes`, 409);
    }

    const { data, error } = await sb
      .from('marketing_themes')
      .insert({
        property_id: propertyId,
        organization_id: organizationId,
        name,
        tokens,
        source,
        source_ref: sourceRef,
        created_by: user.id,
      })
      .select('*')
      .single();
    if (error) return jsonError(req, error.message, 500);

    const row = data as MarketingThemeRow;
    await logAssetActivity({
      req,
      user,
      action: 'marketing.theme_saved',
      propertyId,
      organizationId,
      accessKind,
      targetType: 'marketing_theme',
      targetId: row.id,
      targetLabel: name,
      metadata: { operation: 'create', source, source_ref: sourceRef },
    });
    return jsonSuccess(req, serializeTheme(row));
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const themeId = body.id;
    if (!isMarketingThemeRowId(themeId)) return jsonError(req, 'id is required', 400);

    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = normalizeMarketingThemeName(body.name);
      if (!name) return jsonError(req, 'Name must be 1 to 60 characters', 400);
      patch.name = name;
    }
    if (body.tokens !== undefined) {
      const tokens = parseMarketingThemeTokens(body.tokens);
      if (!tokens) return jsonError(req, 'Invalid theme', 400);
      patch.tokens = tokens;
    }
    if (Object.keys(patch).length === 0) return jsonError(req, 'Nothing to update', 400);

    const { data, error } = await sb
      .from('marketing_themes')
      .update(patch)
      .eq('id', themeId)
      .eq('property_id', propertyId)
      .select('*')
      .maybeSingle();
    if (error) return jsonError(req, error.message, 500);
    if (!data) return jsonError(req, 'Theme not found', 404);

    const row = data as MarketingThemeRow;
    await logAssetActivity({
      req,
      user,
      action: 'marketing.theme_saved',
      propertyId,
      organizationId,
      accessKind,
      targetType: 'marketing_theme',
      targetId: row.id,
      targetLabel: row.name,
      metadata: { operation: 'edit', fields: Object.keys(patch) },
    });
    return jsonSuccess(req, serializeTheme(row));
  }

  // DELETE
  const url = new URL(req.url);
  const body = await readJsonBody(req);
  const themeId = (typeof body.id === 'string' ? body.id : '') || url.searchParams.get('id') || '';
  if (!isMarketingThemeRowId(themeId)) return jsonError(req, 'id is required', 400);
  const moveTo = typeof body.moveTo === 'string' ? body.moveTo : null;
  if (moveTo !== null && (!isMarketingThemeKey(moveTo) || moveTo === themeId)) {
    return jsonError(req, 'moveTo must be another theme', 400);
  }

  const { data: existing, error: existingError } = await sb
    .from('marketing_themes')
    .select('id, name')
    .eq('id', themeId)
    .eq('property_id', propertyId)
    .maybeSingle();
  if (existingError) return jsonError(req, existingError.message, 500);
  if (!existing) return jsonError(req, 'Theme not found', 404);

  if (moveTo && isMarketingThemeRowId(moveTo)) {
    const { data: target, error: targetError } = await sb
      .from('marketing_themes')
      .select('id')
      .eq('id', moveTo)
      .eq('property_id', propertyId)
      .maybeSingle();
    if (targetError) return jsonError(req, targetError.message, 500);
    if (!target) return jsonError(req, 'Theme to move items to was not found', 404);
  }

  const { count: itemCount, error: itemsError } = await sb
    .from('marketing_templates')
    .select('id', { count: 'exact', head: true })
    .eq('property_id', propertyId)
    .eq('theme_key', themeId);
  if (itemsError) return jsonError(req, itemsError.message, 500);

  if ((itemCount ?? 0) > 0) {
    if (!moveTo) {
      return jsonResponse(
        req,
        {
          success: false,
          error: 'Move or delete the items in this theme first',
          itemCount: itemCount ?? 0,
        },
        409,
        'private'
      );
    }
    const { error: moveError } = await sb
      .from('marketing_templates')
      .update({ theme_key: moveTo })
      .eq('property_id', propertyId)
      .eq('theme_key', themeId);
    if (moveError) return jsonError(req, moveError.message, 500);
  }

  const { error: deleteError } = await sb
    .from('marketing_themes')
    .delete()
    .eq('id', themeId)
    .eq('property_id', propertyId);
  if (deleteError) return jsonError(req, deleteError.message, 500);

  await logAssetActivity({
    req,
    user,
    action: 'marketing.theme_deleted',
    propertyId,
    organizationId,
    accessKind,
    targetType: 'marketing_theme',
    targetId: themeId,
    targetLabel: (existing as { name: string }).name,
    metadata: { moved_items: itemCount ?? 0, moved_to: moveTo },
  });
  return jsonSuccess(req, { deleted: true, id: themeId, movedItems: itemCount ?? 0 });
});
