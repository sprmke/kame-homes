import { useLocation, useNavigate } from 'react-router-dom';

import { AlertTriangle, PauseCircle, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

import { useOrgContext } from '@/features/dashboard/org/components/RequireOrgContext';
import {
  usePropertyLifecycle,
  usePropertyLifecycleAction,
} from '@/features/dashboard/org/hooks/usePropertyLifecycle';
import { lifecyclePresentation } from '@/features/dashboard/org/lib/propertyLifecycle';
import { propertySectionPath } from '@/features/dashboard/org/lib/tenantPaths';
import { usePropertyPermissions } from '@/features/dashboard/team/hooks/usePropertyPermissions';
import { hasPropertyPermission } from '@/features/dashboard/team/lib/propertyPermissions';
import { friendlyToastError } from '@/lib/feedback/toastMessages';

import { Button } from '@/components/ui/button';

const ICONS = {
  paused: PauseCircle,
  suspended: ShieldAlert,
  archived: AlertTriangle,
} as const;

/**
 * Property-wide banner for a listing that is not live. Hidden on Settings, where the
 * Listing status section already shows the same state and actions.
 */
export function PropertyLifecycleBanner() {
  const { property, orgSlug, propertySlug } = useOrgContext();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: access } = usePropertyPermissions();
  const { data: lifecycle } = usePropertyLifecycle(property.id);
  const action = usePropertyLifecycleAction(orgSlug);

  const state = lifecycle?.state;
  if (!state || state === 'live' || state === 'pending_verification') return null;
  if (location.pathname.endsWith('/settings')) return null;

  const presentation = lifecyclePresentation(state);
  const Icon = ICONS[state as keyof typeof ICONS] ?? AlertTriangle;
  const canManage = hasPropertyPermission(access?.permissions, 'settings.listingStatus:edit');

  const primaryAction =
    state === 'paused' && lifecycle?.allowedActions.includes('resume')
      ? 'resume'
      : state === 'archived' && lifecycle?.allowedActions.includes('restore')
        ? 'restore'
        : null;

  const handlePrimary = async () => {
    if (!primaryAction) {
      navigate(propertySectionPath(orgSlug, propertySlug, 'settings'));
      return;
    }
    try {
      await action.mutateAsync({ propertyId: property.id, action: primaryAction });
      toast.success(primaryAction === 'resume' ? 'Bookings resumed' : 'Property restored');
    } catch (error) {
      toast.error(friendlyToastError(error, 'Could not update this property'));
    }
  };

  return (
    <div
      role="status"
      className="border-warning/40 bg-warning/10 mb-3 flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-2">
        <Icon className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{presentation.label}</p>
          <p className="text-muted-foreground text-xs">
            {lifecycle?.activationBlock?.message ?? presentation.description}
          </p>
        </div>
      </div>

      {canManage ? (
        <Button
          type="button"
          size="sm"
          variant={primaryAction ? 'default' : 'outline'}
          className="settings-action w-full sm:w-auto"
          disabled={action.isPending}
          onClick={() => void handlePrimary()}
        >
          {primaryAction === 'resume'
            ? 'Resume'
            : primaryAction === 'restore'
              ? 'Restore'
              : 'Manage listing'}
        </Button>
      ) : null}
    </div>
  );
}
