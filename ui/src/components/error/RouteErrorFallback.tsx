import { useEffect, useState } from 'react';

import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { RuntimeErrorFallback } from '@/components/error/RuntimeErrorFallback';
import { isChunkLoadError, reloadForChunkError } from '@/lib/chunkReload';
import { captureAppException } from '@/lib/posthog/capture';
import { captureRenderError } from '@/lib/sentry/capture';

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
  const [reference, setReference] = useState<string | undefined>(undefined);

  useEffect(() => {
    const error = toError(routeError);
    if (isChunkLoadError(error) && reloadForChunkError()) return;
    // A 404 is a user outcome, not a fault. The router already renders its own page for
    // it, and paging on every bad link trains people to ignore alerts.
    const isNotFound = isRouteErrorResponse(routeError) && routeError.status === 404;
    console.error('[RouteErrorFallback]', error);
    if (isNotFound) return;
    captureAppException(error, { source: 'route-error-element' });
    const eventId = captureRenderError(error, null);
    if (eventId) setReference(eventId);
  }, [routeError]);

  return (
    <RuntimeErrorFallback
      reference={reference}
      onReload={() => {
        window.location.reload();
      }}
    />
  );
}
