import { verifyAuthenticatedUser, type AuthenticatedUser, isSuperAdminEmail } from './orgAuth.ts';

export { isSuperAdminEmail };

/** Authenticated user whose email is on SUPER_ADMIN_EMAILS (platform scope). */
export async function verifySuperAdminJwt(req: Request): Promise<AuthenticatedUser> {
  const user = await verifyAuthenticatedUser(req);

  if (!isSuperAdminEmail(user.email)) {
    throw new Response(JSON.stringify({ success: false, error: 'Super admin access required.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return user;
}
