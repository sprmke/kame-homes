import { Navigate } from 'react-router-dom';

import { GUEST_ACCOUNT_PROFILE_PATH } from '@/features/guest/account/lib/guestAccountPaths';

export function GuestAccountIndexPage() {
  return <Navigate to={GUEST_ACCOUNT_PROFILE_PATH} replace />;
}
