import { Navigate, useParams } from 'react-router-dom';

import { DevelopmentSettingsCard } from '@/features/dashboard/super-admin/components/super-admin-development-settings/DevelopmentSettingsCard';
import { superAdminPaths } from '@/features/dashboard/super-admin/lib/superAdminPaths';

export function SuperAdminDevelopmentDetailPage() {
  const { developmentSlug = '' } = useParams<{ developmentSlug: string }>();

  if (!developmentSlug) {
    return <Navigate to={superAdminPaths.developments} replace />;
  }

  return <DevelopmentSettingsCard slug={developmentSlug} />;
}
