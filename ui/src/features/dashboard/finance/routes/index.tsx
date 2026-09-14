import { lazy } from 'react';
import type { ReactNode } from 'react';

import { Route } from 'react-router-dom';

import type { PropertyRouteFn } from '@/features/dashboard/org/routes/guards';

const FinancePage = lazy(() =>
  import('@/features/dashboard/finance/pages/FinancePage').then((m) => ({ default: m.FinancePage }))
);

export function financePropertyRoute(propertyRoute: PropertyRouteFn): ReactNode {
  return <Route path="finance" element={propertyRoute('finance', <FinancePage />)} />;
}
