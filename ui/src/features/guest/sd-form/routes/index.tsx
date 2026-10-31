import { lazy } from 'react';

import { Route } from 'react-router-dom';

const SdFormPage = lazy(() =>
  import('@/features/guest/sd-form/pages/SdFormPage').then((m) => ({ default: m.SdFormPage }))
);

export const sdFormRoutes = [<Route key="sd-form" path="/sd-form" element={<SdFormPage />} />];
