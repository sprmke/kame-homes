import { createContext, useContext, useLayoutEffect } from 'react';

export const AdminLayoutFillMainContext = createContext<((fill: boolean) => void) | null>(null);
export const AdminLayoutFillMainActiveContext = createContext(false);

/** Opt into full-height main column (e.g. inbox) when AdminLayout wraps the route shell.
 *  Multiple callers are ref-counted so cleanup from one page does not clear another's claim.
 */
export function useAdminLayoutFillMain(enabled: boolean) {
  const setFillMain = useContext(AdminLayoutFillMainContext);

  useLayoutEffect(() => {
    if (!enabled || !setFillMain) return;
    setFillMain(true);
    return () => setFillMain(false);
  }, [enabled, setFillMain]);
}

/** True when a descendant has opted into fill-main (Settings / Notifications / Inbox). */
export function useAdminLayoutIsFillMain(): boolean {
  return useContext(AdminLayoutFillMainActiveContext);
}
