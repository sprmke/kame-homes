import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import { helpSupportAnnouncementsRedirectRoute } from '@/features/dashboard/announcements/routes';
import { HelpSupportLayout } from '@/features/dashboard/help-support/components/HelpSupportLayout';
import type { ParkingRouteFn, PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

const HelpDocumentationPage = lazy(() =>
  import('@/features/dashboard/help-support/pages/HelpDocumentationPage').then((m) => ({
    default: m.HelpDocumentationPage,
  }))
);
const HelpSupportOverviewPage = lazy(() =>
  import('@/features/dashboard/help-support/pages/HelpSupportOverviewPage').then((m) => ({
    default: m.HelpSupportOverviewPage,
  }))
);
const TicketsWorkspacePage = lazy(() =>
  import('@/features/dashboard/help-support/pages/TicketsWorkspacePage').then((m) => ({
    default: m.TicketsWorkspacePage,
  }))
);

function helpSupportNestedRoutes(): ReactNode {
  return (
    <>
      <Route index element={<HelpSupportOverviewPage />} />
      <Route path="docs" element={<HelpDocumentationPage />} />
      {helpSupportAnnouncementsRedirectRoute()}
      <Route path="tickets/*" element={<TicketsWorkspacePage />} />
    </>
  );
}

export function helpSupportPropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return (
    <Route path="help-support" element={propertyRoute('help-support', <HelpSupportLayout />)}>
      {helpSupportNestedRoutes()}
    </Route>
  );
}

export function helpSupportParkingRoute(parkingRoute: ParkingRouteFn): ReactNode {
  return (
    <Route path="help-support" element={parkingRoute('help-support', <HelpSupportLayout />)}>
      {helpSupportNestedRoutes()}
    </Route>
  );
}

export function helpSupportOrgNestedRoutes(): ReactNode {
  return helpSupportNestedRoutes();
}
