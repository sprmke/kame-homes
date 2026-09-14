import { lazy } from 'react';

import { Navigate, Route } from 'react-router-dom';

import { GuestAccountLayout } from '@/features/guest/account/components/GuestAccountLayout';
import { RequireGuestSession } from '@/features/guest/account/components/RequireGuestSession';
import {
  GUEST_ACCOUNT_FAVORITES_PATH,
  GUEST_ACCOUNT_PROFILE_PATH,
  GUEST_ACCOUNT_STAYS_PATH,
} from '@/features/guest/account/lib/guestAccountPaths';

const GuestAccountIndexPage = lazy(() =>
  import('@/features/guest/account/pages/GuestAccountIndexPage').then((m) => ({
    default: m.GuestAccountIndexPage,
  }))
);
const GuestMessagesPage = lazy(() =>
  import('@/features/guest/account/pages/GuestMessagesPage').then((m) => ({
    default: m.GuestMessagesPage,
  }))
);
const GuestProfilePage = lazy(() =>
  import('@/features/guest/account/pages/GuestProfilePage').then((m) => ({
    default: m.GuestProfilePage,
  }))
);
const GuestTicketsPage = lazy(() =>
  import('@/features/guest/account/pages/GuestTicketsPage').then((m) => ({
    default: m.GuestTicketsPage,
  }))
);
const GuestVouchersPage = lazy(() =>
  import('@/features/guest/account/pages/GuestVouchersPage').then((m) => ({
    default: m.GuestVouchersPage,
  }))
);
const GuestWishlistPage = lazy(() =>
  import('@/features/guest/account/pages/GuestWishlistPage').then((m) => ({
    default: m.GuestWishlistPage,
  }))
);

export const guestAccountRoutes = [
  <Route
    key="guest-account"
    path="account"
    element={
      <RequireGuestSession>
        <GuestAccountLayout />
      </RequireGuestSession>
    }
  >
    <Route index element={<GuestAccountIndexPage />} />
    <Route path="profile" element={<GuestProfilePage />} />
    <Route path="stays" element={<GuestMessagesPage />} />
    <Route path="vouchers" element={<GuestVouchersPage />} />
    <Route path="favorites" element={<GuestWishlistPage />} />
    <Route path="tickets/*" element={<GuestTicketsPage />} />
    <Route path="trips" element={<Navigate to={GUEST_ACCOUNT_STAYS_PATH} replace />} />
    <Route path="messages" element={<Navigate to={GUEST_ACCOUNT_STAYS_PATH} replace />} />
    <Route path="wishlist" element={<Navigate to={GUEST_ACCOUNT_FAVORITES_PATH} replace />} />
    <Route path="settings" element={<Navigate to={GUEST_ACCOUNT_PROFILE_PATH} replace />} />
  </Route>,
];
