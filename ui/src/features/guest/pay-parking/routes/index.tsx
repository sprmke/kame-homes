import { lazy } from 'react';

import { Route } from 'react-router-dom';

const PayParkingPage = lazy(() =>
  import('@/features/guest/pay-parking/pages/PayParkingPage').then((m) => ({
    default: m.PayParkingPage,
  }))
);

/** Public pay-parking form — guests and admins (no auth required). */
export const payParkingRoutes = [
  <Route
    key="pay-parking-by-id"
    path="/bookings/:bookingId/parking"
    element={<PayParkingPage />}
  />,
];
