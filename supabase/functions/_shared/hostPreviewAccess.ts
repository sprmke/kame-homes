/**
 * Host preview on public GETs (`?preview=1` / `?embed=1`).
 * The anon `Authorization` header stays the gateway key; the host session JWT
 * arrives as `?admin_jwt=` and is re-checked with `verifyPropertyAccess`.
 */
import { verifyPropertyAccess } from './orgAuth.ts';

export async function hasHostPreviewAccess(req: Request, propertyId: string): Promise<boolean> {
  const adminJwt = new URL(req.url).searchParams.get('admin_jwt');
  if (!adminJwt) return false;
  const proxyHeaders = new Headers(req.headers);
  proxyHeaders.set('Authorization', `Bearer ${adminJwt}`);
  const proxyReq = new Request(req.url, { headers: proxyHeaders });
  try {
    await verifyPropertyAccess(proxyReq, propertyId);
    return true;
  } catch {
    return false;
  }
}
