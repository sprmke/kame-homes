import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Navigate, Route, useParams } from 'react-router-dom';

import { orgPropertiesPath } from '@/features/dashboard/org/lib/tenantPaths';
import type { ParkingRouteFn, PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

const ParkingInboxPage = lazy(() =>
  import('@/features/dashboard/inbox/pages/ParkingInboxPage').then((m) => ({
    default: m.ParkingInboxPage,
  }))
);
const PropertyInboxPage = lazy(() =>
  import('@/features/dashboard/inbox/pages/PropertyInboxPage').then((m) => ({
    default: m.PropertyInboxPage,
  }))
);

/** Legacy org inbox → properties (pick a property to open Guest Inbox). */
export function OrgInboxRedirect() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  return <Navigate to={orgSlug ? orgPropertiesPath(orgSlug) : '/'} replace />;
}

export function propertyInboxRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return <Route path="inbox" element={propertyRoute('inbox', <PropertyInboxPage />)} />;
}

export function parkingInboxRoute(parkingRoute: ParkingRouteFn): ReactNode {
  return <Route path="inbox" element={parkingRoute('inbox', <ParkingInboxPage />)} />;
}
