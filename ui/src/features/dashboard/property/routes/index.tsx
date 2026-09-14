import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type { PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

const DashboardPage = lazy(() =>
  import('@/features/dashboard/property/pages/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  }))
);

export function dashboardPropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return <Route index element={propertyRoute('dashboard', <DashboardPage />)} />;
}
