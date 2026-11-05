/** Sets minimal Supabase env before modules that init `DatabaseService` at import time. */
if (!Deno.env.get('SUPABASE_URL')?.trim()) {
  Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
}
if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()) {
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
}
