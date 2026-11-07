import { Routes } from 'react-router-dom';

import { guestRoutes } from '@/features/guest/routes';

import { dashboardRoutes } from '@/features/dashboard/routes';

import { launchRoutes } from '@/features/launch/routes';
import { verificationRoutes } from '@/features/verification/routes';


export function AppRoutes() {
  return (
    <Routes>
      {/* `/app` first: the installed-app launch resolver, valid for every audience. */}
      {launchRoutes}
      {guestRoutes}
      {dashboardRoutes}
      {/* Standalone phone handoff — outside every layout on purpose. */}
      {verificationRoutes}
    </Routes>
  );
}
