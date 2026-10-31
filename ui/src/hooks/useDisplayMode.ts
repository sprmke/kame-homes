import { useEffect, useState } from 'react';

import { isIos, isStandalone } from '@/lib/pwa/capabilities';

export type DisplayMode = {
  /** Launched from a home-screen / desktop install (not a browser tab). */
  standalone: boolean;
  isIos: boolean;
};

/**
 * Tracks whether the app is running installed. Re-evaluates on `display-mode`
 * changes (e.g. the user installs mid-session, or launches the installed app).
 */
export function useDisplayMode(): DisplayMode {
  const [standalone, setStandalone] = useState(isStandalone);

  useEffect(() => {
    const queries = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'].map((m) =>
      window.matchMedia(`(display-mode: ${m})`)
    );
    const update = () => setStandalone(isStandalone());
    queries.forEach((q) => q.addEventListener('change', update));
    window.addEventListener('appinstalled', update);
    return () => {
      queries.forEach((q) => q.removeEventListener('change', update));
      window.removeEventListener('appinstalled', update);
    };
  }, []);

  return { standalone, isIos: isIos() };
}
