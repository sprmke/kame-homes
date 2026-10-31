/**
 * Side-effect module: import it FIRST in live eval entry points. Shared services create their
 * Supabase clients at module load, so env must be populated before those imports evaluate.
 *
 * Also disables the AI response cache so every case measures a fresh model answer.
 *
 * Loads supabase/.env.local without overriding the process environment. The live evals never
 * need the database (billing has no org, the response cache is best-effort), so SUPABASE_URL
 * falls back to the local stack only to satisfy client construction.
 */
try {
  const text = Deno.readTextFileSync(new URL('../../../.env.local', import.meta.url));
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || Deno.env.get(m[1])) continue;
    Deno.env.set(m[1], m[2].replace(/^['"]|['"]$/g, ''));
  }
} catch {
  /* no supabase/.env.local — rely on the process environment */
}

if (!Deno.env.get('SUPABASE_URL')) Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'eval-placeholder');
}
Deno.env.set('AI_RESPONSE_CACHE_DISABLED', '1');
