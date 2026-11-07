import { lazy } from 'react';

import { Route } from 'react-router-dom';

const MobileCaptureHandoffPage = lazy(() =>
  import('@/features/verification/pages/MobileCaptureHandoffPage').then((module) => ({
    default: module.MobileCaptureHandoffPage,
  }))
);

/**
 * Phone handoff route. Standalone: it is deliberately outside `MainLayout` and
 * `MarketingLayoutShell`, with no bottom tab bar.
 */
export const verificationRoutes = (
  <Route
    path="/verify/:sessionToken"
    element={<MobileCaptureHandoffPage />}
  />
);
