/**
 * Normalize Supabase env for local Deno tests.
 * Agent shells often export SUPABASE_URL with `/functions/v1` or an empty service role key.
 */

export const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321';

export const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

export function resolveLocalSupabaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return LOCAL_SUPABASE_URL;
  const withoutFunctions = trimmed.replace(/\/functions\/v1\/?$/i, '').replace(/\/$/, '');
  return withoutFunctions || LOCAL_SUPABASE_URL;
}

export function resolveLocalServiceRoleKey(raw: string | undefined): string {
  const trimmed = raw?.trim();
  return trimmed || LOCAL_SUPABASE_SERVICE_ROLE_KEY;
}

/** Call before importing modules that static-init Supabase clients (e.g. uploadService). */
export function applyLocalSupabaseTestEnv(): void {
  Deno.env.set('SUPABASE_URL', resolveLocalSupabaseUrl(Deno.env.get('SUPABASE_URL')));
  Deno.env.set(
    'SUPABASE_SERVICE_ROLE_KEY',
    resolveLocalServiceRoleKey(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))
  );
}

applyLocalSupabaseTestEnv();
