import { Fragment } from 'react';
import type { ReactNode } from 'react';

import { activityParkingRoute, activityPropertyRoute } from '@/features/dashboard/activity/routes';
import { analyticsPropertyRoute } from '@/features/dashboard/analytics/routes';
import {
  hostAnnouncementsParkingRoute,
  hostAnnouncementsPropertyRoute,
} from '@/features/dashboard/announcements/routes';
import { adminPropertyRoutes } from '@/features/dashboard/bookings/routes/propertyRoutes';
import { customPagesPropertyRoute } from '@/features/dashboard/custom-pages/routes';
import { financePropertyRoute } from '@/features/dashboard/finance/routes';
import {
  helpSupportParkingRoute,
  helpSupportPropertyRoute,
} from '@/features/dashboard/help-support/routes';
import { propertyInboxRoute } from '@/features/dashboard/inbox/routes';
import { propertyReviewsRoute } from '@/features/reviews/routes';
import { maintenancePropertyRoute } from '@/features/dashboard/maintenance/routes';
import { marketingPropertyRoute } from '@/features/dashboard/marketing/routes';
import {
  legacyAdminRedirects,
  orgAdminRoutes,
  orgOnboardingRoutes,
  parkingShellRoute,
  propertyShellRoute,
} from '@/features/dashboard/org/routes';
import { orgRoute, parkingRoute, propertyRoute } from '@/features/dashboard/org/routes/guards';
import { parkingAdminRoutes } from '@/features/dashboard/parking/routes';
import { propertyPlansRoute } from '@/features/dashboard/plans/routes';
import { pricingPropertyRoute } from '@/features/dashboard/pricing/routes';
import { dashboardPropertyRoute } from '@/features/dashboard/property/routes';
import { superAdminRoutes } from '@/features/dashboard/super-admin/routes';
import {
  parkingTeamRoute,
  propertyTeamRoute,
  teamAuthRoutes,
} from '@/features/dashboard/team/routes';

/** Dashboard / admin routes: org, property shell, bookings, finance, etc. */
export const dashboardRoutes: ReactNode[] = [
  superAdminRoutes,
  teamAuthRoutes,
  <Fragment key="org-onboarding">{orgOnboardingRoutes}</Fragment>,
  <Fragment key="org-admin">{orgAdminRoutes(orgRoute)}</Fragment>,
  <Fragment key="property-shell">
    {propertyShellRoute(
      <>
        {dashboardPropertyRoute(propertyRoute)}
        {adminPropertyRoutes(propertyRoute)}
        {customPagesPropertyRoute(propertyRoute)}
        {financePropertyRoute(propertyRoute)}
        {pricingPropertyRoute(propertyRoute)}
        {analyticsPropertyRoute(propertyRoute)}
        {maintenancePropertyRoute(propertyRoute)}
        {marketingPropertyRoute(propertyRoute)}
        {propertyTeamRoute(propertyRoute)}
        {propertyInboxRoute(propertyRoute)}
        {propertyReviewsRoute(propertyRoute)}
        {activityPropertyRoute(propertyRoute)}
        {hostAnnouncementsPropertyRoute(propertyRoute)}
        {helpSupportPropertyRoute(propertyRoute)}
        {propertyPlansRoute()}
      </>
    )}
  </Fragment>,
  <Fragment key="parking-shell">
    {parkingShellRoute(
      <>
        {parkingAdminRoutes(parkingRoute)}
        {parkingTeamRoute(parkingRoute)}
        {activityParkingRoute(parkingRoute)}
        {hostAnnouncementsParkingRoute(parkingRoute)}
        {helpSupportParkingRoute(parkingRoute)}
      </>
    )}
  </Fragment>,
  <Fragment key="legacy-admin">{legacyAdminRedirects}</Fragment>,
];

/** @deprecated Use `dashboardRoutes` */
export const adminRoutes = dashboardRoutes;
