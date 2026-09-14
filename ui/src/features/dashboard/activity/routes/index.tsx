import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type { ParkingRouteFn, PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

const ActivityLogRedirect = lazy(() =>
  import('@/features/dashboard/activity/pages/ActivityLogRedirect').then((m) => ({
    default: m.ActivityLogRedirect,
  }))
);

export function activityPropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <Route
      path="activity"
      element={propertyRoute('activity', <ActivityLogRedirect scope="property" />)}
    />
  );
}

export function activityParkingRoute(parkingRoute: ParkingRouteFn): ReactNode {
  return (
    <Route
      path="activity"
      element={parkingRoute('activity', <ActivityLogRedirect scope="parking" />)}
    />
  );
}
