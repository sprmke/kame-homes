import { useMemo } from 'react';

import { InboxPage } from '@/features/dashboard/inbox/pages/InboxPage';
import { useOptionalOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import { propertyInboxPath } from '@/features/dashboard/org/lib/tenantPaths';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';

export function PropertyInboxPage() {
  const orgContext = useOptionalOrgContext();
  const { data: access } = usePropertyPermissions();
  const permissions = access?.permissions;

  const orgSlug = orgContext?.orgSlug ?? null;
  const orgId = orgContext?.org.id ?? null;
  const propertyId = orgContext?.property.id ?? null;
  const scope = useMemo(() => (propertyId ? { propertyId } : null), [propertyId]);

  const canManageChannels =
    hasPropertyPermission(permissions, 'inbox.channels:add') ||
    hasPropertyPermission(permissions, 'inbox.channels:delete');
  const canManageQuickReplies =
    hasPropertyPermission(permissions, 'inbox.quickReplies:add') ||
    hasPropertyPermission(permissions, 'inbox.quickReplies:edit') ||
    hasPropertyPermission(permissions, 'inbox.quickReplies:delete');
  const canManageAutomation = hasPropertyPermission(permissions, 'inbox.automation:edit');

  return (
    <InboxPage
      kind="property"
      returnPath={
        orgSlug && orgContext?.propertySlug
          ? propertyInboxPath(orgSlug, orgContext.propertySlug)
          : '/inbox'
      }
      canReply={hasPropertyPermission(permissions, 'inbox.messages:edit')}
      canManage={canManageChannels || canManageQuickReplies || canManageAutomation}
      canManageChannels={canManageChannels}
      canManageQuickReplies={canManageQuickReplies}
      canManageAutomation={canManageAutomation}
      showSettingsManageTabs
      scope={scope}
      orgSlug={orgSlug}
      orgId={orgId}
    />
  );
}
