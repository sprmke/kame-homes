import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type { PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

import { PropertyReviewsRouteSkeleton } from '@/components/skeletons/RouteSkeletons';

const PropertyReviewsPage = lazy(() =>
  import('@/features/reviews/pages/PropertyReviewsPage').then((m) => ({
    default: m.PropertyReviewsPage,
  }))
);

export function propertyReviewsRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <Route
      path="reviews"
      element={propertyRoute('reviews', <PropertyReviewsPage />, <PropertyReviewsRouteSkeleton />)}
    />
  );
}
