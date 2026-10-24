import { createContext, useContext } from 'react';

import { usePropertyIdParam } from '@/features/dashboard/org/lib/adminApiScope';

export const ReviewPropertyScopeContext = createContext<string | null>(null);

/** The listing a review action belongs to: the pinned one, else the route's. */
export function useReviewPropertyId(): string | null {
  const pinned = useContext(ReviewPropertyScopeContext);
  const routeProperty = usePropertyIdParam();
  return pinned ?? routeProperty;
}
