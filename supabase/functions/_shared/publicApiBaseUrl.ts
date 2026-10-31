/**
 * Browser- and OAuth-reachable Supabase API origin.
 *
 * Local `functions serve` injects `SUPABASE_URL=http://kong:8000` and strips `SUPABASE_*`
 * from the edge container env file — use `PUBLIC_API_URL` (set in functions-serve.env).
 */

export function publicApiBaseUrl(): string {
  const explicit = (Deno.env.get('PUBLIC_API_URL') ?? Deno.env.get('SUPABASE_PUBLIC_URL') ?? '')
    .trim()
    .replace(/\/+$/, '');
  if (explicit) return explicit;

  let base = (Deno.env.get('SUPABASE_URL') ?? '').trim().replace(/\/+$/, '');
  if (!base) {
    throw new Error('Missing SUPABASE_URL or PUBLIC_API_URL');
  }

  try {
    const u = new URL(base);
    if (u.hostname === 'kong') {
      return 'http://127.0.0.1:54321';
    }
  } catch {
    /* ignore */
  }

  return base;
}
