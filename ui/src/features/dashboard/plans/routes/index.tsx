import type { ReactNode } from 'react';

import { Navigate, Route, useLocation, useParams } from 'react-router-dom';

import { orgPlansPath } from '@/features/dashboard/org/lib/tenantPaths';

function PropertyPlansRedirect() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  if (!orgSlug) {
    return <Navigate to="/org" replace />;
  }
  return <Navigate to={`${orgPlansPath(orgSlug)}${location.search}`} replace />;
}

/** Legacy property `/plans` deep links redirect to the org billing hub. */
export function propertyPlansRoute(): ReactNode {
  return <Route path="plans" element={<PropertyPlansRedirect />} />;
}
