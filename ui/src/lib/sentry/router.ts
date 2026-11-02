import type { createBrowserRouter } from 'react-router-dom';

import * as Sentry from '@sentry/react';

import { isSentrySdkEnabled } from './init';

/**
 * Keeps the `@sentry/*` import inside `lib/sentry/**`.
 *
 * Without this wrapper every navigation is anonymous to Sentry and a slow page cannot be
 * attributed to a route. The SDK pairs with `reactRouterBrowserTracingIntegration` in
 * `init.ts` (same options), so the two must stay in step.
 */
export function wrapRouterForSentry<T extends typeof createBrowserRouter>(factory: T): T {
  if (!isSentrySdkEnabled) return factory;
  try {
    return Sentry.wrapCreateBrowserRouter(factory) as T;
  } catch {
    // A router that will not wrap is still a working router; losing route naming beats a
    // blank page.
    return factory;
  }
}
