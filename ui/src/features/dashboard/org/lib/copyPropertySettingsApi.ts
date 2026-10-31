import {
  AiQuotaExceededClientError,
  throwIfUpgradeHookFromJson,
} from '@/features/dashboard/org/lib/aiQuotaToast';
import type { CopyPropertySettingsGroupId } from '@/features/dashboard/org/lib/copyPropertySettingsGroups';
import { getSessionJwt } from '@/features/dashboard/org/lib/edgeClient';
import type { PlanFeatureKey } from '@/features/dashboard/plans/lib/planFeatures';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL as string;

export type CopyPropertySettingsOptions = {
  copyContact?: boolean;
  copyEmailRecipients?: boolean;
  copyTelegramCredentials?: boolean;
  skipAlreadyCustomized?: boolean;
};

export type CopyPropertySettingsRequest = {
  sourcePropertyId: string;
  targetPropertyIds: string[];
  groups: CopyPropertySettingsGroupId[];
  options?: CopyPropertySettingsOptions;
  dryRun?: boolean;
};

export type CopyPropertySettingsSkipReason =
  'permission' | 'plan' | 'opt_in' | 'not_implemented' | 'empty' | 'already_customized';

export type CopyPropertySettingsSkip = {
  group: CopyPropertySettingsGroupId | string;
  reason: CopyPropertySettingsSkipReason | string;
  detail?: string;
};

export type CopyPropertySettingsFailure = {
  group: CopyPropertySettingsGroupId | string;
  error: string;
};

export type CopyPropertySettingsTargetResult = {
  targetPropertyId: string;
  applied: string[];
  skipped: CopyPropertySettingsSkip[];
  failed: CopyPropertySettingsFailure[];
  alreadyCustomized: string[];
};

export type CopyPropertySettingsResponse = {
  dryRun: boolean;
  results: CopyPropertySettingsTargetResult[];
  logId?: string;
};

export type PropertySettingsCopyLogEntry = {
  id: string;
  organization_id: string;
  source_property_id: string;
  actor_user_id: string;
  groups: string[];
  target_property_ids: string[];
  results: CopyPropertySettingsTargetResult[] | unknown;
  created_at: string;
};

export type ListPropertySettingsCopyLogsResponse = {
  logs: PropertySettingsCopyLogEntry[];
};

type EdgeEnvelope<T> = {
  success?: boolean;
  error?: string;
  upgradeHook?: boolean;
  feature?: string;
  data?: T;
};

async function postCopyPropertySettings<T>(body: Record<string, unknown>): Promise<T> {
  const jwt = await getSessionJwt();
  const res = await fetch(`${FUNCTIONS_URL}/copy-property-settings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as EdgeEnvelope<T>;
  throwIfUpgradeHookFromJson(json, res);
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json.data as T;
}

export function copyPropertySettings(
  body: CopyPropertySettingsRequest
): Promise<CopyPropertySettingsResponse> {
  return postCopyPropertySettings<CopyPropertySettingsResponse>({ ...body });
}

export function listPropertySettingsCopyLogs(args: {
  orgSlug: string;
  limit?: number;
}): Promise<ListPropertySettingsCopyLogsResponse> {
  return postCopyPropertySettings<ListPropertySettingsCopyLogsResponse>({
    action: 'listLogs',
    orgSlug: args.orgSlug,
    limit: args.limit ?? 20,
  });
}

export function isCopyPropertySettingsUpgradeError(
  error: unknown
): error is AiQuotaExceededClientError {
  return error instanceof AiQuotaExceededClientError;
}

export function copyPropertySettingsUpgradeFeature(error: unknown): PlanFeatureKey {
  if (error instanceof AiQuotaExceededClientError && error.feature) {
    return error.feature;
  }
  return 'copyPropertySettings';
}
