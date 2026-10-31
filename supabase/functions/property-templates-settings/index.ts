/**
 * property-templates-settings — Admin GET/PATCH for property template content.
 * Auth: Phase 5 granular templates.* leaves (+ publicPagesAutosaveGate for page-editor autosave).
 */

import {
  countCustomTemplates,
  countPropertyTemplateFolders,
  createPropertyTemplateFolder,
  deletePropertyTemplateFolder,
  deletePropertyTemplateRow,
  DuplicateTemplateFolderNameError,
  getBuiltinPropertyTemplate,
  getPropertyTemplateRow,
  isBuiltinPropertyTemplateKey,
  isCustomTemplateKey,
  MAX_CUSTOM_TEMPLATES,
  MAX_TEMPLATE_FOLDERS,
  propertyTemplateFolderExists,
  renamePropertyTemplateFolder,
  serializePropertyTemplatesForAdmin,
  updateCustomTemplateRow,
  upsertPropertyTemplateRow,
  validateCustomTemplateName,
  validateTemplateContent,
  validateTemplateFolderName,
} from '../_shared/propertyTemplates.ts';
import { jsonError, jsonSuccess, readJsonBody } from '../_shared/httpResponse.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { resolveScopedPropertyAccess } from '../_shared/propertyScope.ts';
import type { TeamPermissionId } from '../_shared/propertyTeamPermissions.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';
import { logAssetActivity } from '../_shared/assetActivity.ts';
import type { AuthenticatedUser } from '../_shared/orgAuth.ts';
import type { PropertyAccessContext } from '../_shared/orgAuth.ts';

function emitTemplateActivity(
  req: Request,
  user: Pick<AuthenticatedUser, 'id' | 'email'>,
  access: PropertyAccessContext,
  action:
    | 'settings.template_saved'
    | 'settings.template_deleted'
    | 'settings.template_folder_saved'
    | 'settings.template_folder_deleted',
  templateKey: string,
  metadata: Record<string, unknown>
): Promise<void> {
  return logAssetActivity({
    req,
    user,
    action,
    propertyId: access.property.id,
    organizationId: access.org.id,
    accessKind: access.accessKind,
    memberId: access.memberId,
    targetType: 'template',
    targetId: `${access.property.id}:${templateKey}`,
    targetLabel: templateKey,
    metadata,
  });
}

async function maybeGatePublicPagesAutosave(
  req: Request,
  propertyId: string,
  body: Record<string, unknown>
): Promise<Response | null> {
  if (body.publicPagesAutosaveGate !== true) return null;
  try {
    await requirePropertyFeature(propertyId, 'publicPagesAutosave');
    return null;
  } catch (err) {
    return catchPlanFeatureError(req, err);
  }
}

