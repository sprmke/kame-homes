/**
 * Shared shape for `/admin/health` checks. Mirrored in
 * `ui/src/features/dashboard/super-admin/lib/systemHealth/healthStatus.ts`.
 */

export type HealthStatus = 'ok' | 'warn' | 'error' | 'off' | 'unknown';

export type HealthCategory =
  'configuration' | 'security' | 'integrations' | 'jobs' | 'database' | 'usage';

export type HealthCheck = {
  id: string;
  category: HealthCategory;
  group: string;
  label: string;
  status: HealthStatus;
  detail?: string;
  hint?: string;
  features?: string[];
  checkedAt?: string;
  /** In-app route where the operator fixes it. */
  fixHref?: string;
  /** External console (provider dashboard, Supabase settings). */
  manageHref?: string;
  /** Live probe id, so the row can re-run just that probe. */
  probeId?: string;
  /** Affected tenants or keys (capped server-side). */
  items?: HealthCheckItem[];
};

export type HealthCheckItem = { label: string; detail?: string; href?: string };

/** Hosted project ref from `https://<ref>.supabase.co`; null for local or custom domains. */
export function supabaseProjectRef(get: (key: string) => string | undefined): string | null {
  const explicit = get('SUPABASE_PROJECT_REF')?.trim();
  if (explicit) return explicit;
  try {
    const host = new URL(get('SUPABASE_URL') ?? '').hostname;
    return host.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function supabaseDashboardUrl(ref: string | null, path: string): string | undefined {
  return ref ? `https://supabase.com/dashboard/project/${ref}/${path}` : undefined;
}

const SEVERITY: Record<HealthStatus, number> = {
  error: 4,
  warn: 3,
  unknown: 2,
  ok: 1,
  off: 0,
};

export function worstStatus(statuses: HealthStatus[]): HealthStatus {
  let worst: HealthStatus = 'off';
  for (const status of statuses) {
    if (SEVERITY[status] > SEVERITY[worst]) worst = status;
  }
  return worst;
}

export function isProductionEnv(get: (key: string) => string | undefined): boolean {
  const env = (get('ENVIRONMENT') ?? get('DENO_ENV'))?.trim().toLowerCase();
  return env === 'production' || env === 'prod';
}
