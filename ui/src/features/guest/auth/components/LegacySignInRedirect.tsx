import { Navigate, useSearchParams } from 'react-router-dom';

import { hostLoginPath } from '@/features/guest/auth/lib/hostAuthPaths';

/** `/sign-in` → `/for-hosts/login` (preserves `?redirect=`). */
export function LegacySignInRedirect() {
  const [params] = useSearchParams();
  const redirect = params.get('redirect');
  return <Navigate to={hostLoginPath(redirect ?? undefined)} replace />;
}
