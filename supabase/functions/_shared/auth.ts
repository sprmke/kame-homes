/**
 * Admin JWT verification — shared helper for all admin-only edge functions.
 *
 * Usage (first line of every admin handler, before any business logic):
 *   const adminUser = await verifyAdminJwt(req);
 *
 * On success: returns the verified user object (email guaranteed to be set).
 * On failure: throws a Response with status 401 or 403 — the caller's catch
 *             block should re-throw it so the handler skeleton serializes it.
 *
 * Rules: .cursor/rules/admin-auth.mdc §3, §6
 * Plan:  docs/planning/NEW_FLOW_PLAN.md §3.2
 */

import { createServiceClient } from './orgAuth.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  email: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function unauthorizedResponse(message: string): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function forbiddenResponse(message: string): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Core verifier ────────────────────────────────────────────────────────────

/**
 * Validates the Bearer JWT in the Authorization header against Supabase Auth,
 * then asserts the user's email is in the ADMIN_ALLOWED_EMAILS allow-list.
 *
 * Throws a serialized Response on failure so the handler's catch block can
 * return it directly.
 */
export async function verifyAdminJwt(req: Request): Promise<AdminUser> {
  // 1. Extract JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw unauthorizedResponse('Missing or invalid Authorization header');
  }
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) {
    throw unauthorizedResponse('Missing JWT');
  }

  // 2. Validate with Supabase Auth (uses service-role key to bypass anon RLS)
  const supabase = createServiceClient();

  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data.user) {
    throw unauthorizedResponse('Invalid or expired session');
  }

  const user = data.user;
  const email = user.email ?? '';

  // 3. Check allow-list (server-side — never trust client-only checks)
  const allowedRaw = Deno.env.get('ADMIN_ALLOWED_EMAILS') ?? '';
  const allowedEmails = allowedRaw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowedEmails.includes(email.toLowerCase())) {
    console.log(`[auth] Admin verified (allow-list): ${email}`);
    return { id: user.id, email };
  }

  const supabaseOrg = createServiceClient();
  const { count, error: orgError } = await supabaseOrg
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id);

  if (orgError) {
    console.error('[auth] org ownership check failed:', orgError.message);
    throw forbiddenResponse('Access restricted');
  }

  if ((count ?? 0) > 0) {
    console.log(`[auth] Admin verified (org owner): ${email}`);
    return { id: user.id, email };
  }

  if (allowedEmails.length === 0) {
    console.error('[auth] ADMIN_ALLOWED_EMAILS is not set and user owns no org');
  } else {
    console.warn(`[auth] Access denied for email: ${email}`);
  }
  throw forbiddenResponse('Access restricted');
}
