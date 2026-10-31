import { Navigate, useParams } from 'react-router-dom';

import type { ActivityLogScope } from '@/features/dashboard/activity/components/ActivityLogPanel';
import {
  orgSettingsPath,
  parkingSectionPath,
  propertySectionPath,
} from '@/features/dashboard/org/lib/tenantPaths';

type Props = {
  scope: ActivityLogScope;
};

/** Legacy `/activity` URLs → settings with the manage modal open. */
export function ActivityLogRedirect({ scope }: Props) {
  const { orgSlug, propertySlug, parkingSlug } = useParams<{
    orgSlug: string;
    propertySlug?: string;
    parkingSlug?: string;
  }>();

  if (!orgSlug) {
    return <Navigate to="/" replace />;
  }

  let target = `${orgSettingsPath(orgSlug)}?open=activity`;
  if (scope === 'property' && propertySlug) {
    target = `${propertySectionPath(orgSlug, propertySlug, 'settings')}?open=activity`;
  } else if (scope === 'parking' && parkingSlug) {
    target = `${parkingSectionPath(orgSlug, parkingSlug, 'settings')}?open=activity`;
  }

  return <Navigate to={target} replace />;
}
