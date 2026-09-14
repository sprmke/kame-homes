import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type { PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

const PropertyAnalyticsPage = lazy(() =>
  import('@/features/dashboard/analytics/pages/PropertyAnalyticsPage').then((m) => ({
    default: m.PropertyAnalyticsPage,
  }))
);

export function analyticsPropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return <Route path="analytics" element={propertyRoute('analytics', <PropertyAnalyticsPage />)} />;
}
