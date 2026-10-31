import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type { PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

import { PropertyMarketingRouteSkeleton } from '@/components/skeletons/RouteSkeletons';

const MarketingStudioPage = lazy(() =>
  import('@/features/dashboard/marketing/pages/MarketingStudioPage').then((m) => ({
    default: m.MarketingStudioPage,
  }))
);

export function marketingPropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <Route
      path="marketing"
      element={propertyRoute(
        'marketing',
        <MarketingStudioPage />,
        <PropertyMarketingRouteSkeleton />
      )}
    />
  );
}