serveAuthenticated('property-templates-settings', async (req, user) => {
  if (req.method === 'GET') {
    const { property } = await resolveScopedPropertyAccess(req, 'templates:view');
    const data = await serializePropertyTemplatesForAdmin(property.id);
    return jsonSuccess(req, data);
  }

  if (req.method !== 'PATCH') {
    return jsonError(req, 'Method not allowed', 405);
  }

  const body = await readJsonBody(req);

  /**
   * Folder + custom-template organisation. Folders only ever hold custom
   * templates, so they inherit the `customTemplates` plan gate and the existing
   * `templates.custom:*` permission leaves — no new feature key, no new leaf.
   */
  async function requireCustomTemplatesFeature(propertyId: string): Promise<Response | null> {
    try {
      await requirePropertyFeature(propertyId, 'customTemplates');
      return null;
    } catch (err) {
      const planErr = catchPlanFeatureError(req, err);
      if (planErr) return planErr;
      throw err;
    }
  }

  if (body.action === 'createFolder') {
    const access = await resolveScopedPropertyAccess(req, 'templates.custom:add');
    const { property } = access;
    const gate = await requireCustomTemplatesFeature(property.id);
    if (gate) return gate;

    const name = typeof body.name === 'string' ? body.name : '';
    const nameErr = validateTemplateFolderName(name);
    if (nameErr) return jsonError(req, nameErr, 400);

    if ((await countPropertyTemplateFolders(property.id)) >= MAX_TEMPLATE_FOLDERS) {
      return jsonError(req, `Maximum ${MAX_TEMPLATE_FOLDERS} folders allowed`, 400);
    }

    let folder;
    try {
      folder = await createPropertyTemplateFolder({ propertyId: property.id, name });
    } catch (err) {
      if (err instanceof DuplicateTemplateFolderNameError) {
        return jsonError(req, err.message, 409);
      }
      throw err;
    }

    await emitTemplateActivity(req, user, access, 'settings.template_folder_saved', folder.id, {
      operation: 'folder_created',
      folder_name: folder.name,
    });
    const data = await serializePropertyTemplatesForAdmin(property.id);
    return jsonSuccess(req, data);
  }

  if (body.action === 'renameFolder') {
    const access = await resolveScopedPropertyAccess(req, 'templates.custom:edit');
    const { property } = access;
    const gate = await requireCustomTemplatesFeature(property.id);
    if (gate) return gate;

    const folderId = typeof body.folderId === 'string' ? body.folderId.trim() : '';
    if (!folderId) return jsonError(req, 'folderId is required', 400);

    const name = typeof body.name === 'string' ? body.name : '';
    const nameErr = validateTemplateFolderName(name);
    if (nameErr) return jsonError(req, nameErr, 400);

    let folder;
    try {
      folder = await renamePropertyTemplateFolder({ propertyId: property.id, folderId, name });
    } catch (err) {
      if (err instanceof DuplicateTemplateFolderNameError) {
        return jsonError(req, err.message, 409);
      }
      throw err;
    }
    if (!folder) return jsonError(req, 'Folder not found', 404);

    await emitTemplateActivity(req, user, access, 'settings.template_folder_saved', folder.id, {
      operation: 'folder_renamed',
      folder_name: folder.name,
    });
    const data = await serializePropertyTemplatesForAdmin(property.id);
    return jsonSuccess(req, data);
  }

  if (body.action === 'deleteFolder') {
    const access = await resolveScopedPropertyAccess(req, 'templates.custom:delete');
    const { property } = access;
    const folderId = typeof body.folderId === 'string' ? body.folderId.trim() : '';
    if (!folderId) return jsonError(req, 'folderId is required', 400);

    if (!(await propertyTemplateFolderExists(property.id, folderId))) {
      return jsonError(req, 'Folder not found', 404);
    }
    // Templates survive: the FK drops them back to the ungrouped Custom section.
    await deletePropertyTemplateFolder(property.id, folderId);

    await emitTemplateActivity(req, user, access, 'settings.template_folder_deleted', folderId, {
      operation: 'folder_deleted',
    });
    const data = await serializePropertyTemplatesForAdmin(property.id);
    return jsonSuccess(req, data);
  }

  if (body.action === 'rename' || body.action === 'move') {
    const access = await resolveScopedPropertyAccess(req, 'templates.custom:edit');
    const { property } = access;
    const gate = await requireCustomTemplatesFeature(property.id);
    if (gate) return gate;

    const templateKey = typeof body.templateKey === 'string' ? body.templateKey.trim() : '';
    if (!isCustomTemplateKey(templateKey)) {
      return jsonError(req, 'Only custom templates can be renamed or moved', 400);
    }

    const patch: {
      name?: string;
      category?: 'standard' | 'email' | 'custom';
      folderId?: string | null;
    } = {};

    if (body.action === 'rename') {
      const name = typeof body.name === 'string' ? body.name : '';
      const nameErr = validateCustomTemplateName(name);
      if (nameErr) return jsonError(req, nameErr, 400);
      patch.name = name;
    } else {
      const categoryRaw = typeof body.category === 'string' ? body.category.trim() : 'custom';
      const category =
        categoryRaw === 'standard' || categoryRaw === 'email' || categoryRaw === 'custom'
          ? categoryRaw
          : 'custom';
      patch.category = category;

      if (category === 'custom') {
        const folderId =
          body.folderId === null || body.folderId === undefined
            ? null
            : typeof body.folderId === 'string'
              ? body.folderId.trim()
              : '';
        if (folderId === '') return jsonError(req, 'folderId must be a string or null', 400);
        if (folderId && !(await propertyTemplateFolderExists(property.id, folderId))) {
          return jsonError(req, 'Folder not found', 404);
        }
        patch.folderId = folderId;
      }
    }

    const row = await updateCustomTemplateRow({
      propertyId: property.id,
      templateKey,
      ...patch,
    });
    if (!row) return jsonError(req, 'Template not found', 404);

    await emitTemplateActivity(req, user, access, 'settings.template_saved', templateKey, {
      category: row.category,
      operation: body.action === 'rename' ? 'rename' : 'move',
      ...(body.action === 'rename' ? { name: row.name } : { folder_id: row.folder_id }),
    });
    const data = await serializePropertyTemplatesForAdmin(property.id);
    return jsonSuccess(req, data);
  }

  if (body.action === 'delete') {
    const access = await resolveScopedPropertyAccess(req, 'templates.custom:delete');
    const { property } = access;
    const gate = await maybeGatePublicPagesAutosave(req, property.id, body);
    if (gate) return gate;
    const templateKey = typeof body.templateKey === 'string' ? body.templateKey.trim() : '';
    if (!isCustomTemplateKey(templateKey)) {
      return jsonError(req, 'Only custom templates can be deleted', 400);
    }
    await deletePropertyTemplateRow(property.id, templateKey);
    await emitTemplateActivity(req, user, access, 'settings.template_deleted', templateKey, {
      category: 'custom',
    });
    const data = await serializePropertyTemplatesForAdmin(property.id);
    return jsonSuccess(req, data);
  }

  if (body.action === 'reset') {
    const templateKey = typeof body.templateKey === 'string' ? body.templateKey.trim() : '';
    if (!isBuiltinPropertyTemplateKey(templateKey)) {
      return jsonError(req, 'Only built-in templates can be reset', 400);
    }
    const builtin = getBuiltinPropertyTemplate(templateKey)!;
    const resetPerm: TeamPermissionId =
      builtin.category === 'email' ? 'templates.email:edit' : 'templates.standard:edit';
    const access = await resolveScopedPropertyAccess(req, resetPerm);
    const { property } = access;
    const gate = await maybeGatePublicPagesAutosave(req, property.id, body);
    if (gate) return gate;
    await upsertPropertyTemplateRow({
      propertyId: property.id,
      templateKey,
      category: builtin.category,
      content: builtin.defaultContent,
      ...(builtin.category === 'standard' ? { sectionImageUrl: null } : {}),
    });
    await emitTemplateActivity(req, user, access, 'settings.template_saved', templateKey, {
      category: builtin.category,
      operation: 'reset',
    });
    const data = await serializePropertyTemplatesForAdmin(property.id);
    return jsonSuccess(req, data);
  }

  if (body.action === 'create') {
    const access = await resolveScopedPropertyAccess(req, 'templates.custom:add');
    const { property } = access;
    try {
      await requirePropertyFeature(property.id, 'customTemplates');
    } catch (err) {
      const planErr = catchPlanFeatureError(req, err);
      if (planErr) return planErr;
      throw err;
    }

    const name = typeof body.name === 'string' ? body.name : '';
    const content = typeof body.content === 'string' ? body.content : '';
    const nameErr = validateCustomTemplateName(name);
    if (nameErr) return jsonError(req, nameErr, 400);
    const contentErr = validateTemplateContent(content);
    if (contentErr) return jsonError(req, contentErr, 400);

    const customCount = await countCustomTemplates(property.id);
    if (customCount >= MAX_CUSTOM_TEMPLATES) {
      return jsonError(req, `Maximum ${MAX_CUSTOM_TEMPLATES} custom templates allowed`, 400);
    }

    const categoryRaw = typeof body.category === 'string' ? body.category.trim() : 'custom';
    const category =
      categoryRaw === 'standard' || categoryRaw === 'email' || categoryRaw === 'custom'
        ? categoryRaw
        : 'custom';

    let folderId: string | null = null;
    if (category === 'custom') {
      folderId = typeof body.folderId === 'string' ? body.folderId.trim() : null;
      if (folderId && !(await propertyTemplateFolderExists(property.id, folderId))) {
        return jsonError(req, 'Folder not found', 404);
      }
    }

    const templateKey = `custom-${crypto.randomUUID()}`;
    await upsertPropertyTemplateRow({
      propertyId: property.id,
      templateKey,
      category,
      name: name.trim(),
      content,
      folderId,
    });
    await emitTemplateActivity(req, user, access, 'settings.template_saved', templateKey, {
      category,
      operation: 'create',
      name: name.trim(),
      ...(folderId ? { folder_id: folderId } : {}),
    });
    const data = await serializePropertyTemplatesForAdmin(property.id);
    return jsonSuccess(req, data);
  }

  const templateKey = typeof body.templateKey === 'string' ? body.templateKey.trim() : '';
  const content = typeof body.content === 'string' ? body.content : null;
  const sectionImageUrl =
    body.sectionImageUrl === null || typeof body.sectionImageUrl === 'string'
      ? (body.sectionImageUrl as string | null)
      : undefined;

  if (!templateKey) {
    return jsonError(req, 'templateKey is required', 400);
  }
  if (content === null) {
    return jsonError(req, 'content is required', 400);
  }

  const contentErr = validateTemplateContent(content);
  if (contentErr) return jsonError(req, contentErr, 400);

  if (isCustomTemplateKey(templateKey)) {
    const access = await resolveScopedPropertyAccess(req, 'templates.custom:edit');
    const { property } = access;
    const gate = await maybeGatePublicPagesAutosave(req, property.id, body);
    if (gate) return gate;
    try {
      await requirePropertyFeature(property.id, 'customTemplates');
    } catch (err) {
      const planErr = catchPlanFeatureError(req, err);
      if (planErr) return planErr;
      throw err;
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name) {
      const nameErr = validateCustomTemplateName(name);
      if (nameErr) return jsonError(req, nameErr, 400);
    }
    const existingRow = await getPropertyTemplateRow(property.id, templateKey);

    const existingCategory =
      existingRow?.category === 'standard' ||
      existingRow?.category === 'email' ||
      existingRow?.category === 'custom'
        ? existingRow.category
        : 'custom';

    await upsertPropertyTemplateRow({
      propertyId: property.id,
      templateKey,
      category: existingCategory,
      name: name || undefined,
      content,
      folderId: existingCategory === 'custom' ? (existingRow?.folder_id ?? null) : null,
    });
    await emitTemplateActivity(req, user, access, 'settings.template_saved', templateKey, {
      category: existingCategory,
      operation: 'edit',
    });
    const data = await serializePropertyTemplatesForAdmin(property.id);
    return jsonSuccess(req, data);
  }

  if (isBuiltinPropertyTemplateKey(templateKey)) {
    const builtin = getBuiltinPropertyTemplate(templateKey)!;
    const editPerm: TeamPermissionId =
      builtin.category === 'email' ? 'templates.email:edit' : 'templates.standard:edit';
    const access = await resolveScopedPropertyAccess(req, editPerm);
    const { property } = access;
    const gate = await maybeGatePublicPagesAutosave(req, property.id, body);
    if (gate) return gate;
    if (builtin.category === 'email') {
      try {
        await requirePropertyFeature(property.id, 'customTemplates');
      } catch (err) {
        const planErr = catchPlanFeatureError(req, err);
        if (planErr) return planErr;
        throw err;
      }
    }
    await upsertPropertyTemplateRow({
      propertyId: property.id,
      templateKey,
      category: builtin.category,
      content,
      ...(builtin.category === 'standard' && sectionImageUrl !== undefined
        ? { sectionImageUrl }
        : {}),
    });
    await emitTemplateActivity(req, user, access, 'settings.template_saved', templateKey, {
      category: builtin.category,
      operation: 'edit',
    });
    const data = await serializePropertyTemplatesForAdmin(property.id);
    return jsonSuccess(req, data);
  }

  return jsonError(req, 'Unknown template key', 400);
});
