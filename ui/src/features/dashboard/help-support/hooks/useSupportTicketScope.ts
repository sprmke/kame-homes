import { useSupportTicketScopeOverride } from '@/features/dashboard/help-support/context/SupportTicketScopeContext';
import {
  useOrgIdParam,
  useOrgSlugParam,
  useParkingIdParam,
  usePropertyIdParam,
} from '@/features/dashboard/org/lib/adminApiScope';

import type { SupportTicketScopeParams } from '../lib/supportTicketApi';

/** Org/property/parking scope from admin routes or an explicit provider override. */
export function useSupportTicketScope(): SupportTicketScopeParams {
  const override = useSupportTicketScopeOverride();
  const routeScope: SupportTicketScopeParams = {
    orgSlug: useOrgSlugParam(),
    orgId: useOrgIdParam(),
    propertyId: usePropertyIdParam(),
    parkingId: useParkingIdParam(),
  };

  if (!override) return routeScope;

  // Spread override so explicit nulls (guest explore) win over route org context, and
  // `channel: 'guest'` is preserved — required for scopeEnabled + guest API queries.
  return { ...routeScope, ...override };
}
