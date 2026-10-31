/**
 * Orchestrator for copy-property-settings — auth, plan gates, dry-run, log, notify.
 */

import { createServiceClient, verifyPropertyAccess } from './orgAuth.ts';
import { createNotification } from './notificationService.ts';
import { isFeatureEnabled, type PlanFeatureKey } from './planFeatures.ts';
import { resolvePropertyEntitlements } from './planEntitlements.ts';
import { ensurePropertySettings } from './propertySettingsSeed.ts';
import { seedPropertyTeamTemplates } from './propertyTeamTemplates.ts';
import {
  getCloneGroup,
  PROPERTY_SETTINGS_CLONE_GROUPS,
  runCloneGroup,
  type CloneGroupId,
  type CloneOptions,
  type CloneRunResult,
  type CloneTargetResult,
  type GroupPayload,
} from './propertySettingsClone.ts';
import { collectPropertySettingsNotifyEmails } from './settingsChangeNotifyRecipients.ts';
import { sendSettingsChangeNoticeEmails } from './settingsChangeNotifyEmail.ts';
import type { TeamPermissionId } from './propertyTeamPermissions.ts';

export type CopyPropertySettingsInput = {
  req: Request;
  actorUserId: string;
  sourcePropertyId: string;
  targetPropertyIds: string[];
  groups: CloneGroupId[];
  options: CloneOptions;
  dryRun: boolean;
};

async function assertLeafAccess(
  req: Request,
  propertyId: string,
  leaves: TeamPermissionId[]
): Promise<boolean> {
  try {
    for (const leaf of leaves) {
      await verifyPropertyAccess(req, propertyId, leaf);
    }
    return true;
  } catch {
    return false;
  }
}

async function targetHasPlanFeature(propertyId: string, feature: PlanFeatureKey): Promise<boolean> {
  const entitlements = await resolvePropertyEntitlements(propertyId);
  return isFeatureEnabled(entitlements, feature);
}

async function targetHasPlanFeatures(
  propertyId: string,
  group: { planFeature?: PlanFeatureKey; planFeatures?: PlanFeatureKey[] }
): Promise<boolean> {
  const keys = [...(group.planFeature ? [group.planFeature] : []), ...(group.planFeatures ?? [])];
  for (const feature of keys) {
    if (!(await targetHasPlanFeature(propertyId, feature))) return false;
  }
  return true;
}

