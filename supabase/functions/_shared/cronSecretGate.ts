/**
 * Shared cron secret verification. Fail-open when unset on non-production; fail-closed on
 * production once operators set ENVIRONMENT=production and provision Vault secrets.
 */

function isProductionEnvironment(): boolean {
  const env = Deno.env.get('ENVIRONMENT')?.trim().toLowerCase();
  // Unset ENVIRONMENT is treated as production so a misconfigured hosted project
  // fails closed rather than silently accepting unauthenticated cron calls.
  // Local dev sets ENVIRONMENT=development (see supabase/.env.local).
  if (!env) return true;
  return env === 'production' || env === 'prod';
}

export type CronSecretGateOptions = {
  envKey: string;
  /** Lowercase header name, e.g. `x-sd-refund-cron-secret`. */
  headerName: string;
  /** When true, missing secret always rejects (use after Vault audit). */
  failClosedWhenUnset?: boolean;
};

/** Returns true when the caller may proceed. */
export function verifyCronSecret(req: Request, options: CronSecretGateOptions): boolean {
  const expected = Deno.env.get(options.envKey)?.trim();
  if (!expected) {
    if (options.failClosedWhenUnset || isProductionEnvironment()) {
      return false;
    }
    return true;
  }
  const got = req.headers.get(options.headerName)?.trim();
  return got === expected;
}
