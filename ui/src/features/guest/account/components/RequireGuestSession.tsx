import { useEffect, type ReactNode } from 'react';

import { GuestAccountGateSkeleton } from '@/components/skeletons/GuestMarketingSkeleton';
import { useGuestAuth } from '@/features/guest/auth/context/GuestAuthContext';

export function RequireGuestSession({ children }: { children: ReactNode }) {
  const { status, requireGuestAuth } = useGuestAuth();
  const authRequested = status === 'loading' || status === 'anonymous';

  useEffect(() => {
    if (status !== 'anonymous') return;
    requireGuestAuth(() => undefined);
  }, [status, requireGuestAuth]);

  if (authRequested) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <GuestAccountGateSkeleton />
      </div>
    );
  }

  return children;
}
