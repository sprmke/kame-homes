import { createContext, useContext, type ReactNode } from 'react';

import { useIsBelowLg, useIsBelowXl } from '@/hooks/useMediaQuery';

type DashboardChromeContextValue = {
  /** Narrow desktop or AI canvas: tighter KPI and date controls. */
  compact: boolean;
};

const DashboardChromeContext = createContext<DashboardChromeContextValue>({ compact: false });

type ProviderProps = {
  aiMode: boolean;
  canvasOpen: boolean;
  children: ReactNode;
};

/**
 * Compact chrome when the main dashboard column is tight: AI mode canvas open,
 * or advanced mode on viewports between lg and xl (sidebar + ~720px content).
 */
export function resolveDashboardCompactChrome(
  aiMode: boolean,
  canvasOpen: boolean,
  isDesktop: boolean,
  isBelowXl: boolean
): boolean {
  return isDesktop && ((aiMode && canvasOpen) || (!aiMode && isBelowXl));
}

export function DashboardChromeProvider({ aiMode, canvasOpen, children }: ProviderProps) {
  const isDesktop = !useIsBelowLg();
  const isBelowXl = useIsBelowXl();
  const compact = resolveDashboardCompactChrome(aiMode, canvasOpen, isDesktop, isBelowXl);

  return (
    <DashboardChromeContext.Provider value={{ compact }}>
      {children}
    </DashboardChromeContext.Provider>
  );
}

export function useDashboardCompactChrome(): boolean {
  return useContext(DashboardChromeContext).compact;
}
