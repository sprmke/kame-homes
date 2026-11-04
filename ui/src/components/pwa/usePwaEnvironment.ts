import { useMemo } from 'react';

import { useDisplayMode } from '@/hooks/useDisplayMode';
import { detectPlatform, type PlatformInfo } from '@/lib/pwa/platform';

/**
 * Browser/OS facts every PWA surface needs, resolved once per render.
 * `useDisplayMode` supplies the reactive standalone flag (install/uninstall,
 * display-mode change); the rest is static for the page's lifetime.
 */
export function usePwaEnvironment(): {
  platform: PlatformInfo;
  standalone: boolean;
} {
  const { standalone } = useDisplayMode();
  const platform = useMemo(
    () =>
      detectPlatform({
        ua: typeof navigator === 'undefined' ? '' : navigator.userAgent,
        platform: typeof navigator === 'undefined' ? '' : navigator.platform,
        maxTouchPoints: typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
      }),
    []
  );
  return { platform, standalone };
}
