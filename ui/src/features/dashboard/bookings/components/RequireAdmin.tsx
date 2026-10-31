import type { ReactNode } from 'react';

import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { hostLoginPath } from '@/features/guest/auth/lib/hostAuthPaths';

import { useAdminSession } from '@/features/dashboard/bookings/hooks/useAdminSession';

import { RouteGuardSkeleton } from '@/components/skeletons/AdminSkeletons';
import { Button } from '@/components/ui/button';

type Props = {
  children: ReactNode;
};

export function RequireAdmin({ children }: Props) {
  const location = useLocation();
  const { status } = useAdminSession();

  if (status === 'loading') {
    return (
      <div className="bg-card fixed inset-0">
        <RouteGuardSkeleton fullScreen />
      </div>
    );
  }

  if (status === 'signed-out') {
    return <Navigate to={hostLoginPath(location.pathname + location.search)} replace />;
  }

  return <>{children}</>;
}

export function RequireAdminSignOutButton() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, status } = useAdminSession();

  return (
    <Button
      onClick={async () => {
        try {
          if (status !== 'signed-out') {
            await signOut();
          }
        } finally {
          navigate(hostLoginPath(location.pathname + location.search), { replace: true });
        }
      }}
      variant="outline"
      className="h-9 w-full text-[13px]"
    >
      Sign out
    </Button>
  );
}
