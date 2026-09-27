import { useEffect } from 'react';

import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { RuntimeErrorFallback } from '@/components/error/RuntimeErrorFallback';
import { captureAppException } from '@/lib/posthog/capture';
import { captureSentryException } from '@/lib/sentry/client';

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (isRouteErrorResponse(error)) {
    return new Error(`${error.status} ${error.statusText}`);
  }
  return new Error(typeof error === 'string' ? error : 'Unknown route error');
}

/**
 * React Router data-router crash UI. Render errors inside `RouterProvider` are
 * caught by the route `errorElement`, not by an outer React error boundary —
 * without this, users see RR's default "Unexpected Application Error!" page.
 */
export function RouteErrorFallback() {
  const routeError = useRouteError();

  useEffect(() => {
    const error = toError(routeError);
    console.error('[RouteErrorFallback]', error);
    captureAppException(error, { source: 'route-error-element' });
    captureSentryException(error, { source: 'route-error-element' });
  }, [routeError]);

  return (
    <RuntimeErrorFallback
      onReload={() => {
        window.location.reload();
      }}
    />
  );
}
