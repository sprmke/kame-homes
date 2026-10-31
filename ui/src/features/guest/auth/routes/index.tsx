import { lazy } from 'react';

import { Navigate, Route } from 'react-router-dom';

import { AuthLayout } from '@/features/guest/auth/components/AuthLayout';
import { LegacySignInRedirect } from '@/features/guest/auth/components/LegacySignInRedirect';

const GuestLoginPage = lazy(() =>
  import('@/features/guest/auth/pages/GuestAuthPages').then((m) => ({
    default: m.GuestLoginPage,
  }))
);
const GuestRegisterPage = lazy(() =>
  import('@/features/guest/auth/pages/GuestAuthPages').then((m) => ({
    default: m.GuestRegisterPage,
  }))
);
const HostLoginPage = lazy(() =>
  import('@/features/guest/auth/pages/HostAuthPages').then((m) => ({ default: m.HostLoginPage }))
);
const HostRegisterPage = lazy(() =>
  import('@/features/guest/auth/pages/HostAuthPages').then((m) => ({
    default: m.HostRegisterPage,
  }))
);

/** Host + guest auth pages — both passwordless (email OTP + Google). */
export const guestAuthRoutes = [
  <Route key="legacy-sign-in" path="/sign-in" element={<LegacySignInRedirect />} />,
  <Route key="auth-shell" element={<AuthLayout />}>
    <Route path="for-hosts/login" element={<HostLoginPage />} />
    <Route path="for-hosts/register" element={<HostRegisterPage />} />
    <Route path="for-guests/login" element={<GuestLoginPage />} />
    <Route path="for-guests/register" element={<GuestRegisterPage />} />
  </Route>,
  <Route
    key="legacy-guest-auth"
    path="/for-guests/*"
    element={<Navigate to="/for-guests/login" replace />}
  />,
];
