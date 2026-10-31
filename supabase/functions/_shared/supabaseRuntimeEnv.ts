/**
 * Resolve Supabase URL + service-role key for edge handlers.
 *
 * Deployed functions receive SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the platform.
 * Local `supabase functions serve --env-file` skips SUPABASE_* names on every hot reload,
 * so `./dev.sh` also writes API_URL + SERVICE_ROLE_KEY (see scripts/dev/build-local-functions-env.sh).
 */

export function resolveSupabaseUrl(): string {
  const raw = Deno.env.get('SUPABASE_URL') ?? Deno.env.get('API_URL') ?? '';
  return raw.trim().replace(/\/+$/, '');
}

export function resolveSupabaseServiceRoleKey(): string {
  return (
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SERVICE_ROLE_KEY') ??
    ''
  ).trim();
}
