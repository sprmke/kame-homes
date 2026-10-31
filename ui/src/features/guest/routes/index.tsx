import { guestAuthRoutes } from '@/features/guest/auth/routes';
import { marketingRoutes } from '@/features/guest/marketing/routes';
import { legacyGuestRedirects, propertyGuestRoutes } from '@/features/guest/property/routes';

/** Guest-facing routes: marketing site + property-scoped operational flows. */
export const guestRoutes = [
  ...marketingRoutes,
  ...guestAuthRoutes,
  ...propertyGuestRoutes,
  ...legacyGuestRedirects,
];
