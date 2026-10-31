/** Route helpers for guest marketing UI (mirrors PMA `config/routes.ts` subset). */

import { HOST_LOGIN_PATH } from '@/features/guest/auth/lib/hostAuthPaths';

export const ROUTES = {
  home: '/',
  login: HOST_LOGIN_PATH,
  property: {
    /** Admin bookings — requires auth. */
    bookings: (_propertySlug: string) => HOST_LOGIN_PATH,
  },
} as const;

export type Routes = typeof ROUTES;
