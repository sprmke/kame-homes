import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type { ParkingRouteFn } from '@/features/dashboard/org/routes/guards';

import { RouteSkeletonBoundary } from '@/components/skeletons/RouteSkeleton';
import {
  ParkingBookingsRouteSkeleton,
  ParkingBookingDetailRouteSkeleton,
  ParkingDashboardRouteSkeleton,
  ParkingFinanceRouteSkeleton,
  ParkingInboxRouteSkeleton,
  ParkingNotificationsRouteSkeleton,
  ParkingPricingRouteSkeleton,
  ParkingSettingsRouteSkeleton,
} from '@/components/skeletons/RouteSkeletons';

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
      <Route
        index
        element={
          <RouteSkeletonBoundary skeleton={<ParkingDashboardRouteSkeleton />}>
            <ParkingDashboardPage />
          </RouteSkeletonBoundary>
        }
      />
      <Route
        path="bookings"
        element={
          <RouteSkeletonBoundary skeleton={<ParkingBookingsRouteSkeleton />}>
            <ParkingBookingsPage />
          </RouteSkeletonBoundary>
        }
      />
      <Route
        path="bookings/:bookingId"
        element={
          <RouteSkeletonBoundary skeleton={<ParkingBookingDetailRouteSkeleton />}>
            <ParkingBookingDetailPage />
          </RouteSkeletonBoundary>
        }
      />
      <Route
        path="finance"
        element={
          <RouteSkeletonBoundary skeleton={<ParkingFinanceRouteSkeleton />}>
            <ParkingFinancePage />
          </RouteSkeletonBoundary>
        }
      />
      <Route
        path="pricing"
        element={
          <RouteSkeletonBoundary skeleton={<ParkingPricingRouteSkeleton />}>
            <ParkingPricingPage />
          </RouteSkeletonBoundary>
        }
      />
      <Route
        path="notifications"
        element={
          <RouteSkeletonBoundary skeleton={<ParkingNotificationsRouteSkeleton />}>
            <ParkingNotificationsPage />
          </RouteSkeletonBoundary>
        }
      />
      <Route
        path="settings"
        element={
          <RouteSkeletonBoundary skeleton={<ParkingSettingsRouteSkeleton />}>
            <ParkingSettingsPage />
          </RouteSkeletonBoundary>
        }
      />
      <Route
        path="inbox"
        element={parkingRoute('inbox', <ParkingInboxPage />, <ParkingInboxRouteSkeleton />)}
      />
    </>
  );
}
