import { Routes } from 'react-router-dom';

import { guestRoutes } from '@/features/guest/routes';

import { dashboardRoutes } from '@/features/dashboard/routes';

export function AppRoutes() {
  return (
    <Routes>
      {guestRoutes}
      {dashboardRoutes}
    </Routes>
  );
}
