import { Link } from 'react-router-dom';

import { ShieldX, Sparkles } from 'lucide-react';

import { RequireAdminSignOutButton } from '@/features/dashboard/bookings/components/RequireAdmin';
import { orgPropertiesPath } from '@/features/dashboard/org/lib/tenantPaths';
import {
  planLimitedAccessDeniedMessage,
  planLimitedAccessDeniedTitle,
} from '@/features/dashboard/team/lib/planLimitedTeamCopy';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TenantAccessDeniedReason = 'default' | 'plan_limited';

type Props = {
  scope: 'org' | 'property';
  reason?: TenantAccessDeniedReason;
  orgSlug?: string;
  orgName?: string;
  propertySlug?: string;
  propertyName?: string;
  /** When true, fills the viewport (used outside AdminLayout sidebar). */
  fullScreen?: boolean;
};

export function TenantAccessDenied({
  scope,
  reason = 'default',
  orgSlug,
  orgName,
  propertyName,
  fullScreen = false,
}: Props) {
  const planLimited = reason === 'plan_limited';

  const title = planLimited
    ? planLimitedAccessDeniedTitle()
    : scope === 'property'
      ? 'No property access'
      : 'No organization access';

  const message = planLimited
    ? planLimitedAccessDeniedMessage(scope)
    : scope === 'property'
      ? propertyName
        ? `You don't have access to ${propertyName}.`
        : "You don't have access to this property."
      : orgName
        ? `You don't have access to ${orgName}.`
        : "You don't have access to this organization.";

  const orgFallbackHref =
    !planLimited && scope === 'property' && orgSlug ? orgPropertiesPath(orgSlug) : null;
  const Icon = planLimited ? Sparkles : ShieldX;

  return (
    <div
      className={cn(
        'flex items-center justify-center px-4 py-10',
        fullScreen ? 'bg-background min-h-screen' : 'min-h-[60vh]'
      )}
      role="alert"
    >
      <div className="border-border bg-card w-full max-w-[min(calc(100vw-1.5rem),24rem)] rounded-xl border p-6 text-center">
        <Icon
          className={cn(
            'mx-auto mb-3 size-8',
            planLimited ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
          )}
          aria-hidden
        />
        <h1 className="text-foreground text-lg font-semibold">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{message}</p>
        <div className="mt-6 space-y-2">
          {orgFallbackHref ? (
            <Button asChild className="min-h-[44px] w-full">
              <Link to={orgFallbackHref}>Organization properties</Link>
            </Button>
          ) : null}
          <Button
            asChild
            variant={orgFallbackHref ? 'outline' : 'default'}
            className="min-h-[44px] w-full"
          >
            <Link to="/org">Home</Link>
          </Button>
          <RequireAdminSignOutButton />
        </div>
      </div>
    </div>
  );
}
