/**
 * Vitest global setup — Node env has no Vite env injection unless we set it here.
 * Keeps imports of `@/lib/supabase/client` and edge helpers from failing at load time.
 */
process.env.VITE_SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321/functions/v1';
process.env.VITE_SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key';
process.env.VITE_SUPABASE_PROJECT_URL =
  process.env.VITE_SUPABASE_PROJECT_URL ?? 'http://127.0.0.1:54321';
