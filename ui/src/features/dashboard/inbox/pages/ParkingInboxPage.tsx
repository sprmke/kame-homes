import { useMemo } from 'react';

import { InboxPage } from '@/features/dashboard/inbox/pages/InboxPage';
import { useParkingContext } from '@/features/dashboard/org/components/RequireParkingContext';
import { parkingInboxPath } from '@/features/dashboard/org/lib/tenantPaths';
import { useParkingPermissions } from '@/features/dashboard/team/hooks/useParkingPermissions';
import { hasParkingPermission } from '@/features/dashboard/team/lib/parkingPermissions';

export function ParkingInboxPage() {
  const { org, orgSlug, parking, parkingSlug } = useParkingContext();
  const { data: access } = useParkingPermissions();
  const scope = useMemo(() => ({ parkingId: parking.id }), [parking.id]);

  return (
    <InboxPage
      kind="parking"
      returnPath={parkingInboxPath(orgSlug, parkingSlug)}
      canReply={hasParkingPermission(access?.permissions, 'inbox:reply')}
      canManage={hasParkingPermission(access?.permissions, 'inbox:manage')}
      showSettingsManageTabs
      scope={scope}
      orgSlug={orgSlug}
      orgId={org.id}
    />
  );
}
