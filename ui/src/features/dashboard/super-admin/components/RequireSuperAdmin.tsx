import type { ReactNode } from 'react';

import { Navigate, useLocation } from 'react-router-dom';

import { ShieldX } from 'lucide-react';

import { hostLoginPath } from '@/features/guest/auth/lib/hostAuthPaths';

import { RequireAdminSignOutButton } from '@/features/dashboard/bookings/components/RequireAdmin';
import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';
import { useOrganizations } from '@/features/dashboard/org/hooks/useOrganizations';

import { RouteGuardSkeleton } from '@/components/skeletons/AdminSkeletons';

type Props = {
  children: ReactNode;
};

export function RequireSuperAdmin({ children }: Props) {
  const location = useLocation();
  const { status } = useAdminSession();
  const capabilities = useOrganizations({ enabled: status === 'admin' });

  if (status === 'loading' || capabilities.isLoading) {
    return <RouteGuardSkeleton fullScreen />;
  }

  if (status === 'signed-out') {
    return <Navigate to={hostLoginPath(location.pathname + location.search)} replace />;
  }

  if (capabilities.data?.isSuperAdmin !== true) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-10" role="alert">
        <div className="border-border bg-card w-full max-w-[min(calc(100vw-1.5rem),24rem)] rounded-xl border p-6 text-center">
          <ShieldX className="text-muted-foreground mx-auto mb-3 size-8" aria-hidden />
          <h1 className="text-foreground text-lg font-semibold">Access restricted</h1>
          <div className="mt-6">
            <RequireAdminSignOutButton />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
