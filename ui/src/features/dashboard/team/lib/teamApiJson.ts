import { throwIfUpgradeHookFromJson } from '@/features/dashboard/org/lib/aiQuotaToast';

type ApiJson<T> = {
  success?: boolean;
  error?: string;
  data?: T;
};

export async function parseTeamApiData<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiJson<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  if (json.data === undefined) {
    throw new Error(json.error ?? 'Request failed');
  }
  return json.data;
}

export async function parseTeamApiLooseData<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiJson<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return (json.data ?? {}) as T;
}

export async function parseTeamApiMutateData<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as ApiJson<T> & {
    upgradeHook?: boolean;
    feature?: string;
  };
  if (json.upgradeHook) {
    throwIfUpgradeHookFromJson(json, res);
  }
  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Request failed');
  }
  return (json.data ?? {}) as T;
}
