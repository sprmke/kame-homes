import { type ReactNode } from 'react';

import { ReviewPropertyScopeContext } from '@/features/reviews/lib/reviewPropertyScopeContext';

/**
 * Pins the review sheets to one listing when the route has no property in it.
 *
 * The property Reviews page gets its listing from the route, so it never needs
 * this. The org rollup mixes listings in one table, so each sheet it opens is
 * wrapped in the row's own property so the scoped hooks follow it.
 */
export function ReviewPropertyScopeProvider({
  propertyId,
  children,
}: {
  propertyId: string | null;
  children: ReactNode;
}) {
  return (
    <ReviewPropertyScopeContext.Provider value={propertyId}>
      {children}
    </ReviewPropertyScopeContext.Provider>
  );
}
