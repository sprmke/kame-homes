import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type { PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

import { PropertyMaintenanceRouteSkeleton } from '@/components/skeletons/RouteSkeletons';

const MaintenancePage = lazy(() =>
  import('@/features/dashboard/maintenance/pages/MaintenancePage').then((m) => ({
    default: m.MaintenancePage,
  }))
);

export function maintenancePropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <Route
      path="maintenance"
      element={propertyRoute(
        'maintenance',
        <MaintenancePage />,
        <PropertyMaintenanceRouteSkeleton />
      )}
    />
  );
}
