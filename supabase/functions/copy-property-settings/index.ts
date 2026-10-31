/**
 * copy-property-settings — copy configuration groups from one property to others
 * in the same org. Identity + operational data never copied.
 *
 * POST body (copy): { sourcePropertyId, targetPropertyIds, groups, options?, dryRun? }
 * POST body (list): { action: 'listLogs', orgSlug?, orgId?, limit? }
 */

import { createServiceClient, verifyOrgAccess } from '../_shared/orgAuth.ts';
import { catchPlanFeatureError, requirePropertyFeature } from '../_shared/planEntitlements.ts';
import { listPropertySettingsCopyLogs } from '../_shared/propertySettingsCopyLogList.ts';
import { CLONE_GROUP_IDS, type CloneGroupId } from '../_shared/propertySettingsCloneTypes.ts';
import { runCopyPropertySettings } from '../_shared/propertySettingsCloneRun.ts';
import {
  jsonError,
  jsonSuccess,
  readJsonBody,
  requireHttpMethod,
} from '../_shared/httpResponse.ts';
import { serveAuthenticated } from '../_shared/serveEdge.ts';

const GROUP_ID_SET = new Set<string>(CLONE_GROUP_IDS);

serveAuthenticated('copy-property-settings', async (req, user) => {
  requireHttpMethod(req, 'POST');
  const body = await readJsonBody(req);

  if (body.action === 'listLogs') {
    const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug.trim() : '';
    const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
    if (!orgSlug && !orgId) {
      return jsonError(req, 'orgSlug or orgId is required');
    }
    const { org } = await verifyOrgAccess(req, {
      orgSlug: orgSlug || undefined,
      orgId: orgId || undefined,
    });
    const limit = typeof body.limit === 'number' ? body.limit : 20;
    try {
      const supabase = createServiceClient();
      const logs = await listPropertySettingsCopyLogs(supabase, org.id, limit);
      return jsonSuccess(req, { logs });
    } catch (err) {
      console.error('[copy-property-settings] listLogs failed:', err);
      return jsonError(req, 'Could not load copy history');
    }
  }

  const sourcePropertyId =
    typeof body.sourcePropertyId === 'string' ? body.sourcePropertyId.trim() : '';
  if (!sourcePropertyId) {
    return jsonError(req, 'sourcePropertyId is required');
  }

  const targetPropertyIds = Array.isArray(body.targetPropertyIds)
    ? body.targetPropertyIds.filter((id: unknown): id is string => typeof id === 'string')
    : [];
  if (targetPropertyIds.length === 0) {
    return jsonError(req, 'targetPropertyIds is required');
  }

  const groupsRaw = Array.isArray(body.groups) ? body.groups : [];
  const groups: CloneGroupId[] = [];
  for (const id of groupsRaw) {
    if (typeof id !== 'string' || !GROUP_ID_SET.has(id)) {
      return jsonError(req, `Unknown group: ${String(id)}`);
    }
    groups.push(id as CloneGroupId);
  }
  if (groups.length === 0) {
    return jsonError(req, 'Select at least one settings group');
  }

  const optionsBody =
    body.options && typeof body.options === 'object' && !Array.isArray(body.options)
      ? (body.options as Record<string, unknown>)
      : {};

  const dryRun = body.dryRun === true;

  try {
    // Preview stays open below Pro; the real copy requires `copyPropertySettings`.
    if (!dryRun) {
      await requirePropertyFeature(sourcePropertyId, 'copyPropertySettings');
    }

    const result = await runCopyPropertySettings({
      req,
      actorUserId: user.id,
      sourcePropertyId,
      targetPropertyIds,
      groups,
      options: {
        copyContact: optionsBody.copyContact === true,
        copyEmailRecipients: optionsBody.copyEmailRecipients === true,
        copyTelegramCredentials: optionsBody.copyTelegramCredentials === true,
        skipAlreadyCustomized: optionsBody.skipAlreadyCustomized === true,
      },
      dryRun,
    });
    return jsonSuccess(req, result);
  } catch (err) {
    const planResponse = catchPlanFeatureError(req, err);
    if (planResponse) return planResponse;
    if (err instanceof Response) return err;
    throw err;
  }
});
