import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import {
  hasMarketingContentEditAccess,
  hasMarketingTemplateManageAccess,
  hasPropertyPermission,
} from '@/features/dashboard/team/lib/propertyPermissions';

export function useMarketingPermissions() {
  const { data: access } = usePropertyPermissions();
  const permissions = access?.permissions;

  return {
    canView: hasPropertyPermission(permissions, 'marketing:view'),
    canEditContent: hasMarketingContentEditAccess(permissions),
    canAddTemplate: hasPropertyPermission(permissions, 'marketing.templates:add'),
    canEditTemplate: hasPropertyPermission(permissions, 'marketing.templates:edit'),
    canDeleteTemplate: hasPropertyPermission(permissions, 'marketing.templates:delete'),
    canManageTemplates: hasMarketingTemplateManageAccess(permissions),
    canGenerate: hasPropertyPermission(permissions, 'marketing.generate:add'),
    canGenerateVideo: hasPropertyPermission(permissions, 'marketing.generate.video:add'),
    canPublish: hasPropertyPermission(permissions, 'marketing.publish:add'),
  };
}
