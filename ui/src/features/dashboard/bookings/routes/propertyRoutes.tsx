import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import { NotificationModuleRedirect } from '@/features/dashboard/bookings/components/NotificationModuleRedirect';
import type { PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

const AdminSettingsPage = lazy(() =>
  import('@/features/dashboard/bookings/pages/AdminSettingsPage').then((m) => ({
    default: m.AdminSettingsPage,
  }))
);
const BookingDetailPage = lazy(() =>
  import('@/features/dashboard/bookings/pages/BookingDetailPage').then((m) => ({
    default: m.BookingDetailPage,
  }))
);
const BookingsListPage = lazy(() =>
  import('@/features/dashboard/bookings/pages/BookingsListPage').then((m) => ({
    default: m.BookingsListPage,
  }))
);
const NotificationsPage = lazy(() =>
  import('@/features/dashboard/bookings/pages/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  }))
);
const TemplatesPage = lazy(() =>
  import('@/features/dashboard/bookings/pages/TemplatesPage').then((m) => ({
    default: m.TemplatesPage,
  }))
);

export function adminPropertyRoutes(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <>
      <Route path="bookings" element={propertyRoute('bookings', <BookingsListPage />)} />
      <Route
        path="bookings/:bookingId"
        element={propertyRoute('bookings', <BookingDetailPage />)}
      />
      <Route path="notifications" element={propertyRoute('notifications', <NotificationsPage />)} />
      <Route path="templates" element={propertyRoute('templates', <TemplatesPage />)} />
      <Route
        path="staff"
        element={propertyRoute('notifications', <NotificationModuleRedirect module="staff" />)}
      />
      <Route
        path="operations"
        element={propertyRoute('notifications', <NotificationModuleRedirect module="operations" />)}
      />
      <Route path="settings" element={propertyRoute('settings', <AdminSettingsPage />)} />
    </>
  );
}
