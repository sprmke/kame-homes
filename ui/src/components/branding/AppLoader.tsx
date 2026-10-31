import { useLayoutEffect } from 'react';

import { acquireAppLoader, releaseAppLoader } from '@/components/branding/appLoaderHost';

interface AppLoaderProps {
  /** Fills the viewport. Inline gates keep the same mark, still screen-centered. */
  fullScreen?: boolean;
}

/**
 * Root / global loader. Renders nothing in React — it acquires a singleton DOM host
 * on `document.body` so Suspense and nested route-guard remounts do not restart the
 * sheen animation or flash a blank frame between handoffs.
 *
 * Uses `useLayoutEffect` so the host is on the body before the browser paints (a plain
 * `useEffect` would leave one blank frame on every mount).
 */
export function AppLoader({ fullScreen = false }: AppLoaderProps) {
  useLayoutEffect(() => {
    acquireAppLoader({ fullScreen });
    return () => releaseAppLoader();
  }, [fullScreen]);

  return null;
}
