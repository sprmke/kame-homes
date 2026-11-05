import { scopedFunctionsUrl } from '@/features/dashboard/org/lib/adminApiScope';
import type { AdminAssetScope } from '@/features/dashboard/org/lib/adminAssetScope';
import { scopedAssetFunctionsUrl } from '@/features/dashboard/org/lib/adminAssetScope';
import { throwIfAiQuota } from '@/features/dashboard/org/lib/aiQuotaToast';

import { throwIfFeatureUnavailableBody } from '@/lib/featureAvailability/featureUnavailableError';
import { supabase } from '@/lib/supabase/client';

export async function getAdminJwt(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('No active session. Please sign in');
  return token;
}

type EdgeSuccess<T> = { success?: boolean; error?: string; data?: T };

function resolveScopeUrl(path: string, scope: AdminAssetScope | string | null): string {
  if (scope && typeof scope === 'object') {
    return scopedAssetFunctionsUrl(path, scope);
  }
  return scopedFunctionsUrl(path, typeof scope === 'string' ? scope : null);
}

export async function fetchTelegramSettings<T>(
  path: string,
  scope: AdminAssetScope | string | null,
  fallbackError: string
): Promise<T> {
  const jwt = await getAdminJwt();
  const res = await fetch(resolveScopeUrl(path, scope), {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  const json = (await res.json()) as EdgeSuccess<T>;
  if (!json.success || !json.data) {
    throw new Error(json.error ?? fallbackError);
  }
  return json.data;
}

export async function patchTelegramSettings<TData>(
  path: string,
  scope: AdminAssetScope | string | null,
  patch: Record<string, unknown>,
  fallbackError: string
): Promise<{ data: TData; cronSync?: { ok?: boolean; error?: string } }> {
  const jwt = await getAdminJwt();
  const res = await fetch(resolveScopeUrl(path, scope), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  const json = (await res.json()) as EdgeSuccess<TData> & {
    cronSync?: { ok?: boolean; error?: string };
    upgradeHook?: boolean;
    feature?: string;
  };
  throwIfAiQuota(json, res);
  throwIfFeatureUnavailableBody(json);
  if (!json.success || !json.data) {
    throw new Error(json.error ?? fallbackError);
  }
  return { data: json.data, cronSync: json.cronSync };
}

export async function postTelegramSettingsAction<T>(
  path: string,
  scope: AdminAssetScope | string | null,
  body: Record<string, unknown>,
  fallbackError: string
): Promise<T> {
  const jwt = await getAdminJwt();
  const res = await fetch(resolveScopeUrl(path, scope), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as EdgeSuccess<T> & Record<string, unknown>;
  throwIfFeatureUnavailableBody(json);
  if (!json.success) {
    throw new Error(json.error ?? fallbackError);
  }
  return json as T;
}
