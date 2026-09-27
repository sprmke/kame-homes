import { Navigate, useLocation } from 'react-router-dom';

import { rewriteDashboardPathForSlugRemap } from '@/features/dashboard/org/lib/tenantSlugRemap';

type Props = {
  children: React.ReactNode;
};

/**
 * After a slug rename this session, rewrite any history entry that still uses
 * the old slug so Back/Forward does not show TenantAccessDenied.
 */
export function TenantSlugRemapRedirect({ children }: Props) {
  const location = useLocation();
  const rewritten = rewriteDashboardPathForSlugRemap(location.pathname);
  if (rewritten) {
    return <Navigate to={`${rewritten}${location.search}${location.hash}`} replace />;
  }
  return <>{children}</>;
}
