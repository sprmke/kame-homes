import { createContext, useContext } from 'react';

import type { SuperAdminOrgDetail } from '@/features/dashboard/super-admin/hooks/useSuperAdminOrgs';

export type SuperAdminOrgContextValue = {
  org: SuperAdminOrgDetail;
  slug: string;
};

/** Provided once by `SuperAdminOrgShell` around every hub section. */
export const SuperAdminOrgContext = createContext<SuperAdminOrgContextValue | null>(null);

export function useSuperAdminOrgContext(): SuperAdminOrgContextValue {
  const ctx = useContext(SuperAdminOrgContext);
  if (!ctx) {
    throw new Error('useSuperAdminOrgContext must be used within SuperAdminOrgShell');
  }
  return ctx;
}
