import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Navigate, Route } from 'react-router-dom';

import type { PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

import { PropertyPricingRouteSkeleton } from '@/components/skeletons/RouteSkeletons';

const PropertyPricingPage = lazy(() =>
  import('@/features/dashboard/pricing/pages/PropertyPricingPage').then((m) => ({
    default: m.PropertyPricingPage,
  }))
);

export function pricingPropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <>
      <Route
        path="pricing"
        element={propertyRoute(
          'pricing',
          <PropertyPricingPage />,
          <PropertyPricingRouteSkeleton />
        )}
      />
      <Route path="calendar" element={<Navigate to="../pricing" replace />} />
    </>
  );
}
