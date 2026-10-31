import { Navigate } from 'react-router-dom';

import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import {
  propertyNotificationsPath,
  type NotificationModule,
} from '@/features/dashboard/org/lib/tenantPaths';

export function NotificationModuleRedirect({ module }: { module: NotificationModule }) {
  const { orgSlug, propertySlug } = useOrgContext();
  return <Navigate to={propertyNotificationsPath(orgSlug, propertySlug, module)} replace />;
}