export async function runCopyPropertySettings(
  input: CopyPropertySettingsInput
): Promise<CloneRunResult> {
  const {
    req,
    actorUserId,
    sourcePropertyId,
    targetPropertyIds,
    groups: groupIds,
    options,
    dryRun,
  } = input;

  const { property: sourceProperty, org } = await verifyPropertyAccess(
    req,
    sourcePropertyId,
    'settings:view'
  );
  const organizationId = sourceProperty.organization_id as string;
  const ownerId = (org as { owner_id?: string }).owner_id ?? '';
  const writeOptions: CloneOptions = { ...options, actorUserId };

  const uniqueTargets = [...new Set(targetPropertyIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueTargets.includes(sourcePropertyId)) {
    throw new Response(JSON.stringify({ error: 'Cannot copy a property onto itself' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (uniqueTargets.length === 0) {
    throw new Response(JSON.stringify({ error: 'Select at least one target property' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServiceClient();
  const { data: targetRows, error: targetError } = await supabase
    .from('properties')
    .select('id, organization_id, name')
    .in('id', uniqueTargets);
  if (targetError) throw new Error(targetError.message);

  const byId = new Map((targetRows ?? []).map((r) => [r.id as string, r]));
  for (const id of uniqueTargets) {
    const row = byId.get(id);
    if (!row) {
      throw new Response(JSON.stringify({ error: `Unknown target property: ${id}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (row.organization_id !== organizationId) {
      throw new Response(JSON.stringify({ error: 'Targets must be in the same organization' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const selectedGroups = groupIds
    .map((id) => getCloneGroup(id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  // Prefer registry order
  const ordered = PROPERTY_SETTINGS_CLONE_GROUPS.filter((g) =>
    selectedGroups.some((s) => s.id === g.id)
  );

  const sourcePayloads = new Map<CloneGroupId, GroupPayload>();
  for (const group of ordered) {
    sourcePayloads.set(
      group.id,
      await group.read({ propertyId: sourcePropertyId, organizationId })
    );
  }

  const results: CloneTargetResult[] = [];

  for (const targetId of uniqueTargets) {
    const targetResult: CloneTargetResult = {
      targetPropertyId: targetId,
      applied: [],
      skipped: [],
      failed: [],
      alreadyCustomized: [],
    };

    if (!dryRun) {
      await ensurePropertySettings(targetId);
      await seedPropertyTeamTemplates(supabase, targetId);
    }

    for (const group of ordered) {
      const allowed = await assertLeafAccess(req, targetId, group.editLeaves);
      if (!allowed) {
        targetResult.skipped.push({ group: group.id, reason: 'permission' });
        continue;
      }

      const planOk = await targetHasPlanFeatures(targetId, group);
      if (!planOk) {
        targetResult.skipped.push({ group: group.id, reason: 'plan' });
        continue;
      }

      if (group.id === 'contact' && !options.copyContact) {
        targetResult.skipped.push({ group: group.id, reason: 'opt_in' });
        continue;
      }

      if (options.skipAlreadyCustomized) {
        try {
          const customized = await group.hasNonDefault({
            propertyId: targetId,
            organizationId,
          });
          if (customized) {
            targetResult.skipped.push({
              group: group.id,
              reason: 'already_customized',
            });
            continue;
          }
        } catch {
          // continue and attempt write
        }
      }

      const payload = sourcePayloads.get(group.id) ?? {};
      const outcome = await runCloneGroup({
        group,
        payload,
        targetCtx: { propertyId: targetId, organizationId },
        options: writeOptions,
        dryRun,
      });

      if (outcome.status === 'applied') {
        targetResult.applied.push(outcome.group);
        if (outcome.alreadyCustomized) targetResult.alreadyCustomized.push(outcome.group);
      } else if (outcome.status === 'skipped') {
        targetResult.skipped.push(outcome.skip);
      } else {
        targetResult.failed.push(outcome.failure);
      }
    }

    results.push(targetResult);
  }

  let logId: string | undefined;
  if (!dryRun) {
    const { data: logRow, error: logError } = await supabase
      .from('property_settings_copy_log')
      .insert({
        organization_id: organizationId,
        source_property_id: sourcePropertyId,
        actor_user_id: actorUserId,
        groups: ordered.map((g) => g.id),
        target_property_ids: uniqueTargets,
        results,
      })
      .select('id')
      .single();
    if (logError) {
      console.warn('[copy-property-settings] log insert failed:', logError.message);
    } else {
      logId = logRow?.id as string | undefined;
    }

    for (const target of results) {
      if (target.applied.length === 0) continue;
      const name = String(byId.get(target.targetPropertyId)?.name ?? 'Property');
      await createNotification({
        organizationId,
        propertyId: target.targetPropertyId,
        type: 'property_settings_copied',
        title: 'Settings copied',
        body: `Settings were copied to ${name}`,
        metadata: {
          sourcePropertyId,
          applied: target.applied,
          logId,
        },
        dedupeKey: logId
          ? `property_settings_copied:${logId}:${target.targetPropertyId}`
          : undefined,
      });
    }

    const anyApplied = results.some((r) => r.applied.length > 0);
    if (anyApplied) {
      try {
        const recipientSet = new Set<string>();
        for (const target of results) {
          if (target.applied.length === 0) continue;
          const emails = await collectPropertySettingsNotifyEmails(
            supabase,
            organizationId,
            target.targetPropertyId,
            ownerId
          );
          for (const email of emails) recipientSet.add(email);
        }
        const sourceName = String((sourceProperty as { name?: string }).name ?? 'Property');
        await sendSettingsChangeNoticeEmails({
          supabase,
          organizationId,
          recipients: [...recipientSet],
          listingName: sourceName,
          settingLabel: 'Copied settings',
          actorUserId,
          ownerId,
          propertyId: sourcePropertyId,
        });
      } catch (err) {
        console.warn('[copy-property-settings] notify email failed:', err);
      }
    }
  }

  return { dryRun, results, logId };
}
