import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type { ParkingRouteFn } from '@/features/dashboard/org/routes/guards';

const ParkingInboxPage = lazy(() =>
  import('@/features/dashboard/inbox/pages/ParkingInboxPage').then((m) => ({
    default: m.ParkingInboxPage,
  }))
);
const ParkingBookingDetailPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingBookingDetailPage').then((m) => ({
    default: m.ParkingBookingDetailPage,
  }))
);
const ParkingBookingsPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingBookingsPage').then((m) => ({
    default: m.ParkingBookingsPage,
  }))
);
const ParkingDashboardPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingDashboardPage').then((m) => ({
    default: m.ParkingDashboardPage,
  }))
);
const ParkingFinancePage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingFinancePage').then((m) => ({
    default: m.ParkingFinancePage,
  }))
);
const ParkingNotificationsPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingNotificationsPage').then((m) => ({
    default: m.ParkingNotificationsPage,
  }))
);
const ParkingPricingPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingPricingPage').then((m) => ({
    default: m.ParkingPricingPage,
  }))
);
const ParkingSettingsPage = lazy(() =>
  import('@/features/dashboard/parking/pages/ParkingSettingsPage').then((m) => ({
    default: m.ParkingSettingsPage,
  }))
);

export function parkingAdminRoutes(parkingRoute: ParkingRouteFn): ReactNode {
  return (
    <>
      <Route index element={<ParkingDashboardPage />} />
      <Route path="bookings" element={<ParkingBookingsPage />} />
      <Route path="bookings/:bookingId" element={<ParkingBookingDetailPage />} />
      <Route path="finance" element={<ParkingFinancePage />} />
      <Route path="pricing" element={<ParkingPricingPage />} />
      <Route path="notifications" element={<ParkingNotificationsPage />} />
      <Route path="settings" element={<ParkingSettingsPage />} />
      <Route path="inbox" element={parkingRoute('inbox', <ParkingInboxPage />)} />
    </>
  );
}
